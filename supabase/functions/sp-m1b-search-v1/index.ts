import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { parsePack, chooseLaunchStandardPack, classifySearchMode, isExactAnchorQuery, packDisplayTextFromQuery } from "./query-policy.mjs";
import { composeSpecificResults, composeCategoryResults } from "./result-composition.mjs";
import { computeBestChoice, orderDistinctProducts, orderExactOffers } from "./ranking-policy.mjs";

type Obj = Record<string, any>;
type Profile = "all" | "children" | "pregnant" | "seniors";
type Input = {
  query: string;
  profile?: Profile;
  limit?: number;
  category?: string;
  location?: string | null;
  foreground_deadline_ms?: number;
};

const FUNCTION_VERSION = "SP-US2/1.0";
const RANKING_VERSION = "SP-US2-RANKING/1.0";
const TRUST_PROMISE = "We determine safety from qualified ingredient evidence when possible. If ingredient evidence is insufficient, the product may still be shown with a clear notice that its Safety Score could not be determined.";

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
  throw new Error("SUPABASE_SERVER_KEY_UNAVAILABLE");
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

async function rpc(base: string, key: string, name: string, body: Obj, timeout = 8000) {
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

function profileToken(profile: Profile) {
  return profile === "children" ? "CHILDREN"
    : profile === "pregnant" ? "PREGNANT"
    : profile === "seniors" ? "SENIORS"
    : "ALL";
}

function cleanHttps(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function numberOrNull(value: unknown) {
  const number = typeof value === "number" ? value
    : typeof value === "string" && value.trim() ? Number(value)
    : NaN;
  return Number.isFinite(number) ? number : null;
}

function decorateCache(response: Obj, runId: string, elapsed: number) {
  return {
    ...response,
    contract_version: "SP-US2/1.0",
    products: Array.isArray(response.products)
      ? response.products.map((product: any) => ({ ...product, engine: "CACHE", recovery_status: null }))
      : [],
    m1b_meta: {
      ...(response.m1b_meta && typeof response.m1b_meta === "object" ? response.m1b_meta : {}),
      run_id: runId,
      engine: "CACHE",
      m1br_queued_count: 0,
      foreground_latency_ms: elapsed,
    },
  };
}

function offerFor(candidate: Obj) {
  return candidate.offer && typeof candidate.offer === "object" ? candidate.offer : {};
}

function cardPack(candidate: Obj) {
  const explicit = typeof candidate.pack_normalized_key === "string" && candidate.pack_normalized_key
    ? candidate.pack_normalized_key
    : null;
  return explicit ?? parsePack(candidate.pack_size_text).key;
}

function packFromRecord(record: Obj | null) {
  if (!record) return null;
  const key = typeof record.pack_normalized_key === "string" && record.pack_normalized_key.trim()
    ? record.pack_normalized_key.trim()
    : null;
  const value = numberOrNull(record.pack_normalized_value);
  const unit = typeof record.pack_normalized_unit === "string" && record.pack_normalized_unit.trim()
    ? record.pack_normalized_unit.trim().toLowerCase()
    : null;
  if (key && value !== null && unit) return { explicit: true, key, value, unit };
  const parsed = parsePack(record.pack_size_text);
  return parsed?.explicit ? parsed : null;
}

function packDisplayText(key: string | null, records: Obj[]) {
  if (!key) return null;
  for (const record of records) {
    const pack = packFromRecord(record);
    if (pack?.key === key && typeof record.pack_size_text === "string" && record.pack_size_text.trim()) {
      return record.pack_size_text.trim();
    }
  }
  return key;
}

function trustedPackRecords(candidates: Obj[]) {
  const out: Obj[] = [];
  for (const candidate of candidates) {
    const offer = offerFor(candidate);
    if (offer.verified !== true || offer.exact_pack_match !== true) continue;
    if (!cleanHttps(offer.source_url)) continue;
    const pack = packFromRecord(offer);
    if (!pack) continue;
    out.push({ ...offer, ...pack, pack_size_text: offer.pack_size_text ?? candidate.pack_size_text ?? null });
  }
  return out;
}

function officialDefaultPackRecords(candidates: Obj[]) {
  const out: Obj[] = [];
  for (const candidate of candidates) {
    const sourceKind = String(candidate?.pack_source_kind ?? "").toUpperCase();
    if (candidate?.pack_is_official_default !== true || !sourceKind.startsWith("OFFICIAL_")) continue;
    const pack = packFromRecord(candidate);
    if (!pack) continue;
    out.push({
      ...pack,
      brand_name: candidate.brand_name ?? null,
      source_domain: candidate.pack_source_domain ?? candidate.source_domain ?? null,
      source_lineage: candidate.pack_source_id ?? candidate.product_id ?? null,
      pack_size_text: candidate.pack_size_text ?? null,
    });
  }
  return out;
}

function baseCard(candidate: Obj) {
  return {
    canonical_product_id: String(candidate.product_id ?? candidate.canonical_product_id ?? ""),
    canonical_product_fingerprint: String(candidate.product_fingerprint ?? candidate.canonical_product_fingerprint ?? ""),
    merchant_offer_id: candidate.offer?.id ?? null,
    pack_size_text: candidate.pack_size_text ?? null,
    pack_normalized_key: cardPack(candidate),
  };
}

function fallbackCard(candidate: Obj, recoveryStatus: string, failureCode: string | null) {
  const offer = offerFor(candidate);
  const price = numberOrNull(offer.price);
  const sourceUrl = cleanHttps(offer.affiliate_url) ?? cleanHttps(offer.source_url);
  return {
    ...baseCard(candidate),
    product_fingerprint: String(candidate.product_fingerprint ?? ""),
    product_name: String(candidate.product_name ?? "Product"),
    brand_name: typeof candidate.brand_name === "string" ? candidate.brand_name : null,
    category: typeof candidate.category === "string" ? candidate.category : "",
    offer_merchant: typeof offer.merchant_name === "string" && offer.merchant_name.trim()
      ? offer.merchant_name
      : typeof offer.platform_name === "string" ? offer.platform_name : null,
    price: price !== null && price > 0 ? price : null,
    price_text: price !== null && price > 0 ? `₹${price}` : null,
    currency: typeof offer.currency === "string" ? offer.currency.toUpperCase() : "INR",
    original_product_url: sourceUrl,
    image_url: cleanHttps(offer.image_url) ?? cleanHttps(candidate.image_url),
    safety_score: null,
    profile_score: null,
    child_score: null,
    pregnancy_score: null,
    senior_score: null,
    display_basis: "PRICE_ONLY_FALLBACK",
    safety_determined: false,
    safety_status_label: "Safety Score could not be determined due to insufficient ingredient evidence.",
    safety_unavailable_reason: failureCode ?? "INSUFFICIENT_INGREDIENT_EVIDENCE",
    ingredient_qualification_decision: "NOT_QUALIFIED",
    safety_warnings: [],
    engine: "M1-B",
    recovery_status: recoveryStatus,
  };
}

function selectedProfileScore(safety: Obj, profile: Profile) {
  const general = numberOrNull(safety.safety_score);
  if (profile === "children") return numberOrNull(safety.child_score) ?? general;
  if (profile === "pregnant") return numberOrNull(safety.pregnancy_score) ?? general;
  if (profile === "seniors") return numberOrNull(safety.senior_score) ?? general;
  return general;
}

function recommendation(score: number | null) {
  if (score === null) return null;
  if (score < 55) return "avoid";
  if (score < 75) return "caution";
  return "acceptable";
}

function qualifiedCard(
  candidate: Obj,
  safety: Obj,
  profile: Profile,
  engine: "CACHE" | "M1-B",
  ingredientConfidence: unknown = null,
) {
  const offer = offerFor(candidate);
  const price = numberOrNull(offer.price);
  const sourceUrl = cleanHttps(offer.affiliate_url) ?? cleanHttps(offer.source_url);
  const safetyScore = numberOrNull(safety.safety_score);
  const profileScore = numberOrNull(safety.profile_score) ?? selectedProfileScore(safety, profile);
  const warnings = Array.isArray(safety.warnings)
    ? safety.warnings.filter((item: unknown) => typeof item === "string")
    : [];
  return {
    ...baseCard(candidate),
    product_fingerprint: String(candidate.product_fingerprint ?? ""),
    product_name: String(candidate.product_name ?? "Product"),
    brand_name: typeof candidate.brand_name === "string" ? candidate.brand_name : null,
    category: typeof candidate.category === "string" ? candidate.category : "",
    offer_merchant: typeof offer.merchant_name === "string" && offer.merchant_name.trim()
      ? offer.merchant_name
      : typeof offer.platform_name === "string" ? offer.platform_name : null,
    price: price !== null && price > 0 ? price : null,
    price_text: price !== null && price > 0 ? `₹${price}` : null,
    currency: typeof offer.currency === "string" ? offer.currency.toUpperCase() : "INR",
    original_product_url: sourceUrl,
    image_url: cleanHttps(offer.image_url) ?? cleanHttps(candidate.image_url),
    safety_score: safetyScore,
    profile_score: profileScore,
    child_score: numberOrNull(safety.child_score),
    pregnancy_score: numberOrNull(safety.pregnancy_score),
    senior_score: numberOrNull(safety.senior_score),
    display_basis: "SAFETY_QUALIFIED",
    safety_determined: true,
    safety_status_label: "Regulatory safety assessment available",
    safety_unavailable_reason: null,
    ingredient_qualification_decision: "QUALIFIED",
    recommendation_class: safety.recommendation_class ?? recommendation(profileScore),
    safety_warnings: warnings,
    overall_confidence: numberOrNull(ingredientConfidence) ?? numberOrNull(safety.determination_confidence),
    score_label: "Regulatory Safety Score",
    assessment_display_label: "Independent regulatory-data assessment available",
    assessment_source: "SafeProducts independent assessment",
    assessment_disclaimer: "Independent informational assessment based on qualified ingredient and applicable regulatory evidence; not regulatory certification or medical advice.",
    engine,
    recovery_status: "NOT_REQUIRED",
  };
}

async function invokePathA(base: string, key: string, input: Obj, timeout: number) {
  const headers = restHeaders(key);
  headers["x-m1b-internal-key"] = key;
  const response = await fetch(`${base.replace(/\/$/, "")}/functions/v1/sp-m1b-path-a-v1`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(Math.max(1000, timeout)),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`PATH_A_${response.status}`);
  return text.trim() ? JSON.parse(text) : {};
}

async function invokeCommerce(base: string, key: string, input: Obj, timeout: number) {
  const headers = restHeaders(key);
  headers["x-us2-internal-key"] = key;
  const response = await fetch(`${base.replace(/\/$/, "")}/functions/v1/sp-us2-commerce-v1`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(Math.max(1000, timeout)),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`COMMERCE_${response.status}`);
  return text.trim() ? JSON.parse(text) : {};
}

Deno.serve(async (req: Request) => {
  const started = Date.now();
  const requestId = crypto.randomUUID();
  if (req.method !== "POST") return json({ success: false, code: "METHOD_NOT_ALLOWED", request_id: requestId }, 405);

  let input: Input;
  try { input = await req.json(); } catch {
    return json({ success: false, code: "INVALID_JSON", request_id: requestId }, 400);
  }

  const query = typeof input.query === "string" ? input.query.trim() : "";
  const profile: Profile = ["all", "children", "pregnant", "seniors"].includes(String(input.profile))
    ? input.profile!
    : "all";
  const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 10);
  const category = typeof input.category === "string" && input.category.trim() ? input.category.trim() : "ALL";
  const location = typeof input.location === "string" && input.location.trim() ? input.location.trim() : null;
  const foreground_deadline_ms = Math.min(Math.max(Number(input.foreground_deadline_ms) || 25000, 5000), 30000);
  if (!query || query.length > 200) return json({ success: false, code: "QUERY_INVALID", request_id: requestId }, 400);

  const base = Deno.env.get("SUPABASE_URL") ?? "";
  if (!base) return json({ success: false, code: "SERVER_CONFIGURATION_MISSING", request_id: requestId }, 503);
  let key: string;
  try { key = adminKey(); } catch {
    return json({ success: false, code: "SUPABASE_SERVER_KEY_UNAVAILABLE", request_id: requestId }, 500);
  }

  try {
    const cache = await rpc(base, key, "sp_prod1_read_search_result_cache_v1", {
      p_search_query: query,
      p_category: category,
      p_user_profile: profileToken(profile),
      p_location: location,
      p_contract_version: "SP-US2/1.0",
    }, Math.min(5000, foreground_deadline_ms));
    if (
      cache.ok
      && cache.data?.hit === true
      && cache.data?.response
      && typeof cache.data.response === "object"
      && cache.data.response.contract_version === "SP-US2/1.0"
    ) {
      const cacheRunId = typeof cache.data.source_search_id === "string" ? cache.data.source_search_id : requestId;
      return json(decorateCache(cache.data.response, cacheRunId, Date.now() - started));
    }

    const initial = await rpc(base, key, "sp_m1b_search_catalog_candidates_v1", {
      p_query: query,
      p_category: category,
      p_limit: limit,
    }, Math.min(5000, Math.max(1000, foreground_deadline_ms - (Date.now() - started))));
    const candidates = initial.ok && Array.isArray(initial.data?.candidates)
      ? initial.data.candidates.slice(0, limit)
      : [];
    const anchorCandidate = candidates[0] ?? null;
    const searchMode = classifySearchMode({ anchorExact: isExactAnchorQuery(query, anchorCandidate) });
    const explicitPack = parsePack(query);

    const officialPackKind = String(anchorCandidate?.pack_source_kind ?? "").toUpperCase();
    const officialDefault = searchMode === "SPECIFIC_PRODUCT"
      && anchorCandidate?.pack_is_official_default === true
      && officialPackKind.startsWith("OFFICIAL_")
      ? packFromRecord(anchorCandidate)
      : null;
    const officialDefaults: Obj[] = searchMode === "CATEGORY"
      ? officialDefaultPackRecords(candidates)
      : [];

    const trustedOfferPacks: Obj[] = trustedPackRecords(candidates);
    const anchorIdForPack = typeof anchorCandidate?.product_id === "string" ? anchorCandidate.product_id : null;
    if (searchMode === "SPECIFIC_PRODUCT" && anchorIdForPack && (explicitPack.explicit || !officialDefault)) {
      const lookupPacks = explicitPack.explicit ? [explicitPack.key] : [null];
      for (const lookupPack of lookupPacks) {
        const cachedOffers = await rpc(base, key, "sp_us2_exact_offers_v1", {
          p_product_id: anchorIdForPack,
          p_pack_normalized_key: lookupPack,
          p_limit: 10,
        }, 3000).catch(() => ({ ok: false, data: null }));
        const rows = cachedOffers.ok && Array.isArray(cachedOffers.data) ? cachedOffers.data : [];
        for (const offer of rows) {
          if (offer?.verified !== true || offer?.exact_pack_match !== true || !cleanHttps(offer?.source_url)) continue;
          const pack = packFromRecord(offer);
          if (pack) trustedOfferPacks.push({ ...offer, ...pack });
        }
      }
    }

    const selectedPack = chooseLaunchStandardPack({
      searchMode,
      explicitUserPack: explicitPack.explicit ? explicitPack : null,
      officialDefault,
      officialDefaults: officialDefaults,
      trustedOffers: trustedOfferPacks,
    });
    const selectedPackKey = selectedPack?.key ?? null;
    const selectedPackSource: "USER" | "OFFICIAL_DEFAULT" | "TRUSTED_MERCHANT_MODE" | null = explicitPack.explicit
      ? "USER"
      : searchMode === "SPECIFIC_PRODUCT" && officialDefault && selectedPackKey === officialDefault.key
        ? "OFFICIAL_DEFAULT"
        : searchMode === "CATEGORY" && officialDefaults.some((pack) => pack.key === selectedPackKey)
          ? "OFFICIAL_DEFAULT"
          : selectedPackKey
            ? "TRUSTED_MERCHANT_MODE"
            : null;
    const requestedPackText = explicitPack.explicit ? packDisplayTextFromQuery(query) ?? explicitPack.key : null;
    const selectedPackText = explicitPack.explicit
      ? requestedPackText ?? selectedPackKey
      : selectedPackSource === "OFFICIAL_DEFAULT"
        ? searchMode === "SPECIFIC_PRODUCT"
          ? anchorCandidate?.pack_size_text ?? selectedPackKey
          : packDisplayText(selectedPackKey, officialDefaults)
        : packDisplayText(selectedPackKey, trustedOfferPacks);

    if (anchorCandidate?.category) {
      const extra = await rpc(base, key, "sp_us2_category_cards_v1", {
        p_category: anchorCandidate.category,
        p_exclude_product_id: searchMode === "SPECIFIC_PRODUCT" ? anchorCandidate.product_id : null,
        p_pack_normalized_key: selectedPackKey,
        p_limit: 10,
      }, 3500).catch(() => ({ ok: false, data: null }));
      const cards = extra.ok && Array.isArray(extra.data?.cards) ? extra.data.cards : [];
      const seen = new Set(candidates.map((candidate: any) => String(candidate.product_id)));
      for (const card of cards) {
        if (!seen.has(String(card.product_id))) {
          candidates.push(card);
          seen.add(String(card.product_id));
        }
        if (candidates.length >= 10) break;
      }
    }

    const products: Obj[] = [];
    let m1brQueued = 0;
    let firstRunId: string | null = null;
    let pathACalled = false;
    const runIdsByProduct = new Map<string, string>();

    for (const candidate of candidates.slice(0, 10)) {
      const cachedSafety = candidate.strict_safety && typeof candidate.strict_safety === "object"
        ? candidate.strict_safety
        : null;
      if (cachedSafety?.assessment_status === "QUALIFIED" && numberOrNull(cachedSafety.safety_score) !== null) {
        products.push(qualifiedCard(candidate, cachedSafety, profile, "CACHE"));
        continue;
      }

      const elapsed = Date.now() - started;
      if (elapsed >= foreground_deadline_ms - 750) {
        products.push(fallbackCard(candidate, "NOT_STARTED_DEADLINE", "M1-B foreground deadline reached"));
        continue;
      }
      const productId = typeof candidate.product_id === "string" ? candidate.product_id : null;
      const fingerprint = typeof candidate.product_fingerprint === "string" ? candidate.product_fingerprint : "";
      if (!productId || !fingerprint) continue;

      const begun = await rpc(base, key, "sp_m1b_begin_run_v1", {
        p_context: "NORMAL_SEARCH",
        p_product_id: productId,
        p_product_fingerprint: fingerprint,
        p_benchmark_slot_id: null,
        p_session_key: null,
      }, 4000);
      const runId = begun.ok && typeof begun.data?.run_id === "string" ? begun.data.run_id : null;
      if (!runId) {
        products.push(fallbackCard(candidate, "BEGIN_FAILED", "M1-B orchestration unavailable"));
        continue;
      }
      runIdsByProduct.set(productId, runId);
      if (!firstRunId) firstRunId = runId;
      pathACalled = true;

      let pathA: Obj = {};
      try {
        const remaining = Math.max(1000, foreground_deadline_ms - (Date.now() - started) - 500);
        pathA = await invokePathA(base, key, {
          run_id: runId,
          product_id: productId,
          query,
          identity: {
            brand_name: candidate.brand_name,
            product_name: candidate.product_name,
            variant: candidate.variant_name ?? undefined,
            pack_size_text: candidate.pack_size_text ?? undefined,
            market_country_code: candidate.market_country_code ?? "IN",
            gtin: candidate.gtin ?? undefined,
          },
          foreground_budget_ms: remaining,
          benchmark_mode: false,
        }, remaining);
      } catch {
        pathA = {
          ingredient_status: "INSUFFICIENT_EVIDENCE",
          failure_code: "PATH_A_FOREGROUND_TIMEOUT",
          recovery_enqueued: false,
        };
        const enqueued = await rpc(base, key, "sp_m1b_enqueue_recovery_v1", {
          p_run_id: runId,
          p_product_id: productId,
          p_failure_code: "PATH_A_FOREGROUND_TIMEOUT",
          p_payload: { identity: candidate, search_query: query },
        }, 4000).catch(() => ({ ok: false, data: null }));
        pathA.recovery_enqueued = enqueued.ok === true && enqueued.data?.success === true;
      }

      if (pathA.recovery_enqueued === true) m1brQueued += 1;
      if (pathA.ingredient_status === "QUALIFIED") {
        const scoreResult = await rpc(base, key, "sp_m1b_score_qualified_product_v1", {
          p_run_id: runId,
          p_product_id: productId,
          p_profile: profileToken(profile),
        }, Math.min(7000, Math.max(1000, foreground_deadline_ms - (Date.now() - started))))
          .catch(() => ({ ok: false, data: null }));
        if (scoreResult.ok && scoreResult.data?.score_available === true && numberOrNull(scoreResult.data?.safety_score) !== null) {
          products.push(qualifiedCard(candidate, scoreResult.data, profile, "M1-B", pathA.ingredient_confidence));
          continue;
        }
        products.push(fallbackCard(
          candidate,
          "REGULATORY_PENDING",
          typeof scoreResult.data?.reason === "string" ? scoreResult.data.reason : "REGULATORY_EVIDENCE_INCOMPLETE",
        ));
        continue;
      }
      products.push(fallbackCard(
        candidate,
        pathA.recovery_enqueued === true ? "QUEUED" : "PENDING",
        pathA.failure_code ?? null,
      ));
    }

    let composed: Obj[] = [];
    let commerceTelemetry: Obj | null = null;
    if (searchMode === "SPECIFIC_PRODUCT" && anchorCandidate) {
      const anchorId = String(anchorCandidate.product_id ?? "");
      const anchor = products.find((product) => String(product.canonical_product_id) === anchorId) ?? null;
      let offers: any[] = [];
      const remaining = foreground_deadline_ms - (Date.now() - started);
      if (anchor && remaining > 1500) {
        try {
          const anchorRunId = runIdsByProduct.get(anchorId) ?? null;
          const commerce = await invokeCommerce(base, key, {
            product_id: anchorId,
            brand_name: anchorCandidate.brand_name,
            product_name: anchorCandidate.product_name,
            variant_name: anchorCandidate.variant_name,
            pack_normalized_key: selectedPackKey,
            limit: 5,
            allow_paid_discovery: Boolean(anchorRunId),
          }, Math.min(8000, remaining));
          commerceTelemetry = commerce?.telemetry && typeof commerce.telemetry === "object" ? commerce.telemetry : null;
          if (Array.isArray(commerce.offers)) offers = commerce.offers;

          if (anchorRunId && commerceTelemetry) {
            await rpc(base, key, "sp_m1b_record_attempt_v1", {
              p_run_id: anchorRunId,
              p_engine: "M1-B",
              p_stage: "COMMERCE",
              p_status: "COMPLETED",
              p_metrics: {
                latency_ms: numberOrNull(commerceTelemetry.latency_ms) ?? 0,
                search_calls: numberOrNull(commerceTelemetry.commerce_discovery_calls) ?? 0,
                commerce_discovery_calls: numberOrNull(commerceTelemetry.commerce_discovery_calls) ?? 0,
                paid_model_calls: numberOrNull(commerceTelemetry.paid_model_calls) ?? 0,
                provider_input_tokens: numberOrNull(commerceTelemetry.provider_input_tokens) ?? 0,
                provider_output_tokens: numberOrNull(commerceTelemetry.provider_output_tokens) ?? 0,
                provider_total_tokens: numberOrNull(commerceTelemetry.provider_total_tokens) ?? 0,
                provider_usage_observed_calls: numberOrNull(commerceTelemetry.provider_usage_observed_calls) ?? 0,
                ocr_calls: 0,
                vlm_calls: 0,
                cost_usd: commerceTelemetry.cost_usd ?? null,
              },
              p_failure_code: null,
              p_detail: { source: "SP-US2-COMMERCE", telemetry: commerceTelemetry },
            }, 4000).catch(() => null);
          }
        } catch { /* cached offer below still remains usable */ }
      }
      const existing = offerFor(anchorCandidate);
      if (existing?.source_url) {
        offers.push({
          id: existing.id ?? existing.source_url,
          productId: anchorId,
          platformName: existing.platform_name,
          merchantName: existing.merchant_name,
          sourceUrl: existing.source_url,
          price: existing.price,
          currency: existing.currency,
          imageUrl: existing.image_url,
          packSizeText: existing.pack_size_text ?? anchorCandidate.pack_size_text,
          packNormalizedKey: existing.pack_normalized_key ?? cardPack(anchorCandidate),
          exactPackMatch: existing.exact_pack_match === true,
          confidence: numberOrNull(existing.offer_confidence) ?? 95,
        });
      }
      composed = anchor
        ? composeSpecificResults({
            anchor,
            offers: orderExactOffers(offers),
            alternatives: orderDistinctProducts(products.filter((product) => String(product.canonical_product_id) !== anchorId)),
            selectedPackKey,
          })
        : composeCategoryResults({ products, selectedPackKey, limit });
    } else {
      composed = orderDistinctProducts(composeCategoryResults({ products, selectedPackKey, limit }));
    }

    if (!selectedPackKey) {
      composed = composed.map((product) => ({ ...product, price: null, price_text: null }));
    }

    const safetyQualified = composed.filter((product) => product.display_basis === "SAFETY_QUALIFIED");
    const safetyPending = composed.filter((product) => product.display_basis !== "SAFETY_QUALIFIED");
    const priced = composed.filter((product) => numberOrNull(product.price) !== null && Number(product.price) > 0);
    const lowest = priced.reduce((best: Obj | null, current: Obj) =>
      !best || current.price < best.price ? current : best, null);
    const safest = safetyQualified.length
      ? safetyQualified.reduce((best: Obj, current: Obj) =>
          (numberOrNull(current.profile_score) ?? -1) > (numberOrNull(best.profile_score) ?? -1) ? current : best,
        safetyQualified[0])
      : null;
    const bestChoice = selectedPackKey ? computeBestChoice(composed) : null;
    const status = safetyQualified.length && safetyPending.length
      ? "PARTIAL_SAFETY_WITH_PRICE_FALLBACK"
      : safetyQualified.length
        ? "READY"
        : composed.length ? "PRICE_ONLY_FALLBACK_READY" : "SOURCE_SHORTFALL_BELOW_SIX";
    const safetyNotice = safetyPending.length
      ? "Some displayed products do not yet have sufficient ingredient evidence for a Safety Score."
      : safetyQualified.length
        ? "Safety Scores are based on qualified ingredient evidence for the identified product formula."
        : "No matching products were available.";

    return json({
      contract_version: "SP-US2/1.0",
      status,
      profile: profileToken(profile),
      search_mode: searchMode,
      anchor_product: searchMode === "SPECIFIC_PRODUCT" && anchorCandidate
        ? {
            canonical_product_id: String(anchorCandidate.product_id ?? ""),
            canonical_product_fingerprint: String(anchorCandidate.product_fingerprint ?? ""),
            brand_name: typeof anchorCandidate.brand_name === "string" ? anchorCandidate.brand_name : null,
            product_name: typeof anchorCandidate.product_name === "string" ? anchorCandidate.product_name : null,
            variant_name: typeof anchorCandidate.variant_name === "string" ? anchorCandidate.variant_name : null,
            category: typeof anchorCandidate.category === "string" ? anchorCandidate.category : null,
            pack_size_text: selectedPackText ?? anchorCandidate.pack_size_text ?? null,
            pack_normalized_key: selectedPackKey,
            identity_status: anchorCandidate.identity_status ?? null,
            market_country_code: anchorCandidate.market_country_code ?? "IN",
          }
        : null,
      selected_pack: {
        text: selectedPackText,
        normalized_key: selectedPackKey,
        source: selectedPackSource,
        requested_text: requestedPackText,
        requested_normalized_key: explicitPack.explicit ? explicitPack.key : null,
        fallback_applied: false,
      },
      products: composed,
      safest_product: safest,
      lowest_price_product: lowest,
      best_value_product: selectedPackKey ? bestChoice : null,
      price_fallback_count: safetyPending.length,
      safety_qualified_count: safetyQualified.length,
      fallback_safety_claim: false,
      trust_promise: TRUST_PROMISE,
      trust_promise_display_required: safetyPending.length > 0,
      consumer_notice: safetyNotice,
      ranking_version: RANKING_VERSION,
      m1b_meta: {
        run_id: firstRunId ?? requestId,
        engine: pathACalled ? "M1-B" : "CACHE",
        m1br_queued_count: m1brQueued,
        foreground_latency_ms: Date.now() - started,
        commerce_telemetry: commerceTelemetry,
      },
      function_version: FUNCTION_VERSION,
    });
  } catch (error) {
    return json({
      success: false,
      code: error instanceof DOMException && error.name === "TimeoutError" ? "TIMED_OUT" : "UNAVAILABLE",
      request_id: requestId,
      m1b_meta: {
        run_id: requestId,
        engine: "M1-B",
        m1br_queued_count: 0,
        foreground_latency_ms: Date.now() - started,
      },
    }, 503);
  }
});
