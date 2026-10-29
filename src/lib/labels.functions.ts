import { createServerFn, SAFEPRODUCTS_RUNTIME_ENV } from "./clientServerFn";
import { z } from "zod";
import { assertCanonicalSupabaseUrl, assertPublishableKey } from "@/lib/backendIdentity";

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/i, "Must be a SHA-256 hash");
const dimensionSchema = z.number().int().positive().max(30_000);

const inputSchema = z.object({
  imageDataUrl: z.string().min(20).max(15_000_000).regex(/^data:image\/(png|jpe?g|webp|gif);base64,/i, "Must be a base64-encoded image data URL"),
  profile: z.enum(["ALL", "Children", "Pregnant Women", "Pregnant Woman", "Seniors"]),
  sessionId: z.string().min(1).max(100),
  accessToken: z.string().min(20).max(8192),
  brandName: z.string().trim().min(1).max(200),
  productName: z.string().trim().min(1).max(300),
  variant: z.string().trim().max(200).default(""),
  packSizeText: z.string().trim().max(120).default(""),
  frontImageSha256: sha256Schema,
  ingredientImageSha256: sha256Schema,
  frontWidth: dimensionSchema,
  frontHeight: dimensionSchema,
  ingredientWidth: dimensionSchema,
  ingredientHeight: dimensionSchema,
});

type IngredientRow = {
  name: string;
  status: "permitted" | "restricted" | "prohibited" | "identified" | "undisclosed" | "unknown";
  details: string;
};

export type MultiSourceSafetyReviewResult={
 version:"SP_MULTI_SOURCE_EVIDENCE_V1";
 qualification:"CURATED_PILOT_NOT_INDEPENDENTLY_VALIDATED";
 product_scope:string;category:string;source_count:number;
 matched_ingredient_count:number;assessable_ingredient_count:number;
 ingredient_evidence_coverage:number;
 assessment_band:"PROFILE_CAUTION"|"EVIDENCE_CAUTION"|"EVIDENCE_PARTIAL"|"NO_APPLICABLE_EVIDENCE";
 evidence:{
  ingredient:string;canonical:string;id:string;
  severity:"CAUTION"|"EXPOSURE_CHECK"|"PROFILE_CAUTION";
  summary:string;context:string;requires_exposure:boolean;
  source:{id:string;authority:string;category:string;url:string;role:string};
 }[];
 unresolved_ingredients:string[];disclosure_gaps:string[];source_roles:string[];
 warnings:string[];numeric_product_safety_score:null;methodology:string;
};
export type ClinicalSafetyScreenResult={
 version:"SP_CLINICAL_SCREEN_V1";score:number|null;
 status:"PROVISIONAL_CLINICAL_SCREEN"|"AVOID_FOR_PROFILE"|"NOT_ASSESSABLE";
 regulatory_evidence_coverage_separate:true;
 summary:string;signals:{key:string;points:number;finding:string;source_url:string}[];
 unknowns:string[];methodology:string;source_count:number;scope:"SINGLE_BOTANICAL_INGREDIENT";
};
export type SupplementRegulatoryReviewResult = {
 review_version:string;regulatory_category:string;category_confirmed:boolean;scope_note:string;
 checks:{key:string;title:string;status:"REFERENCE_MATCH"|"VISIBLE"|"NOT_VISIBLE"|"REQUIRES_VERIFICATION"|"APPLICABILITY_UNCONFIRMED";detail:string;source_key:string}[];
 references:{key:string;authority:string;role:string;title:string;url:string}[];
 caveat:string;
};
type SharedLabelResult = {
  supplement_review?: SupplementRegulatoryReviewResult | null;
  clinical_screen?: ClinicalSafetyScreenResult | null;
  multi_source_review?: MultiSourceSafetyReviewResult | null;
  detected_ingredients: string[];
  ingredient_breakdown: IngredientRow[];
  warnings: string[];
  summary: string;
  product_scope?: string;
  evidence_coverage?: number;
  research_pending_count?: number;
  regulatory_screen_score?: number;
  safety_score_raw?: number;
  confidence_adjustment?: number;
  score_policy_version?: string;
  cache_hit?: boolean;
  engine?: string;
  edge_version?: string;
  brand_name: string;
  product_name: string;
  variant: string;
  pack_size_text: string;
  catalog_sync_status: "SYNCED" | "PENDING";
  catalog_product_id?: string;
  run_id?: string;
  recovery_status?: string;
  scan_id?: string;
};

export type QualifiedLabelResult = SharedLabelResult & {
  status?: "QUALIFIED" | "PROVISIONAL_SCORE";
  safety_score: number;
  id: string;
};

export type PendingLabelResult = SharedLabelResult & {
  status: "DEEPER_VERIFICATION_IN_PROGRESS" | "INSUFFICIENT_EVIDENCE" | "CONFLICT_REQUIRES_REVIEW";
  safety_score: null;
  id?: string;
  run_id: string;
};

export type LabelAnalysisResult = QualifiedLabelResult | PendingLabelResult;

function ingredientRowsValid(value: unknown): value is IngredientRow[] {
  if (!Array.isArray(value)) return false;
  const statuses = new Set(["permitted", "restricted", "prohibited", "identified", "undisclosed", "unknown"]);
  return value.every((row) => {
    if (!row || typeof row !== "object") return false;
    const r = row as Record<string, unknown>;
    return typeof r.name === "string" && typeof r.status === "string" && statuses.has(r.status) && typeof r.details === "string";
  });
}

function isLegacyAnalysisResult(value: unknown): value is Omit<QualifiedLabelResult, "brand_name" | "product_name" | "variant" | "pack_size_text" | "catalog_sync_status"> {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.detected_ingredients) || !v.detected_ingredients.every((x) => typeof x === "string")) return false;
  if (!ingredientRowsValid(v.ingredient_breakdown)) return false;
  if (typeof v.safety_score !== "number" || !Number.isFinite(v.safety_score) || v.safety_score < 0 || v.safety_score > 100) return false;
  if (!Array.isArray(v.warnings) || !v.warnings.every((x) => typeof x === "string")) return false;
  if (typeof v.summary !== "string") return false;
  if (v.id !== undefined && typeof v.id !== "string") return false;
  if (v.product_scope !== undefined && typeof v.product_scope !== "string") return false;
  if (v.evidence_coverage !== undefined && (typeof v.evidence_coverage !== "number" || !Number.isFinite(v.evidence_coverage) || v.evidence_coverage < 0 || v.evidence_coverage > 100)) return false;
  if (v.research_pending_count !== undefined && (typeof v.research_pending_count !== "number" || !Number.isInteger(v.research_pending_count) || v.research_pending_count < 0)) return false;
  for (const field of ["regulatory_screen_score", "safety_score_raw"] as const) {
    const item = v[field];
    if (item !== undefined && (typeof item !== "number" || !Number.isFinite(item) || item < 0 || item > 100)) return false;
  }
  if (v.confidence_adjustment !== undefined && (typeof v.confidence_adjustment !== "number" || !Number.isFinite(v.confidence_adjustment) || v.confidence_adjustment < 0 || v.confidence_adjustment > 20)) return false;
  if (v.score_policy_version !== undefined && typeof v.score_policy_version !== "string") return false;
  if (v.cache_hit !== undefined && typeof v.cache_hit !== "boolean") return false;
  if (v.engine !== undefined && typeof v.engine !== "string") return false;
  if (v.edge_version !== undefined && typeof v.edge_version !== "string") return false;
  return true;
}

function isM1BLabelResult(value: unknown): value is LabelAnalysisResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const status = typeof v.status === "string" ? v.status : "";
  if (!["QUALIFIED", "PROVISIONAL_SCORE", "DEEPER_VERIFICATION_IN_PROGRESS", "INSUFFICIENT_EVIDENCE", "CONFLICT_REQUIRES_REVIEW"].includes(status)) return false;
  if (!Array.isArray(v.detected_ingredients) || !v.detected_ingredients.every((x) => typeof x === "string")) return false;
  if (!ingredientRowsValid(v.ingredient_breakdown)) return false;
  if (!Array.isArray(v.warnings) || !v.warnings.every((x) => typeof x === "string")) return false;
  if (typeof v.summary !== "string") return false;
  if (typeof v.run_id !== "string" || !v.run_id) return false;
  if (v.catalog_sync_status !== "SYNCED" && v.catalog_sync_status !== "PENDING") return false;
  if(v.multi_source_review!==undefined&&v.multi_source_review!==null){
    const mr=v.multi_source_review as Record<string,unknown>;
    if(typeof mr!=="object"||mr.version!=="SP_MULTI_SOURCE_EVIDENCE_V1"
     ||mr.qualification!=="CURATED_PILOT_NOT_INDEPENDENTLY_VALIDATED"
     ||mr.numeric_product_safety_score!==null
     ||!Array.isArray(mr.evidence)||mr.evidence.length>45
     ||!Array.isArray(mr.unresolved_ingredients)||!Array.isArray(mr.disclosure_gaps)
     ||!Array.isArray(mr.warnings)||typeof mr.methodology!=="string"
     ||typeof mr.ingredient_evidence_coverage!=="number"
     ||mr.ingredient_evidence_coverage<0||mr.ingredient_evidence_coverage>100
     ||typeof mr.source_count!=="number"||mr.source_count<0||mr.source_count>20
     ||typeof mr.assessable_ingredient_count!=="number"||typeof mr.matched_ingredient_count!=="number"
     ||!["PROFILE_CAUTION","EVIDENCE_CAUTION","EVIDENCE_PARTIAL","NO_APPLICABLE_EVIDENCE"].includes(String(mr.assessment_band)))return false;
    const allowed=/^https:\/\/(?:www\.nccih\.nih\.gov|ods\.od\.nih\.gov|www\.fda\.gov)\//;
    if(!mr.evidence.every((e:unknown)=>{
      if(!e||typeof e!=="object")return false;
      const x=e as Record<string,unknown>;const s=x.source as Record<string,unknown>|undefined;
      return typeof x.ingredient==="string"&&typeof x.summary==="string"&&typeof x.context==="string"
        &&typeof x.id==="string"&&typeof x.canonical==="string"
        &&typeof x.requires_exposure==="boolean"
        &&!!s&&typeof s.url==="string"&&allowed.test(s.url)&&typeof s.authority==="string";
    }))return false;
  }
  if(v.clinical_screen!==undefined&&v.clinical_screen!==null){
    const sc=v.clinical_screen as Record<string,unknown>;
    if(typeof sc!=="object"||sc.version!=="SP_CLINICAL_SCREEN_V1"||sc.regulatory_evidence_coverage_separate!==true
      ||!["PROVISIONAL_CLINICAL_SCREEN","AVOID_FOR_PROFILE","NOT_ASSESSABLE"].includes(String(sc.status))
      ||!Array.isArray(sc.signals)||sc.signals.length<1||sc.signals.length>12
      ||!Array.isArray(sc.unknowns)||typeof sc.summary!=="string"||typeof sc.methodology!=="string"
      ||!(sc.score===null||(typeof sc.score==="number"&&Number.isFinite(sc.score)&&sc.score>=0&&sc.score<=100))
      ||(sc.status==="PROVISIONAL_CLINICAL_SCREEN"&&sc.score===null)
      ||(sc.status!=="PROVISIONAL_CLINICAL_SCREEN"&&sc.score!==null))return false;
    if(!sc.signals.every((x:unknown)=>x&&typeof x==="object"
      &&["key","finding","source_url"].every(k=>typeof (x as Record<string,unknown>)[k]==="string")
      &&typeof (x as Record<string,unknown>).points==="number"
      &&(x as Record<string,unknown>).source_url==="https://www.nccih.nih.gov/health/ashwagandha"))return false;
  }
  if (v.supplement_review !== undefined && v.supplement_review !== null) {
    const sr = v.supplement_review as Record<string,unknown>;
    if (typeof sr !== "object" || sr.review_version !== "SP_SUPPLEMENT_REVIEW_V1" || !Array.isArray(sr.checks)
      || sr.checks.length > 32 || !Array.isArray(sr.references) || sr.references.length > 12
      || typeof sr.scope_note !== "string" || typeof sr.caveat !== "string"
      || typeof sr.regulatory_category !== "string" || typeof sr.category_confirmed !== "boolean") return false;
    if (!sr.checks.every((row:unknown)=>!!row&&typeof row==="object"
      && ["key","title","status","detail","source_key"].every(k=>typeof (row as Record<string,unknown>)[k]==="string"))) return false;
    if (!sr.references.every((ref:unknown)=>!!ref&&typeof ref==="object"
      && ["key","authority","role","title","url"].every(k=>typeof (ref as Record<string,unknown>)[k]==="string"))) return false;
  }
  if (status === "QUALIFIED" || status === "PROVISIONAL_SCORE") {
    return typeof v.safety_score === "number" && Number.isFinite(v.safety_score) && v.safety_score >= 0 && v.safety_score <= 100;
  }
  return v.safety_score === null;
}

function responseObject(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function labelHeaders(accessToken: string, publishableKey: string) {
  return { Authorization: `Bearer ${accessToken}`, apikey: publishableKey, "Content-Type": "application/json" };
}

async function callM1BLabel(data: z.infer<typeof inputSchema>, supabaseUrl: string, publishableKey: string): Promise<LabelAnalysisResult> {
  const controller = new AbortController();
  // Native M1-B label lane has a 25-second foreground ceiling; allow only transport cleanup beyond it.
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const resp = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/sp-m1b-label-analyze-v2`, {
      method: "POST",
      headers: labelHeaders(data.accessToken, publishableKey),
      body: JSON.stringify({
        imageDataUrl: data.imageDataUrl,
        profile: data.profile,
        sessionId: data.sessionId,
        identity: {
          brand_name: data.brandName,
          product_name: data.productName,
          variant: data.variant,
          pack_size_text: data.packSizeText,
          market_country_code: "IN",
        },
        frontImageSha256: data.frontImageSha256,
        ingredientImageSha256: data.ingredientImageSha256,
        frontWidth: data.frontWidth,
        frontHeight: data.frontHeight,
        ingredientWidth: data.ingredientWidth,
        ingredientHeight: data.ingredientHeight,
        foreground_deadline_ms: 25_000,
      }),
      signal: controller.signal,
    });
    const raw = await resp.text();
    const payload = responseObject(raw);
    if (resp.status === 401) throw new Error("Your temporary safety session expired. Please try the analysis again.");
    if (resp.status === 429) throw new Error("Too many label checks. Please wait a while and try again.");
    if (!resp.ok) {
      console.error("SafeProducts M1-B label Edge error", resp.status, typeof payload.code === "string" ? payload.code : "UNKNOWN");
      throw new Error("Label analysis is temporarily unavailable. Please try again.");
    }
    if (!isM1BLabelResult(payload)) {
      console.error("SafeProducts M1-B label Edge returned an invalid response contract");
      throw new Error("Label analysis returned an invalid response. Please try again.");
    }
    return {
      ...payload,
      brand_name: data.brandName,
      product_name: data.productName,
      variant: data.variant,
      pack_size_text: data.packSizeText,
      safety_score: payload.status === "QUALIFIED" || payload.status === "PROVISIONAL_SCORE" ? payload.safety_score : null,
    } as LabelAnalysisResult;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Label analysis reached its foreground time limit. Deeper verification will continue when the run was queued.");
    }
    throw error instanceof Error ? error : new Error("Label analysis is temporarily unavailable. Please try again.");
  } finally {
    clearTimeout(timeout);
  }
}

async function callLegacyLabel(data: z.infer<typeof inputSchema>, supabaseUrl: string, publishableKey: string): Promise<QualifiedLabelResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 65_000);
  let resp: Response;
  let raw = "";
  let payload: unknown = null;
  try {
    const requestBody = JSON.stringify({ imageDataUrl: data.imageDataUrl, profile: data.profile, sessionId: data.sessionId });
    const requestAnalysis = () => fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/sp-label-analyze-v1`, {
      method: "POST",
      headers: labelHeaders(data.accessToken, publishableKey),
      body: requestBody,
      signal: controller.signal,
    });
    resp = await requestAnalysis();
    raw = await resp.text();
    if (raw.trim()) { try { payload = JSON.parse(raw); } catch { payload = null; } }
    const firstError = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const transient = resp.status === 502 || resp.status === 504 || (resp.status === 503 && firstError.code !== "OPENAI_NOT_CONFIGURED");
    if (transient) {
      console.warn("SafeProducts label Edge transient error; retrying once", resp.status);
      await new Promise((resolve) => setTimeout(resolve, 750));
      resp = await requestAnalysis();
      raw = await resp.text();
      payload = null;
      if (raw.trim()) { try { payload = JSON.parse(raw); } catch { payload = null; } }
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Label analysis timed out. Please try again with a clear label photo.");
    throw new Error("Label analysis is temporarily unavailable. Please try again.");
  } finally {
    clearTimeout(timeout);
  }

  const errorPayload = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  if (resp.status === 401) throw new Error("Your temporary safety session expired. Please try the analysis again.");
  if (resp.status === 429) throw new Error("Too many label checks. Please wait a while and try again.");
  if (resp.status === 503 && errorPayload.code === "OPENAI_NOT_CONFIGURED") throw new Error("Label analysis is temporarily unavailable while the AI service is being configured.");
  if (!resp.ok) {
    console.error("SafeProducts label Edge error", resp.status, typeof errorPayload.code === "string" ? errorPayload.code : "UNKNOWN", typeof errorPayload.request_id === "string" ? errorPayload.request_id : "");
    throw new Error("Failed to analyse label. Please try again with a clearer photo.");
  }
  if (!isLegacyAnalysisResult(payload)) {
    console.error("SafeProducts label Edge returned an invalid response contract");
    throw new Error("Label analysis returned an invalid response. Please try again.");
  }

  const analysisId = payload.id ?? "";
  const analysisImageSha256 = data.ingredientImageSha256;
  let catalogSyncStatus: "SYNCED" | "PENDING" = "PENDING";
  let catalogProductId: string | undefined;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(analysisId)) {
    const catalogController = new AbortController();
    const catalogTimeout = setTimeout(() => catalogController.abort(), 5_000);
    try {
      const catalogResponse = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/sp-label-catalog-ingest-v1`, {
        method: "POST",
        headers: labelHeaders(data.accessToken, publishableKey),
        body: JSON.stringify({
          analysisId,
          analysisImageSha256,
          ingredientImageSha256: data.ingredientImageSha256,
          frontImageSha256: data.frontImageSha256,
          frontWidth: data.frontWidth,
          frontHeight: data.frontHeight,
          ingredientWidth: data.ingredientWidth,
          ingredientHeight: data.ingredientHeight,
          identity: { brand_name: data.brandName, product_name: data.productName, variant: data.variant, pack_size_text: data.packSizeText },
        }),
        signal: catalogController.signal,
      });
      const catalogPayload = responseObject(await catalogResponse.text());
      if (catalogResponse.ok && catalogPayload.success === true) {
        catalogSyncStatus = "SYNCED";
        const catalog = catalogPayload.catalog;
        if (catalog && typeof catalog === "object" && !Array.isArray(catalog)) {
          const productId = (catalog as Record<string, unknown>).product_id;
          if (typeof productId === "string") catalogProductId = productId;
        }
      } else console.warn("SafeProducts catalog sync deferred", catalogResponse.status, typeof catalogPayload.code === "string" ? catalogPayload.code : "UNKNOWN");
    } catch (error) {
      console.warn("SafeProducts catalog sync deferred", error instanceof Error && error.name === "AbortError" ? "TIMEOUT" : "TRANSPORT");
    } finally { clearTimeout(catalogTimeout); }
  }

  return {
    detected_ingredients: payload.detected_ingredients,
    ingredient_breakdown: payload.ingredient_breakdown,
    safety_score: payload.safety_score,
    warnings: payload.warnings,
    summary: payload.summary,
    id: analysisId,
    product_scope: payload.product_scope,
    evidence_coverage: payload.evidence_coverage,
    research_pending_count: payload.research_pending_count,
    regulatory_screen_score: payload.regulatory_screen_score,
    safety_score_raw: payload.safety_score_raw,
    confidence_adjustment: payload.confidence_adjustment,
    score_policy_version: payload.score_policy_version,
    cache_hit: payload.cache_hit,
    engine: payload.engine,
    edge_version: payload.edge_version,
    brand_name: data.brandName,
    product_name: data.productName,
    variant: data.variant,
    pack_size_text: data.packSizeText,
    catalog_sync_status: catalogSyncStatus,
    catalog_product_id: catalogProductId,
  };
}

export const analyzeLabel = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<LabelAnalysisResult> => {
    const supabaseUrl = assertCanonicalSupabaseUrl(SAFEPRODUCTS_RUNTIME_ENV.SUPABASE_URL, "SUPABASE_URL");
    const publishableKey = assertPublishableKey(SAFEPRODUCTS_RUNTIME_ENV.SUPABASE_PUBLISHABLE_KEY, "SUPABASE_PUBLISHABLE_KEY");
    // M1-B has precedence. When enabled, never fall back to the legacy provisional-score path.
    if (SAFEPRODUCTS_RUNTIME_ENV.SP_M1B_LABEL_ENABLED === "true") return callM1BLabel(data, supabaseUrl, publishableKey);
    return callLegacyLabel(data, supabaseUrl, publishableKey);
  });
