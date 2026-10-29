import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { acquisitionReuseQueries, prepareDiscoveryProducts, shouldUsePaidDiscovery, sourceUrlSupportedByProvider } from "./discovery-policy.mjs";

type Obj = Record<string, any>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
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
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json", Accept: "application/json" };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

function constantTimeEqual(a: string, b: string) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

async function rpc(base: string, key: string, name: string, body: Obj, timeout = 7000) {
  const response = await fetch(`${base.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: restHeaders(key),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const text = await response.text();
  let data: any = null;
  if (text.trim()) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  return { ok: response.ok, status: response.status, data };
}

function outputText(value: any) {
  for (const item of Array.isArray(value?.output) ? value.output : []) {
    if (item?.type !== "message") continue;
    for (const part of Array.isArray(item.content) ? item.content : []) {
      if (part?.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  return null;
}

function sourceUrls(value: any) {
  const found = new Set<string>();
  const walk = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) { for (const item of node) walk(item); return; }
    if (typeof node !== "object") return;
    if (typeof node.url === "string" && /^https:\/\//i.test(node.url)) found.add(node.url);
    for (const child of Object.values(node)) walk(child);
  };
  for (const item of Array.isArray(value?.output) ? value.output : []) {
    if (item?.type === "web_search_call") walk(item?.action?.sources);
  }
  return [...found];
}

function tokenCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

function telemetry(
  started: number,
  paidDiscoveryCalls: number,
  freeCount: number,
  usage: any = null,
  paidDiscoveryBudgetReason: string | null = null,
) {
  return {
    cache_hit: freeCount > 0,
    free_discovery_count: freeCount,
    paid_discovery_calls: paidDiscoveryCalls,
    paid_discovery_budget_reason: paidDiscoveryBudgetReason,
    provider_usage: usage ?? null,
    provider_input_tokens: tokenCount(usage?.input_tokens),
    provider_output_tokens: tokenCount(usage?.output_tokens),
    provider_total_tokens: tokenCount(usage?.total_tokens),
    provider_usage_observed_calls: usage ? paidDiscoveryCalls : 0,
    latency_ms: Date.now() - started,
    cost_usd: null,
  };
}

function resilienceRows(payload: any) {
  return Array.isArray(payload?.results) ? payload.results : [];
}

function toCard(product: Obj, staged: Obj | null) {
  const productId = staged?.product_id ? String(staged.product_id) : String(product.id ?? product.source_url ?? crypto.randomUUID());
  const fingerprint = staged?.product_fingerprint ? String(staged.product_fingerprint) : productId;
  return {
    canonical_product_id: productId,
    canonical_product_fingerprint: fingerprint,
    product_fingerprint: fingerprint,
    merchant_offer_id: null,
    product_name: String(product.product_name ?? product.name ?? "Product"),
    brand_name: typeof product.brand_name === "string" && product.brand_name.trim() ? product.brand_name.trim()
      : typeof product.brand === "string" && product.brand.trim() ? product.brand.trim() : null,
    category: typeof product.category === "string" ? product.category : "",
    offer_merchant: product.merchant_name ?? product.platform ?? product.source_name ?? null,
    price: Number.isFinite(Number(product.price)) && Number(product.price) > 0 ? Number(product.price) : null,
    price_text: Number.isFinite(Number(product.price)) && Number(product.price) > 0 ? `₹${Number(product.price)}` : null,
    currency: "INR",
    original_product_url: product.source_url ?? null,
    image_url: product.image_url ?? null,
    pack_size_text: product.pack_size_text ?? null,
    pack_normalized_key: product.pack_normalized_key ?? null,
    display_basis: "PRICE_ONLY_FALLBACK",
    safety_determined: false,
    safety_score: null,
    profile_score: null,
    child_score: null,
    pregnancy_score: null,
    senior_score: null,
    ingredient_qualification_decision: "NOT_QUALIFIED",
    safety_status_label: "Safety Score could not be determined due to insufficient ingredient evidence.",
    safety_unavailable_reason: "SEARCH_DISCOVERY_IDENTITY_OR_INGREDIENT_EVIDENCE_PENDING",
    safety_warnings: [],
    recovery_status: staged?.review_required === true
      ? "IDENTITY_REVIEW_QUEUED"
      : staged?.review_required === false
        ? "NOT_REQUIRED"
        : "IDENTITY_REVIEW_NOT_STAGED",
    result_group: "CATEGORY_PRODUCT",
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
  if (!query || query.length > 200) return json({ success: false, code: "QUERY_INVALID" }, 400);
  const acquisitionQuery = typeof input.acquisition_query === "string" && input.acquisition_query.trim()
    ? input.acquisition_query.trim()
    : query;

  const limit = Math.max(1, Math.min(Math.trunc(Number(input.limit) || 10), 10));
  const targetCount = Math.max(1, Math.min(Math.trunc(Number(input.target_count) || 6), limit));
  const profile = typeof input.profile === "string" && input.profile.trim() ? input.profile.trim() : "ALL";
  const requestedPackKey = typeof input.requested_pack_key === "string" && input.requested_pack_key.trim()
    ? input.requested_pack_key.trim()
    : null;
  const base = Deno.env.get("SUPABASE_URL") ?? "";
  if (!base) return json({ success: false, code: "SERVER_CONFIGURATION_MISSING" }, 503);

  const reuseQueries = acquisitionReuseQueries(acquisitionQuery, query);
  const acquisitionPromise = Promise.all(reuseQueries.map((reuseQuery) => rpc(
    base,
    key,
    "sp_us2_recent_acquisition_results_v1",
    {
      p_query: reuseQuery,
      p_requested_pack_key: reuseQuery === acquisitionQuery ? requestedPackKey : null,
      p_limit: limit,
    },
    3000,
  ).catch(() => ({ ok: false, status: 0, data: null }))));

  const [acquisitions, resilience, recent] = await Promise.all([
    acquisitionPromise,
    rpc(base, key, "sp_web_search_resilience_v1", { p_search_query: query, p_profile: profile, p_limit: limit }, 5000),
    rpc(base, key, "sp_web_recent_discovery_fallback_v1", { p_search_query: query, p_limit: limit }, 5000),
  ]);
  const acquisitionRows = acquisitions.flatMap((acquisition) => acquisition.ok
    ? resilienceRows(acquisition.data).map((row: Obj) => ({ ...row, acquisition_correlated: true }))
    : []);
  const primaryAcquisition = acquisitions[0] ?? { ok: false, data: null };
  const acquisitionResolvedPackKey = primaryAcquisition.ok ? primaryAcquisition.data?.resolved_pack_key ?? null : null;
  const acquisitionPackResolution = primaryAcquisition.ok ? primaryAcquisition.data?.pack_resolution ?? null : null;
  const freeRows = [
    ...acquisitionRows,
    ...(resilience.ok ? resilienceRows(resilience.data) : []),
    ...(recent.ok ? resilienceRows(recent.data) : []),
  ];
  const preparationOptions = { queryText: query, requestedPackKey, limit, acquisitionResolvedPackKey, acquisitionPackResolution };
  let prepared = prepareDiscoveryProducts(freeRows, preparationOptions);
  const effectiveRequestedPackKey = prepared.selectedPackKey ?? requestedPackKey;

  let paidDiscoveryCalls = 0;
  let paidDiscoveryBudgetReason: string | null = null;
  let usage: any = null;
  let providerRows: Obj[] = [];
  const allowPaidDiscovery = input.allow_paid_discovery === true;

  if (shouldUsePaidDiscovery({ currentCount: prepared.products.length, targetCount, allowPaidDiscovery })) {
    const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    if (!openaiKey) {
      paidDiscoveryBudgetReason = "PROVIDER_KEY_UNAVAILABLE";
    } else {
      const budgetClaim = await rpc(
        base,
        key,
        "sp_us2_claim_paid_discovery_v1",
        { p_query: query },
        1500,
      ).catch(() => ({ ok: false, status: 0, data: null }));
      paidDiscoveryBudgetReason = typeof budgetClaim.data?.reason === "string"
        ? budgetClaim.data.reason
        : budgetClaim.ok
          ? "BUDGET_RESPONSE_INVALID"
          : "BUDGET_UNAVAILABLE";

      if (budgetClaim.ok && budgetClaim.data?.allowed === true) {
        const schema = {
          type: "object",
          additionalProperties: false,
          properties: {
            products: {
              type: "array",
              maxItems: 12,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  brand_name: { type: "string" },
                  product_name: { type: "string" },
                  variant_name: { type: ["string", "null"] },
                  category: { type: ["string", "null"] },
                  pack_size_text: { type: ["string", "null"] },
                  source_url: { type: "string" },
                  source_name: { type: ["string", "null"] },
                  merchant_name: { type: ["string", "null"] },
                  price: { type: ["number", "null"] },
                  currency: { type: "string" },
                  image_url: { type: ["string", "null"] },
                  identity_confidence: { type: "number", minimum: 0, maximum: 100 },
                  india_market: { type: "boolean" },
                  direct_product_page: { type: "boolean" },
                },
                required: ["brand_name", "product_name", "variant_name", "category", "pack_size_text", "source_url", "source_name", "merchant_name", "price", "currency", "image_url", "identity_confidence", "india_market", "direct_product_page"],
              },
            },
          },
          required: ["products"],
        };
        const packInstruction = effectiveRequestedPackKey ? ` Required normalized pack: ${effectiveRequestedPackKey}.` : " Prefer products sharing the same commonly available India pack size.";
        const prompt = `SafeProducts product discovery only. Find genuine India-market products relevant to: ${query}.${packInstruction} Prefer distinct brands and direct official or trusted merchant product pages. Return visible INR prices when available. Do not research or return ingredients, safety claims, recommendations, Safety Scores, medical claims, or regulatory conclusions. Never guess product identity, pack, URL, price, or image.`;
        try {
          paidDiscoveryCalls = 1;
          const response = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: Deno.env.get("SP_US2_DISCOVERY_MODEL") ?? "gpt-5.6-luna",
              store: false,
              reasoning: { effort: "low" },
              tools: [{ type: "web_search" }],
              tool_choice: "auto",
              include: ["web_search_call.action.sources"],
              input: prompt,
              text: { format: { type: "json_schema", name: "sp_us2_product_discovery", strict: true, schema } },
            }),
            signal: AbortSignal.timeout(8000),
          });
          if (response.ok) {
            const provider = await response.json();
            usage = provider?.usage ?? null;
            const sources = sourceUrls(provider);
            let parsed: any = {};
            try { parsed = JSON.parse(outputText(provider) ?? "{}"); } catch { parsed = {}; }
            providerRows = (Array.isArray(parsed.products) ? parsed.products : [])
              .filter((row: any) => row?.india_market === true && row?.direct_product_page === true)
              .filter((row: any) => typeof row?.source_url === "string" && sourceUrlSupportedByProvider(row.source_url, sources))
              .map((row: any) => ({
                ...row,
                name: row.product_name,
                brand: row.brand_name,
                source_url: row.source_url,
                price: row.price,
                currency: row.currency,
              }));
          }
        } catch { /* return validated free discovery below */ }
      }
    }
  } else {
    paidDiscoveryBudgetReason = allowPaidDiscovery ? "FREE_RESULTS_SUFFICIENT" : "PAID_DISCOVERY_DISABLED";
  }

  if (providerRows.length) {
    prepared = prepareDiscoveryProducts([...freeRows, ...providerRows], preparationOptions);
  }

  const cards: Obj[] = [];
  for (const product of prepared.products.slice(0, limit)) {
    const brandName = typeof product.brand_name === "string" && product.brand_name.trim() ? product.brand_name.trim()
      : typeof product.brand === "string" && product.brand.trim() ? product.brand.trim() : "";
    const productName = typeof product.product_name === "string" && product.product_name.trim() ? product.product_name.trim()
      : typeof product.name === "string" ? product.name.trim() : "";
    let staged: Obj | null = null;
    if (product.acquisition_correlated === true && typeof product.product_id === "string") {
      staged = {
        product_id: product.product_id,
        product_fingerprint: product.product_fingerprint ?? product.product_id,
        review_required: true,
      };
    } else if (brandName && productName && typeof product.source_url === "string") {
      const result = await rpc(base, key, "sp_catalog_stage_search_discovery_v1", {
        p_payload: {
          brand_name: brandName,
          product_name: productName,
          variant_name: product.variant_name ?? null,
          pack_size_text: product.pack_size_text ?? null,
          category: product.category ?? null,
          source_url: product.source_url,
          source_name: product.source_name ?? product.platform ?? product.merchant_name ?? null,
          identity_confidence: product.identity_confidence ?? null,
        },
      }, 4000).catch(() => ({ ok: false, data: null }));
      if (result.ok && result.data?.success === true) staged = result.data;
    }
    cards.push(toCard(product, staged));
  }

  return json({
    success: true,
    status: cards.length >= targetCount ? "DISCOVERY_TARGET_MET" : cards.length ? "DISCOVERY_PARTIAL" : "DISCOVERY_EMPTY",
    selected_pack: {
      normalized_key: prepared.selectedPackKey,
      text: prepared.selectedPackKey?.replace(":", " ") ?? null,
      source: prepared.fallbackApplied ? "MARKET_STANDARD_FALLBACK" : requestedPackKey ? "USER" : prepared.selectedPackKey ? "TRUSTED_DISCOVERY_MODE" : null,
      requested_normalized_key: requestedPackKey,
      requested_text: requestedPackKey?.replace(":", " ") ?? null,
      fallback_applied: prepared.fallbackApplied === true,
    },
    products: cards,
    telemetry: telemetry(started, paidDiscoveryCalls, freeRows.length, usage, paidDiscoveryBudgetReason),
  });
});