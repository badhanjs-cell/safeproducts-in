import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { composeSpecificResults, composeCategoryResults } from '../supabase/functions/sp-m1b-search-v1/result-composition.mjs';

const anchor={canonical_product_id:'p0',canonical_product_fingerprint:'fp0',brand_name:'Brand A',product_name:'Baby Lotion',pack_normalized_key:'200:ml',safety_score:91,profile_score:91,display_basis:'SAFETY_QUALIFIED'};

test('specific search composes at most five exact offers then five different-brand alternatives',()=>{
 const offers=Array.from({length:7},(_,i)=>({id:`o${i}`,productId:'p0',merchantName:`M${i}`,sourceUrl:`https://m${i}.example/p`,price:200+i,packNormalizedKey:'200:ml',exactPackMatch:true}));
 const alternatives=[
  {canonical_product_id:'p1',canonical_product_fingerprint:'fp1',brand_name:'Brand B',product_name:'Alt 1',pack_normalized_key:'200:ml',price:210},
  {canonical_product_id:'p2',canonical_product_fingerprint:'fp2',brand_name:'Brand B',product_name:'Alt 2',pack_normalized_key:'200:ml',price:220},
  {canonical_product_id:'p3',canonical_product_fingerprint:'fp3',brand_name:'Brand C',product_name:'Alt 3',pack_normalized_key:'200:ml',price:230},
  {canonical_product_id:'p4',canonical_product_fingerprint:'fp4',brand_name:'Brand D',product_name:'Wrong pack',pack_normalized_key:'400:ml',price:150},
  {canonical_product_id:'p5',canonical_product_fingerprint:'fp5',brand_name:'Brand E',product_name:'Alt 5',pack_normalized_key:'200:ml',price:240},
  {canonical_product_id:'p6',canonical_product_fingerprint:'fp6',brand_name:'Brand F',product_name:'Alt 6',pack_normalized_key:'200:ml',price:250},
  {canonical_product_id:'p7',canonical_product_fingerprint:'fp7',brand_name:'Brand G',product_name:'Alt 7',pack_normalized_key:'200:ml',price:260},
 ];
 const out=composeSpecificResults({anchor,offers,alternatives,selectedPackKey:'200:ml'});
 assert.equal(out.length,10);
 assert.equal(out.filter(x=>x.result_group==='EXACT_OFFER').length,5);
 assert.equal(out.filter(x=>x.result_group==='ALTERNATIVE').length,5);
 assert.ok(out.filter(x=>x.result_group==='EXACT_OFFER').every(x=>x.canonical_product_id==='p0'&&x.safety_score===91));
 const alt=out.filter(x=>x.result_group==='ALTERNATIVE');
 assert.equal(new Set(alt.map(x=>x.brand_name.toLowerCase())).size,alt.length);
 assert.ok(alt.every(x=>x.pack_normalized_key==='200:ml'));
});

test('specific search never fabricates missing slots',()=>{
 const out=composeSpecificResults({anchor,offers:[],alternatives:[],selectedPackKey:'200:ml'});
 assert.deepEqual(out,[]);
});

test('category search returns at most ten distinct canonical products and prefers distinct brands',()=>{
 const products=Array.from({length:12},(_,i)=>({canonical_product_id:`p${i}`,canonical_product_fingerprint:`fp${i}`,brand_name:i<2?'Same Brand':`Brand ${i}`,product_name:`Hair Oil ${i}`,pack_normalized_key:'100:ml',price:100+i}));
 const out=composeCategoryResults({products,selectedPackKey:'100:ml',limit:10});
 assert.ok(out.length<=10);
 assert.equal(new Set(out.map(x=>x.canonical_product_id)).size,out.length);
 assert.equal(out.filter(x=>x.brand_name==='Same Brand').length,1);
 assert.ok(out.every(x=>x.result_group==='CATEGORY_PRODUCT'));
});

test('search edge exposes the SP-US2 contract and delegates result groups and category classification',()=>{
 const source=readFileSync('supabase/functions/sp-m1b-search-v1/index.ts','utf8');
 const composition=readFileSync('supabase/functions/sp-m1b-search-v1/result-composition.mjs','utf8');
 const queryPolicy=readFileSync('supabase/functions/sp-m1b-search-v1/query-policy.mjs','utf8');
 assert.match(source,/SP-US2\/1\.0/);
 assert.match(source,/SPECIFIC_PRODUCT/);
 assert.match(queryPolicy,/CATEGORY/);
 assert.match(source,/sp-us2-commerce-v1/);
 assert.match(source,/composeSpecificResults/);
 assert.match(source,/composeCategoryResults/);
 assert.match(composition,/CATEGORY_PRODUCT/);
 assert.match(composition,/result_group/);
 assert.match(source,/selected_pack/);
 assert.match(source,/canonical_product_id/);
 assert.match(source,/merchant_offer_id/);
});

test('no-size pack resolution uses only explicit official-default metadata or trusted merchant mode',()=>{
 const source=readFileSync('supabase/functions/sp-m1b-search-v1/index.ts','utf8');
 assert.match(source,/pack_is_official_default/);
 assert.match(source,/pack_source_kind/);
 assert.match(source,/sp_us2_exact_offers_v1/);
 assert.match(source,/trustedOfferPacks/);
 assert.match(source,/TRUSTED_MERCHANT_MODE/);
 assert.match(source,/OFFICIAL_DEFAULT/);
 assert.match(source,/source:\s*selectedPackSource/);
 assert.doesNotMatch(source,/USER_EXPLICIT/);
 assert.doesNotMatch(source,/UNRESOLVED/);
});
