import { createServerFn, SAFEPRODUCTS_RUNTIME_ENV } from "./clientServerFn";
import { z } from "zod";
import { assertCanonicalSupabaseUrl, assertPublishableKey } from "./backendIdentity";
import { buildMakeSearchBody, normalizeSearchResponse, unavailable } from "./searchContract";
import { normalizeSearchQuery } from "./searchLanguage";
import { supabasePublicHeaders, isRedirectResponse } from "./supabasePublicHeaders";
import { mergeSearchEnv, resolveSearchRuntimeConfig, selectSearchRoute, type SearchRuntimeConfig } from "./searchRuntimeConfig";

const InputSchema = z.object({
  query: z.string().trim().min(1).max(200),
  profile: z.enum(["all", "children", "pregnant", "seniors"]).default("all"),
  limit: z.number().int().min(1).max(10).default(10),
  category: z.string().trim().min(1).max(100).default("all"),
  location: z.string().trim().max(150).nullable().default(null),
});

type SearchInput = z.infer<typeof InputSchema>;

// Read-only exact-product+pack lookup. Private user photos are never exposed.
async function exactLabelPackMatch(base:string,key:string,query:string,profile:string){
  if(query.length<5||query.length>200)return null;
  const tokens:Record<string,string>={all:"ALL",children:"Children",pregnant:"Pregnant Women",seniors:"Seniors"};
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),2000);
  try{
    const r=await fetch(base+"/rest/v1/rpc/sp_web_label_exact_pack_search_v1",{
      method:"POST",signal:controller.signal,headers:supabasePublicHeaders(key),
      body:JSON.stringify({p_query:query,p_profile:tokens[profile]??"ALL"})
    });
    if(!r.ok)return null;
    const item=await r.json();
    if(!item||item.source!=="USER_LABEL_EXACT_PACK"
      ||!["QUALIFIED","PROVISIONAL","UNDETERMINED"].includes(item.score_status)
      ||typeof item.product_fingerprint!=="string"||typeof item.brand_name!=="string"
      ||typeof item.product_name!=="string"||typeof item.pack_size_text!=="string"
      ||!(item.score_status==="UNDETERMINED"&&item.screening_score==null)
        &&(!Number.isFinite(Number(item.screening_score))||item.screening_score==null||Number(item.screening_score)<0||Number(item.screening_score)>100)
      ||!Number.isFinite(Number(item.evidence_coverage)))return null;
    // Independent source-backed clinical risk screen is not the regulatory Safety Score.
    // It requires the same exact identity, pack, profile and retained front photo.
    let clinicalScreen:null|Record<string,unknown>=null;
    try{
      const res=await fetch(base+"/rest/v1/rpc/sp_web_label_exact_pack_clinical_screen_v1",{
        method:"POST",signal:controller.signal,
        headers:supabasePublicHeaders(key),
        body:JSON.stringify({p_query:query,p_profile:tokens[profile]??"ALL"})
      });
      if(res.ok){
        const v=await res.json();
        if(v&&v.version==="SP_CLINICAL_SCREEN_V1"&&v.regulatory_evidence_coverage_separate===true
          &&["PROVISIONAL_CLINICAL_SCREEN","AVOID_FOR_PROFILE","NOT_ASSESSABLE"].includes(v.status)
          &&Array.isArray(v.signals)&&v.signals.length>0&&v.signals.length<=12
          &&v.signals.every((s:any)=>s.source_url==="https://www.nccih.nih.gov/health/ashwagandha")
          &&(v.score==null||(typeof v.score==="number"&&v.score>=0&&v.score<=100))){
          clinicalScreen=v;
        }
      }
    }catch{ /* Optional, never block normal search. */ }
    let multiSourceReview:null|Record<string,unknown>=null;
    try{
      const res=await fetch(base+"/rest/v1/rpc/sp_web_label_exact_pack_multi_source_v1",{
        method:"POST",signal:controller.signal,
        headers:supabasePublicHeaders(key),
        body:JSON.stringify({p_query:query,p_profile:tokens[profile]??"ALL"})
      });
      if(res.ok){
        const v=await res.json();
        if(v&&v.version==="SP_MULTI_SOURCE_EVIDENCE_V1"
          &&v.qualification==="CURATED_PILOT_NOT_INDEPENDENTLY_VALIDATED"
          &&v.numeric_product_safety_score===null
          &&Array.isArray(v.evidence)&&v.evidence.length<=45
          &&typeof v.ingredient_evidence_coverage==="number"
          &&v.ingredient_evidence_coverage>=0&&v.ingredient_evidence_coverage<=100
          &&v.evidence.every((e:any)=>{
             try {const s=new URL(e?.source?.url);return s.protocol==="https:"&&
               ["www.nccih.nih.gov","ods.od.nih.gov","www.fda.gov"].includes(s.hostname)}
             catch{return false}
          }))multiSourceReview=v;
      }
    }catch{ /* Search must still work without optional review. */ }
    return {product_id:String(item.product_id),product_fingerprint:item.product_fingerprint,
      brand_name:item.brand_name,product_name:item.product_name,
      variant_name:typeof item.variant_name==="string"?item.variant_name:null,
      pack_size_text:item.pack_size_text,score_status:item.score_status as "QUALIFIED"|"PROVISIONAL"|"UNDETERMINED",
      screening_score:item.score_status==="UNDETERMINED"?null:Number(item.screening_score),evidence_coverage:Number(item.evidence_coverage),
      score_policy_version:typeof item.score_policy_version==="string"?item.score_policy_version:null,
      source:"USER_LABEL_EXACT_PACK" as const,
      clinical_screen:clinicalScreen as import("./labels.functions").ClinicalSafetyScreenResult|null,
      multi_source_review:multiSourceReview as import("./labels.functions").MultiSourceSafetyReviewResult|null};
  }catch{return null}finally{clearTimeout(timeout)}
}


async function callM1BSearch(data: SearchInput, query: string, runtime: SearchRuntimeConfig) {
  let base: string;
  let key: string;
  try {
    base = assertCanonicalSupabaseUrl(runtime.supabaseUrl, "M1-B search Supabase URL");
    key = assertPublishableKey(runtime.publishableKey, "M1-B search invocation key");
  } catch {
    return unavailable("NOT_QUALIFIED");
  }

  const labelPackPromise = exactLabelPackMatch(base,key,query,data.profile);
  const controller = new AbortController();
  // SP-US2 v3 is the launch-hardened live engine and owns the bounded foreground search path.
  // Rollback endpoint remains `${base}/functions/v1/sp-us2-search-v2`.
  const timer = setTimeout(() => controller.abort(), 40000);
  try {
    const response = await fetch(`${base}/functions/v1/sp-us2-search-v3`, {
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      headers: supabasePublicHeaders(key),
      body: JSON.stringify({
        query,
        profile: data.profile,
        limit: data.limit,
        category: data.category,
        location: data.location,
        foreground_deadline_ms: 25000,
      }),
    });
    // Never follow redirects: fail closed so the public key never reaches a noncanonical host.
    if (isRedirectResponse(response)) return { ...unavailable("UNAVAILABLE"), labelExactPack: await labelPackPromise };
    if (!response.ok) return { ...unavailable(response.status === 504 ? "TIMED_OUT" : "UNAVAILABLE"), labelExactPack: await labelPackPromise };
    const text = await response.text();
    if (text.length > 1000000) return unavailable("INVALID_RESPONSE");
    let payload: unknown;
    try { payload = JSON.parse(text); } catch { return unavailable("INVALID_RESPONSE"); }
    const normalized = normalizeSearchResponse(payload, data.profile);
    const exact = await labelPackPromise;
    return { ...normalized, labelExactPack: exact };
  } catch {
    return { ...unavailable(controller.signal.aborted ? "TIMED_OUT" : "UNAVAILABLE"), labelExactPack: await labelPackPromise };
  } finally {
    clearTimeout(timer);
  }
}

export const searchProducts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const query = normalizeSearchQuery(data.query);
    if (!query || query.length > 200) return unavailable("INVALID_RESPONSE");

    // Server runtime env wins; build-time public VITE_* values (URL + publishable key only)
    // are a fallback when hosting does not inject them. Identity guards still fail closed.
    const runtime = resolveSearchRuntimeConfig(
      mergeSearchEnv(SAFEPRODUCTS_RUNTIME_ENV, {
        VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      }),
    );
    const route = selectSearchRoute(runtime);
    if (route === "M1B") return callM1BSearch(data, query, runtime);
    // Legacy Make search remains available only while its explicit rollout flag is enabled.
    if (route !== "LEGACY_MAKE") return unavailable("NOT_QUALIFIED");
    const url = runtime.makeSearchWebhookUrl ?? SAFEPRODUCTS_RUNTIME_ENV.MAKE_SEARCH_WEBHOOK_URL;
    if (!url) return unavailable();
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password) return unavailable();
    } catch {
      return unavailable();
    }
    const controller = new AbortController();
    // Cold qualification has been measured around 91s; 120s is a bounded legacy resilience ceiling.
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const response = await fetch(url, {
        method: "POST",
        redirect: "manual",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildMakeSearchBody(query, data.profile, data.limit, data.category, data.location)),
      });
      if (isRedirectResponse(response)) return unavailable();
      if (!response.ok) return unavailable();
      const text = await response.text();
      if (text.length > 1000000) return unavailable("INVALID_RESPONSE");
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        return unavailable("INVALID_RESPONSE");
      }
      return normalizeSearchResponse(payload, data.profile);
    } catch {
      return unavailable(controller.signal.aborted ? "TIMED_OUT" : "UNAVAILABLE");
    } finally {
      clearTimeout(timer);
    }
  });
