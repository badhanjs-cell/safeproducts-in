import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { validateMakeCallback, validateMakeCallbackV11 } from "./make-policy.mjs";

type Obj = Record<string, any>;
const MAX_BODY_BYTES = 524288;
const ACQ_V10 = "SP-US2-MAKE-ACQUISITION/1.0";
const ACQ_V11 = "SP-US2-MAKE-ACQUISITION/1.1";
const CB_V10 = "SP-US2-MAKE-CALLBACK/1.0";
const CB_V11 = "SP-US2-MAKE-CALLBACK/1.1";

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

function boundedIds(values: string[]) {
  return [...new Set(values)].slice(0, 10);
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text.trim()) return null;
  try { return JSON.parse(text); } catch { return null; }
}

async function rpc(base: string, key: string, name: string, body: Obj, timeout = 5000) {
  const response = await fetch(`${base.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: restHeaders(key),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  return { ok: response.ok, status: response.status, data: await parseResponse(response) };
}

async function acquisitionRequest(base: string, key: string, requestId: string) {
  const select = "id,normalized_query,search_mode,anchor_product_id,requested_pack_key,comparison_pack_key,category,status,target_exact_offers,target_alternatives,target_category_products,contract_version,result_summary";
  const url = `${base.replace(/\/$/, "")}/rest/v1/sp_us2_acquisition_request_v1?id=eq.${encodeURIComponent(requestId)}&select=${encodeURIComponent(select)}&limit=1`;
  const response = await fetch(url, { method: "GET", headers: restHeaders(key), signal: AbortSignal.timeout(3000) });
  const data = await parseResponse(response);
  return response.ok && Array.isArray(data) && data.length === 1 ? data[0] : null;
}

async function canonicalAnchor(base: string, key: string, productId: string | null) {
  if (!productId) return null;
  const select = "id,brand_name,product_name,variant_name,category,market_country_code";
  const url = `${base.replace(/\/$/, "")}/rest/v1/sp_catalog_product_v1?id=eq.${encodeURIComponent(productId)}&select=${encodeURIComponent(select)}&limit=1`;
  const response = await fetch(url, { method: "GET", headers: restHeaders(key), signal: AbortSignal.timeout(3000) });
  const data = await parseResponse(response);
  return response.ok && Array.isArray(data) && data.length === 1 ? data[0] : null;
}

async function finish(base: string, key: string, requestId: string, status: string, summary: Obj | null, errorCode: string | null = null) {
  return rpc(base, key, "sp_us2_finish_acquisition_v1", {
    p_request_id: requestId,
    p_status: status,
    p_error_code: errorCode,
    p_result_summary: summary,
    p_retry_after_seconds: 60,
  }, 3000);
}

async function failValidated(base: string, key: string, requestId: string, code: string, httpStatus = 400) {
  await finish(base, key, requestId, "FAILED", { validation_code: code }, "CALLBACK_VALIDATION_FAILED").catch(() => null);
  return json({ success: false, code }, httpStatus);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ success: false, code: "METHOD_NOT_ALLOWED" }, 405);

  const callbackKey = Deno.env.get("SP_US2_MAKE_CALLBACK_KEY") ?? "";
  const suppliedKey = req.headers.get("x-sp-us2-make-key") ?? "";
  if (!callbackKey || !suppliedKey || !constantTimeEqual(suppliedKey, callbackKey)) {
    return json({ success: false, code: "CALLBACK_AUTH_REQUIRED" }, 401);
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return json({ success: false, code: "PAYLOAD_TOO_LARGE" }, 413);

  let text: string;
  try { text = await req.text(); } catch { return json({ success: false, code: "BODY_READ_FAILED" }, 400); }
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return json({ success: false, code: "PAYLOAD_TOO_LARGE" }, 413);

  let raw: Obj;
  try { raw = JSON.parse(text); } catch { return json({ success: false, code: "INVALID_JSON" }, 400); }
  const requestId = typeof raw?.request_id === "string" ? raw.request_id.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return json({ success: false, code: "REQUEST_ID_INVALID" }, 400);

  let key: string;
  try { key = serverKey(); } catch { return json({ success: false, code: "SERVER_CONFIGURATION_MISSING" }, 503); }
  const base = Deno.env.get("SUPABASE_URL") ?? "";
  if (!base) return json({ success: false, code: "SERVER_CONFIGURATION_MISSING" }, 503);

  const requestRow = await acquisitionRequest(base, key, requestId);
  if (!requestRow) return json({ success: false, code: "ACQUISITION_REQUEST_NOT_FOUND" }, 404);
  if (requestRow.status === "COMPLETED") {
    return json({ success: true, request_id: requestRow.id, status: "COMPLETED", idempotent: true, result_summary: requestRow.result_summary ?? null });
  }
  if (!["DISPATCHING", "DISPATCHED"].includes(String(requestRow.status))) return json({ success: false, code: "ACQUISITION_REQUEST_STATE_INVALID" }, 409);

  const queueVersion = String(requestRow.contract_version || ACQ_V10);
  const expectedCallbackVersion = queueVersion === ACQ_V11 ? CB_V11 : queueVersion === ACQ_V10 ? CB_V10 : null;
  if (!expectedCallbackVersion || raw.contract_version !== expectedCallbackVersion) {
    return failValidated(base, key, requestRow.id, "CONTRACT_VERSION_MISMATCH");
  }

  const anchor = queueVersion === ACQ_V11
    ? await canonicalAnchor(base, key, requestRow.anchor_product_id ? String(requestRow.anchor_product_id) : null)
    : null;
  if (queueVersion === ACQ_V11 && requestRow.search_mode === "SPECIFIC_PRODUCT" && requestRow.anchor_product_id && !anchor) {
    return failValidated(base, key, requestRow.id, "ANCHOR_NOT_AVAILABLE", 422);
  }

  const validated = queueVersion === ACQ_V11
    ? validateMakeCallbackV11(raw, {
        contractVersion: ACQ_V11,
        searchMode: requestRow.search_mode,
        query: requestRow.normalized_query,
        requestedPackKey: requestRow.requested_pack_key ?? null,
        comparisonPackKey: requestRow.comparison_pack_key ?? null,
        category: requestRow.category ?? null,
        targetExactOffers: requestRow.target_exact_offers ?? 0,
        targetAlternatives: requestRow.target_alternatives ?? 0,
        targetCategoryProducts: requestRow.target_category_products ?? 0,
        marketCountryCode: "IN",
        currency: "INR",
        anchor,
      })
    : validateMakeCallback(raw, {
        query: requestRow.normalized_query,
        marketCountryCode: "IN",
        currency: "INR",
        requestedPackKey: requestRow.requested_pack_key ?? null,
      });

  if (!validated.ok) return failValidated(base, key, requestRow.id, validated.code);

  const effectivePackKey = validated.value.effectivePackKey
    ?? validated.value.resolvedPackKey
    ?? requestRow.requested_pack_key
    ?? requestRow.comparison_pack_key
    ?? null;
  const productIds = new Map<string, string>();
  if (requestRow.anchor_product_id) productIds.set("ANCHOR", String(requestRow.anchor_product_id));
  let productsStaged = 0;
  let candidateProducts = 0;
  let reusedProducts = 0;
  let offersStaged = 0;
  let imagesPersisted = 0;
  const candidateProductIds: string[] = [];
  const reusedProductIds: string[] = [];
  const offerIds: string[] = [];

  for (const product of validated.value.products) {
    if (product.ref === "ANCHOR") {
      if (!requestRow.anchor_product_id) return failValidated(base, key, requestRow.id, "ANCHOR_NOT_AVAILABLE", 422);
      productIds.set(product.ref, String(requestRow.anchor_product_id));
      continue;
    }
    const staged = await rpc(base, key, "sp_catalog_stage_search_discovery_v1", {
      p_payload: {
        brand_name: product.brand_name,
        product_name: product.product_name,
        variant_name: product.variant_name,
        category: product.category ?? requestRow.category ?? null,
        pack_size_text: product.pack_size_text,
        source_url: product.source_url,
        source_name: product.source_name,
        identity_confidence: product.identity_confidence,
      },
    });
    const productId = staged.ok && typeof staged.data?.product_id === "string" ? staged.data.product_id : null;
    if (!productId) {
      await finish(base, key, requestRow.id, "FAILED", { products_staged: productsStaged }, "PRODUCT_STAGING_FAILED").catch(() => null);
      return json({ success: false, code: "PRODUCT_STAGING_FAILED" }, 422);
    }
    productIds.set(product.ref, productId);
    productsStaged += 1;
    if (staged.data?.identity_status === "CANDIDATE") {
      candidateProducts += 1;
      candidateProductIds.push(productId);
    } else {
      reusedProducts += 1;
      reusedProductIds.push(productId);
    }
  }

  for (const offer of validated.value.offers) {
    const productId = productIds.get(offer.product_ref);
    if (!productId) {
      await finish(base, key, requestRow.id, "FAILED", { products_staged: productsStaged, offers_staged: offersStaged }, "OFFER_PRODUCT_UNRESOLVED").catch(() => null);
      return json({ success: false, code: "OFFER_PRODUCT_UNRESOLVED" }, 422);
    }
    const staged = await rpc(base, key, "sp_us2_stage_commerce_offer_v1", {
      p_payload: {
        product_id: productId,
        merchant_name: offer.merchant_name,
        platform_name: offer.platform_name,
        source_url: offer.source_url,
        observed_source_urls: offer.observed_source_urls,
        price: offer.price,
        currency: "INR",
        market_country_code: "IN",
        image_url: offer.image_url,
        pack_size_text: offer.pack_size_text,
        pack_normalized_key: offer.pack_normalized_key,
        requested_pack_key: effectivePackKey,
        exact_product_match: true,
        variant_match: true,
        exact_pack_match: offer.exact_pack_match,
        confidence: offer.confidence,
      },
    });
    if (!staged.ok || !staged.data?.offer_id) {
      await finish(base, key, requestRow.id, "FAILED", { products_staged: productsStaged, offers_staged: offersStaged }, "OFFER_STAGING_FAILED").catch(() => null);
      return json({ success: false, code: "OFFER_STAGING_FAILED" }, 422);
    }
    offersStaged += 1;
    offerIds.push(String(staged.data.offer_id));
  }

  if (queueVersion === ACQ_V11 && Array.isArray(validated.value.images)) {
    for (const image of validated.value.images) {
      const productId = productIds.get(String(image.product_ref));
      if (!productId) continue;
      const persisted = await rpc(base, key, "sp_us2_upsert_display_image_v1", {
        p_product_id: productId,
        p_image: {
          source_kind: "SEARCH_DISCOVERY",
          source_url: image.source_url,
          image_url: image.url,
          exact_product_match: true,
        },
      }, 2500).catch(() => ({ ok: false, data: null }));
      if (persisted.ok && persisted.data?.success === true) imagesPersisted += 1;
    }
  }

  const summary = {
    contract_version: queueVersion,
    products_staged: productsStaged,
    candidate_products: candidateProducts,
    reused_products: reusedProducts,
    offers_staged: offersStaged,
    images_persisted: imagesPersisted,
    requested_pack_key: validated.value.requestedPackKey ?? requestRow.requested_pack_key ?? null,
    comparison_pack_key: validated.value.comparisonPackKey ?? requestRow.comparison_pack_key ?? null,
    resolved_pack_key: validated.value.resolvedPackKey ?? effectivePackKey,
    pack_resolution: validated.value.packResolution ?? "REQUESTED",
    candidate_product_ids: boundedIds(candidateProductIds),
    reused_product_ids: boundedIds(reusedProductIds),
    offer_ids: boundedIds(offerIds),
  };
  const finished = await finish(base, key, requestRow.id, "COMPLETED", summary);
  if (!finished.ok) return json({ success: false, code: "ACQUISITION_FINISH_FAILED" }, 503);

  return json({ success: true, request_id: requestRow.id, status: "COMPLETED", ...summary });
});
