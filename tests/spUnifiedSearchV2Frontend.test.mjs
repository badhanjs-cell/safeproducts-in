import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('search contract accepts SP-US2 metadata and same canonical product across unique merchant offers',async()=>{
 const {normalizeSearchResponse}=await import('../src/lib/searchContract.ts');
 const product=(id,group,merchant,price)=>({product_fingerprint:id,canonical_product_id:'canon-1',canonical_product_fingerprint:'canon-fp',merchant_offer_id:id,result_group:group,product_name:'Baby Lotion',brand_name:'Brand',category:'Baby',offer_merchant:merchant,price,currency:'INR',original_product_url:`https://${merchant}.example/p`,image_url:null,safety_score:90,profile_score:90,child_score:90,pregnancy_score:90,senior_score:90,display_basis:'SAFETY_QUALIFIED',safety_determined:true,ingredient_qualification_decision:'QUALIFIED',safety_warnings:[],engine:'M1-B',recovery_status:'NOT_REQUIRED',pack_size_text:'200 ml',pack_normalized_key:'200:ml'});
 const payload={contract_version:'SP-US2/1.0',ranking_version:'SP-US2-RANKING/1.0',status:'READY',profile:'ALL',search_mode:'SPECIFIC_PRODUCT',selected_pack:{text:'200 ml',normalized_key:'200:ml',source:'USER_EXPLICIT'},products:[product('offer-1','EXACT_OFFER','m1',200),product('offer-2','EXACT_OFFER','m2',220)],fallback_safety_claim:false,trust_promise:null,trust_promise_display_required:false,consumer_notice:null,m1b_meta:{run_id:'r',engine:'M1-B',m1br_queued_count:0,foreground_latency_ms:1}};
 const out=normalizeSearchResponse(payload,'all');
 assert.equal(out.status,'READY');
 assert.equal(out.results.length,2);
 assert.equal(out.searchMode,'SPECIFIC_PRODUCT');
 assert.equal(out.selectedPack?.normalizedKey,'200:ml');
 assert.equal(out.results[0].canonical_product_id,'canon-1');
 assert.equal(out.results[1].canonical_product_id,'canon-1');
});

test('unscored SP-US2 product remains display eligible without image price merchant or purchase URL',async()=>{
 const {normalizeSearchResponse}=await import('../src/lib/searchContract.ts');
 const payload={contract_version:'SP-US2/1.0',ranking_version:'SP-US2-RANKING/1.0',status:'PRICE_ONLY_FALLBACK_READY',profile:'ALL',search_mode:'CATEGORY',selected_pack:{text:'100 ml',normalized_key:'100:ml',source:'OFFICIAL_DEFAULT'},products:[{product_fingerprint:'p1',canonical_product_id:'p1',canonical_product_fingerprint:'fp1',merchant_offer_id:null,result_group:'CATEGORY_PRODUCT',product_name:'Hair Oil',brand_name:'Brand',category:'Hair Care',offer_merchant:null,price:null,currency:'INR',original_product_url:null,image_url:null,safety_score:null,profile_score:null,child_score:null,pregnancy_score:null,senior_score:null,display_basis:'PRICE_ONLY_FALLBACK',safety_determined:false,safety_status_label:'Safety Score could not be determined due to insufficient ingredient evidence.',safety_unavailable_reason:'INSUFFICIENT_INGREDIENT_EVIDENCE',ingredient_qualification_decision:'NOT_QUALIFIED',safety_warnings:[],engine:'M1-B',recovery_status:'QUEUED',pack_size_text:'100 ml',pack_normalized_key:'100:ml'}],fallback_safety_claim:false,trust_promise:null,trust_promise_display_required:true,consumer_notice:null,m1b_meta:{run_id:'r',engine:'M1-B',m1br_queued_count:1,foreground_latency_ms:1}};
 const out=normalizeSearchResponse(payload,'all');
 assert.equal(out.results.length,1);
 assert.equal(out.results[0].display_eligible,true);
 assert.equal(out.results[0].safety_score,null);
});

test('SearchResults renders 5+5 sections for specific mode and one grid for category mode',()=>{
 const source=readFileSync('src/components/SearchResults.tsx','utf8');
 assert.match(source,/Same product — compare prices/);
 assert.match(source,/Other products in this category/);
 assert.match(source,/searchMode/);
 assert.match(source,/EXACT_OFFER/);
 assert.match(source,/ALTERNATIVE/);
 assert.match(source,/orderDistinctProductsForDisplay/);
 assert.match(source,/orderExactMerchantOffers/);
 assert.doesNotMatch(source,/safetyQualified\.map[\s\S]*safetyPending\.map/);
});

test('ProductCard shows one Best Choice badge and exact insufficient-evidence wording with image placeholder',()=>{
 const source=readFileSync('src/components/ProductCard.tsx','utf8');
 assert.match(source,/Best Choice/);
 assert.match(source,/motion-reduce:animate-none/);
 assert.match(source,/Safety Score could not be determined/);
 assert.match(source,/Product image unavailable/);
});

test('resilience products remain compatible with unified category product metadata',()=>{
 const source=readFileSync('src/lib/searchResilience.ts','utf8');
 assert.match(source,/CATEGORY_PRODUCT/);
 assert.match(source,/canonical_product_id/);
});
