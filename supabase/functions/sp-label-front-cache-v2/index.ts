import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Save original photos only after the user's explicit opt-in and a qualified
// analysis was persisted. Scores and ingredients are NEVER accepted from client.
const VERSION = "SP-LABEL-FRONT-ONLY/2.2";
const BUCKET = "sp-label-evidence-private-v1";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_ORIGINS = new Set([
  "https://safeproducts.in", "https://www.safeproducts.in",
  "https://safeproducts-777273687940.asia-south1.run.app",
  "https://safeproducts.lovable.app"
]);
function corsHeaders(origin: string | null) {
  return {
    ...(origin && ALLOWED_ORIGINS.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
    "Access-Control-Max-Age": "600",
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;

function adminKey(): string {
  const name = Deno.env.get("SP_LABEL_ADMIN_KEY_NAME") ?? "default";
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
    const key = keys[name] ?? keys.default;
    if (key) return key;
  } catch { /* Legacy project secret. */ }
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("SERVER_KEY_UNAVAILABLE");
  return key;
}
function adminHeaders(key: string): Record<string, string> {
  return { apikey: key, ...(key.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${key}` }) };
}
async function decodeImage(dataUrl: string) {
  const match = /^data:image\/(jpeg|png|webp);base64,([a-z0-9+/=]+)$/i.exec(dataUrl);
  if (!match || dataUrl.length > 14_500_000) throw new Error("INVALID_IMAGE");
  const subtype = match[1].toLowerCase();
  const decoded = atob(match[2]);
  if (!decoded.length || decoded.length > MAX_IMAGE_BYTES) throw new Error("IMAGE_SIZE_INVALID");
  const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
  const magic = subtype === "png"
    ? bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    : subtype === "jpeg"
      ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
        String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!magic) throw new Error("IMAGE_SIGNATURE_INVALID");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const imageHash = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, "0")).join("");
  const textDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(dataUrl));
  const dataUrlHash = Array.from(new Uint8Array(textDigest), x => x.toString(16).padStart(2, "0")).join("");
  return { bytes, imageHash, dataUrlHash, mime: "image/" + subtype, ext: subtype === "jpeg" ? "jpg" : subtype };
}
Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  function reply(code: string, status: number, more: Record<string, unknown> = {}) {
    return new Response(JSON.stringify({ success: status < 300, code, version: VERSION, ...more }), {
      status,
      headers: { ...corsHeaders(origin), "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  }
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== "POST") return reply("METHOD_NOT_ALLOWED", 405);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 15_500_000) return reply("PAYLOAD_TOO_LARGE", 413);
  const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  if (!base) return reply("SERVER_CONFIGURATION_MISSING", 503);

  let key: string;
  try { key = adminKey(); } catch { return reply("SERVER_CONFIGURATION_MISSING", 503); }
  const jwt = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt || jwt.split(".").length !== 3) return reply("AUTH_REQUIRED", 401);
  // Verify signature/expiry via Supabase Auth, never trust a decoded JWT subject.
  const auth = await fetch(`${base}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? key },
    signal: AbortSignal.timeout(5_000),
  }).catch(() => null);
  if (!auth?.ok) return reply("AUTH_REQUIRED", 401);
  const principal = await auth.json().catch(() => null);
  const ownerId = principal?.id;
  if (typeof ownerId !== "string" || !UUID.test(ownerId)) return reply("AUTH_REQUIRED", 401);

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return reply("INVALID_JSON", 400); }
  // The submission notice states that only the product front photo is retained.
  // There is no independent checkbox or ingredient-photo upload path.
  const scanId = body.scanId;
  const expectedImageHash = body.imageSha256;
  if (typeof scanId !== "string" || !UUID.test(scanId)
      || typeof expectedImageHash !== "string" || !HASH.test(expectedImageHash)
      || typeof body.imageDataUrl !== "string"
      || body.role !== "front") return reply("FRONT_IMAGE_ONLY", 422);

  let image: Awaited<ReturnType<typeof decodeImage>>;
  try { image = await decodeImage(body.imageDataUrl); }
  catch { return reply("INVALID_IMAGE", 422); }
  if (image.imageHash !== expectedImageHash.toLowerCase()) return reply("IMAGE_HASH_MISMATCH", 422);
  // Verify the signed-in owner, exact front hash and non-UNDTERMINED
  // M1-B score saved by a privileged authenticated analysis endpoint.
  const ah = adminHeaders(key);
  const url = `${base}/rest/v1/sp_web_label_pack_scan_v1?id=eq.${scanId}&owner_id=eq.${ownerId}&select=id,front_sha256,score_status,product_id`;
  const response = await fetch(url, { headers: ah, signal: AbortSignal.timeout(6_000) }).catch(() => null);
  if (!response?.ok) return reply("PACK_SCAN_LOOKUP_FAILED", 503);
  const records = await response.json().catch(() => []);
  const scan = Array.isArray(records) ? records[0] : null;
  if (!scan || scan.front_sha256 !== image.imageHash || !["QUALIFIED", "PROVISIONAL", "UNDETERMINED"].includes(scan.score_status)) {
    return reply("REGISTERED_EXACT_FRONT_SCAN_REQUIRED", 409);
  }
  const exists = await fetch(
    `${base}/rest/v1/sp_web_label_front_asset_v1?scan_id=eq.${scanId}&select=front_sha256`,
    {headers:ah,signal:AbortSignal.timeout(6_000)}
  ).catch(() => null);
  if (!exists?.ok) return reply("FRONT_LOOKUP_FAILED", 503);
  const found = await exists.json().catch(() => []);
  if (found.length) return found[0].front_sha256 === image.imageHash
    ? reply("FRONT_ALREADY_STORED", 200, {stored:true})
    : reply("FRONT_CONFLICT", 409);
  const objectPath = `${ownerId}/${scanId}/front-${image.imageHash}.${image.ext}`;
  const storageResponse = await fetch(`${base}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: { ...ah, "content-type": image.mime, "x-upsert": "true", "cache-control": "private, max-age=0" },
    body: image.bytes,
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!storageResponse?.ok) { console.warn("SafeProducts front upload:",storageResponse?.status??"NETWORK_FAILURE"); return reply("PRIVATE_IMAGE_STORAGE_FAILED", 503); }

  const saveResponse = await fetch(`${base}/rest/v1/sp_web_label_front_asset_v1?on_conflict=scan_id`, {
    method: "POST",
    headers: { ...ah, "content-type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({
      scan_id: scanId, owner_id: ownerId, front_sha256: image.imageHash,
      storage_bucket: BUCKET, storage_path: objectPath, mime_type: image.mime, byte_count: image.bytes.length,
    }),
    signal: AbortSignal.timeout(7_000),
  }).catch(() => null);
  if (!saveResponse?.ok) { console.warn("SafeProducts front metadata:",saveResponse?.status??"NETWORK_FAILURE"); return reply("IMAGE_METADATA_PERSISTENCE_FAILED", 503); }
  return reply("FRONT_IMAGE_SAVED", 201, { stored: true });
});
