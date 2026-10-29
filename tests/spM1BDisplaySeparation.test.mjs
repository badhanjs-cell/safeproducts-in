import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { orderProductsForDisplay } from '../src/lib/productDisplayOrder.ts';

const source = readFileSync('src/components/SearchResults.tsx','utf8');

test('unified v2 search renders scored and unscored products in one comparable result model', () => {
  assert.match(source, /orderDistinctProductsForDisplay/);
  assert.match(source, /Safety Score is inferred or estimated/);
  assert.doesNotMatch(source, /const safetyQualified = results\.filter/);
  assert.doesNotMatch(source, /const safetyPending = results\.filter/);
  assert.doesNotMatch(source, /Other products.*safety analysis pending/i);
});

function product(id, basis, score, price) {
  return {
    id, name:id, brand:null, category:'', evaluated_profile:'all', platform:'Merchant', price, currency:'INR',
    image_url:null, ingredients:null, safety_score:score, profile_score:score,
    profile_safety:{all:score,children:null,pregnant:null,seniors:null}, warnings:[], recommendation:null,
    confidence:null, source_url:'https://example.com/'+id, affiliate_link:null, production_qualified:basis==='SAFETY_QUALIFIED',
    badges:{safest:false,lowestPrice:false,bestValue:false}, display_eligible:true, display_basis:basis,
    safety_determined:basis==='SAFETY_QUALIFIED', safety_status_label:null, safety_unavailable_reason:null, price_text:null,
  };
}

test('display ordering never treats a price-only result as the safest result', () => {
  const pending=product('pending','PRICE_ONLY_FALLBACK',null,10);
  const qualified=product('qualified','SAFETY_QUALIFIED',91,100);
  const ordered=orderProductsForDisplay([pending,qualified]);
  assert.equal(ordered[0].id,'qualified');
  assert.equal(ordered[0].display_basis,'SAFETY_QUALIFIED');
});
