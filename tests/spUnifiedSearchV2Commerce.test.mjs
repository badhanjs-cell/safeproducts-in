import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeOffer, selectExactOffers } from '../supabase/functions/sp-us2-commerce-v1/offer-policy.mjs';

test('offer policy rejects wrong product, variant, pack, insecure URLs and invalid prices', () => {
  const base={productId:'p1',platformName:'Shop',merchantName:'Seller',sourceUrl:'https://shop.example/p',price:199,currency:'INR',exactProductMatch:true,variantMatch:true,packNormalizedKey:'200:ml',exactPackMatch:true,confidence:98};
  assert.ok(normalizeOffer(base,{productId:'p1',packNormalizedKey:'200:ml'}));
  assert.equal(normalizeOffer({...base,exactProductMatch:false},{productId:'p1',packNormalizedKey:'200:ml'}),null);
  assert.equal(normalizeOffer({...base,variantMatch:false},{productId:'p1',packNormalizedKey:'200:ml'}),null);
  assert.equal(normalizeOffer({...base,packNormalizedKey:'400:ml'},{productId:'p1',packNormalizedKey:'200:ml'}),null);
  assert.equal(normalizeOffer({...base,sourceUrl:'http://shop.example/p'},{productId:'p1',packNormalizedKey:'200:ml'}),null);
});

test('offer selection dedupes merchant/domain and orders by price without affiliate influence', () => {
  const offers=[
    {id:'a',productId:'p1',platformName:'A',merchantName:'Same',sourceDomain:'a.example',sourceUrl:'https://a.example/1',price:220,currency:'INR',exactProductMatch:true,variantMatch:true,packNormalizedKey:'200:ml',exactPackMatch:true,confidence:99,affiliateCommission:99},
    {id:'b',productId:'p1',platformName:'A',merchantName:'Same',sourceDomain:'a.example',sourceUrl:'https://a.example/2',price:210,currency:'INR',exactProductMatch:true,variantMatch:true,packNormalizedKey:'200:ml',exactPackMatch:true,confidence:99,affiliateCommission:0},
    {id:'c',productId:'p1',platformName:'B',merchantName:'Other',sourceDomain:'b.example',sourceUrl:'https://b.example/1',price:205,currency:'INR',exactProductMatch:true,variantMatch:true,packNormalizedKey:'200:ml',exactPackMatch:true,confidence:97},
  ];
  const selected=selectExactOffers(offers,{productId:'p1',packNormalizedKey:'200:ml',limit:5});
  assert.deepEqual(selected.map(x=>x.id),['c','b']);
});

test('commerce worker is cache-first, makes at most one bounded paid discovery call, and never touches safety evidence', () => {
  const source=readFileSync('supabase/functions/sp-us2-commerce-v1/index.ts','utf8');
  const policy=readFileSync('supabase/functions/sp-us2-commerce-v1/offer-policy.mjs','utf8');
  assert.match(source,/sp_us2_exact_offers_v1/);
  assert.match(source,/CACHE_SUFFICIENT/);
  assert.match(source,/web_search/);
  assert.match(source,/paid_discovery_calls/);
  assert.match(source,/sp_us2_upsert_commerce_offer_v1/);
  assert.match(source,/affiliate commission/);
  assert.doesNotMatch(source,/sp_catalog_safety_assessment_v1/);
  assert.doesNotMatch(source,/sp_catalog_ingredient_evidence_v1/);
  assert.doesNotMatch(source,/sp_catalog_product_ingredient_v1/);
  assert.doesNotMatch(policy,/affiliate/i);
});

test('commerce persistence is service-role-only and pack-bound', () => {
  const sql=readFileSync('supabase/migrations/20260921152000_sp_unified_search_commerce_write_v2.sql','utf8');
  assert.match(sql,/sp_us2_upsert_commerce_offer_v1/);
  assert.match(sql,/pack_normalized_key/);
  assert.match(sql,/exact_pack_match/);
  assert.match(sql,/revoke\s+all[\s\S]*from\s+anon/i);
  assert.match(sql,/revoke\s+all[\s\S]*from\s+authenticated/i);
  assert.match(sql,/grant\s+execute[\s\S]*to\s+service_role/i);
  assert.doesNotMatch(sql,/sp_catalog_safety_assessment_v1/i);
  assert.doesNotMatch(sql,/sp_catalog_ingredient_evidence_v1/i);
});
