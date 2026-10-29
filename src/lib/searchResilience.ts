import type { Profile } from '@/components/HeroSearch';
import { supabase } from '@/integrations/supabase/client';
import { normalizeSearchQuery } from './searchLanguage';
import { toApiProfile, type ApiProfile, type Product } from './searchContract';
import { parsePackKeyFromText, prepareResilienceProducts } from './searchResiliencePolicy.mjs';

const objectValue = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const textValue = (value: unknown): string | null => { if (typeof value !== 'string') return null; const v=value.trim(); return v || null; };
const numberValue = (value: unknown): number | null => { if (typeof value !== 'number' && typeof value !== 'string') return null; const n=Number(value); return Number.isFinite(n)?n:null; };
const httpsValue = (value: unknown): string | null => { const raw=textValue(value); if(!raw)return null; try{const url=new URL(raw);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null}catch{return null} };
function profileScores(row: Record<string, unknown>) { return {all:numberValue(row.safety_score),children:numberValue(row.child_score),pregnant:numberValue(row.pregnancy_score),seniors:numberValue(row.senior_score)} satisfies Record<ApiProfile, number | null>; }
function cachedLabel(value: unknown): string | null { const raw=textValue(value);if(!raw)return null;const d=new Date(raw);return Number.isNaN(d.getTime())?null:d.toLocaleString(); }

function mapRow(raw: unknown, profile: ApiProfile): Product | null {
  const row=objectValue(raw),id=textValue(row.id),name=textValue(row.name); if(!id||!name)return null;
  const displayBasis=textValue(row.display_basis)?.toUpperCase(); if(displayBasis!=='SAFETY_QUALIFIED'&&displayBasis!=='PRICE_ONLY_FALLBACK')return null;
  const safetyQualified=displayBasis==='SAFETY_QUALIFIED'&&row.safety_determined===true,scores=profileScores(row),declaredProfileScore=numberValue(row.profile_score),selectedScore=safetyQualified?declaredProfileScore??scores[profile]:null;if(safetyQualified&&selectedScore===null)return null;
  const price=numberValue(row.price),currency=textValue(row.currency)?.toUpperCase()??null,affiliateLink=httpsValue(row.affiliate_url),sourceUrl=httpsValue(row.source_url),commercialOk=price!==null&&price>0&&currency==='INR'&&!!(affiliateLink??sourceUrl);if(!commercialOk)return null;
  const cacheTime=cachedLabel(row.cached_at),displayNote=textValue(row.display_note),cacheDisclaimer=safetyQualified?`${displayNote??'Last known qualified SafeProducts assessment.'}${cacheTime?` Cached ${cacheTime}.`:''} Live product data is still being refreshed.`:displayNote??'Live safety qualification is temporarily unavailable. No safety score is claimed.';
  return {id,name,brand:textValue(row.brand),category:textValue(row.category)??'',evaluated_profile:profile,platform:textValue(row.platform),price,currency,image_url:httpsValue(row.image_url),ingredients:null,safety_score:safetyQualified?scores.all:null,profile_score:safetyQualified?selectedScore:null,profile_safety:safetyQualified?scores:{all:null,children:null,pregnant:null,seniors:null},warnings:[],recommendation:safetyQualified?textValue(row.recommendation):null,confidence:safetyQualified?numberValue(row.confidence):null,source_url:sourceUrl,affiliate_link:affiliateLink,production_qualified:safetyQualified,badges:{safest:false,lowestPrice:false,bestValue:false},display_eligible:true,display_basis:safetyQualified?'SAFETY_QUALIFIED':'PRICE_ONLY_FALLBACK',safety_determined:safetyQualified,safety_status_label:safetyQualified?'Cached qualified safety assessment':'Safety Score could not be determined due to insufficient ingredient evidence.',safety_unavailable_reason:safetyQualified?null:'Live safety qualification is temporarily unavailable for this result.',price_text:price.toLocaleString('en-IN'),assessment_display_label:safetyQualified?'Cached qualified assessment':null,assessment_source:safetyQualified?'SafeProducts verified cache':null,assessment_disclaimer:cacheDisclaimer,canonical_product_id:textValue(row.canonical_product_id)??id,canonical_product_fingerprint:textValue(row.canonical_product_fingerprint)??id,merchant_offer_id:textValue(row.merchant_offer_id),result_group:'CATEGORY_PRODUCT',pack_size_text:textValue(row.pack_size_text),pack_normalized_key:textValue(row.pack_normalized_key)};
}
function mappedProducts(payload:unknown,profile:ApiProfile):Product[]{const body=objectValue(payload);return(Array.isArray(body.results)?body.results:[]).map(row=>mapRow(row,profile)).filter((product):product is Product=>product!==null)}
export type SearchResilienceResult={products:Product[];status:string;safetyQualifiedCount:number;priceFallbackCount:number;selectedPackKey:string|null;priceComparisonAvailable:boolean};
const emptyResult=(status:string):SearchResilienceResult=>({products:[],status,safetyQualifiedCount:0,priceFallbackCount:0,selectedPackKey:null,priceComparisonAvailable:false});
export async function getSearchResilienceProducts(input:{query:string;profile:Profile;limit?:number}):Promise<SearchResilienceResult>{
 const query=normalizeSearchQuery(input.query),limit=Math.min(Math.max(input.limit??10,1),10);if(!query)return emptyResult('EMPTY_QUERY');
 const [primaryResult,recentResult]=await Promise.all([(supabase as any).rpc('sp_web_search_resilience_v1',{p_search_query:query,p_profile:input.profile,p_limit:limit}),(supabase as any).rpc('sp_web_recent_discovery_fallback_v1',{p_search_query:query,p_limit:limit})]);
 const profile=toApiProfile(input.profile),primaryProducts=primaryResult.error?[]:mappedProducts(primaryResult.data,profile),recentProducts=recentResult.error?[]:mappedProducts(recentResult.data,profile);
 const requestedPackKey=parsePackKeyFromText(query),prepared=prepareResilienceProducts([...primaryProducts,...recentProducts],limit,requestedPackKey,query),products=prepared.products;
 if(products.length===0)return emptyResult(primaryResult.error&&recentResult.error?'UNAVAILABLE':'NO_RESILIENCE_PRODUCTS');
 const safetyQualifiedCount=products.filter(p=>p.display_basis==='SAFETY_QUALIFIED').length,priceFallbackCount=products.filter(p=>p.display_basis==='PRICE_ONLY_FALLBACK').length;
 return{products,status:'RESILIENCE_READY',safetyQualifiedCount,priceFallbackCount,selectedPackKey:prepared.selectedPackKey,priceComparisonAvailable:prepared.priceComparisonAvailable};
}
