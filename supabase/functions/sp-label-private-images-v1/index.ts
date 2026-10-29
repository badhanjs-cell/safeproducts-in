import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Save original photos only after the user's explicit opt-in and a qualified
// analysis was persisted. Scores and ingredients are NEVER accepted from client.
const VERSION = "SP-LABEL-PRIVATE-IMAGES/1.0";
const BUCKET = "sp-label-evidence-private-v1";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;

function reply(code: string, status: number, more: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ success: status < 300, code, version: VERSION, ...more }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}
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
  if (body.consent !== true) return reply("IMAGE_STORAGE_CONSENT_REQUIRED", 422);
  const analysisId = body.analysisId;
  const role = body.role;
  const expectedImageHash = body.imageSha256;
  const ingredientHash = body.ingredientImageSha256;
  if (typeof analysisId !== "string" || !UUID.test(analysisId)
      || (role !== "front" && role !== "ingredients")
      || typeof expectedImageHash !== "string" || !HASH.test(expectedImageHash)
      || typeof ingredientHash !== "string" || !HASH.test(ingredientHash)
      || typeof body.imageDataUrl !== "string") return reply("INVALID_IMAGE_METADATA", 400);

  let image: Awaited<ReturnType<typeof decodeImage>>;
  try { image = await decodeImage(body.imageDataUrl); }
  catch { return reply("INVALID_IMAGE", 422); }
  if (image.imageHash !== expectedImageHash.toLowerCase()) return reply("IMAGE_HASH_MISMATCH", 422);
  if (role === "ingredients" && image.imageHash !== ingredientHash.toLowerCase()) return reply("INGREDIENT_HASH_MISMATCH", 422);
  if (role === "front" && image.imageHash === ingredientHash.toLowerCase()) return reply("DUPLICATE_IMAGE_ROLE", 422);

  const ah = adminHeaders(key);
  const analysisResponse = await fetch(
    `${base}/rest/v1/sp_web_label_analyses_v1?id=eq.${analysisId}&select=id,image_sha256,safety_score,profile_used,engine_version`,
    { headers: ah, signal: AbortSignal.timeout(6_000) },
  ).catch(() => null);
  if (!analysisResponse?.ok) return reply("ANALYSIS_LOOKUP_FAILED", 503);
  const analyses = await analysisResponse.json().catch(() => []);
  const record = Array.isArray(analyses) ? analyses[0] : null;
  if (!record || record.safety_score === null || !record.engine_version) {
    return reply("QUALIFIED_ANALYSIS_NOT_FOUND_FOR_IMAGE", 409);
  }
  const recordedHash = String(record.image_sha256).toLowerCase();
  // The ingredient panel is the evidence anchor; legacy stored its data-URL
  // digest, while M1-B stores SHA-256 of the original image bytes.
  if (role === "ingredients" && ![image.imageHash, image.dataUrlHash].includes(recordedHash)) {
    return reply("ANALYSIS_IMAGE_MISMATCH", 409);
  }
  if (role === "front") {
    const proof = await fetch(
      `${base}/rest/v1/sp_web_label_private_images_v1?analysis_id=eq.${analysisId}&owner_id=eq.${ownerId}&image_role=eq.ingredients&select=image_sha256`,
      { headers: ah, signal: AbortSignal.timeout(6_000) },
    ).catch(() => null);
    if (!proof?.ok) return reply("INGREDIENT_PROOF_LOOKUP_FAILED", 503);
    const savedIngredients = await proof.json().catch(() => []);
    if (!Array.isArray(savedIngredients) || savedIngredients[0]?.image_sha256 !== ingredientHash.toLowerCase()) {
      return reply("INGREDIENT_PHOTO_MUST_BE_SAVED_FIRST", 409);
    }
  }

  const metaUrl = `${base}/rest/v1/sp_web_label_private_images_v1?analysis_id=eq.${analysisId}&owner_id=eq.${ownerId}&image_role=eq.${role}&select=image_sha256`;
  const existsResponse = await fetch(metaUrl, { headers: ah, signal: AbortSignal.timeout(6_000) }).catch(() => null);
  if (!existsResponse?.ok) return reply("IMAGE_METADATA_LOOKUP_FAILED", 503);
  const existing = await existsResponse.json().catch(() => []);
  if (existing.length) {
    return existing[0].image_sha256 === image.imageHash
      ? reply("IMAGE_ALREADY_SAVED", 200, { role, stored: true })
      : reply("IMAGE_ROLE_ALREADY_OCCUPIED", 409);
  }
  const objectPath = `${ownerId}/${analysisId}/${role}-${image.imageHash}.${image.ext}`;
  const storageResponse = await fetch(`${base}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: { ...ah, "content-type": image.mime, "x-upsert": "true", "cache-control": "private, max-age=0" },
    body: image.bytes,
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!storageResponse?.ok) return reply("PRIVATE_IMAGE_STORAGE_FAILED", 503);

  const saveResponse = await fetch(`${base}/rest/v1/sp_web_label_private_images_v1?on_conflict=analysis_id,owner_id,image_role`, {
    method: "POST",
    headers: { ...ah, "content-type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({
      analysis_id: analysisId, owner_id: ownerId, image_role: role, image_sha256: image.imageHash,
      storage_bucket: BUCKET, storage_path: objectPath, mime_type: image.mime, byte_count: image.bytes.length,
    }),
    signal: AbortSignal.timeout(7_000),
  }).catch(() => null);
  if (!saveResponse?.ok) return reply("IMAGE_METADATA_PERSISTENCE_FAILED", 503);
  return reply("PRIVATE_IMAGE_SAVED", 201, { role, stored: true });
});
