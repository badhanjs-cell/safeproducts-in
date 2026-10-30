import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { evidenceTierV2, finalConfidence, qualifiesOfficialV2, qualifiesTrustedV2 } from "./qualification.mjs";
import { chooseDisplayImage } from "./image-policy.mjs";

const ENGINE = "M1-B";
const ENGINE_VERSION = "SP-M1B-PATH-A/2.1";
const QUALIFICATION_POLICY_VERSION = "M1B_QUALIFICATION_V2";
const DEFAULT_MODEL = "gpt-5.6-luna";
type Obj = Record<string, any>;
type Identity = {
  brand_name: string;
  product_name: string;
  variant?: string;
  pack_size_text?: string;
  market_country_code?: string;
  gtin?: string;
};
type Input = {
  run_id: string;
  product_id?: string;
  query?: string;
  identity: Identity;
  foreground_budget_ms: number;
  benchmark_mode?: boolean;
};

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

function constantTimeEqual(a: string, b: string) {
  const enc = new TextEncoder();
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i += 1) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

function headers(key: string) {
  const h: Record<string, string> = {
    apikey: key,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (!key.startsWith("sb_secret_")) h.Authorization = `Bearer ${key}`;
  return h;
}

async function rpc(base: string, key: string, name: string, body: Obj, timeout = 12000) {
  const response = await fetch(`${base.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: headers(key),
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

async function rest(base: string, key: string, path: string, timeout = 8000) {
  const response = await fetch(`${base.replace(/\/$/, "")}/rest/v1/${path}`, {
    headers: headers(key),
    signal: AbortSignal.timeout(timeout),
  });
  const text = await response.text();
  let data: any = null;
  if (text.trim()) {
    try { data = JSON.parse(text); } catch { data = null; }
  }
  return { ok: response.ok, status: response.status, data };
}

function host(url: string) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; }
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

function tokenCount(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

function providerUsageMetrics(providerUsage: any) {
  return {
    provider_input_tokens: tokenCount(providerUsage?.input_tokens),
    provider_output_tokens: tokenCount(providerUsage?.output_tokens),
    provider_total_tokens: tokenCount(providerUsage?.total_tokens),
  };
}

function sourceUrls(value: any) {
  const out = new Set<string>();
  const walk = (x: any) => {
    if (!x) return;
    if (Array.isArray(x)) { for (const y of x) walk(y); return; }
    if (typeof x !== "object") return;
    if (typeof x.url === "string" && /^https:\/\//i.test(x.url)) out.add(x.url);
    for (const y of Object.values(x)) walk(y);
  };
  for (const item of Array.isArray(value?.output) ? value.output : []) {
    if (item?.type === "web_search_call") walk(item?.action?.sources);
  }
  return [...out];
}

function supported(url: string, sources: string[]) {
  const h = host(url);
  return !!h && sources.some((source) => source === url || host(source) === h);
}

function normalizedList(value: any) {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const clean = item.trim().replace(/\s+/g, " ");
    if (clean && clean.length <= 300 && !out.some((x) => x.toLowerCase() === clean.toLowerCase())) out.push(clean);
  }
  return out.slice(0, 250);
}

function trustedHosts() {
  return new Set(
    (Deno.env.get("SP_M1B_TRUSTED_DOMAINS") ?? "1mg.com,tata1mg.com,netmeds.com,apollopharmacy.in,nykaa.com,amazon.in,flipkart.com,firstcry.com,pharmeasy.in,healthkart.com,tirabeauty.com,purplle.com,clinikally.com,jiomart.com,blinkit.com,zeptonow.com,bigbasket.com,myshopify.com")
      .split(",")
      .map((x) => x.trim().toLowerCase().replace(/^www\./, ""))
      .filter(Boolean),
  );
}

function scoreCandidate(candidate: any, officialHosts: Set<string>, trusted: Set<string>, corroboration: number) {
  const h = host(String(candidate.source_url ?? ""));
  const claimed = String(candidate.source_kind ?? "").toUpperCase();
  const official = !!h && (officialHosts.size === 0 || officialHosts.has(h)) && claimed.startsWith("OFFICIAL");
  const trust = !!h && (trusted.has(h) || claimed === "TRUSTED_RETAILER" || claimed === "OFFICIAL_SHOPIFY" || claimed === "MARKETPLACE");
  const sourceAuthority = official ? 100 : trust ? 96 : claimed === "OPEN_DATABASE" ? 80 : 65;
  const exactIdentity = candidate.exact_product_match === true;
  const packRequired = Boolean(candidate.pack_required);
  const packMarketResolved = candidate.market_match === true && (!packRequired || candidate.pack_match === true);
  const variantRequired = Boolean(candidate.variant_required);
  const variantOk = !variantRequired || candidate.variant_match === true;
  const ingredients = normalizedList(candidate.ingredients);
  const hardGates = {
    exactIdentity: exactIdentity && variantOk,
    packMarketResolved,
    completeDeclaration: candidate.declaration_complete === true && ingredients.length > 0,
    notTruncated: candidate.not_truncated === true,
    provenanceComplete: !!h,
    extractionAcceptable: candidate.extraction_mode === "STRUCTURED_TEXT" || candidate.extraction_mode === "VISIBLE_PAGE_TEXT",
    sufficientlyFresh: candidate.live_page === true,
    unresolvedConflict: candidate.conflict === true,
  };
  const components = {
    sourceAuthority,
    identity: hardGates.exactIdentity && hardGates.packMarketResolved ? 100 : 0,
    completeness: hardGates.completeDeclaration ? 100 : 0,
    extraction: candidate.extraction_mode === "STRUCTURED_TEXT" ? 100 : candidate.extraction_mode === "VISIBLE_PAGE_TEXT" ? 98 : 70,
    freshness: candidate.live_page === true ? 95 : 70,
    lineage: 100,
    corroboration,
    conflictPenalty: candidate.conflict === true ? 100 : 0,
    hardGates,
  };
  const confidence = finalConfidence(components);
  return { official, trust, ingredients, components, confidence, evidenceTier: evidenceTierV2(confidence) };
}

function sameIngredients(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((x, i) => x.toLowerCase() === b[i]?.toLowerCase());
}

function toDisplayImage(candidate: any) {
  if (!candidate) return null;
  return {
    image_url: candidate.imageUrl,
    source_url: candidate.sourceUrl,
    source_kind: candidate.sourceKind,
    width_px: candidate.widthPx ?? null,
    height_px: candidate.heightPx ?? null,
    exact_product_match: true,
  };
}

async function discover(input: Input, openaiKey: string, officialHosts: Set<string>, budget: number) {
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      evidence: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            source_url: { type: "string" },
            source_kind: { type: "string", enum: ["OFFICIAL_BRAND", "OFFICIAL_SHOPIFY", "TRUSTED_RETAILER", "OPEN_DATABASE", "MARKETPLACE"] },
            ingredients: { type: "array", items: { type: "string" }, maxItems: 250 },
            declaration_complete: { type: "boolean" },
            not_truncated: { type: "boolean" },
            exact_product_match: { type: "boolean" },
            market_match: { type: "boolean" },
            pack_required: { type: "boolean" },
            pack_match: { type: "boolean" },
            variant_required: { type: "boolean" },
            variant_match: { type: "boolean" },
            live_page: { type: "boolean" },
            extraction_mode: { type: "string", enum: ["STRUCTURED_TEXT", "VISIBLE_PAGE_TEXT", "SNIPPET_ONLY", "UNKNOWN"] },
            conflict: { type: "boolean" },
          },
          required: ["source_url", "source_kind", "ingredients", "declaration_complete", "not_truncated", "exact_product_match", "market_match", "pack_required", "pack_match", "variant_required", "variant_match", "live_page", "extraction_mode", "conflict"],
        },
      },
      display_images: {
        type: "array",
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            image_url: { type: "string" },
            source_url: { type: "string" },
            source_kind: { type: "string", enum: ["OFFICIAL_BRAND", "OFFICIAL_SHOPIFY", "TRUSTED_RETAILER", "MARKETPLACE"] },
            width_px: { type: ["integer", "null"] },
            height_px: { type: ["integer", "null"] },
            exact_product_match: { type: "boolean" },
          },
          required: ["image_url", "source_url", "source_kind", "width_px", "height_px", "exact_product_match"],
        },
      },
      offer: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              platform_name: { type: "string" },
              merchant_name: { type: ["string", "null"] },
              source_url: { type: "string" },
              price: { type: ["number", "null"] },
              currency: { type: "string" },
              list_price: { type: ["number", "null"] },
              availability_status: { type: "string" },
              image_url: { type: ["string", "null"] },
              exact_product_match: { type: "boolean" },
              direct_merchant_page: { type: "boolean" },
              confidence: { type: "number" },
            },
            required: ["platform_name", "merchant_name", "source_url", "price", "currency", "list_price", "availability_status", "image_url", "exact_product_match", "direct_merchant_page", "confidence"],
          },
        ],
      },
    },
    required: ["evidence", "display_images", "offer"],
  };

  const id = input.identity;
  const prompt = `SafeProducts Path A evidence acquisition. Find the exact ${id.market_country_code ?? "IN"}-market product and preserve only evidence actually visible on cited pages. Brand=${id.brand_name}; product=${id.product_name}; variant=${id.variant ?? "unknown"}; pack=${id.pack_size_text ?? "unknown"}; GTIN=${id.gtin ?? "unknown"}. Prefer verified official brand domains${officialHosts.size ? ` (${[...officialHosts].join(", ")})` : ""}, then trusted structured retailer/pharmacy sources. Return the complete ingredient declaration only when the source visibly provides it. Never infer, complete, repair, or invent missing ingredients. declaration_complete=true only if the page presents a complete declaration rather than a snippet. not_truncated=true only when the end of the declaration is visible. exact_product_match/pack/variant/market flags describe visible identity evidence. live_page=true only when the page was directly reachable during this request; an otherwise exact complete cited page may still be retained with live_page=false and lower freshness confidence. While consulting those same pages, return up to six exact-product image URLs when already visible; prefer official or first-party product imagery, include observed pixel dimensions only when actually known, and never make a separate image-only search. Image and price are independent commerce assets and never safety evidence.`;
  const body = {
    model: Deno.env.get("SP_M1B_WEB_MODEL") ?? DEFAULT_MODEL,
    store: false,
    reasoning: { effort: "low" },
    tools: [{ type: "web_search" }],
    tool_choice: "auto",
    include: ["web_search_call.action.sources"],
    input: prompt,
    text: { format: { type: "json_schema", name: "sp_m1b_path_a", strict: true, schema } },
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Math.max(3000, Math.min(budget, 25000))),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`OPENAI_${response.status}`);
  const parsed = JSON.parse(raw);
  const text = outputText(parsed);
  if (!text) throw new Error("OPENAI_EMPTY_OUTPUT");
  const out = JSON.parse(text);
  const sources = sourceUrls(parsed);
  out.evidence = (Array.isArray(out.evidence) ? out.evidence : []).filter((e: any) => supported(String(e?.source_url ?? ""), sources));
  out.display_images = (Array.isArray(out.display_images) ? out.display_images : []).filter((img: any) => supported(String(img?.source_url ?? ""), sources));
  if (out.offer && !supported(String(out.offer.source_url ?? ""), sources)) out.offer = null;
  return { out, sources, providerUsage: parsed?.usage ?? null };
}

Deno.serve(async (req: Request) => {
  const started = Date.now();
  const requestId = crypto.randomUUID();
  if (req.method !== "POST") return json({ success: false, code: "METHOD_NOT_ALLOWED", request_id: requestId }, 405);

  let key: string;
  try { key = adminKey(); } catch {
    return json({ success: false, code: "SUPABASE_SERVER_KEY_UNAVAILABLE", request_id: requestId }, 500);
  }
  const suppliedInternalKey = req.headers.get("x-m1b-internal-key") ?? "";
  if (!constantTimeEqual(suppliedInternalKey, key)) {
    return json({ success: false, code: "INTERNAL_AUTH_REQUIRED", request_id: requestId }, 401);
  }

  let input: Input;
  try { input = await req.json(); } catch {
    return json({ success: false, code: "INVALID_JSON", request_id: requestId }, 400);
  }
  if (!input?.run_id || !input?.identity?.brand_name?.trim() || !input?.identity?.product_name?.trim()) {
    return json({ success: false, code: "IDENTITY_REQUIRED", request_id: requestId }, 400);
  }

  const budget = Math.max(3000, Math.min(Number(input.foreground_budget_ms) || 15000, 30000));
  const base = Deno.env.get("SUPABASE_URL") ?? "";
  const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!base || !openaiKey) return json({ success: false, code: "SERVER_CONFIGURATION_MISSING", request_id: requestId }, 503);

  try {
    let officialHosts = new Set<string>();
    if (input.product_id) {
      const product = await rest(base, key, `sp_catalog_product_v1?select=brand_id&id=eq.${encodeURIComponent(input.product_id)}&limit=1`);
      const brandId = Array.isArray(product.data) ? product.data[0]?.brand_id : null;
      if (brandId) {
        const domains = await rest(base, key, `sp_catalog_brand_domain_v1?select=domain_host&brand_id=eq.${brandId}&status=eq.VERIFIED`);
        officialHosts = new Set((Array.isArray(domains.data) ? domains.data : []).map((x: any) => String(x.domain_host).toLowerCase().replace(/^www\./, "")));
      }
    }

    const { out, sources, providerUsage } = await discover(input, openaiKey, officialHosts, budget);
    const usage = providerUsageMetrics(providerUsage);
    const trusted = trustedHosts();
    const rawCandidates = Array.isArray(out.evidence) ? out.evidence : [];
    const normalized = rawCandidates.map((candidate: any) => ({ raw: candidate, ...scoreCandidate(candidate, officialHosts, trusted, 0) }));
    for (const candidate of normalized) {
      if (!candidate.trust) continue;
      const corroborated = normalized.some((other: any) =>
        other !== candidate &&
        (other.official || other.trust) &&
        host(String(other.raw.source_url)) !== host(String(candidate.raw.source_url)) &&
        sameIngredients(candidate.ingredients, other.ingredients)
      );
      if (corroborated) Object.assign(candidate, scoreCandidate(candidate.raw, officialHosts, trusted, 100));
    }

    let chosen: any = normalized.find((candidate: any) => candidate.official && qualifiesOfficialV2(candidate.components));
    if (!chosen) chosen = normalized.find((candidate: any) => candidate.trust && qualifiesTrustedV2(candidate.components));

    let ingredient_status: "QUALIFIED" | "INSUFFICIENT_EVIDENCE" | "CONFLICT_REQUIRES_REVIEW" = "INSUFFICIENT_EVIDENCE";
    let failure_code: string | null = "TRUSTED_SOURCE_INSUFFICIENT";
    if (normalized.some((candidate: any) => candidate.raw.conflict === true)) {
      ingredient_status = "CONFLICT_REQUIRES_REVIEW";
      failure_code = "SOURCE_CONFLICT";
    } else if (chosen) {
      ingredient_status = "QUALIFIED";
      failure_code = null;
    }

    const official_early_stop = ingredient_status === "QUALIFIED" && chosen?.official === true;
    const evidence_stop_reason = ingredient_status === "QUALIFIED"
      ? chosen?.official
        ? "SUFFICIENT_OFFICIAL_EVIDENCE"
        : chosen?.trust
          ? "SUFFICIENT_TRUSTED_EVIDENCE"
          : null
      : null;

    const selectedImage = chooseDisplayImage((Array.isArray(out.display_images) ? out.display_images : []).map((img: any) => ({
      sourceKind: img.source_kind,
      imageUrl: img.image_url,
      sourceUrl: img.source_url,
      exact: img.exact_product_match === true,
      widthPx: img.width_px,
      heightPx: img.height_px,
    })));
    const display_image = toDisplayImage(selectedImage);

    const detail = {
      engine_version: ENGINE_VERSION,
      qualification_policy_version: QUALIFICATION_POLICY_VERSION,
      source_url: chosen?.raw?.source_url ?? null,
      source_kind: chosen?.raw?.source_kind ?? null,
      parsed_ingredients: chosen?.ingredients ?? [],
      ingredient_confidence: chosen?.confidence ?? null,
      evidence_confidence: chosen?.confidence ?? null,
      evidence_tier: chosen?.evidenceTier ?? null,
      evidence_components: chosen?.components ?? null,
      evidence_stop_reason,
      official_early_stop,
      web_sources: sources.slice(0, 30),
      display_images: out.display_images ?? [],
      display_image,
      offer: out.offer ?? null,
      provider_usage: providerUsage,
      ...usage,
      benchmark_mode: input.benchmark_mode === true,
    };
    const metrics = {
      latency_ms: Date.now() - started,
      search_calls: 1,
      commerce_discovery_calls: 0,
      paid_model_calls: 1,
      ocr_calls: 0,
      vlm_calls: 0,
      provider_usage: providerUsage,
      ...usage,
      official_early_stop,
      cache_hit: false,
      cost_usd: null,
    };

    await rpc(base, key, "sp_m1b_record_attempt_v1", {
      p_run_id: input.run_id,
      p_engine: ENGINE,
      p_stage: chosen?.official ? "OFFICIAL" : chosen?.trust ? "TRUSTED" : "PATH_A",
      p_status: ingredient_status,
      p_metrics: metrics,
      p_failure_code: failure_code,
      p_detail: detail,
    });

    let image_saved = false;
    let commerce_saved = false;
    if (input.product_id && input.benchmark_mode !== true) {
      const applicationDetail = { ...detail, display_image: null };
      const [applied, imageApplied] = await Promise.all([
        rpc(base, key, "sp_m1b_apply_path_a_result_v1", {
          p_run_id: input.run_id,
          p_product_id: input.product_id,
          p_result: applicationDetail,
        }),
        display_image
          ? rpc(base, key, "sp_us2_upsert_display_image_v1", {
              p_product_id: input.product_id,
              p_image: display_image,
            }, 4000).catch(() => ({ ok: false, data: null }))
          : Promise.resolve({ ok: false, data: null }),
      ]);
      commerce_saved = applied.ok && applied.data?.commerce_saved === true;
      image_saved = imageApplied.ok && imageApplied.data?.success === true;
    }

    let recovery_enqueued = false;
    if (ingredient_status !== "QUALIFIED") {
      const enqueued = await rpc(base, key, "sp_m1b_enqueue_recovery_v1", {
        p_run_id: input.run_id,
        p_product_id: input.product_id ?? null,
        p_failure_code: failure_code,
        p_payload: { identity: input.identity, path_a_detail: detail },
      });
      recovery_enqueued = enqueued.ok && enqueued.data?.success === true;
    }

    return json({
      success: true,
      engine: ENGINE,
      engine_version: ENGINE_VERSION,
      qualification_policy_version: QUALIFICATION_POLICY_VERSION,
      ingredient_status,
      ingredient_confidence: chosen?.confidence ?? null,
      evidence_confidence: chosen?.confidence ?? null,
      evidence_tier: chosen?.evidenceTier ?? null,
      evidence_stop_reason,
      parsed_ingredients: chosen?.ingredients ?? [],
      evidence_refs: chosen?.raw?.source_url ? [chosen.raw.source_url] : [],
      image_saved,
      commerce_saved,
      failure_code,
      recovery_enqueued: ingredient_status === "QUALIFIED" ? false : recovery_enqueued,
      display_image,
      offer: out.offer ?? null,
      request_id: requestId,
    });
  } catch (error) {
    const code = error instanceof DOMException && error.name === "TimeoutError" ? "PATH_A_FOREGROUND_TIMEOUT" : "PATH_A_FAILED";
    await rpc(base, key, "sp_m1b_record_attempt_v1", {
      p_run_id: input.run_id,
      p_engine: ENGINE,
      p_stage: "PATH_A",
      p_status: code.includes("TIMEOUT") ? "TIMED_OUT" : "FAILED",
      p_metrics: {
        latency_ms: Date.now() - started,
        search_calls: 1,
        commerce_discovery_calls: 0,
        paid_model_calls: 1,
        ocr_calls: 0,
        vlm_calls: 0,
        provider_usage: null,
        provider_input_tokens: null,
        provider_output_tokens: null,
        provider_total_tokens: null,
        official_early_stop: false,
        cache_hit: false,
        cost_usd: null,
      },
      p_failure_code: code,
      p_detail: { message: error instanceof Error ? error.message : String(error), engine_version: ENGINE_VERSION, qualification_policy_version: QUALIFICATION_POLICY_VERSION },
    }).catch(() => null);
    const enqueued = await rpc(base, key, "sp_m1b_enqueue_recovery_v1", {
      p_run_id: input.run_id,
      p_product_id: input.product_id ?? null,
      p_failure_code: code,
      p_payload: { identity: input.identity },
    }).catch(() => ({ ok: false, data: null }));
    return json({
      success: true,
      engine: ENGINE,
      engine_version: ENGINE_VERSION,
      qualification_policy_version: QUALIFICATION_POLICY_VERSION,
      ingredient_status: "INSUFFICIENT_EVIDENCE",
      ingredient_confidence: null,
      evidence_confidence: null,
      evidence_tier: null,
      evidence_stop_reason: null,
      parsed_ingredients: [],
      evidence_refs: [],
      image_saved: false,
      commerce_saved: false,
      failure_code: code,
      recovery_enqueued: enqueued.ok === true && enqueued.data?.success === true,
      request_id: requestId,
    });
  }
});