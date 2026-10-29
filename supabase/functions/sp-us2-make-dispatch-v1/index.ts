import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type Obj = Record<string, any>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function serverKey() {
  const preferred = Deno.env.get("SP_LABEL_ADMIN_KEY_NAME") ?? "default";
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const map = JSON.parse(raw);
      const value = map[preferred] ?? map.default ?? Object.values(map)[0];
      if (typeof value === "string" && value.trim()) return value;
    } catch { /* fall through */ }
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy?.trim()) return legacy;
  throw new Error("SERVER_KEY_UNAVAILABLE");
}

function restHeaders(key: string) {
  const headers: Record<string, string> = {
    apikey: key,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

function constantTimeEqual(leftValue: string, rightValue: string) {
  const left = new TextEncoder().encode(leftValue);
  const right = new TextEncoder().encode(rightValue);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left[index] ^ right[index];
  return diff === 0;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text.trim()) return null;
  try { return JSON.parse(text); } catch { return null; }
}

async function rpc(base: string, key: string, name: string, body: Obj, timeout = 4000) {
  const response = await fetch(`${base.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: restHeaders(key),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  return { ok: response.ok, status: response.status, data: await parseResponse(response) };
}

async function finish(
  base: string,
  key: string,
  requestId: string,
  status: "DISPATCHED" | "RETRY" | "FAILED",
  errorCode: string | null = null,
  summary: Obj | null = null,
  retryAfterSeconds = 60,
) {
  return rpc(base, key, "sp_us2_finish_acquisition_v1", {
    p_request_id: requestId,
    p_status: status,
    p_error_code: errorCode,
    p_result_summary: summary,
    p_retry_after_seconds: retryAfterSeconds,
  }, 3000);
}

async function fetchAnchor(base: string, key: string, productId: string) {
  const select = "id,brand_name,product_name,variant_name,pack_size_text,pack_normalized_key,category,market_country_code,identity_status";
  const anchorUrl = `${base.replace(/\/$/, "")}/rest/v1/sp_catalog_product_v1?id=eq.${encodeURIComponent(productId)}&select=${encodeURIComponent(select)}&limit=1`;
  const response = await fetch(anchorUrl, {
    method: "GET",
    headers: restHeaders(key),
    signal: AbortSignal.timeout(3000),
  });
  const data = await parseResponse(response);
  return {
    ok: response.ok,
    status: response.status,
    row: response.ok && Array.isArray(data) && data.length === 1 ? data[0] : null,
  };
}

function webhookConfiguration() {
  const raw = Deno.env.get("MAKE_ACQUISITION_WEBHOOK_URL") ?? "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ success: false, code: "METHOD_NOT_ALLOWED" }, 405);

  let key: string;
  try { key = serverKey(); } catch { return json({ success: false, code: "SERVER_CONFIGURATION_MISSING" }, 503); }
  const suppliedKey = req.headers.get("x-us2-internal-key") ?? "";
  if (!suppliedKey || !constantTimeEqual(suppliedKey, key)) {
    return json({ success: false, code: "INTERNAL_AUTH_REQUIRED" }, 401);
  }

  const webhookUrl = webhookConfiguration();
  const flag = (Deno.env.get("SP_US2_MAKE_ACQUISITION_ENABLED") ?? "").trim().toLowerCase();
  const acquisitionEnabled = flag === "true" || (flag !== "false" && webhookUrl !== null);
  if (!acquisitionEnabled) return json({ success: true, status: "DISABLED" });

  const base = Deno.env.get("SUPABASE_URL") ?? "";
  if (!base) return json({ success: false, code: "SERVER_CONFIGURATION_MISSING" }, 503);

  // Successor dispatcher claims only launch 1.1 rows. Historical 1.0 rows remain untouched.
  const claimed = await rpc(base, key, "sp_us2_claim_acquisition_v1_1", {}, 3000).catch(() => null);
  const request = claimed?.ok && claimed.data?.claimed === true && claimed.data?.request
    ? claimed.data.request as Obj
    : null;
  if (!request) {
    if (claimed && claimed.ok) return json({ success: true, status: "NO_DUE_REQUEST" });
    return json({ success: false, code: "ACQUISITION_CLAIM_FAILED" }, 503);
  }

  const requestId = String(request.id ?? "");
  if (!requestId) return json({ success: false, code: "ACQUISITION_CLAIM_INVALID" }, 503);
  if (request.contract_version !== "SP-US2-MAKE-ACQUISITION/1.1") {
    await finish(base, key, requestId, "FAILED", "ACQUISITION_CONTRACT_VERSION_INVALID").catch(() => null);
    return json({ success: false, request_id: requestId, status: "FAILED", code: "ACQUISITION_CONTRACT_VERSION_INVALID" }, 422);
  }

  if (!webhookUrl) {
    await finish(base, key, requestId, "FAILED", "MAKE_WEBHOOK_CONFIGURATION_INVALID").catch(() => null);
    return json({ success: false, request_id: requestId, status: "FAILED", code: "MAKE_WEBHOOK_CONFIGURATION_INVALID" }, 503);
  }

  let anchorProduct: Obj | null = null;
  if (request.anchor_product_id) {
    const anchor = await fetchAnchor(base, key, String(request.anchor_product_id)).catch(() => null);
    if (!anchor?.ok) {
      await finish(base, key, requestId, "RETRY", "ANCHOR_LOOKUP_FAILED", null, 60).catch(() => null);
      return json({ success: false, request_id: requestId, status: "RETRY", code: "ANCHOR_LOOKUP_FAILED" }, 503);
    }
    if (!anchor.row) {
      await finish(base, key, requestId, "FAILED", "ANCHOR_NOT_FOUND").catch(() => null);
      return json({ success: false, request_id: requestId, status: "FAILED", code: "ANCHOR_NOT_FOUND" }, 422);
    }
    anchorProduct = {
      id: anchor.row.id,
      brand_name: anchor.row.brand_name ?? null,
      product_name: anchor.row.product_name ?? null,
      variant_name: anchor.row.variant_name ?? null,
      pack_size_text: anchor.row.pack_size_text ?? null,
      pack_normalized_key: anchor.row.pack_normalized_key ?? null,
      category: anchor.row.category ?? null,
      market_country_code: anchor.row.market_country_code ?? "IN",
      identity_status: anchor.row.identity_status ?? null,
    };
  }

  const requestedPackKey = typeof request.requested_pack_key === "string" && request.requested_pack_key.trim()
    ? request.requested_pack_key.trim()
    : null;
  const comparisonPackKey = requestedPackKey
    ? null
    : typeof request.comparison_pack_key === "string" && request.comparison_pack_key.trim()
      ? request.comparison_pack_key.trim()
      : null;
  const callbackUrl = `${base.replace(/\/$/, "")}/functions/v1/sp-us2-make-callback-v1`;
  const jobPayload = {
    contract_version: "SP-US2-MAKE-ACQUISITION/1.1",
    request_id: requestId,
    query: String(request.normalized_query ?? ""),
    search_mode: String(request.search_mode ?? "CATEGORY"),
    anchor_product: anchorProduct,
    requested_pack_key: requestedPackKey,
    comparison_pack_key: comparisonPackKey,
    category: typeof request.category === "string" ? request.category : null,
    target_exact_offers: Math.min(Math.max(Number(request.target_exact_offers ?? 0), 0), 5),
    target_alternatives: Math.min(Math.max(Number(request.target_alternatives ?? 0), 0), 5),
    target_category_products: Math.min(Math.max(Number(request.target_category_products ?? 0), 0), 10),
    market_country_code: "IN",
    currency: "INR",
    callback_url: callbackUrl,
  };

  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(jobPayload),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    const finished = await finish(base, key, requestId, "RETRY", "MAKE_DELIVERY_NETWORK_FAILURE", null, 60).catch(() => null);
    const terminalStatus = finished?.data?.status === "FAILED" ? "FAILED" : "RETRY";
    return json({ success: false, request_id: requestId, status: terminalStatus, code: "MAKE_DELIVERY_NETWORK_FAILURE" }, 503);
  }

  if (response.ok) {
    const finished = await finish(base, key, requestId, "DISPATCHED", null, {
      delivery_http_status: response.status,
      delivered_at: new Date().toISOString(),
      contract_version: "SP-US2-MAKE-ACQUISITION/1.1",
    }).catch(() => null);
    if (!finished?.ok) return json({ success: false, request_id: requestId, code: "DISPATCH_STATE_UPDATE_FAILED" }, 503);
    return json({
      success: true,
      request_id: requestId,
      status: finished.data?.status ?? "DISPATCHED",
      delivery_http_status: response.status,
    });
  }

  const transient = response.status === 408 || response.status === 429 || response.status >= 500;
  if (transient) {
    const retryAfter = response.status === 429 ? 300 : 60;
    const finished = await finish(base, key, requestId, "RETRY", `MAKE_HTTP_${response.status}`, {
      delivery_http_status: response.status,
      contract_version: "SP-US2-MAKE-ACQUISITION/1.1",
    }, retryAfter).catch(() => null);
    const terminalStatus = finished?.data?.status === "FAILED" ? "FAILED" : "RETRY";
    return json({ success: false, request_id: requestId, status: terminalStatus, code: `MAKE_HTTP_${response.status}` }, 503);
  }

  await finish(base, key, requestId, "FAILED", `MAKE_HTTP_${response.status}`, {
    delivery_http_status: response.status,
    contract_version: "SP-US2-MAKE-ACQUISITION/1.1",
  }).catch(() => null);
  return json({ success: false, request_id: requestId, status: "FAILED", code: `MAKE_HTTP_${response.status}` }, 502);
});
