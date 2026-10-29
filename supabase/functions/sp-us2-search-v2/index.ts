import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  acquisitionNeed,
  coreNeedsDiscovery,
  discoveryTargetCount,
  googleClusterAcquisitionNeed,
  mergeGoogleClusterExactOffers,
  mergeSearchResponses,
  parsePackKeyFromText,
  specificAlternativeQuery,
} from "./orchestration-policy.mjs";

type Obj = Record<string, any>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

function adminKey() {
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
  return null;
}

function internalHeaders(key: string) {
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json", Accept: "application/json", "x-us2-internal-key": key };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

function clientHeaders(req: Request) {
  const authorization = req.headers.get("Authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (authorization) headers.Authorization = authorization;
  if (apikey) headers.apikey = apikey;
  return headers;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text.trim()) return null;
  try { return JSON.parse(text); } catch { return null; }
}

async function invokeCore(base: string, req: Request, input: Obj, timeout: number) {
  const response = await fetch(`${base.replace(/\/$/, "")}/functions/v1/sp-m1b-search-v1`, {
    method: "POST",
    headers: clientHeaders(req),
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(Math.max(1000, timeout)),
  });
  return { ok: response.ok, status: response.status, data: await parseResponse(response) };
}

async function invokeGoogleCluster(base: string, key: string, input: Obj, timeout: number) {
  const response = await fetch(`${base.replace(/\/$/, "")}/functions/v1/sp-us2-google-cluster-v1`, {
    method: "POST",
    headers: internalHeaders(key),
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(Math.max(1000, timeout)),
  });
  return { ok: response.ok, status: response.status, data: await parseResponse(response) };
}

async function invokeDiscovery(base: string, key: string, input: Obj, timeout: number) {
  const response = await fetch(`${base.replace(/\/$/, "")}/functions/v1/sp-us2-discovery-v1`, {
    method: "POST",
    headers: internalHeaders(key),
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(Math.max(1000, timeout)),
  });
  return { ok: response.ok, status: response.status, data: await parseResponse(response) };
}

async function enqueueAcquisition(base: string, key: string, input: Obj) {
  const response = await fetch(`${base.replace(/\/$/, "")}/rest/v1/rpc/sp_us2_enqueue_acquisition_v1_1`, {
    method: "POST",
    headers: internalHeaders(key),
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(500),
  });
  return { ok: response.ok, status: response.status, data: await parseResponse(response) };
}

function scheduleMakeDispatch(base: string, key: string) {
  if (Deno.env.get("SP_US2_MAKE_ACQUISITION_ENABLED") !== "true") return false;
  const runtime = (globalThis as any).EdgeRuntime;
  if (!runtime || typeof runtime.waitUntil !== "function") return false;
  const dispatchPromise = fetch(`${base.replace(/\/$/, "")}/functions/v1/sp-us2-make-dispatch-v1`, {
    method: "POST",
    headers: internalHeaders(key),
    body: JSON.stringify({ source: "SP-US2-SEARCH-V2" }),
    signal: AbortSignal.timeout(9000),
  }).catch(() => null);
  runtime.waitUntil(dispatchPromise);
  return true;
}

function acquisitionAnchor(response: Obj) {
  if (response?.anchor_product?.canonical_product_id) return response.anchor_product;
  const products = Array.isArray(response?.products) ? response.products : [];
  return products.find((product: Obj) => product?.result_group === "EXACT_OFFER") ?? null;
}

function acquisitionCategory(response: Obj, input: Obj) {
  if (typeof input.category === "string" && input.category.trim() && input.category.trim().toLowerCase() !== "all") {
    return input.category.trim();
  }
  const anchor = acquisitionAnchor(response);
  if (typeof anchor?.category === "string" && anchor.category.trim()) return anchor.category.trim();
  const products = Array.isArray(response?.products) ? response.products : [];
  const product = products.find((row: Obj) => typeof row?.category === "string" && row.category.trim());
  return product?.category?.trim?.() ?? null;
}

async function finalizeSearchResponse({
  response,
  base,
  key,
  query,
  limit,
  input,
  started,
  discoveryTelemetry,
  googleClusterTelemetry,
}: {
  response: Obj;
  base: string;
  key: string | null;
  query: string;
  limit: number;
  input: Obj;
  started: number;
  discoveryTelemetry: Obj | null;
  googleClusterTelemetry: Obj | null;
}) {
  response.m1b_meta = {
    ...(response.m1b_meta && typeof response.m1b_meta === "object" ? response.m1b_meta : {}),
    foreground_latency_ms: Date.now() - started,
    discovery_telemetry: discoveryTelemetry,
    google_cluster_acquisition: googleClusterTelemetry,
  };

  const need = acquisitionNeed(response, limit);
  const explicitRequestedPackKey = parsePackKeyFromText(query)
    || response?.selected_pack?.requested_normalized_key
    || null;
  const comparisonPackKey = explicitRequestedPackKey
    ? null
    : typeof response?.selected_pack?.normalized_key === "string"
      ? response.selected_pack.normalized_key
      : null;
  const makeAcquisition: Obj = {
    needed: need.needed,
    foreground_eligible: need.foregroundEligible,
    queued: false,
    dispatch_scheduled: false,
    request_id: null,
    reason: need.needed ? null : "COVERAGE_SUFFICIENT",
    current_exact_offers: need.currentExactOffers,
    current_alternatives: need.currentAlternatives,
    current_distinct_brands: need.currentDistinctBrands,
    target_exact_offers: need.targetExactOffers,
    target_alternatives: need.targetAlternatives,
    target_category_products: need.targetCategoryProducts,
    minimum_useful_floor: need.minimumUsefulFloor,
    requested_pack_key: explicitRequestedPackKey,
    comparison_pack_key: comparisonPackKey,
  };

  if (need.needed && !need.foregroundEligible) {
    makeAcquisition.reason = "BACKGROUND_ONLY_ABOVE_MINIMUM_FLOOR";
  } else if (need.needed && !key) {
    makeAcquisition.reason = "SERVER_KEY_UNAVAILABLE";
  } else if (need.needed && key) {
    try {
      const anchor = acquisitionAnchor(response);
      const enqueued = await enqueueAcquisition(base, key, {
        p_query: query,
        p_search_mode: need.searchMode,
        p_anchor_product_id: anchor?.canonical_product_id ?? null,
        p_requested_pack_key: explicitRequestedPackKey,
        p_comparison_pack_key: comparisonPackKey,
        p_category: acquisitionCategory(response, input),
        p_target_exact_offers: need.targetExactOffers,
        p_target_alternatives: need.targetAlternatives,
        p_target_category_products: need.targetCategoryProducts,
        p_payload: {
          source: "SP-US2-SEARCH-V2",
          minimum_useful_floor: need.minimumUsefulFloor,
        },
      });
      makeAcquisition.request_id = enqueued.data?.request_id ?? null;
      makeAcquisition.queued = enqueued.ok && enqueued.data?.allowed === true;
      makeAcquisition.reason = typeof enqueued.data?.reason === "string"
        ? enqueued.data.reason
        : enqueued.ok ? "ENQUEUE_RESPONSE_INVALID" : "ENQUEUE_REJECTED";
      if (makeAcquisition.queued || makeAcquisition.reason === "ACTIVE_REQUEST_EXISTS") {
        makeAcquisition.dispatch_scheduled = scheduleMakeDispatch(base, key);
      }
    } catch {
      makeAcquisition.reason = "ENQUEUE_UNAVAILABLE";
    }
  }

  response.m1b_meta.make_acquisition = makeAcquisition;
  return json(response);
}

function emptyCore(profile: string) {
  return {
    contract_version: "SP-US2/1.0",
    status: "SOURCE_SHORTFALL_BELOW_SIX",
    profile,
    search_mode: "CATEGORY",
    selected_pack: { text: null, normalized_key: null, source: null },
    products: [],
    trust_promise: "We determine safety from qualified ingredient evidence when possible. If ingredient evidence is insufficient, the product may still be shown with a clear notice that its Safety Score could not be determined.",
    m1b_meta: { run_id: crypto.randomUUID(), engine: "CACHE", m1br_queued_count: 0, foreground_latency_ms: 0 },
  };
}

Deno.serve(async (req: Request) => {
  const started = Date.now();
  if (req.method !== "POST") return json({ success: false, code: "METHOD_NOT_ALLOWED" }, 405);

  let input: Obj;
  try { input = await req.json(); } catch { return json({ success: false, code: "INVALID_JSON" }, 400); }
  const query = typeof input.query === "string" ? input.query.trim() : "";
  if (!query || query.length > 200) return json({ success: false, code: "QUERY_INVALID" }, 400);

  const limit = Math.max(1, Math.min(Math.trunc(Number(input.limit) || 10), 10));
  const profile = typeof input.profile === "string" && input.profile.trim() ? input.profile.trim() : "all";
  const overallDeadline = Math.max(8000, Math.min(Math.trunc(Number(input.foreground_deadline_ms) || 25000), 30000));
  const base = Deno.env.get("SUPABASE_URL") ?? "";
  if (!base) return json({ success: false, code: "SERVER_CONFIGURATION_MISSING" }, 503);

  const key = adminKey();
  const coreBudget = Math.min(22000, Math.max(5000, overallDeadline - 6500)); // Restore M1-B acquisition window without bypassing overall deadline.
  let coreResponse: Obj = emptyCore(profile.toUpperCase());
  try {
    const core = await invokeCore(base, req, { ...input, query, limit, foreground_deadline_ms: coreBudget }, coreBudget + 1500);
    if (core.ok && core.data && typeof core.data === "object") coreResponse = core.data;
  } catch { /* candidate discovery can still provide a fail-closed unscored result set */ }

  const searchMode = coreResponse.search_mode === "SPECIFIC_PRODUCT" ? "SPECIFIC_PRODUCT" : "CATEGORY";
  let selectedPackKey = parsePackKeyFromText(query)
    ?? (typeof coreResponse?.selected_pack?.normalized_key === "string" ? coreResponse.selected_pack.normalized_key : null);
  let googleClusterTelemetry: Obj | null = searchMode === "SPECIFIC_PRODUCT"
    ? null
    : { attempted: false, reason: "NOT_SPECIFIC_PRODUCT", shopping_calls: 0, stores_calls: 0 };
  let workingCore = coreResponse;

  const clusterNeed = googleClusterAcquisitionNeed(workingCore);
  const remainingForCluster = overallDeadline - (Date.now() - started);
  if (clusterNeed.eligible && key && selectedPackKey && remainingForCluster > 5000) {
    try {
      const clusterBudget = Math.min(9500, Math.max(2000, remainingForCluster - 3000));
      const cluster = await invokeGoogleCluster(base, key, {
        query,
        anchor_product: workingCore.anchor_product,
        requested_pack_key: selectedPackKey,
        target_exact_offers: clusterNeed.targetExactOffers,
      }, clusterBudget);
      if (cluster.data && typeof cluster.data === "object") {
        const clusterData = cluster.data;
        googleClusterTelemetry = {
          attempted: clusterData.attempted === true,
          reason: typeof clusterData.reason === "string"
            ? clusterData.reason
            : cluster.ok ? "CLUSTER_RESPONSE_INVALID" : "CLUSTER_INVOCATION_REJECTED",
          ...(clusterData.telemetry && typeof clusterData.telemetry === "object" ? clusterData.telemetry : {}),
        };
        if (Array.isArray(clusterData.exact_offers) && clusterData.exact_offers.length) {
          workingCore = mergeGoogleClusterExactOffers(workingCore, clusterData.exact_offers, selectedPackKey);
        }
      } else {
        googleClusterTelemetry = {
          attempted: true,
          reason: cluster.ok ? "CLUSTER_RESPONSE_INVALID" : "CLUSTER_INVOCATION_REJECTED",
          shopping_calls: 0,
          stores_calls: 0,
        };
      }
    } catch { /* cluster acquisition remains fail-open */
      googleClusterTelemetry = {
        attempted: true,
        reason: "CLUSTER_INVOCATION_UNAVAILABLE",
        shopping_calls: 0,
        stores_calls: 0,
      };
    }
  } else if (searchMode === "SPECIFIC_PRODUCT") {
    googleClusterTelemetry = {
      attempted: false,
      reason: !clusterNeed.eligible
        ? "EXACT_COVERAGE_SUFFICIENT"
        : !key
          ? "SERVER_KEY_UNAVAILABLE"
          : !selectedPackKey
            ? "PACK_UNRESOLVED"
            : "DEADLINE_BUDGET_INSUFFICIENT",
      shopping_calls: 0,
      stores_calls: 0,
    };
  }

  const coreProducts = Array.isArray(workingCore.products) ? workingCore.products : [];
  if (coreProducts.length >= 6 && !coreNeedsDiscovery(workingCore, limit)) {
    const response = mergeSearchResponses(workingCore, null, { query, limit });
    return finalizeSearchResponse({
      response, base, key, query, limit, input, started,
      discoveryTelemetry: null, googleClusterTelemetry,
    });
  }

  const remainingForDiscovery = overallDeadline - (Date.now() - started);
  if (!key || remainingForDiscovery <= 2000 || !coreNeedsDiscovery(workingCore, limit)) {
    const response = mergeSearchResponses(workingCore, null, { query, limit });
    return finalizeSearchResponse({
      response, base, key, query, limit, input, started,
      discoveryTelemetry: null, googleClusterTelemetry,
    });
  }

  const discoveryQuery = searchMode === "SPECIFIC_PRODUCT"
    ? specificAlternativeQuery(workingCore, query)
    : query;
  let discoveryTelemetry: Obj | null = null;
  let discoveredProducts: Obj[] = [];
  let discoveryResponse: Obj | null = null;

  try {
    const discovery = await invokeDiscovery(base, key, {
      query: discoveryQuery,
      acquisition_query: query,
      profile: workingCore.profile ?? profile.toUpperCase(),
      limit,
      target_count: discoveryTargetCount(workingCore, limit),
      requested_pack_key: selectedPackKey,
      allow_paid_discovery: remainingForDiscovery > 6000,
    }, Math.min(10500, Math.max(1500, remainingForDiscovery - 500)));
    if (discovery.ok && discovery.data && typeof discovery.data === "object") {
      discoveryResponse = discovery.data;
      discoveryTelemetry = discovery.data.telemetry && typeof discovery.data.telemetry === "object" ? discovery.data.telemetry : null;
      discoveredProducts = Array.isArray(discovery.data.products) ? discovery.data.products : [];
      const discoveryPackKey = typeof discovery.data?.selected_pack?.normalized_key === "string"
        ? discovery.data.selected_pack.normalized_key
        : null;
      if (!selectedPackKey && discoveryPackKey) selectedPackKey = discoveryPackKey;
      if (selectedPackKey && discoveryResponse?.selected_pack && !discoveryResponse.selected_pack.normalized_key) {
        discoveryResponse.selected_pack.normalized_key = selectedPackKey;
      }
    }
  } catch { /* core response remains valid and fail-closed */ }

  const mergedDiscovery = discoveryResponse
    ? { ...discoveryResponse, products: discoveredProducts, telemetry: discoveryTelemetry }
    : null;
  const response = mergeSearchResponses(workingCore, mergedDiscovery, { query, limit });
  return finalizeSearchResponse({
    response, base, key, query, limit, input, started,
    discoveryTelemetry, googleClusterTelemetry,
  });
});
