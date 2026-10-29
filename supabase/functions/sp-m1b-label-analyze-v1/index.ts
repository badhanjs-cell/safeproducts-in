import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const FUNCTION_VERSION="SP-M1B-LABEL/1.0";
const SCORE_ENGINE_VERSION="M1B_LABEL_SAFETY_V1";
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
function genericPlaceholder(s:string){return /^(excipients?|q\.?s\.?|other ingredients?|base)$/i.test(s.trim());}
function details(r:any){const name=String(r?.canonical_name??r?.input_name??"Ingredient");const agency=typeof r?.agency==="string"&&r.agency?` (${r.agency})`:"";if(r?.status==="prohibited")return `${name} matched an applicable prohibited reference${agency}.`;if(r?.status==="restricted")return `${name} matched an applicable restricted reference${agency}; label concentration/use conditions may still matter.`;if(r?.status==="permitted")return `${name} matched an applicable permitted/allowed reference${agency}.`;return `${name} does not yet have complete applicable regulatory evidence for a Safety Score.`;}
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
    return json({status,safety_score:null,detected_ingredients:ingredients,ingredient_breakdown:[],warnings:[],summary:status==="DEEPER_VERIFICATION_IN_PROGRESS"?"Ingredient verification is continuing in the background.":"A Safety Score is withheld until the required evidence is complete.",run_id:runId,catalog_sync_status:"SYNCED",catalog_product_id:productId,brand_name:identity.brand_name,product_name:identity.product_name,variant:String(identity.variant??""),pack_size_text:String(identity.pack_size_text??""),product_scope:scope,engine:"M1-B",edge_version:FUNCTION_VERSION,recovery_status:queued?"QUEUED":"NOT_REQUIRED"});
  };

  try{
    const remaining=Math.max(1000,foreground_deadline_ms-(Date.now()-started)-2500);
    if(remaining<4000)return pending("DEEPER_VERIFICATION_IN_PROGRESS",[],"M1B_LABEL_FOREGROUND_DEADLINE",true);
    // Reuse a previously qualified exact-image ingredient extraction only.
    // Never reuse a Safety Score: always repeat live regulatory checks and scoring.
    const prior=await rpc(base,key,"sp_web_label_cached_extraction_v1",{
      p_image_sha256:ingredientImageSha256,p_engine_version:SCORE_ENGINE_VERSION
    },1200).catch(()=>({ok:false,data:null}));
    let extraction:any=prior.ok&&Array.isArray(prior.data?.detected_ingredients)
      && prior.data?.declaration_complete===true ? prior.data : null;
    const cachedExtraction=extraction!==null;
    if(!cachedExtraction){
    const schema={type:"object",additionalProperties:false,properties:{detected_ingredients:{type:"array",minItems:1,maxItems:150,items:{type:"string"}},product_scope:{type:"string",enum:[...ALLOWED_SCOPES]},declaration_complete:{type:"boolean"},uncertain_tokens:{type:"array",maxItems:50,items:{type:"string"}}},required:["detected_ingredients","product_scope","declaration_complete","uncertain_tokens"]};
    const prompt=`Read only the visible ingredient/composition/INCI declaration from this exact product label. Identity already pair-validated: brand=${identity.brand_name}; product=${identity.product_name}; variant=${identity.variant??""}; pack=${identity.pack_size_text??"unknown"}; market=${identity.market_country_code}. Preserve ingredient order. Split separate ingredients. Never infer, complete, repair or invent obscured text. declaration_complete=true only when the complete declaration including its visible end is readable. Put every uncertain token or unreadable fragment in uncertain_tokens. Classify product_scope from visible product/ingredient evidence. Do not perform safety scoring or regulatory classification.`;
    const ai=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${openai}`,"Content-Type":"application/json"},body:JSON.stringify({model:Deno.env.get("SP_M1B_LABEL_MODEL")??DEFAULT_MODEL,store:false,max_output_tokens:1800,input:[{role:"system",content:[{type:"input_text",text:prompt}]},{role:"user",content:[{type:"input_text",text:"Extract only the visible label declaration."},{type:"input_image",image_url:imageDataUrl,detail:"high"}]}],text:{format:{type:"json_schema",name:"sp_m1b_label_extraction",strict:true,schema}}}),signal:AbortSignal.timeout(Math.min(18_000,remaining))});
    if(!ai.ok)return pending("DEEPER_VERIFICATION_IN_PROGRESS",[],`LABEL_VLM_${ai.status}`,true);
    const aiJson=await ai.json();const text=outputText(aiJson);if(!text)return pending("DEEPER_VERIFICATION_IN_PROGRESS",[],"LABEL_VLM_EMPTY",true);
    try{extraction=JSON.parse(text)}catch{return pending("DEEPER_VERIFICATION_IN_PROGRESS",[],"LABEL_VLM_INVALID",true)}
    }
    const ingredients=clean(extraction?.detected_ingredients);const scope=ALLOWED_SCOPES.has(extraction?.product_scope)?extraction.product_scope:"UNKNOWN";const uncertain=clean(extraction?.uncertain_tokens);
    const complete=extraction?.declaration_complete===true&&uncertain.length===0&&ingredients.length>0&&!ingredients.some(genericPlaceholder);
    if(!ingredients.length)return pending("DEEPER_VERIFICATION_IN_PROGRESS",[],"LABEL_INGREDIENTS_NOT_READABLE",true,scope);

    const normalized=await rpc(base,key,"sp_web_normalize_label_ingredients_v1",{p_ingredients:ingredients},Math.min(4000,Math.max(1000,foreground_deadline_ms-(Date.now()-started)-1500)));
    const normalizedIngredients=normalized.ok&&Array.isArray(normalized.data)&&normalized.data.length?normalized.data.map((x:any)=>String(x)):ingredients;
    const applied=await rpc(base,key,"sp_m1b_label_apply_ingredient_evidence_v1",{p_run_id:runId,p_product_id:productId,p_payload:{ingredient_image_sha256:ingredientImageSha256,detected_ingredients:normalizedIngredients,declaration_complete:complete,uncertain_tokens:uncertain,product_scope:scope,engine_version:FUNCTION_VERSION}},4000);
    if(!applied.ok)return pending("DEEPER_VERIFICATION_IN_PROGRESS",normalizedIngredients,"LABEL_EVIDENCE_PERSISTENCE_FAILED",true,scope);
    await record("USER_LABEL_VLM_EXTRACTION",complete?"COMPLETED":"INSUFFICIENT_EVIDENCE",complete?null:"LABEL_DECLARATION_INCOMPLETE",{declaration_complete:complete,uncertain_tokens:uncertain.length,cache_hit:cachedExtraction});
    if(!complete)return pending("DEEPER_VERIFICATION_IN_PROGRESS",normalizedIngredients,"LABEL_DECLARATION_INCOMPLETE",true,scope);

    const resolutions:any[]=[];
    for(const name of normalizedIngredients){
      if(Date.now()-started>foreground_deadline_ms-2500)return pending("INSUFFICIENT_EVIDENCE",normalizedIngredients,"LABEL_REGULATORY_DEADLINE",false,scope);
      const rr=await rpc(base,key,"sp_web_resolve_label_ingredient_v2",{p_name:name,p_product_scope:scope},3000);
      resolutions.push(rr.ok&&rr.data&&typeof rr.data==="object"?rr.data:{input_name:name,status:"unknown",regulatory_applicable:false});
    }
    const breakdown=resolutions.map(r=>({name:String(r.input_name??r.canonical_name??"Ingredient"),status:["permitted","restricted","prohibited"].includes(String(r.status))?String(r.status):"unknown",details:details(r)}));
    const regulatoryComplete=resolutions.length===normalizedIngredients.length&&resolutions.every(r=>r.regulatory_applicable===true&&["permitted","restricted","prohibited"].includes(String(r.status)));
    if(!regulatoryComplete){await record("REGULATORY_QUALIFICATION","INSUFFICIENT_EVIDENCE","REGULATORY_EVIDENCE_INCOMPLETE",{resolved_count:resolutions.filter(r=>r.regulatory_applicable===true).length,total:resolutions.length});return json({status:"INSUFFICIENT_EVIDENCE",safety_score:null,detected_ingredients:normalizedIngredients,ingredient_breakdown:breakdown,warnings:["Safety Score withheld until applicable regulatory evidence is complete."],summary:"The ingredient declaration was read, but the evidence required for a Safety Score is incomplete.",run_id:runId,catalog_sync_status:"SYNCED",catalog_product_id:productId,brand_name:identity.brand_name,product_name:identity.product_name,variant:String(identity.variant??""),pack_size_text:String(identity.pack_size_text??""),product_scope:scope,engine:"M1-B",edge_version:FUNCTION_VERSION,recovery_status:"NOT_REQUIRED"});}

    const scored=await rpc(base,key,"sp_web_score_label_safety_v1",{p_breakdown:resolutions.map(r=>({...r,status:String(r.status)})),p_product_scope:scope,p_profile:profile},Math.min(4000,Math.max(1000,foreground_deadline_ms-(Date.now()-started)-500)));
    const score=Number(scored.data?.safety_score);const coverage=Number(scored.data?.evidence_coverage??0);
    if(!scored.ok||!Number.isFinite(score)||score<0||score>100||coverage<100)return pending("INSUFFICIENT_EVIDENCE",normalizedIngredients,"DETERMINISTIC_SCORE_EVIDENCE_INCOMPLETE",false,scope);
    const warnings=["Independent SafeProducts analytical result based on the submitted exact-product label and identified regulatory evidence."];
    const summary=`Safety Score ${Math.round(score)}/100; evidence coverage ${coverage.toFixed(0)}%.`;
    const saved=await rpc(base,key,"sp_web_record_label_analysis_v3",{p_detected_ingredients:normalizedIngredients,p_safety_score:score,p_regulatory_screen_score:Number(scored.data?.regulatory_screen_score??score),p_safety_score_raw:Number(scored.data?.raw_safety_score??score),p_confidence_adjustment:Number(scored.data?.confidence_adjustment??0),p_profile_used:profile,p_warnings:warnings,p_ingredient_breakdown:breakdown,p_summary:summary,p_session_id:sessionId,p_image_sha256:ingredientImageSha256,p_product_scope:scope,p_score_policy_version:String(scored.data?.policy_version??"LABEL_SAFETY_V1_0"),p_evidence_coverage:coverage,p_research_pending_count:0,p_engine_version:SCORE_ENGINE_VERSION,p_resolution_snapshot:{m1b_run_id:runId,edge_version:FUNCTION_VERSION,qualification:"EXACT_USER_LABEL_PLUS_COMPLETE_REGULATORY_EVIDENCE"}},4000);
    const id=saved.ok?(typeof saved.data==="string"?saved.data:String(saved.data?.id??"")):"";
    await record("FINAL_LABEL_QUALIFICATION","QUALIFIED",null,{evidence_coverage:coverage});
    return json({status:"QUALIFIED",detected_ingredients:normalizedIngredients,ingredient_breakdown:breakdown,safety_score:score,warnings,summary,id,product_scope:scope,evidence_coverage:coverage,research_pending_count:0,score_policy_version:String(scored.data?.policy_version??"LABEL_SAFETY_V1_0"),engine:"M1-B",edge_version:FUNCTION_VERSION,cache_hit:false,run_id:runId,catalog_sync_status:"SYNCED",catalog_product_id:productId,brand_name:identity.brand_name,product_name:identity.product_name,variant:String(identity.variant??""),pack_size_text:String(identity.pack_size_text??""),recovery_status:"NOT_REQUIRED"});
  }catch(error){
    return pending("DEEPER_VERIFICATION_IN_PROGRESS",[],error instanceof DOMException&&error.name==="TimeoutError"?"M1B_LABEL_FOREGROUND_TIMEOUT":"M1B_LABEL_FOREGROUND_FAILED",true);
  }
});
