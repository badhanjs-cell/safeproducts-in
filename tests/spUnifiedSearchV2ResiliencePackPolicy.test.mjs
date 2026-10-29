import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePack as parseSearchPack } from '../supabase/functions/sp-m1b-search-v1/query-policy.mjs';
import { parsePackKeyFromText, prepareResilienceProducts } from '../src/lib/searchResiliencePolicy.mjs';

test('resilience hides prices when no comparable pack can be established and keeps one product per brand', () => {
  const result = prepareResilienceProducts([
    { id: 'a1', canonical_product_id: 'a1', brand: 'Brand A', pack_normalized_key: null, price: 100, price_text: '100' },
    { id: 'a2', canonical_product_id: 'a2', brand: 'Brand A', pack_normalized_key: null, price: 90, price_text: '90' },
    { id: 'b1', canonical_product_id: 'b1', brand: 'Brand B', pack_normalized_key: null, price: 120, price_text: '120' },
  ], 10);

  assert.equal(result.selectedPackKey, null);
  assert.equal(result.priceComparisonAvailable, false);
  assert.deepEqual(result.products.map((p) => p.id), ['a1', 'b1']);
  assert.ok(result.products.every((p) => p.price === null && p.price_text === null));
});

test('resilience chooses the modal normalized pack and excludes different or unknown packs from price comparison', () => {
  const result = prepareResilienceProducts([
    { id: 'a1', canonical_product_id: 'a1', brand: 'Brand A', pack_normalized_key: '100:ml', price: 100, price_text: '100' },
    { id: 'a2', canonical_product_id: 'a2', brand: 'Brand A', pack_normalized_key: '100:ml', price: 95, price_text: '95' },
    { id: 'b1', canonical_product_id: 'b1', brand: 'Brand B', pack_normalized_key: '100:ml', price: 120, price_text: '120' },
    { id: 'c1', canonical_product_id: 'c1', brand: 'Brand C', pack_normalized_key: '200:ml', price: 130, price_text: '130' },
    { id: 'd1', canonical_product_id: 'd1', brand: 'Brand D', pack_normalized_key: null, price: 80, price_text: '80' },
  ], 10);

  assert.equal(result.selectedPackKey, '100:ml');
  assert.equal(result.priceComparisonAvailable, true);
  assert.deepEqual(result.products.map((p) => p.id), ['a1', 'b1']);
  assert.ok(result.products.every((p) => p.pack_normalized_key === '100:ml'));
});

test('resilience pack parsing stays aligned with the canonical search pack parser', () => {
  const samples = ['Baby Lotion 200 ml', 'Oil 1 L', 'Powder 0.4 kg', '60 capsules', '5 in 1 lotion'];
  for (const sample of samples) {
    assert.equal(parsePackKeyFromText(sample), parseSearchPack(sample).key);
  }
});

test('Indian gm pack abbreviation normalizes to grams', () => {
  assert.equal(parsePackKeyFromText('Baby Soap 75 gm'), '75:g');
  assert.equal(parseSearchPack('Baby Soap 75 gm').key, '75:g');
});

test('explicit user pack wins in resilience mode and pack identity may be derived from product titles', () => {
  const result = prepareResilienceProducts([
    { id: 'a', canonical_product_id: 'a', brand: 'Brand A', name: 'Lotion 100 ml', pack_normalized_key: null, price: 100, price_text: '100' },
    { id: 'b', canonical_product_id: 'b', brand: 'Brand B', name: 'Lotion 200 ml', pack_normalized_key: null, price: 180, price_text: '180' },
    { id: 'c', canonical_product_id: 'c', brand: 'Brand C', name: 'Lotion 200 ml', pack_normalized_key: null, price: 170, price_text: '170' },
  ], 10, '200:ml');

  assert.equal(result.selectedPackKey, '200:ml');
  assert.equal(result.priceComparisonAvailable, true);
  assert.deepEqual(result.products.map((p) => p.id), ['b', 'c']);
  assert.ok(result.products.every((p) => p.pack_normalized_key === '200:ml'));
});

test('resilience rejects category-mismatched products before pack selection', () => {
  const result = prepareResilienceProducts([
    { id: 'soap-a', canonical_product_id: 'soap-a', brand: 'Soap Brand', name: 'Gentle Baby Soap 75 g', category: 'baby care', price: 80, price_text: '80' },
    { id: 'lotion-a', canonical_product_id: 'lotion-a', brand: 'Lotion Brand', name: 'Baby Milk Lotion 200 ml', category: 'baby product', price: 65, price_text: '65' },
    { id: 'oil-a', canonical_product_id: 'oil-a', brand: 'Oil Brand', name: 'Baby Hair Oil 200 ml', category: 'baby product', price: 70, price_text: '70' },
  ], 10, null, 'baby soap');

  assert.deepEqual(result.products.map((p) => p.id), ['soap-a']);
  assert.equal(result.selectedPackKey, '75:g');
});

test('resilience collapses the same cross-source product and prefers safety-qualified evidence', () => {
  const title = 'Chicco Baby Moments Soap 75g Buy 3 Get 1 Free';
  const result = prepareResilienceProducts([
    { id: 'recent-1', canonical_product_id: 'recent-1', brand: null, name: title, category: 'baby soap', display_basis: 'PRICE_ONLY_FALLBACK', safety_determined: false, price: 179, price_text: '179' },
    { id: 'cache-1', canonical_product_id: 'cache-1', brand: 'Chicco', name: title, category: 'baby soap', display_basis: 'SAFETY_QUALIFIED', safety_determined: true, safety_score: 91, profile_score: 91, price: 179, price_text: '179' },
  ], 10, null, 'baby soap');

  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].id, 'cache-1');
  assert.equal(result.products[0].display_basis, 'SAFETY_QUALIFIED');
  assert.equal(result.products[0].safety_score, 91);
});
