import "jsr:@supabase/functions-js/edge-runtime.d.ts";
type Obj=Record<string,any>;
const MAX_ENRICH_PER_RUN=1;
const GLOBAL_LEASE_SECONDS=90;
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}})}
function serverKey(){const preferred=Deno.env.get("SP_LABEL_ADMIN_KEY_NAME")??"default";const raw=Deno.env.get("SUPABASE_SECRET_KEYS");if(raw){try{const map=JSON.parse(raw);const value=map[preferred]??map.default??Object.values(map)[0];if(typeof value==="string"&&value.trim())return value}catch{/* fall through */}}const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(legacy?.trim())return legacy;throw new Error("SERVER_KEY_UNAVAILABLE")}
function constantTimeEqual(a:string,b:string){const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);if(x.length!==y.length)return false;let d=0;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0}
function headers(key:string){const h:Record<string,string>={apikey:key,"Content-Type":"application/json",Accept:"application/json"};if(!key.startsWith("sb_secret_"))h.Authorization=`Bearer ${key}`;return h}
async function parse(r:Response){const t=await r.text();if(!t.trim())return null;try{return JSON.parse(t)}catch{return null}}
async function rpc(base:string,key:string,name:string,body:Obj,timeout=6000){const r=await fetch(`${base.replace(/\/$/,"")}/rest/v1/rpc/${name}`,{method:"POST",headers:headers(key),body:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});return{ok:r.ok,status:r.status,data:await parse(r)}}
async function product(base:string,key:string,id:string){const r=await fetch(`${base.replace(/\/$/,"")}/rest/v1/sp_catalog_product_v1?select=id,product_fingerprint,brand_name,product_name,variant_name,pack_size_text,pack_normalized_key,market_country_code,gtin,identity_status,is_active&id=eq.${encodeURIComponent(id)}&limit=1`,{headers:headers(key),signal:AbortSignal.timeout(3000)});const d=await parse(r);return r.ok&&Array.isArray(d)?d[0]??null:null}
async function pathA(base:string,key:string,body:Obj){try{const r=await fetch(`${base.replace(/\/$/,"")}/functions/v1/sp-m1b-path-a-v1`,{method:"POST",headers:{...headers(key),"x-m1b-internal-key":key},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});return{ok:r.ok,status:r.status,data:await parse(r)}}catch{return{ok:false,status:0,data:null}}}


/** Fail closed while an M1-BR evidence-recovery or human-review case owns this product.
 * A database lookup is cheaper than another paid provider path and cannot be
 * bypassed by waiting out the ordinary short provider cooldown.
 */
async function pendingRecovery(base:string,key:string,id:string){
 const url=new URL((base.endsWith("/")?base.slice(0,-1):base)+"/rest/v1/sp_m1br_recovery_queue_v1");
 url.searchParams.set("select","id,status");
 url.searchParams.set("product_id","eq."+id);
 url.searchParams.set("status","in.(PENDING,RETRY,IN_PROGRESS,ADMIN_REVIEW)");
 url.searchParams.set("order","created_at.desc");
 url.searchParams.set("limit","1");
 const r=await fetch(url.toString(),{headers:headers(key),signal:AbortSignal.timeout(3500)});
 if(!r.ok)throw Error("RECOVERY_STATE_READ_FAILED");
 const rows=await parse(r);
 if(!Array.isArray(rows))throw Error("RECOVERY_STATE_INVALID");
 return rows[0]??null;
}

async function enrichOne(base:string,key:string,id:string,profile:string){
 try{
   const p=await product(base,key,id);if(!p){await rpc(base,key,"sp_us2_finish_live_safety_enrichment_v1",{p_product_id:id,p_status:"PRODUCT_NOT_FOUND"});return{product_id:id,status:"PRODUCT_NOT_FOUND"}}
   if(p.identity_status==="VERIFIED"){
     const reused=await rpc(base,key,"sp_m1b_score_catalog_reuse_v2",{p_product_id:id,p_profile:profile},5000).catch(()=>({ok:false,data:null,status:0}));
     if(reused.ok&&reused.data?.score_available===true){await rpc(base,key,"sp_us2_finish_live_safety_enrichment_v1",{p_product_id:id,p_status:"CATALOG_REUSED"});return{product_id:id,status:"CATALOG_REUSED",score:reused.data.safety_score}}
   }
   const begun=await rpc(base,key,"sp_m1b_begin_run_v1",{p_context:"NORMAL_SEARCH",p_product_id:id,p_product_fingerprint:p.product_fingerprint,p_benchmark_slot_id:null,p_session_key:null},4000);
   const runId=begun.data?.run_id;if(!begun.ok||!runId){await rpc(base,key,"sp_us2_finish_live_safety_enrichment_v1",{p_product_id:id,p_status:"RUN_START_FAILED"});return{product_id:id,status:"RUN_START_FAILED"}}
   const acquired=await pathA(base,key,{run_id:runId,product_id:id,query:`${p.brand_name} ${p.product_name} ${p.pack_size_text??""}`.trim(),identity:{brand_name:p.brand_name,product_name:p.product_name,variant:p.variant_name??undefined,pack_size_text:p.pack_size_text??undefined,market_country_code:p.market_country_code??"IN",gtin:p.gtin??undefined},foreground_budget_ms:55000,background_mode:true,benchmark_mode:false});
   if(!acquired.ok||acquired.data?.ingredient_status!=="QUALIFIED"){
     const status=acquired.data?.failure_code??"INSUFFICIENT_EVIDENCE";
     await rpc(base,key,"sp_us2_finish_live_safety_enrichment_v1",{p_product_id:id,p_status:status});
     return{product_id:id,status};
   }
   const scored=await rpc(base,key,"sp_m1b_score_qualified_product_v2",{p_run_id:runId,p_product_id:id,p_profile:profile},6000);
   const status=scored.ok&&scored.data?.score_available===true?"QUALIFIED":"SCORE_UNAVAILABLE";
   await rpc(base,key,"sp_us2_finish_live_safety_enrichment_v1",{p_product_id:id,p_status:status});
   return{product_id:id,status,score:scored.data?.safety_score??null,evidence_coverage:scored.data?.evidence_coverage??null};
 }catch(error){await rpc(base,key,"sp_us2_finish_live_safety_enrichment_v1",{p_product_id:id,p_status:"WORKER_FAILED"}).catch(()=>null);return{product_id:id,status:"WORKER_FAILED",error:error instanceof Error?error.message:String(error)}}
}

Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json({success:false,code:"METHOD_NOT_ALLOWED"},405);
 let key:string;try{key=serverKey()}catch{return json({success:false,code:"SERVER_CONFIGURATION_MISSING"},503)}
 if(!constantTimeEqual(req.headers.get("x-us2-internal-key")??"",key))return json({success:false,code:"INTERNAL_AUTH_REQUIRED"},401);
 let input:Obj;try{input=await req.json()}catch{return json({success:false,code:"INVALID_JSON"},400)}
 const ids=Array.isArray(input.product_ids)?[...new Set(input.product_ids.filter((v:any)=>typeof v==="string"&&/^[0-9a-f-]{36}$/i.test(v)))].slice(0,10):[];
 const profile=typeof input.profile==="string"?input.profile:"ALL";const base=Deno.env.get("SUPABASE_URL")??"";if(!base)return json({success:false,code:"SERVER_CONFIGURATION_MISSING"},503);

 // Global provider lease prevents separate browser refreshes/searches from running
 // overlapping background Path A calls. A failed owner intentionally leaves the
 // short lease in place as provider backoff; it self-expires after 90 seconds.
 const holderId=crypto.randomUUID();
 const globalLease=await rpc(base,key,"sp_us2_claim_safety_provider_lease_v1",{p_holder_id:holderId,p_lease_seconds:GLOBAL_LEASE_SECONDS},2500).catch(()=>({ok:false,data:null,status:0}));
 if(!globalLease.ok||globalLease.data?.allowed!==true){
   return json({success:true,engine:"SP-US2-SAFETY-ENRICH/1.3",scanned:ids.length,processed:0,max_enrich_per_run:MAX_ENRICH_PER_RUN,results:ids.map((product_id:string)=>({product_id,status:"PROVIDER_BUSY"}))});
 }

 const selected:string[]=[];const skipped:any[]=[];
 for(const id of ids){
   if(selected.length>=MAX_ENRICH_PER_RUN)break;
   // Protect against duplicate Path A work while OCR/VLM or human review is pending.
   let recovery:any;
   try{recovery=await pendingRecovery(base,key,id)}
   catch{skipped.push({product_id:id,status:"RECOVERY_STATE_UNAVAILABLE"});continue}
   if(recovery){skipped.push({product_id:id,status:"RECOVERY_ALREADY_PENDING",recovery_status:recovery.status});continue}
   const claim=await rpc(base,key,"sp_us2_claim_live_safety_enrichment_v2",{p_product_id:id,p_cooldown_minutes:720},2500).catch(()=>({ok:false,data:null,status:0}));
   if(claim.ok&&claim.data?.allowed===true)selected.push(id);
   else skipped.push({product_id:id,status:claim.data?.reason??"CLAIM_DENIED"});
 }

 if(selected.length===0){
   await rpc(base,key,"sp_us2_release_safety_provider_lease_v1",{p_holder_id:holderId},2500).catch(()=>null);
   return json({success:true,engine:"SP-US2-SAFETY-ENRICH/1.3",scanned:ids.length,processed:0,max_enrich_per_run:MAX_ENRICH_PER_RUN,results:skipped});
 }

 const enriched:any[]=[];
 for(const id of selected){
   enriched.push(await enrichOne(base,key,id,profile));
 }

 // Keep the lease until expiry after provider-path failure to create bounded backoff.
 // OPENAI_429 is the observed live rate-limit failure and must not reopen capacity immediately.
 // Successful/non-provider outcomes release immediately so another queued product can run.
 const providerFailed=enriched.some((row)=>row?.status==="OPENAI_429"||row?.status==="PATH_A_FAILED"||row?.status==="WORKER_FAILED");
 if(!providerFailed){
   await rpc(base,key,"sp_us2_release_safety_provider_lease_v1",{p_holder_id:holderId},2500).catch(()=>null);
 }
 return json({success:true,engine:"SP-US2-SAFETY-ENRICH/1.3",scanned:ids.length,processed:enriched.length,max_enrich_per_run:MAX_ENRICH_PER_RUN,provider_backoff:providerFailed,results:[...enriched,...skipped]});
});
