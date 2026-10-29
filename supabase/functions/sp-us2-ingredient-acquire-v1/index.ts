import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// SafeProducts only — Make controlled ingredient acquisition.
// Make orchestrates product-level work; Supabase alone owns evidence qualification,
// regulatory scoring, canonical cache, review escalation and consumer result eligibility.
// Do not return image bytes, private photos, API keys or source-page bodies to Make.
type Obj=Record<string,unknown>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function response(x:Obj,status=200){return new Response(JSON.stringify({contract_version:"SP_MAKE_INGREDIENT_ACQUISITION/1.0",...x}),{status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"}})}
function equal(a:string,b:string){const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);if(x.length!==y.length)return false;let v=0;for(let i=0;i<x.length;i++)v|=x[i]^y[i];return v===0}
function adminKey(){const named=Deno.env.get("SP_LABEL_ADMIN_KEY_NAME")??"default";const all=Deno.env.get("SUPABASE_SECRET_KEYS");if(all){try{const obj=JSON.parse(all);const val=obj[named]??obj.default??Object.values(obj)[0];if(typeof val==="string"&&val.trim())return val}catch{}}const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(legacy?.trim())return legacy;throw Error("SERVER_KEY_UNAVAILABLE")}
function headers(key:string){const h:Record<string,string>={apikey:key,"content-type":"application/json","accept":"application/json"};if(!key.startsWith("sb_secret_"))h.Authorization=`Bearer ${key}`;return h}
async function rpc(base:string,key:string,name:string,body:Obj,ms=6500){const r=await fetch(`${base}/rest/v1/rpc/${name}`,{method:"POST",headers:headers(key),body:JSON.stringify(body),signal:AbortSignal.timeout(ms)});let v:any=null;try{v=await r.json()}catch{}return{ok:r.ok,data:v,status:r.status}}
async function readProduct(base:string,key:string,id:string){
 const select="id,product_fingerprint,brand_name,product_name,variant_name,pack_size_text,pack_normalized_key,market_country_code,gtin,is_active";
 const url=`${base}/rest/v1/sp_catalog_product_v1?id=eq.${encodeURIComponent(id)}&select=${select}&limit=1`;
 const r=await fetch(url,{headers:headers(key),signal:AbortSignal.timeout(5000)});
 if(!r.ok)return null;
 const items=await r.json();return Array.isArray(items)?items[0]??null:null;
}
async function cachedQualified(base:string,key:string,id:string,profile:string){
 const url=`${base}/rest/v1/sp_catalog_product_unified_v1?product_id=eq.${encodeURIComponent(id)}&select=assessment_status,overall_score,child_score,pregnancy_score,senior_score&limit=1`;
 const r=await fetch(url,{headers:headers(key),signal:AbortSignal.timeout(5000)});
 if(!r.ok)return false;
 const rows=await r.json();const v=Array.isArray(rows)?rows[0]:null;
 const field=profile==="children"?"child_score":profile==="pregnant"?"pregnancy_score":profile==="seniors"?"senior_score":"overall_score";
 const n=v?.[field];
 return v?.assessment_status==="QUALIFIED"&&n!==null&&n!==undefined
   &&Number.isFinite(Number(n))&&Number(n)>=0&&Number(n)<=100;
}
async function routeHumanReview(base:string,key:string,id:string,reason:string):Promise<boolean>{
 // Fail closed: do not discard an unqualified case when OCR queueing failed.
 // Reuse an existing OPEN review instead of manufacturing duplicate review work.
 try{
  const look=`${base}/rest/v1/sp_catalog_review_queue_v1?select=id&product_id=eq.${encodeURIComponent(id)}&review_type=eq.INGREDIENT_RECOVERY&status=eq.OPEN&limit=1`;
  const existing=await fetch(look,{headers:headers(key),signal:AbortSignal.timeout(4500)});
  if(!existing.ok)return false;
  const rows=await existing.json();if(Array.isArray(rows)&&rows.length>0)return true;
  const saved=await fetch(`${base}/rest/v1/sp_catalog_review_queue_v1`,{method:"POST",
   headers:{...headers(key),Prefer:"return=minimal"},
   body:JSON.stringify({product_id:id,review_type:"INGREDIENT_RECOVERY",severity:"HIGH",status:"OPEN",
    title:"Make ingredient acquisition — manual evidence verification",
    detail:"Automated official/trusted ingredient evidence and OCR recovery were inconclusive.",
    source_context:{workflow:"SP_MAKE_INGREDIENT_ACQUISITION_V1",failure_reason:reason.slice(0,100)}}),
   signal:AbortSignal.timeout(4500)});
  return saved.ok;
 }catch{return false}
}
async function existingRecentRecovery(base:string,key:string,id:string){
 // A failed extraction can be expensive. Within a 24h recovery window,
 // never issue a second paid search while M1-BR already owns the work.
 const url=new URL(base+"/rest/v1/sp_m1br_recovery_queue_v1");
 url.searchParams.set("select","run_id,status");
 url.searchParams.set("product_id","eq."+id);
 url.searchParams.set("status","in.(PENDING,RETRY,IN_PROGRESS)");
 url.searchParams.set("created_at","gte."+new Date(Date.now()-86400000).toISOString());
 url.searchParams.set("order","created_at.desc");
 url.searchParams.set("limit","1");
 const r=await fetch(url.toString(),{headers:headers(key),signal:AbortSignal.timeout(5000)});
 if(!r.ok)throw Error("RECOVERY_STATUS_READ_FAILED");
 const rows=await r.json();return Array.isArray(rows)?rows[0]??null:null;
}
function profileToken(x:string){switch(x){case"children":return"CHILDREN";case"pregnant":return"PREGNANT";case"seniors":return"SENIORS";default:return"ALL"}}
Deno.serve(async(req)=>{
 if(req.method!=="POST")return response({status:"REJECTED",reason:"METHOD_NOT_ALLOWED"},405);
 const secret=Deno.env.get("SP_US2_MAKE_CALLBACK_KEY")??"";
 const provided=req.headers.get("x-sp-us2-make-key")??"";
 if(!secret||!provided||!equal(secret,provided))return response({status:"REJECTED",reason:"MAKE_AUTH_REQUIRED"},401);
 if(Number(req.headers.get("content-length")??"0")>4096)return response({status:"REJECTED",reason:"PAYLOAD_TOO_LARGE"},413);
 let input:any;try{const txt=await req.text();if(txt.length>4096)throw Error("SIZE");input=JSON.parse(txt)}catch{return response({status:"REJECTED",reason:"INVALID_PAYLOAD"},400)}
 const productId=typeof input?.product_id==="string"?input.product_id.trim():"";
 const mode=typeof input?.mode==="string"?input.mode.trim().toUpperCase():"PREFLIGHT";
 const profile=typeof input?.profile==="string"?input.profile.trim().toLowerCase():"all";
 if(!UUID.test(productId)||!["PREFLIGHT","ACQUIRE"].includes(mode)||!["all","children","pregnant","seniors"].includes(profile))
   return response({status:"REJECTED",reason:"INPUT_CONTRACT_INVALID"},400);
 let key:string;try{key=adminKey()}catch{return response({status:"RETRYABLE",reason:"BACKEND_KEY_UNAVAILABLE"},503)}
 const base=(Deno.env.get("SUPABASE_URL")??"").replace(/\/$/,"");
 if(!base)return response({status:"RETRYABLE",reason:"BACKEND_UNAVAILABLE"},503);
 let product:any=null;
 try{product=await readProduct(base,key,productId)}catch{return response({status:"RETRYABLE",reason:"PRODUCT_LOOKUP_FAILED"},503)}
 if(!product||product.is_active!==true)return response({status:"REJECTED",reason:"ACTIVE_CANONICAL_PRODUCT_REQUIRED"},404);
 if(!product.product_fingerprint||!product.brand_name||!product.product_name)
   return response({status:"HUMAN_REVIEW_REQUIRED",reason:"INCOMPLETE_PRODUCT_IDENTITY",product_id:productId});
 let cached=false;try{cached=await cachedQualified(base,key,productId,profile)}catch{}
 if(cached)return response({status:"CACHED_QUALIFIED",product_id:productId,source_priority:"CANONICAL_CACHE",score_available:true,paid_calls:0,image_not_required_for_safety:true});
 if(mode==="PREFLIGHT")return response({status:"PREFLIGHT_READY",product_id:productId,score_available:false,
    source_priority:["OFFICIAL_BRAND","OFFICIAL_SHOPIFY","TRUSTED_RETAILER","OCR","IMAGE_READER","HUMAN_REVIEW"],
    live_page_acquisition_started:false,paid_calls:0,image_not_required_for_safety:true});
 let existingRecovery:any=null;
 try{existingRecovery=await existingRecentRecovery(base,key,productId)}
 catch{return response({status:"RETRYABLE",product_id:productId,score_available:false,
    reason:"RECOVERY_STATE_UNAVAILABLE",paid_calls:0},503)}
 if(existingRecovery)return response({status:"RECOVERY_ALREADY_QUEUED",product_id:productId,
    run_id:existingRecovery.run_id,score_available:false,paid_calls:0,
    recovery_state:existingRecovery.status,reason:"EXISTING_BACKEND_RECOVERY_IN_PROGRESS"});

 // Contract: exactly one Path-A acquisition per ACQUIRE request. Path A itself
 // stops qualification at complete official source; trusted merchant next.
 // Missing evidence is routed to the existing OCR/VLM recovery worker; no fabricated score.
 let begun:Obj|any;try{
  const v=await rpc(base,key,"sp_m1b_begin_run_v1",{p_context:"NORMAL_SEARCH",p_product_id:productId,
   p_product_fingerprint:product.product_fingerprint,p_benchmark_slot_id:null,p_session_key:null},5500);
  begun=v.ok?v.data:null;
 }catch{}
 const runId=typeof begun?.run_id==="string"?begun.run_id:"";
 if(!UUID.test(runId))return response({status:"RETRYABLE",product_id:productId,reason:"RUN_CREATION_FAILED"},503);
 let acquisition:any=null;
 try{
  const r=await fetch(`${base}/functions/v1/sp-m1b-path-a-v1`,{
   method:"POST",headers:{...headers(key),"x-m1b-internal-key":key},
   body:JSON.stringify({run_id:runId,product_id:productId,
    identity:{brand_name:product.brand_name,product_name:product.product_name,
      variant:product.variant_name??undefined,pack_size_text:product.pack_size_text??undefined,
      market_country_code:product.market_country_code??"IN",gtin:product.gtin??undefined},
    query:`${product.brand_name} ${product.product_name} ${product.pack_size_text??""}`.trim(),
    foreground_budget_ms:28500,benchmark_mode:false}),
   signal:AbortSignal.timeout(36500)
  });
  if(r.ok)acquisition=await r.json();
 }catch{}
 if(!acquisition||acquisition.success!==true){
  const enqueued=await rpc(base,key,"sp_m1b_enqueue_recovery_v1",{
   p_run_id:runId,p_product_id:productId,p_failure_code:"MAKE_PATH_A_UNAVAILABLE",
   p_payload:{identity:{brand_name:product.brand_name,product_name:product.product_name,
    variant:product.variant_name,pack_size_text:product.pack_size_text,market_country_code:product.market_country_code}}
  },5000).catch(()=>({ok:false,data:null}));
  const queued=enqueued.ok&&enqueued.data?.success===true;
  const humanReviewQueued=queued?false:await routeHumanReview(base,key,productId,"OFFICIAL_TRUSTED_EXTRACTION_UNAVAILABLE");
  return response({status:queued?"RECOVERY_QUEUED":humanReviewQueued?"HUMAN_REVIEW_REQUIRED":"RETRYABLE",
   human_review_recorded:humanReviewQueued,product_id:productId,run_id:runId,score_available:false,reason:"OFFICIAL_TRUSTED_EXTRACTION_UNAVAILABLE",
   source_priority_completed:"SOURCE_QUALIFICATION_INCOMPLETE",fallback:"OCR_THEN_IMAGE_READER_THEN_HUMAN"});
 }
 if(acquisition.ingredient_status!=="QUALIFIED"){
  const queued=acquisition.recovery_enqueued===true;
  const humanReviewQueued=queued?false:await routeHumanReview(base,key,productId,String(acquisition.failure_code??"NOT_QUALIFIED"));
  return response({status:queued?"RECOVERY_QUEUED":humanReviewQueued?"HUMAN_REVIEW_REQUIRED":"RETRYABLE",
   human_review_recorded:humanReviewQueued,product_id:productId,run_id:runId,score_available:false,source_priority_completed:acquisition.failure_code==="PATH_A_FOREGROUND_TIMEOUT"?"PATH_A_TIMED_OUT":"OFFICIAL_THEN_TRUSTED",
   reason:acquisition.failure_code??"INGREDIENT_EVIDENCE_NOT_QUALIFIED",
   fallback:"OCR_THEN_IMAGE_READER_THEN_HUMAN",
   image_saved:acquisition.image_saved===true});
 }
 const score=await rpc(base,key,"sp_m1b_score_qualified_product_v1",{
  p_run_id:runId,p_product_id:productId,p_profile:profileToken(profile)},6500).catch(()=>({ok:false,data:null}));
 const scored=score.ok&&score.data?.score_available===true
  &&Number.isFinite(Number(score.data.safety_score))&&score.data.safety_score!==null;
 return response({status:scored?"QUALIFIED_AND_CACHED":"REGULATORY_REVIEW_PENDING",
  product_id:productId,run_id:runId,score_available:scored,
  source_priority_completed:acquisition.evidence_stop_reason??"SUFFICIENT_SOURCE_EVIDENCE",
  source_kind:acquisition.evidence_refs?.length?"SOURCE_LINKED":null,
  ingredient_count:Array.isArray(acquisition.parsed_ingredients)?acquisition.parsed_ingredients.length:0,
  evidence_refs:acquisition.evidence_refs??[],
  canonical_product_safety_not_merchant_specific:true,
  image_saved:acquisition.image_saved===true,missing_safety_score_fabricated:false,
  review_reason:scored?null:(score.data?.reason??"REGULATORY_QUALIFICATION_INCOMPLETE")});
});
