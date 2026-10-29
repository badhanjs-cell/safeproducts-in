import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {buildSupplementReview} from "./supplement-regulatory-review-v1.ts";
import {clinicalScreenForLabel} from "./clinical-safety-screen-v1.ts";
import {buildMultiSourceReview} from "./multi-source-evidence-v1.ts";

const FUNCTION_VERSION="SP-M1B-LABEL/2.5";
const SCORE_ENGINE_VERSION="M1B_LABEL_SAFETY_V1"; // freeze qualified cache provenance
const DEFAULT_MODEL="gpt-5.6-luna";
const ALLOWED_PROFILES=new Set(["ALL","Children","Pregnant Women","Seniors"]);
const ALLOWED_SCOPES=new Set(["COSMETIC_TOPICAL","SUPPLEMENT_ORAL","FOOD_BEVERAGE","HOUSEHOLD_OTHER","UNKNOWN"]);
const MAX_DATA_URL=14_500_000;
type Obj=Record<string,any>;

function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});}
function getAdminKey(){const preferred=Deno.env.get("SP_LABEL_ADMIN_KEY_NAME")??"default";const raw=Deno.env.get("SUPABASE_SECRET_KEYS");if(raw){try{const m=JSON.parse(raw);const v=m[preferred]??m.default??Object.values(m)[0];if(typeof v==="string"&&v.trim())return v;}catch{}}const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(legacy?.trim())return legacy;throw new Error("SUPABASE_SERVER_KEY_UNAVAILABLE");}
function headers(key:string){const h:Record<string,string>={apikey:key,"Content-Type":"application/json",Accept:"application/json"};if(!key.startsWith("sb_secret_"))h.Authorization=`Bearer ${key}`;return h;}
async function rpc(base:string,key:string,name:string,body:Obj,timeout=6000){const r=await fetch(`${base.replace(/\/$/,"")}/rest/v1/rpc/${name}`,{method:"POST",headers:headers(key),body:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});const t=await r.text();let data:any=null;if(t.trim()){try{data=JSON.parse(t)}catch{data=t}}return{ok:r.ok,status:r.status,data};}
function outputText(v:any){for(const item of Array.isArray(v?.output)?v.output:[]){if(item?.type!=="message")continue;for(const p of Array.isArray(item.content)?item.content:[])if(p?.type==="output_text"&&typeof p.text==="string"&&p.text.trim())return p.text;}return null;}
function clean(v:any){if(!Array.isArray(v))return[];const out:string[]=[];for(const x of v){if(typeof x!=="string")continue;const s=x.trim().replace(/\s+/g," ");if(!s||s.length>300)continue;if(!out.some(y=>y.toLowerCase()===s.toLowerCase()))out.push(s);}return out.slice(0,150);}
function unspecifiedExcipients(s:string){
  return /^(?:excipients?|inactive ingredients?|other ingredients?|base)(?:\s*[-—:]\s*(?:q\.?\s*s\.?|quantity sufficient|as needed))?\.?$/i.test(s.trim())
    || /^(?:q\.?\s*s\.?|quantity sufficient)$/i.test(s.trim());
}
function genericPlaceholder(s:string){return unspecifiedExcipients(s);}
// Resolve explicit botanical names without guessing. Preserve the original
// exact label declaration for presentation and audit.
function lookupCandidates(s:string){
  const candidates=[s.trim()];
  if(/\bwithania\s+somnifera\b/i.test(s))candidates.push("Withania somnifera");
  if(/\bashwagandha\b/i.test(s))candidates.push("Ashwagandha");
  return [...new Set(candidates)];
}
function details(r:any){const name=String(r?.canonical_name??r?.input_name??"Ingredient");const agency=typeof r?.agency==="string"&&r.agency?` (${r.agency})`:"";if(r?.status==="prohibited")return `${name} matched an applicable prohibited reference${agency}.`;if(r?.status==="restricted")return `${name} matched an applicable restricted reference${agency}; label concentration/use conditions may still matter.`;if(r?.status==="permitted")return `${name} matched an applicable permitted/allowed reference${agency}.`;if(r?.unspecified)return "This label says excipients q.s. but does not identify them; they cannot be checked individually.";if(r?.identity_verified)return `${name} was identified in the botanical/ingredient registry, but an applicable regulatory determination has not yet been established for this product type.`;return `${name} has not been matched to enough applicable evidence. This is not a finding of harm or safety.`;}
function decodeImage(dataUrl:string){const m=dataUrl.match(/^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/i);if(!m)return null;try{const raw=atob(m[2]);const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes;}catch{return null;}}
async function sha256(bytes:Uint8Array){const d=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,"0")).join("");}

Deno.serve(async(req:Request)=>{
  const requestId=crypto.randomUUID();const started=Date.now();
  if(req.method!=="POST")return json({success:false,code:"METHOD_NOT_ALLOWED",request_id:requestId},405);
  const contentLength=Number(req.headers.get("content-length")??0);if(Number.isFinite(contentLength)&&contentLength>15_500_000)return json({success:false,code:"PAYLOAD_TOO_LARGE",request_id:requestId},413);
  let p:any;try{p=await req.json()}catch{return json({success:false,code:"INVALID_JSON",request_id:requestId},400)}
  const imageDataUrl=typeof p?.imageDataUrl==="string"?p.imageDataUrl:"";
  const profile=typeof p?.profile==="string"?p.profile:"";
  const sessionId=typeof p?.sessionId==="string"?p.sessionId:"";
  const identity=p?.identity&&typeof p.identity==="object"?p.identity:{};
  const ingredientImageSha256=String(p?.ingredientImageSha256??"").toLowerCase();
  const frontImageSha256=String(p?.frontImageSha256??"").toLowerCase();
  const foreground_deadline_ms=Math.min(Math.max(Number(p?.foreground_deadline_ms)||25_000,5_000),25_000);
  if(!/^data:image\/(png|jpe?g|webp);base64,/i.test(imageDataUrl)||imageDataUrl.length<20||imageDataUrl.length>MAX_DATA_URL||!ALLOWED_PROFILES.has(profile)||sessionId.length<1||sessionId.length>100)return json({success:false,code:"INVALID_LABEL_PAYLOAD",request_id:requestId},400);
  if(!/^[0-9a-f]{64}$/.test(ingredientImageSha256)||!/^[0-9a-f]{64}$/.test(frontImageSha256)||ingredientImageSha256===frontImageSha256)return json({success:false,code:"INVALID_IMAGE_PROVENANCE",request_id:requestId},400);
  if(typeof identity.brand_name!=="string"||!identity.brand_name.trim()||typeof identity.product_name!=="string"||!identity.product_name.trim())return json({success:false,code:"PAIR_VALIDATED_IDENTITY_REQUIRED",request_id:requestId},400);
  identity.pack_size_text=typeof identity.pack_size_text==="string"?identity.pack_size_text.trim():"";
  identity.market_country_code=typeof identity.market_country_code==="string"&&identity.market_country_code.trim()?identity.market_country_code.trim().toUpperCase():"IN";
  const bytes=decodeImage(imageDataUrl);if(!bytes||bytes.length===0||bytes.length>10*1024*1024)return json({success:false,code:"INGREDIENT_IMAGE_INVALID",request_id:requestId},400);
  if(await sha256(bytes)!==ingredientImageSha256)return json({success:false,code:"INGREDIENT_IMAGE_HASH_MISMATCH",request_id:requestId},400);

  const base=Deno.env.get("SUPABASE_URL")??"";const openai=Deno.env.get("OPENAI_API_KEY")??"";if(!base||!openai)return json({success:false,code:"SERVER_CONFIGURATION_MISSING",request_id:requestId},503);
  let key:string;try{key=getAdminKey()}catch{return json({success:false,code:"SUPABASE_SERVER_KEY_UNAVAILABLE",request_id:requestId},500)}

  // Gateway JWT verification is disabled for this existing endpoint; validate
  // the actual bearer with Supabase Auth before service-role RPCs or AI usage.
  // Anonymous visitor sessions are legitimate Supabase Auth users.
  const bearer=(req.headers.get("authorization")??"").replace(/^Bearer\s+/i,"");
  if(bearer.split(".").length!==3)return json({success:false,code:"AUTH_REQUIRED",request_id:requestId},401);
  const authApiKey=Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY")??key;
  let verifiedUser:Response;
  try{
    verifiedUser=await fetch(`${base.replace(/\/$/,"")}/auth/v1/user`,{
      headers:{apikey:authApiKey,Authorization:`Bearer ${bearer}`},
      signal:AbortSignal.timeout(4_000)
    });
  }catch{return json({success:false,code:"AUTH_VERIFICATION_UNAVAILABLE",request_id:requestId},503)}
  if(!verifiedUser.ok){
    return json({success:false,code:verifiedUser.status===401||verifiedUser.status===403?"AUTH_REQUIRED":"AUTH_VERIFICATION_UNAVAILABLE",request_id:requestId},verifiedUser.status===401||verifiedUser.status===403?401:503);
  }
  const userInfo=await verifiedUser.json().catch(()=>null);
  if(!userInfo||typeof userInfo.id!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userInfo.id)){
    return json({success:false,code:"AUTH_REQUIRED",request_id:requestId},401);
  }

  const imageMeta={front_image_sha256:frontImageSha256,ingredient_image_sha256:ingredientImageSha256,front_width_px:p.frontWidth,front_height_px:p.frontHeight,ingredient_width_px:p.ingredientWidth,ingredient_height_px:p.ingredientHeight};
  const registered=await rpc(base,key,"sp_m1b_label_register_evidence_v1",{p_identity:identity,p_image_meta:imageMeta},5000);
  if(!registered.ok||registered.data?.success!==true)return json({success:false,code:"LABEL_IDENTITY_REGISTRATION_FAILED",request_id:requestId},503);
  const productId=String(registered.data.product_id??"");const fingerprint=String(registered.data.product_fingerprint??"");
  const begun=await rpc(base,key,"sp_m1b_begin_run_v1",{p_context:"CHECK_MY_LABEL",p_product_id:productId,p_product_fingerprint:fingerprint,p_benchmark_slot_id:null,p_session_key:null},4000);
  if(!begun.ok||typeof begun.data?.run_id!=="string")return json({success:false,code:"LABEL_RUN_BEGIN_FAILED",request_id:requestId},503);
  const runId=begun.data.run_id;
  const record=(stage:string,status:string,failure_code:string|null,detail:Obj={})=>rpc(base,key,"sp_m1b_record_attempt_v1",{p_run_id:runId,p_engine:"M1-B",p_stage:stage,p_status:status,p_metrics:{latency_ms:Date.now()-started,vlm_calls:stage==="USER_LABEL_VLM_EXTRACTION"&&detail.cache_hit!==true?1:0,search_calls:0,ocr_calls:0},p_failure_code:failure_code,p_detail:{engine_version:FUNCTION_VERSION,...detail}},3500).catch(()=>null);
  const queue=async(code:string,detail:Obj={})=>{const q=await rpc(base,key,"sp_m1b_enqueue_recovery_v1",{p_run_id:runId,p_product_id:productId,p_failure_code:code,p_payload:{identity,ingredient_image_sha256:ingredientImageSha256,front_image_sha256:frontImageSha256,path_a_detail:detail}},3500).catch(()=>({ok:false,data:null}));return q.ok===true&&q.data?.success===true;};

  const pending=async(status:"DEEPER_VERIFICATION_IN_PROGRESS"|"INSUFFICIENT_EVIDENCE"|"CONFLICT_REQUIRES_REVIEW",ingredients:string[],code:string,enqueue:boolean,scope="UNKNOWN")=>{
    const queued=enqueue?await queue(code,{detected_ingredients:ingredients,product_scope:scope}):false;
    await record("FINAL_LABEL_QUALIFICATION",status==="CONFLICT_REQUIRES_REVIEW"?"CONFLICT_REQUIRES_REVIEW":"INSUFFICIENT_EVIDENCE",code,{recovery_enqueued:queued});
    return json({status,safety_score:null,detected_ingredients:ingredients,ingredient_breakdown:[],warnings:[],summary:status==="DEEPER_VERIFICATION_IN_PROGRESS"?"The full ingredient declaration could not be analysed in this attempt. Please use a clearer ingredient photo and retry.":"The declaration or evidence is not sufficient for a reliable product screening result.",run_id:runId,catalog_sync_status:"SYNCED",catalog_product_id:productId,brand_name:identity.brand_name,product_name:identity.product_name,variant:String(identity.variant??""),pack_size_text:String(identity.pack_size_text??""),product_scope:scope,engine:"M1-B",edge_version:FUNCTION_VERSION,recovery_status:queued?"QUEUED":"NOT_REQUIRED"});
  };

  try{
    const remaining=Math.max(1000,foreground_deadline_ms-(Date.now()-started)-2500);
    if(remaining<4000)return pending("DEEPER_VERIFICATION_IN_PROGRESS",[],"M1B_LABEL_FOREGROUND_DEADLINE",true);
    // Exact *two-image* matched transcription is preferred over repeated OCR.
    // The cache is private to the signed-in owner and profile. We intentionally
    // recompute regulatory and clinical findings under current policies.
    const exact=await rpc(base,key,"sp_web_label_exact_pair_transcription_v1",{
      p_owner_id:userInfo.id,p_front_sha256:frontImageSha256,
      p_ingredient_sha256:ingredientImageSha256,p_profile:profile
    },1800).catch(()=>({ok:false,data:null}));
    const exactTranscription=exact.ok
      &&exact.data?.provenance==="SAME_OWNER_EXACT_FRONT_AND_INGREDIENT_HASHES"
      &&exact.data?.transcription_revision==="EXACT_PAIR_TRANSCRIPTION_V1"
      &&exact.data?.declaration_complete===true
      &&Array.isArray(exact.data?.detected_ingredients)
      &&exact.data.detected_ingredients.length>0
      &&exact.data.detected_ingredients.length<=150
      &&exact.data?.product_scope==="SUPPLEMENT_ORAL"
      &&exact.data?.supplement_label&&typeof exact.data.supplement_label==="object"
      ?exact.data:null;
    // The frozen qualified-cache lane is maintained for other product types.
    const prior=exactTranscription?{ok:false,data:null}:await rpc(base,key,"sp_web_label_cached_extraction_v1",{
      p_image_sha256:ingredientImageSha256,p_engine_version:SCORE_ENGINE_VERSION
    },1200).catch(()=>({ok:false,data:null}));
    let extraction:any=exactTranscription || (prior.ok
      &&Array.isArray(prior.data?.detected_ingredients)
      &&prior.data?.declaration_complete===true ? prior.data:null);
    const cachedExtraction=extraction!==null;
    if(!cachedExtraction){
    const supplementLabelFields=["category_declaration","directions","daily_dose","ayush_manufacturing_license","fssai_license_number","not_for_medicinal_use","batch_and_expiry","precautions","claims","producer_details","veg_nonveg_mark"];
    const labelProperties=Object.fromEntries(supplementLabelFields.map(key=>[key,{type:"string"}]));
    const schema={type:"object",additionalProperties:false,properties:{detected_ingredients:{type:"array",minItems:1,maxItems:150,items:{type:"string"}},product_scope:{type:"string",enum:[...ALLOWED_SCOPES]},declaration_complete:{type:"boolean"},uncertain_tokens:{type:"array",maxItems:50,items:{type:"string"}},supplement_label:{type:"object",additionalProperties:false,properties:labelProperties,required:supplementLabelFields}},required:["detected_ingredients","product_scope","declaration_complete","uncertain_tokens","supplement_label"]};
    const prompt=`Read only the visible ingredient/composition/INCI declaration from this exact product label. Identity already pair-validated: brand=${identity.brand_name}; product=${identity.product_name}; variant=${identity.variant??""}; pack=${identity.pack_size_text??"unknown"}; market=${identity.market_country_code}. Preserve ingredient order. Split separate ingredients. Never infer, complete, repair or invent obscured text. declaration_complete=true only when the complete declaration including its visible end is readable. Put every uncertain token or unreadable fragment in uncertain_tokens. Classify product_scope from visible product/ingredient evidence. For an oral supplement, also transcribe ONLY clearly visible text from THIS ingredient-panel photograph into supplement_label: category_declaration, directions, daily_dose, ayush_manufacturing_license, fssai_license_number, not_for_medicinal_use, batch_and_expiry, precautions, claims, producer_details, veg_nonveg_mark. Return empty string for any field not legible in this particular photo. NEVER invent licence, directions or warning text; absence from this photo is not absence from the whole package. Do not perform safety scoring or regulatory classification.`;
    const ai=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${openai}`,"Content-Type":"application/json"},body:JSON.stringify({model:Deno.env.get("SP_M1B_LABEL_MODEL")??DEFAULT_MODEL,store:false,max_output_tokens:2400,input:[{role:"system",content:[{type:"input_text",text:prompt}]},{role:"user",content:[{type:"input_text",text:"Extract only the visible label declaration."},{type:"input_image",image_url:imageDataUrl,detail:"high"}]}],text:{format:{type:"json_schema",name:"sp_m1b_label_extraction",strict:true,schema}}}),signal:AbortSignal.timeout(Math.min(18_000,remaining))});
    if(!ai.ok)return pending("DEEPER_VERIFICATION_IN_PROGRESS",[],`LABEL_VLM_${ai.status}`,true);
    const aiJson=await ai.json();const text=outputText(aiJson);if(!text)return pending("DEEPER_VERIFICATION_IN_PROGRESS",[],"LABEL_VLM_EMPTY",true);
    try{extraction=JSON.parse(text)}catch{return pending("DEEPER_VERIFICATION_IN_PROGRESS",[],"LABEL_VLM_INVALID",true)}
    }
    const ingredients=clean(extraction?.detected_ingredients);const scope=ALLOWED_SCOPES.has(extraction?.product_scope)?extraction.product_scope:"UNKNOWN";const uncertain=clean(extraction?.uncertain_tokens);
    const complete=extraction?.declaration_complete===true&&uncertain.length===0&&ingredients.some(x=>!unspecifiedExcipients(x));
    if(!ingredients.length)return pending("DEEPER_VERIFICATION_IN_PROGRESS",[],"LABEL_INGREDIENTS_NOT_READABLE",true,scope);

    const normalized=await rpc(base,key,"sp_web_normalize_label_ingredients_v1",{p_ingredients:ingredients},Math.min(4000,Math.max(1000,foreground_deadline_ms-(Date.now()-started)-1500)));
    const normalizedIngredients=normalized.ok&&Array.isArray(normalized.data)&&normalized.data.length?normalized.data.map((x:any)=>String(x)):ingredients;
    // SafeProducts-only read-only FSSAI schedule adapter; the shared regulatory
    // master remains immutable, and a listed plant is not whole-product approval.
    const botanicalForSchedule=scope==="SUPPLEMENT_ORAL"
      ? normalizedIngredients.find(x=>/ashwagandha|withania\s+somnifera/i.test(x)):undefined;
    const scheduleResult=botanicalForSchedule
      ? await rpc(base,key,"sp_web_fssai_supplement_schedule_v1",
          {p_ingredient:botanicalForSchedule,p_scope:scope},1700).catch(()=>({ok:false,data:null}))
      : {ok:false,data:null};
    const supplementReview=buildSupplementReview(normalizedIngredients,scope,profile,extraction?.supplement_label,
      scheduleResult.ok?scheduleResult.data:null);
    const applied=await rpc(base,key,"sp_m1b_label_apply_ingredient_evidence_v1",{p_run_id:runId,p_product_id:productId,p_payload:{ingredient_image_sha256:ingredientImageSha256,detected_ingredients:normalizedIngredients,declaration_complete:complete,uncertain_tokens:uncertain,product_scope:scope,engine_version:FUNCTION_VERSION}},4000);
    if(!applied.ok)return pending("DEEPER_VERIFICATION_IN_PROGRESS",normalizedIngredients,"LABEL_EVIDENCE_PERSISTENCE_FAILED",true,scope);
    await record("USER_LABEL_VLM_EXTRACTION",complete?"COMPLETED":"INSUFFICIENT_EVIDENCE",complete?null:"LABEL_DECLARATION_INCOMPLETE",{declaration_complete:complete,uncertain_tokens:uncertain.length,cache_hit:cachedExtraction,exact_pair_cache_hit:Boolean(exactTranscription)});
    if(!complete)return pending("DEEPER_VERIFICATION_IN_PROGRESS",normalizedIngredients,"LABEL_DECLARATION_INCOMPLETE",true,scope);

    // Generic "excipients q.s." is a disclosure limitation, not a chemical ingredient.
    // Lookup canonical botanical synonyms visible in the original declaration only.
    const placeholders=normalizedIngredients.filter(unspecifiedExcipients);
    const disclosed=normalizedIngredients.filter(name=>!unspecifiedExcipients(name));
    const unknown=(name:string)=>({input_name:name,status:"unknown",regulatory_applicable:false,identity_verified:false});
    const resolutions:any[]=[];
    async function lookup(name:string){
      let best:any=unknown(name);
      for(const candidate of lookupCandidates(name)){
        try{
          const rr=await rpc(base,key,"sp_web_resolve_label_ingredient_v2",{
            p_name:candidate,p_product_scope:scope
          },Math.min(2500,Math.max(1000,started+foreground_deadline_ms-Date.now()-6000)));
          if(!rr.ok||!rr.data||typeof rr.data!=="object")continue;
          const found={...rr.data,input_name:name,lookup_term:candidate};
          if(found.regulatory_applicable===true&&["permitted","restricted","prohibited"].includes(String(found.status)))return found;
          if(found.identity_verified===true)best=found;
        }catch{ /* A failed lookup never implies permitted/safe. */ }
      }
      return best;
    }
    for(let i=0;i<disclosed.length;i+=6){
      const batch=disclosed.slice(i,i+6);
      if(Date.now()>started+foreground_deadline_ms-6800){
        resolutions.push(...disclosed.slice(i).map(unknown));
        break;
      }
      resolutions.push(...await Promise.all(batch.map(lookup)));
    }
    // The FSSAI food-supplement schedule does not qualify an AYUSH-declared
    // medicine. Keep medicine regulatory qualification independent of clinical risk.
    const declaredAyush=supplementReview?.regulatory_category==="AYURVEDIC_PROPRIETARY_MEDICINE";
    const regulatorySupported=declaredAyush?0:resolutions.filter(r=>r.regulatory_applicable===true&&["permitted","restricted","prohibited"].includes(String(r.status))).length;
    const completeScope=regulatorySupported===disclosed.length&&!placeholders.length;
    const computedCoverage=disclosed.length?Math.round(1000*regulatorySupported/disclosed.length)/10:0;
    const breakdown=resolutions.map(r=>({
      // AYUSH-declared medicines cannot inherit FSSAI permitted status.

      name:String(r.input_name??r.canonical_name??"Ingredient"),
      status:declaredAyush?"identified":["permitted","restricted","prohibited"].includes(String(r.status))?String(r.status):r.identity_verified===true?"identified":"unknown",
      details:declaredAyush? "Botanical identity is recognized, but an FSSAI food-supplement listing does not establish Ayurvedic-medicine regulatory approval. Assess the declared medicine under AYUSH/Drugs Rules.":details(r)
    }));
    breakdown.push(...placeholders.map(name=>({
      name,status:"undisclosed",details:details({input_name:name,unspecified:true})
    })));
    const outstanding=disclosed.length-regulatorySupported;
    await record("REGULATORY_QUALIFICATION",completeScope?"COMPLETED":"INSUFFICIENT_EVIDENCE",
      completeScope?null:"REGULATORY_EVIDENCE_INCOMPLETE",{
        regulatory_supported:regulatorySupported,declared_active_count:disclosed.length,
        unspecified_excipient_groups:placeholders.length
      });
    let score:number|null=null;
    let coverage=computedCoverage;
    let scored:any={data:null,ok:false};
    // Zero supported ingredient determinations cannot justify *any* numeric safety score.
    if(regulatorySupported>0){
      scored=await rpc(base,key,"sp_web_score_label_safety_v1",{
        p_breakdown:resolutions,p_product_scope:scope,p_profile:profile
      },Math.min(4000,Math.max(1200,started+foreground_deadline_ms-Date.now()-1200))).catch(()=>({ok:false,data:null}));
      const value=Number(scored.data?.safety_score);
      const reportedCoverage=Number(scored.data?.evidence_coverage);
      if(scored.ok&&Number.isFinite(value)&&value>=0&&value<=100&&Number.isFinite(reportedCoverage)
        &&reportedCoverage>=0&&reportedCoverage<=100&&reportedCoverage>0){
        // The deterministic scorer may credit verified identity without an
        // applicable regulatory rule; never inflate regulatory coverage.
        coverage=Math.min(computedCoverage,reportedCoverage);
        if(coverage>=50)score=value;
      }
    }
    const qualified=completeScope&&score!==null&&coverage===100;
    const status=qualified?"QUALIFIED":score!==null?"PROVISIONAL_SCORE":"INSUFFICIENT_EVIDENCE";
    const scoreStatus=qualified?"QUALIFIED":score!==null?"PROVISIONAL":"UNDETERMINED";
    const warnings:string[]=[];
    if(placeholders.length)warnings.push("The label lists excipients q.s. without naming them; undisclosed ingredients were not individually assessed.");
    if(outstanding)warnings.push(outstanding+" of "+disclosed.length+" disclosed ingredients have no complete applicable regulatory determination.");
    if(scoreStatus==="PROVISIONAL")warnings.push("This is a limited evidence-dependent screening index, not a verified full-product Safety Score.");
    if(scoreStatus==="UNDETERMINED")warnings.push("No numerical score is shown because the available regulatory evidence cannot support one.");
    const summary=qualified
      ? "Qualified Safety Score "+Math.round(score!)+"/100 with complete applicable regulatory evidence for the declared ingredients."
      : score!==null
        ? "Limited screening index "+Math.round(score)+"/100 from partially supported ingredients; "+coverage.toFixed(0)+"% applicable evidence coverage. Not a verified product Safety Score."
        : "Ingredients were read, but there is not enough applicable regulatory evidence to calculate a reliable Safety Score. The recognized botanical identity and undisclosed excipients are explained below.";
    let analysisId="";
    if(qualified){
      const saved=await rpc(base,key,"sp_web_record_label_analysis_v3",{
        p_detected_ingredients:normalizedIngredients,p_safety_score:score,
        p_regulatory_screen_score:Number(scored.data?.regulatory_screen_score??score),
        p_safety_score_raw:Number(scored.data?.raw_safety_score??score),
        p_confidence_adjustment:Number(scored.data?.confidence_adjustment??0),
        p_profile_used:profile,p_warnings:warnings,p_ingredient_breakdown:breakdown,
        p_summary:summary,p_session_id:sessionId,p_image_sha256:ingredientImageSha256,
        p_product_scope:scope,p_score_policy_version:String(scored.data?.policy_version??"LABEL_SAFETY_V1_0"),
        p_evidence_coverage:100,p_research_pending_count:0,p_engine_version:SCORE_ENGINE_VERSION,
        p_resolution_snapshot:{m1b_run_id:runId,edge_version:FUNCTION_VERSION,qualification:"EXACT_USER_LABEL_PLUS_COMPLETE_REGULATORY_EVIDENCE"}
      },3200).catch(()=>({ok:false,data:null}));
      analysisId=saved.ok?(typeof saved.data==="string"?saved.data:String(saved.data?.id??"")):"";
    }
    const durableStatus=qualified&&/^[0-9a-f-]{36}$/i.test(analysisId)?"QUALIFIED":score!==null?"PROVISIONAL":"UNDETERMINED";
    const savedScan=await rpc(base,key,"sp_web_label_record_pack_scan_v1",{
      p_run_id:runId,p_owner_id:userInfo.id,p_front_sha256:frontImageSha256,
      p_ingredient_sha256:ingredientImageSha256,p_profile:profile,p_status:durableStatus,
      p_score:score,p_coverage:coverage,p_ingredients:normalizedIngredients,
      p_breakdown:breakdown,p_warnings:warnings,p_policy:durableStatus==="QUALIFIED"?
        String(scored.data?.policy_version??"LABEL_SAFETY_V1_0"):"M1B_EVIDENCE_SCREEN_V2_1"
    },3500).catch(()=>({ok:false,data:null}));
    const scanId=savedScan.ok&&typeof savedScan.data==="string"?savedScan.data:"";
    if(scanId&&supplementReview){
      await rpc(base,key,"sp_web_label_record_supplement_review_v1",{
        p_run_id:runId,p_owner_id:userInfo.id,p_report:supplementReview
      },2400).catch(()=>({ok:false}));
    }
    // Clinical screening uses independent scientific safety evidence. No
    // regulatory coverage or qualified Safety Score is manufactured.
    const clinicalScreen=scanId?clinicalScreenForLabel(normalizedIngredients,scope,profile,supplementReview):null;
    if(scanId&&clinicalScreen){
      await rpc(base,key,"sp_web_label_save_clinical_screen_v1",{
        p_run_id:runId,p_owner_id:userInfo.id,p_screen:clinicalScreen
      },2200).catch(()=>({ok:false}));
    }
    // Pilot evidence aggregation spans oral nutrition, food and cosmetics.
    // It does not change verified Safety Scores or imply regulatory approval.
    const multiSourceReview=scanId?buildMultiSourceReview(normalizedIngredients,scope,profile):null;
    if(scanId&&multiSourceReview){
      await rpc(base,key,"sp_web_label_save_multi_source_v1",{
        p_run_id:runId,p_owner_id:userInfo.id,p_report:multiSourceReview
      },2200).catch(()=>({ok:false}));
    }
    await record("FINAL_LABEL_QUALIFICATION",durableStatus==="QUALIFIED"?"QUALIFIED":"INSUFFICIENT_EVIDENCE",
      scanId?null:"LABEL_PACK_CACHE_COMMIT_FAILED",{scan_saved:!!scanId,score_status:durableStatus,evidence_coverage:coverage});
    return json({
      status:durableStatus==="QUALIFIED"?"QUALIFIED":score!==null?"PROVISIONAL_SCORE":"INSUFFICIENT_EVIDENCE",detected_ingredients:normalizedIngredients,ingredient_breakdown:breakdown,
      safety_score:score,warnings,summary,id:analysisId,scan_id:scanId,supplement_review:supplementReview,clinical_screen:clinicalScreen,multi_source_review:multiSourceReview,
      product_scope:scope,evidence_coverage:coverage,research_pending_count:outstanding,
      score_policy_version:durableStatus==="QUALIFIED"?String(scored.data?.policy_version??"LABEL_SAFETY_V1_0"):"M1B_EVIDENCE_SCREEN_V2_1",
      engine:"M1-B",edge_version:FUNCTION_VERSION,cache_hit:cachedExtraction,run_id:runId,
      catalog_sync_status:scanId?"SYNCED":"PENDING",catalog_product_id:productId,
      brand_name:identity.brand_name,product_name:identity.product_name,
      variant:String(identity.variant??""),pack_size_text:String(identity.pack_size_text??""),
      recovery_status:"NOT_REQUIRED"
    });
  }catch(error){
    return pending("DEEPER_VERIFICATION_IN_PROGRESS",[],error instanceof DOMException&&error.name==="TimeoutError"?"M1B_LABEL_FOREGROUND_TIMEOUT":"M1B_LABEL_FOREGROUND_FAILED",true);
  }
});
