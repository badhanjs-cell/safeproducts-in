import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareDiscoveryProducts } from '../supabase/functions/sp-us2-discovery-v1/discovery-policy.mjs';
import { mergeSearchResponses } from '../supabase/functions/sp-us2-search-v2/orchestration-policy.mjs';

function row(id, pack) {
  return { id, canonical_product_id: id, product_name: 'Baby Lotion', name: 'Baby Lotion',
    brand_name: id, source_url: `https://shop.example.in/products/${id}`, price: 200,
    currency: 'INR', pack_normalized_key: pack, acquisition_correlated: true,
    result_group: 'CATEGORY_PRODUCT', display_basis: 'PRICE_ONLY_FALLBACK', safety_determined: false };
}

const options = { queryText: 'baby lotion 250 ml', requestedPackKey: '250:ml',
  acquisitionResolvedPackKey: '100:ml', acquisitionPackResolution: 'MARKET_STANDARD_FALLBACK' };

test('correlated acquisition fallback survives discovery preparation as one uniform pack', () => {
  const actual = prepareDiscoveryProducts([row('A', '100:ml'), row('B', '200:ml')], options);
  assert.equal(actual.selectedPackKey, '100:ml');
  assert.equal(actual.fallbackApplied, true);
  assert.deepEqual(actual.products.map(p => p.id), ['A']);
});

test('a genuine requested-pack row overrides an older correlated fallback', () => {
  const actual = prepareDiscoveryProducts([row('A', '100:ml'), row('B', '250:ml')], options);
  assert.equal(actual.selectedPackKey, '250:ml');
  assert.deepEqual(actual.products.map(p => p.id), ['B']);
});

test('discovery ignores cross-family and unobserved fallback metadata', () => {
  for (const pack of ['75:g', '60:count', '99:ml']) {
    const actual = prepareDiscoveryProducts([row('A', '100:ml'), row('B', '75:g')],
      { ...options, acquisitionResolvedPackKey: pack });
    assert.equal(actual.selectedPackKey, '250:ml');
    assert.equal(actual.products.length, 0);
  }
});

test('current requested-pack supply overrides a core fallback during composition', () => {
  const core = { selected_pack: { normalized_key: '100:ml', source: 'MARKET_STANDARD_FALLBACK',
    requested_normalized_key: '250:ml', fallback_applied: true }, products: [row('A', '100:ml')] };
  const actual = mergeSearchResponses(core, { products: [row('B', '250:ml')] }, { query: 'baby lotion 250 ml' });
  assert.equal(actual.selected_pack.normalized_key, '250:ml');
  assert.deepEqual(actual.products.map(p => p.canonical_product_id), ['B']);
  assert.doesNotMatch(actual.consumer_notice, /not available/i);
});
