import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MAX_AUDIO_DATA_URL_CHARS = 4_000_000;
const MAX_AUDIO_BYTES = 2_500_000;
const AUTO_VOICE_EDGE_URL = "https://wmxbdirvlwuagouraobr.supabase.co/functions/v1/sp-voice-auto-transcribe-v1";

// The legacy anon JWT is a public project key (not a service-role secret). It is
// used only as a server-to-edge authentication fallback when the deployment
// does not expose a legacy anon-key environment variable. The Edge Function
// keeps the paid Make/OpenAI webhook encrypted in Vault and rate-limits calls.
const PUBLIC_LEGACY_ANON_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndteGJkaXJ2bHd1YWdvdXJhb2JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTAwODgsImV4cCI6MjA5MjI2NjA4OH0.JMmfyKke6NkMYRkOsHi3WCG-_xAVvh-6BEo7v0mLMDA";

const InputSchema = z.object({
  audioDataUrl: z.string().min(32).max(MAX_AUDIO_DATA_URL_CHARS),
});

export type AutoVoiceResult = {
  ok: boolean;
  status:
    | "READY"
    | "UNAVAILABLE"
    | "INVALID_AUDIO"
    | "TRANSCRIPTION_FAILED"
    | "TIMED_OUT"
    | "RATE_LIMITED";
  transcript: string | null;
  detectedLanguage: "en" | "hi" | "pa" | null;
};

const unavailable = (status: AutoVoiceResult["status"] = "UNAVAILABLE"): AutoVoiceResult => ({
  ok: false,
  status,
  transcript: null,
  detectedLanguage: null,
});

function legacyAnonJwt() {
  const configured = process.env.SUPABASE_ANON_KEY?.trim() || process.env.VITE_SUPABASE_ANON_KEY?.trim();
  return configured?.startsWith("eyJ") ? configured : PUBLIC_LEGACY_ANON_JWT;
}

function autoVoiceConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim() || (AUTO_VOICE_EDGE_URL && legacyAnonJwt()));
}

export const getAutoVoiceCapability = createServerFn({ method: "GET" }).handler(async () => ({
  available: autoVoiceConfigured(),
}));

function parseAudioDataUrl(value: string): { mimeType: string; bytes: Uint8Array } | null {
  const match = /^data:(audio\/[a-z0-9.+-]+)(?:;codecs=[^;,]+)?;base64,([a-z0-9+/=]+)$/i.exec(value);
  if (!match) return null;

  const mimeType = match[1].toLowerCase();
  if (!["audio/webm", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/m4a"].includes(mimeType)) {
    return null;
  }

  try {
    const binary = atob(match[2]);
    if (binary.length < 256 || binary.length > MAX_AUDIO_BYTES) return null;
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { mimeType, bytes };
  } catch {
    return null;
  }
}

function extensionFor(mimeType: string) {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("m4a")) return "m4a";
  return "mp4";
}

function detectedLanguage(payload: Record<string, unknown>): "en" | "hi" | "pa" | null {
  const languages = Array.isArray(payload.languages) ? payload.languages : [];
  for (const item of languages) {
    const code = typeof item === "string"
      ? item
      : item && typeof item === "object" && typeof (item as { code?: unknown }).code === "string"
        ? (item as { code: string }).code
        : "";
    const normalized = code.toLowerCase().split("-")[0];
    if (normalized === "en" || normalized === "hi" || normalized === "pa") return normalized;
  }
  return null;
}

function detectedLanguageFromText(text: string): "en" | "hi" | "pa" | null {
  if (/[\u0A00-\u0A7F]/u.test(text)) return "pa";
  if (/[\u0900-\u097F]/u.test(text)) return "hi";
  if (/[A-Za-z]/u.test(text)) return "en";
  return null;
}

async function transcribeDirectOpenAI(
  parsed: { mimeType: string; bytes: Uint8Array },
  apiKey: string,
): Promise<AutoVoiceResult> {
  const audioBuffer = parsed.bytes.slice().buffer as ArrayBuffer;
  const form = new FormData();
  form.append("file", new Blob([audioBuffer], { type: parsed.mimeType }), `voice.${extensionFor(parsed.mimeType)}`);
  form.append("model", "gpt-transcribe");
  form.append("response_format", "json");
  // Candidate-language hints let the transcription model identify English,
  // Hindi, Punjabi, or code-switching without asking the user to preselect a locale.
  form.append("languages[]", "en");
  form.append("languages[]", "hi");
  form.append("languages[]", "pa");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!response.ok) return unavailable("TRANSCRIPTION_FAILED");

    const text = await response.text();
    if (text.length > 100_000) return unavailable("TRANSCRIPTION_FAILED");

    let payload: unknown;
    try { payload = JSON.parse(text); } catch { return unavailable("TRANSCRIPTION_FAILED"); }
    if (!payload || typeof payload !== "object") return unavailable("TRANSCRIPTION_FAILED");

    const record = payload as Record<string, unknown>;
    const transcript = typeof record.text === "string" ? record.text.trim() : "";
    if (!transcript || transcript.length > 500) return unavailable("TRANSCRIPTION_FAILED");

    return {
      ok: true,
      status: "READY",
      transcript,
      detectedLanguage: detectedLanguage(record) ?? detectedLanguageFromText(transcript),
    };
  } catch {
    return unavailable(controller.signal.aborted ? "TIMED_OUT" : "TRANSCRIPTION_FAILED");
  } finally {
    clearTimeout(timer);
  }
}

async function transcribeSecureFallback(
  parsed: { mimeType: string; bytes: Uint8Array },
): Promise<AutoVoiceResult> {
  const token = legacyAnonJwt();
  if (!token) return unavailable();

  const audioBuffer = parsed.bytes.slice().buffer as ArrayBuffer;
  const form = new FormData();
  form.append("audio", new Blob([audioBuffer], { type: parsed.mimeType }), `voice.${extensionFor(parsed.mimeType)}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50_000);
  try {
    const response = await fetch(AUTO_VOICE_EDGE_URL, {
      method: "POST",
      signal: controller.signal,
      redirect: "error",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: token,
      },
      body: form,
    });

    if (response.status === 429) return unavailable("RATE_LIMITED");
    if (!response.ok) return unavailable("TRANSCRIPTION_FAILED");

    const text = await response.text();
    if (text.length > 20_000) return unavailable("TRANSCRIPTION_FAILED");
    let payload: unknown;
    try { payload = JSON.parse(text); } catch { return unavailable("TRANSCRIPTION_FAILED"); }
    if (!payload || typeof payload !== "object") return unavailable("TRANSCRIPTION_FAILED");

    const record = payload as Record<string, unknown>;
    const transcript = record.success === true && typeof record.text === "string" ? record.text.trim() : "";
    if (!transcript || transcript.length > 500) return unavailable("TRANSCRIPTION_FAILED");

    return {
      ok: true,
      status: "READY",
      transcript,
      detectedLanguage: detectedLanguageFromText(transcript),
    };
  } catch {
    return unavailable(controller.signal.aborted ? "TIMED_OUT" : "TRANSCRIPTION_FAILED");
  } finally {
    clearTimeout(timer);
  }
}

export const transcribeAutoVoice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<AutoVoiceResult> => {
    const parsed = parseAudioDataUrl(data.audioDataUrl);
    if (!parsed) return unavailable("INVALID_AUDIO");

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (apiKey) {
      const direct = await transcribeDirectOpenAI(parsed, apiKey);
      if (direct.ok || direct.status === "INVALID_AUDIO" || direct.status === "RATE_LIMITED") return direct;
      // A transient direct-provider failure may still be recovered by the
      // managed SafeProducts transcription route below.
    }

    return transcribeSecureFallback(parsed);
  });
