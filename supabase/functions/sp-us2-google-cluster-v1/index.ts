import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  clusterAcquisitionNeed,
  deriveShoppingQueryFromCommerceHints,
  normalizeClusterStores,
  selectGoogleProductCluster,
} from "./google-cluster-policy.mjs";

type Obj = Record<string, any>;

type ProviderResult = {
  ok: boolean;
  status: number;
  data: any;
  timeout: boolean;
};

const REASONS = {
  EXACT_COVERAGE_SUFFICIENT: "EXACT_COVERAGE_SUFFICIENT",
  SERPAPI_KEY_UNAVAILABLE: "SERPAPI_KEY_UNAVAILABLE",
  SHOPPING_TIMEOUT: "SHOPPING_TIMEOUT",
  SHOPPING_PROVIDER_ERROR: "SHOPPING_PROVIDER_ERROR",
  NO_QUALIFIED_CLUSTER: "NO_QUALIFIED_CLUSTER",
  CLUSTER_TOKEN_MISSING: "CLUSTER_TOKEN_MISSING",
  STORES_TIMEOUT: "STORES_TIMEOUT",
  STORES_PROVIDER_ERROR: "STORES_PROVIDER_ERROR",
  NO_QUALIFIED_STORES: "NO_QUALIFIED_STORES",
  PARTIAL_STORE_COVERAGE: "PARTIAL_STORE_COVERAGE",
  STAGING_REJECTED: "STAGING_REJECTED",
  READY: "READY",
} as const;

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

async function historicalCommerceHints(base: string, key: string, productId: string) {
  try {
    const url = new URL(`${base.replace(/\/$/, "")}/rest/v1/sp_catalog_commerce_offer_v1`);
    url.searchParams.set("select", "product_id,merchant_name,source_domain,source_url,offer_confidence,market_country_code,retrieved_at");
    url.searchParams.set("product_id", `eq.${productId}`);
    url.searchParams.set("market_country_code", "eq.IN");
    url.searchParams.set("offer_confidence", "gte.80");
    url.searchParams.set("order", "retrieved_at.desc");
    url.searchParams.set("limit", "20");
    const response = await fetch(url, {
      method: "GET",
      headers: restHeaders(key),
      signal: AbortSignal.timeout(1500),
    });
    const data = await parseResponse(response);
    return response.ok && Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function providerJson(url: URL, timeout: number): Promise<ProviderResult> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeout),
    });
    return { ok: response.ok, status: response.status, data: await parseResponse(response), timeout: false };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    return { ok: false, status: 0, data: null, timeout: /timeout/i.test(name) };
  }
}

function exactRows(payload: any) {
  return Array.isArray(payload) ? payload : [];
}

async function exactOffers(base: string, key: string, productId: string, packKey: string | null) {
  if (!packKey) return [];
  const result = await rpc(base, key, "sp_us2_exact_offers_v1", {
    p_product_id: productId,
    p_pack_normalized_key: packKey,
    p_limit: 5,
  }, 3500).catch(() => ({ ok: false, status: 0, data: null }));
  return result.ok ? exactRows(result.data) : [];
}

function responseBody({
  started,
  attempted,
  reason,
  shoppingCalls,
  storesCalls,
  storesObserved,
  storesAccepted,
  storesStaged,
  exactBefore,
  exactAfter,
  targetExactOffers,
  exactOfferRows,
}: {
  started: number;
  attempted: boolean;
  reason: string;
  shoppingCalls: number;
  storesCalls: number;
  storesObserved: number;
  storesAccepted: number;
  storesStaged: number;
  exactBefore: number;
  exactAfter: number;
  targetExactOffers: number;
  exactOfferRows: any[];
}) {
  const residualShortfall = Math.max(0, Math.min(5, targetExactOffers) - Math.max(0, exactAfter));
  return {
    success: true,
    attempted,
    reason,
    exact_offers: exactOfferRows,
    telemetry: {
      shopping_calls: Math.min(1, shoppingCalls),
      stores_calls: Math.min(1, storesCalls),
      stores_observed: storesObserved,
      stores_accepted: storesAccepted,
      stores_staged: storesStaged,
      exact_before: exactBefore,
      exact_after: exactAfter,
      residual_shortfall: residualShortfall,
      latency_ms: Date.now() - started,
      cost_usd: null,
    },
  };
}

Deno.serve(async (req: Request) => {
  const started = Date.now();
  if (req.method !== "POST") return json({ success: false, code: "METHOD_NOT_ALLOWED" }, 405);

  let key: string;
  try { key = serverKey(); } catch { return json({ success: false, code: "SERVER_CONFIGURATION_MISSING" }, 503); }
  if (!constantTimeEqual(req.headers.get("x-us2-internal-key") ?? "", key)) {
    return json({ success: false, code: "INTERNAL_AUTH_REQUIRED" }, 401);
  }

  let input: Obj;
  try { input = await req.json(); } catch { return json({ success: false, code: "INVALID_JSON" }, 400); }
  const query = typeof input.query === "string" ? input.query.trim() : "";
  const anchor = input.anchor_product && typeof input.anchor_product === "object" ? input.anchor_product : null;
  const productId = typeof anchor?.canonical_product_id === "string" ? anchor.canonical_product_id.trim() : "";
  const productName = typeof anchor?.product_name === "string" ? anchor.product_name.trim() : "";
  const brandName = typeof anchor?.brand_name === "string" ? anchor.brand_name.trim() : "";
  const requestedPackKey = typeof input.requested_pack_key === "string" && input.requested_pack_key.trim()
    ? input.requested_pack_key.trim().toLowerCase()
    : typeof anchor?.pack_normalized_key === "string" && anchor.pack_normalized_key.trim()
      ? anchor.pack_normalized_key.trim().toLowerCase()
      : null;
  if (!query || query.length > 200 || !productId || !productName || !brandName || !requestedPackKey) {
    return json({ success: false, code: "INPUT_INVALID" }, 400);
  }

  const base = Deno.env.get("SUPABASE_URL") ?? "";
  if (!base) return json({ success: false, code: "SERVER_CONFIGURATION_MISSING" }, 503);

  let shoppingCalls = 0;
  let storesCalls = 0;
  let storesObserved = 0;
  let storesAccepted = 0;
  let storesStaged = 0;

  const beforeRows = await exactOffers(base, key, productId, requestedPackKey);
  const exactBefore = beforeRows.length;
  const canonicalNeed = clusterAcquisitionNeed(exactBefore, 5);
  const requestedShortfall = Math.max(0, Math.min(
    canonicalNeed.shortfall,
    Math.trunc(Number(input.target_exact_offers) || canonicalNeed.shortfall),
  ));
  if (!canonicalNeed.needed || requestedShortfall <= 0) {
    return json(responseBody({
      started, attempted: false, reason: REASONS.EXACT_COVERAGE_SUFFICIENT,
      shoppingCalls, storesCalls, storesObserved, storesAccepted, storesStaged,
      exactBefore, exactAfter: exactBefore, targetExactOffers: 5, exactOfferRows: beforeRows,
    }));
  }

  const serpApiKey = Deno.env.get("SP_US2_SERPAPI_API_KEY") ?? "";
  if (!serpApiKey.trim()) {
    return json(responseBody({
      started, attempted: false, reason: REASONS.SERPAPI_KEY_UNAVAILABLE,
      shoppingCalls, storesCalls, storesObserved, storesAccepted, storesStaged,
      exactBefore, exactAfter: exactBefore, targetExactOffers: 5, exactOfferRows: beforeRows,
    }));
  }

  const commerceHints = await historicalCommerceHints(base, key, productId);
  const shoppingQuery = deriveShoppingQueryFromCommerceHints(query, commerceHints, { anchor });
  const shoppingUrl = new URL("https://serpapi.com/search.json");
  shoppingUrl.searchParams.set("engine", "google_shopping");
  shoppingUrl.searchParams.set("q", shoppingQuery);
  shoppingUrl.searchParams.set("gl", "in");
  shoppingUrl.searchParams.set("hl", "en");
  shoppingUrl.searchParams.set("google_domain", "google.co.in");
  shoppingUrl.searchParams.set("api_key", serpApiKey);

  shoppingCalls = 1;
  const shopping = await providerJson(shoppingUrl, 4500);
  if (!shopping.ok) {
    return json(responseBody({
      started, attempted: true, reason: shopping.timeout ? REASONS.SHOPPING_TIMEOUT : REASONS.SHOPPING_PROVIDER_ERROR,
      shoppingCalls, storesCalls, storesObserved, storesAccepted, storesStaged,
      exactBefore, exactAfter: exactBefore, targetExactOffers: 5, exactOfferRows: beforeRows,
    }));
  }

  const cluster = selectGoogleProductCluster(shopping.data, {
    query,
    requestedPackKey,
    anchor,
  });
  if (!cluster) {
    return json(responseBody({
      started, attempted: true, reason: REASONS.NO_QUALIFIED_CLUSTER,
      shoppingCalls, storesCalls, storesObserved, storesAccepted, storesStaged,
      exactBefore, exactAfter: exactBefore, targetExactOffers: 5, exactOfferRows: beforeRows,
    }));
  }
  if (!cluster.pageToken) {
    return json(responseBody({
      started, attempted: true, reason: REASONS.CLUSTER_TOKEN_MISSING,
      shoppingCalls, storesCalls, storesObserved, storesAccepted, storesStaged,
      exactBefore, exactAfter: exactBefore, targetExactOffers: 5, exactOfferRows: beforeRows,
    }));
  }

  const storesUrl = new URL("https://serpapi.com/search.json");
  storesUrl.searchParams.set("engine", "google_immersive_product");
  storesUrl.searchParams.set("page_token", cluster.pageToken);
  storesUrl.searchParams.set("more_stores", "true");
  storesUrl.searchParams.set("gl", "in");
  storesUrl.searchParams.set("hl", "en");
  storesUrl.searchParams.set("api_key", serpApiKey);

  storesCalls = 1;
  const stores = await providerJson(storesUrl, 4500);
  if (!stores.ok) {
    return json(responseBody({
      started, attempted: true, reason: stores.timeout ? REASONS.STORES_TIMEOUT : REASONS.STORES_PROVIDER_ERROR,
      shoppingCalls, storesCalls, storesObserved, storesAccepted, storesStaged,
      exactBefore, exactAfter: exactBefore, targetExactOffers: 5, exactOfferRows: beforeRows,
    }));
  }

  storesObserved = Array.isArray(stores.data?.product_results?.stores) ? stores.data.product_results.stores.length : 0;
  const acceptedStores = normalizeClusterStores(stores.data, {
    query,
    anchor,
    requestedPackKey,
    lockedCluster: cluster,
    shortfall: requestedShortfall,
  });
  storesAccepted = acceptedStores.length;
  if (!storesAccepted) {
    return json(responseBody({
      started, attempted: true, reason: REASONS.NO_QUALIFIED_STORES,
      shoppingCalls, storesCalls, storesObserved, storesAccepted, storesStaged,
      exactBefore, exactAfter: exactBefore, targetExactOffers: 5, exactOfferRows: beforeRows,
    }));
  }

  const stagingResults = await Promise.all(
    acceptedStores.map(async (offer) => {
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
          requested_pack_key: requestedPackKey,
          exact_product_match: true,
          variant_match: true,
          exact_pack_match: offer.exact_pack_match,
          confidence: offer.confidence,
        },
      }, 3500).catch(() => ({ ok: false, status: 0, data: null }));
      return staged.ok && !!staged.data?.offer_id;
    }),
  );
  storesStaged = stagingResults.filter(Boolean).length;
  const stagingRejected = stagingResults.length - storesStaged;

  const afterRows = await exactOffers(base, key, productId, requestedPackKey);
  const exactAfter = afterRows.length;
  const residualShortfall = Math.max(0, 5 - exactAfter);
  let reason = residualShortfall === 0 ? REASONS.READY : REASONS.PARTIAL_STORE_COVERAGE;
  if (stagingRejected > 0 && storesStaged === 0) reason = REASONS.STAGING_REJECTED;

  return json(responseBody({
    started, attempted: true, reason,
    shoppingCalls, storesCalls, storesObserved, storesAccepted, storesStaged,
    exactBefore, exactAfter, targetExactOffers: 5, exactOfferRows: afterRows,
  }));
});
