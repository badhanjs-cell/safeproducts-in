import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('ranking module exports unified ordering and 70/30 best choice policy',async()=>{
 const source=readFileSync('src/lib/productDisplayOrder.ts','utf8');
 assert.match(source,/orderDistinctProductsForDisplay/);
 assert.match(source,/orderExactMerchantOffers/);
 assert.match(source,/computeBestChoice/);
 assert.match(source,/0\.7/);
 assert.match(source,/0\.3/);
 assert.doesNotMatch(source,/affiliate/i);
 assert.doesNotMatch(source,/image_url/i);
});

test('category ordering is safest, then lowest-priced distinct remaining, then ascending price',async()=>{
 const {orderDistinctProductsForDisplay}=await import('../src/lib/productDisplayOrder.ts');
 const base=(id,score,price)=>({id,canonical_product_id:id,display_basis:score==null?'PRICE_ONLY_FALLBACK':'SAFETY_QUALIFIED',safety_determined:score!=null,profile_score:score,safety_score:score,price});
 const out=orderDistinctProductsForDisplay([base('a',80,100),base('b',95,300),base('c',70,90),base('d',null,70)]);
 assert.deepEqual(out.map(x=>x.id),['b','d','c','a']);
});

test('best choice uses 70 percent safety and 30 percent normalized price across distinct scored priced products',async()=>{
 const {computeBestChoice}=await import('../src/lib/productDisplayOrder.ts');
 const products=[
  {id:'a',canonical_product_id:'a',display_basis:'SAFETY_QUALIFIED',safety_determined:true,profile_score:100,safety_score:100,price:300},
  {id:'b',canonical_product_id:'b',display_basis:'SAFETY_QUALIFIED',safety_determined:true,profile_score:90,safety_score:90,price:100},
  {id:'c',canonical_product_id:'c',display_basis:'SAFETY_QUALIFIED',safety_determined:true,profile_score:85,safety_score:85,price:200},
 ];
 const best=computeBestChoice(products);
 assert.equal(best?.id,'b');
});

test('best choice equal-price tie prioritizes safety then stable canonical id and never selects unscored products',async()=>{
 const {computeBestChoice}=await import('../src/lib/productDisplayOrder.ts');
 const products=[
  {id:'z',canonical_product_id:'z',display_basis:'SAFETY_QUALIFIED',safety_determined:true,profile_score:90,safety_score:90,price:100},
  {id:'a',canonical_product_id:'a',display_basis:'SAFETY_QUALIFIED',safety_determined:true,profile_score:90,safety_score:90,price:100},
  {id:'u',canonical_product_id:'u',display_basis:'PRICE_ONLY_FALLBACK',safety_determined:false,profile_score:null,safety_score:null,price:1},
 ];
 assert.equal(computeBestChoice(products)?.id,'a');
});

test('exact merchant offers order only by valid price and stable order',async()=>{
 const {orderExactMerchantOffers}=await import('../src/lib/productDisplayOrder.ts');
 const rows=[{id:'a',price:200},{id:'b',price:null},{id:'c',price:150},{id:'d',price:150}];
 assert.deepEqual(orderExactMerchantOffers(rows).map(x=>x.id),['c','d','a','b']);
});

test('backend ranking policy mirrors the same ordering and 70/30 formula for non-UI consumers',async()=>{
 const backend=await import('../supabase/functions/sp-m1b-search-v1/ranking-policy.mjs');
 const products=[
  {product_fingerprint:'a',canonical_product_id:'a',display_basis:'SAFETY_QUALIFIED',safety_determined:true,profile_score:100,price:300},
  {product_fingerprint:'b',canonical_product_id:'b',display_basis:'SAFETY_QUALIFIED',safety_determined:true,profile_score:90,price:100},
  {product_fingerprint:'u',canonical_product_id:'u',display_basis:'PRICE_ONLY_FALLBACK',safety_determined:false,profile_score:null,price:50},
 ];
 assert.equal(backend.computeBestChoice(products)?.canonical_product_id,'b');
 assert.deepEqual(backend.orderDistinctProducts(products).map(x=>x.canonical_product_id),['a','u','b']);
 assert.deepEqual(backend.orderExactOffers([{id:'a',price:200},{id:'b',price:100}]).map(x=>x.id),['b','a']);
});
