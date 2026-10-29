import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const FUNCTION_VERSION = "SP-LABEL-CATALOG-INGEST/1.2";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function getAdminKey(): string {
  const preferred = Deno.env.get("SP_LABEL_ADMIN_KEY_NAME") ?? "default";
  const mapRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (mapRaw) {
    try {
      const map = JSON.parse(mapRaw) as Record<string, string>;
      const selected = map[preferred] ?? map.default ?? Object.values(map)[0];
      if (selected?.trim()) return selected;
    } catch {
      // Fall through to legacy server key.
    }
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy?.trim()) return legacy;
  throw new Error("SUPABASE_SERVER_KEY_UNAVAILABLE");
}

function adminHeaders(key: string): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: key,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function rpc(
  url: string,
  key: string,
  name: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: any }> {
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: adminHeaders(key),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8_000),
  });
  const text = await response.text();
  let data: any = null;
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { ok: response.ok, status: response.status, data };
}

function decodeJwtSubject(request: Request): string | null {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

function validHash(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function safeDimension(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= 30_000 ? n : null;
}

Deno.serve(async (request: Request): Promise<Response> => {
  const requestId = crypto.randomUUID();
  if (request.method !== "POST") {
    return jsonResponse({ success: false, code: "METHOD_NOT_ALLOWED", request_id: requestId }, 405);
  }

  if (!decodeJwtSubject(request)) {
    return jsonResponse({ success: false, code: "AUTH_SUBJECT_REQUIRED", request_id: requestId }, 401);
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ success: false, code: "INVALID_JSON", request_id: requestId }, 400);
  }

  const analysisId = payload?.analysisId;
  const analysisImageSha256 = payload?.analysisImageSha256;
  const ingredientImageSha256 = payload?.ingredientImageSha256;
  const frontImageSha256 = payload?.frontImageSha256;
  const identity = payload?.identity ?? {};
  const brandName = typeof identity.brand_name === "string" ? identity.brand_name.trim() : "";
  const productName = typeof identity.product_name === "string" ? identity.product_name.trim() : "";
  const variant = typeof identity.variant === "string" ? identity.variant.trim() : "";
  const packSizeText = typeof identity.pack_size_text === "string" ? identity.pack_size_text.trim() : "";

  if (
    !validUuid(analysisId) ||
    !validHash(analysisImageSha256) ||
    !validHash(ingredientImageSha256) ||
    !validHash(frontImageSha256)
  ) {
    return jsonResponse({ success: false, code: "INVALID_CATALOG_LINK_PAYLOAD", request_id: requestId }, 400);
  }
  if (
    !brandName ||
    brandName.length > 200 ||
    !productName ||
    productName.length > 300 ||
    variant.length > 200 ||
    packSizeText.length > 120
  ) {
    return jsonResponse({ success: false, code: "INVALID_PRODUCT_IDENTITY", request_id: requestId }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (!supabaseUrl) {
    return jsonResponse({ success: false, code: "SUPABASE_URL_UNAVAILABLE", request_id: requestId }, 500);
  }

  let adminKey: string;
  try {
    adminKey = getAdminKey();
  } catch {
    return jsonResponse({ success: false, code: "SUPABASE_SERVER_KEY_UNAVAILABLE", request_id: requestId }, 500);
  }

  const result = await rpc(supabaseUrl, adminKey, "sp_catalog_ingest_label_analysis_by_id_v2", {
    p_analysis_id: analysisId,
    p_analysis_image_sha256: analysisImageSha256.toLowerCase(),
    p_identity: {
      brand_name: brandName,
      product_name: productName,
      variant,
      pack_size_text: packSizeText,
    },
    p_image_meta: {
      front_image_sha256: frontImageSha256.toLowerCase(),
      ingredient_image_sha256: ingredientImageSha256.toLowerCase(),
      front_width_px: safeDimension(payload?.frontWidth),
      front_height_px: safeDimension(payload?.frontHeight),
      ingredient_width_px: safeDimension(payload?.ingredientWidth),
      ingredient_height_px: safeDimension(payload?.ingredientHeight),
    },
  });

  if (!result.ok) {
    const code = result.data && typeof result.data === "object" && typeof result.data.code === "string"
      ? result.data.code
      : "CATALOG_RPC_FAILED";
    console.error("SafeProducts catalog ingest failed", requestId, result.status, code);
    return jsonResponse({ success: false, code, request_id: requestId }, result.status >= 400 && result.status < 600 ? result.status : 502);
  }

  return jsonResponse({
    success: true,
    catalog: result.data,
    edge_version: FUNCTION_VERSION,
    request_id: requestId,
  });
});