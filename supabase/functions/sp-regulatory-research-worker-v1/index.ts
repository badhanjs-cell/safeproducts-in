import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const WORKER_CODE="REGULATORY_WEB_RESEARCH";
const WORKER_VERSION="SP-REGULATORY-WEB-RESEARCH/1.0";
const DEFAULT_MODEL="gpt-5.6-luna";
type Obj=Record<string,any>;

function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});}
function getAdminKey():string{const p=Deno.env.get("SP_LABEL_ADMIN_KEY_NAME")??"default";const raw=Deno.env.get("SUPABASE_SECRET_KEYS");if(raw){try{const m=JSON.parse(raw) as Record<string,string>;const k=m[p]??m.default??Object.values(m)[0];if(k?.trim())return k;}catch{}}const k=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(k?.trim())return k;throw new Error("SUPABASE_SERVER_KEY_UNAVAILABLE");}
function headers(k:string){const h:Record<string,string>={apikey:k,"Content-Type":"application/json",Accept:"application/json"};if(!k.startsWith("sb_secret_"))h.Authorization=`Bearer ${k}`;return h;}
async function rpc(base:string,key:string,name:string,body:Obj,timeout=12000){const r=await fetch(`${base.replace(/\/$/,"")}/rest/v1/rpc/${name}`,{method:"POST",headers:headers(key),body:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});const t=await r.text();let data:any=null;if(t.trim()){try{data=JSON.parse(t)}catch{data=t}}return{ok:r.ok,status:r.status,data};}
function outputText(v:any):string|null{for(const item of Array.isArray(v?.output)?v.output:[]){if(item?.type!=="message")continue;for(const p of Array.isArray(item.content)?item.content:[])if(p?.type==="output_text"&&typeof p.text==="string")return p.text;}return null;}
function sourceUrls(v:any):string[]{const out=new Set<string>();const walk=(x:any)=>{if(!x)return;if(Array.isArray(x)){for(const y of x)walk(y);return;}if(typeof x!=="object")return;if(typeof x.url==="string"&&/^https:\/\//i.test(x.url))out.add(x.url);for(const y of Object.values(x))walk(y);};for(const item of Array.isArray(v?.output)?v.output:[])if(item?.type==="web_search_call")walk(item?.action?.sources);return[...out];}
function host(u:string):string|null{try{return new URL(u).hostname.toLowerCase().replace(/^www\./,"")}catch{return null}}
function sourceSupported(u:string,sources:string[]):boolean{const h=host(u);if(!h)return false;return sources.some(s=>s===u||host(s)===h);}

async function research(item:Obj,domains:string[],openaiKey:string){
  const schema={type:"object",additionalProperties:false,properties:{evidence:{type:"array",maxItems:8,items:{type:"object",additionalProperties:false,properties:{source_url:{type:"string"},authority:{type:["string","null"]},jurisdiction:{type:["string","null"]},source_title:{type:["string","null"]},evidence_summary:{type:"string"},legal_force:{type:["string","null"]},publication_date:{type:["string","null"]},confidence:{type:"number",minimum:0,maximum:100},evidence_kind:{type:"string",enum:["IDENTITY","REGULATORY","BOTH"]}},required:["source_url","authority","jurisdiction","source_title","evidence_summary","legal_force","publication_date","confidence","evidence_kind"]}}},required:["evidence"]};
  const prompt=`You are the SafeProducts authoritative-source regulatory research worker. Research this ingredient only on the supplied official authority domains. Ingredient: ${String(item.canonical_name??"")}. INCI: ${String(item.inci_name??"")}. CAS: ${String(item.cas_number??"")}. Queue purpose: ${String(item.current_status??"")}.
Hard rules:
- Return evidence only when the official source explicitly concerns this exact substance, a clearly documented synonym, or an exact botanical/material identity.
- Distinguish identity evidence from binding regulatory evidence.
- Do not infer a restriction from silence. Do not treat guidance, enforcement notices, marketing pages, or search snippets as a binding ingredient rule unless the source itself establishes that status.
- Preserve jurisdiction and legal force.
- Never create or publish a GRIL identity or regulatory position. All output is candidate evidence for human review.
- If no relevant official-source evidence is found, return an empty evidence array.`;
  const body={model:Deno.env.get("SP_REGULATORY_WEB_MODEL")??Deno.env.get("SP_LABEL_OPENAI_MODEL")??DEFAULT_MODEL,store:false,reasoning:{effort:"low"},tools:[{type:"web_search",filters:{allowed_domains:domains.slice(0,100)}}],tool_choice:"auto",include:["web_search_call.action.sources"],input:prompt,text:{format:{type:"json_schema",name:"safeproducts_regulatory_research",strict:true,schema}}};
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${openaiKey}`,"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(50000)});
  const raw=await r.text();if(!r.ok)throw new Error(`OPENAI_${r.status}`);const parsed=JSON.parse(raw);const text=outputText(parsed);if(!text)throw new Error("OPENAI_EMPTY_OUTPUT");const result=JSON.parse(text);const sources=sourceUrls(parsed);const evidence=(Array.isArray(result.evidence)?result.evidence:[]).filter((e:any)=>sourceSupported(String(e?.source_url??""),sources));return{evidence,sources};
}

Deno.serve(async(req:Request)=>{
  const requestId=crypto.randomUUID();if(req.method!=="POST")return json({success:false,code:"METHOD_NOT_ALLOWED",request_id:requestId},405);
  const token=req.headers.get("x-sp-worker-token")??"";const base=Deno.env.get("SUPABASE_URL")??"";if(!base)return json({success:false,code:"SUPABASE_URL_UNAVAILABLE",request_id:requestId},500);
  let key:string;try{key=getAdminKey()}catch{return json({success:false,code:"SUPABASE_SERVER_KEY_UNAVAILABLE",request_id:requestId},500)}
  const auth=await rpc(base,key,"sp_internal_worker_token_valid_v1",{p_worker_code:WORKER_CODE,p_token:token});if(!auth.ok||auth.data!==true)return json({success:false,code:"WORKER_AUTH_REQUIRED",request_id:requestId},401);
  const openaiKey=Deno.env.get("OPENAI_API_KEY")??"";if(!openaiKey)return json({success:false,code:"OPENAI_NOT_CONFIGURED",request_id:requestId},503);
  const domainsResp=await rpc(base,key,"sp_get_regulatory_official_domains_v1",{});const domains=Array.isArray(domainsResp.data)?domainsResp.data.filter((x:any)=>typeof x==="string"&&x.length>2):[];if(!domains.length)return json({success:false,code:"OFFICIAL_DOMAIN_REGISTRY_EMPTY",request_id:requestId},503);
  const claim=await rpc(base,key,"sp_claim_regulatory_web_research_v1",{p_limit:2});if(!claim.ok||!Array.isArray(claim.data))return json({success:false,code:"REGULATORY_CLAIM_FAILED",request_id:requestId},503);
  const outcomes:any[]=[];
  for(const item of claim.data){
    try{
      const {evidence,sources}=await research(item,domains,openaiKey);
      const enriched=evidence.map((e:any)=>({...e,worker_sources:sources.slice(0,30),worker_version:WORKER_VERSION,automatic_publication:false}));
      const done=await rpc(base,key,"sp_complete_regulatory_web_research_v1",{p_queue_id:item.queue_id,p_evidence:enriched,p_worker_version:WORKER_VERSION});if(!done.ok)throw new Error(`COMPLETE_${done.status}`);
      outcomes.push({queue_id:item.queue_id,success:true,accepted_evidence:done.data?.accepted_evidence??0});
    }catch(e){const msg=e instanceof Error?e.message:String(e);outcomes.push({queue_id:item.queue_id,success:false,code:msg.slice(0,120)});}
  }
  return json({success:true,worker_version:WORKER_VERSION,claimed:claim.data.length,outcomes,automatic_publication:false,request_id:requestId});
});