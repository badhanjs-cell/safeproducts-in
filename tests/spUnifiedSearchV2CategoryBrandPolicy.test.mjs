import test from 'node:test';
import assert from 'node:assert/strict';
import { composeCategoryResults, composeSpecificResults } from '../supabase/functions/sp-m1b-search-v1/result-composition.mjs';

test('category search never fills missing slots with another product from an already represented brand', () => {
  const products = [
    { canonical_product_id: 'a1', brand_name: 'Brand A', pack_normalized_key: '100:ml' },
    { canonical_product_id: 'a2', brand_name: 'Brand A', pack_normalized_key: '100:ml' },
    { canonical_product_id: 'a3', brand_name: 'Brand A', pack_normalized_key: '100:ml' },
    { canonical_product_id: 'b1', brand_name: 'Brand B', pack_normalized_key: '100:ml' },
    { canonical_product_id: 'b2', brand_name: 'Brand B', pack_normalized_key: '100:ml' },
  ];

  const out = composeCategoryResults({ products, selectedPackKey: '100:ml', limit: 10 });

  assert.equal(out.length, 2);
  assert.deepEqual(out.map((row) => row.canonical_product_id), ['a1', 'b1']);
  assert.equal(new Set(out.map((row) => row.brand_name.toLowerCase())).size, out.length);
});

test('category search does not use multiple unknown-brand products to inflate diversity', () => {
  const products = [
    { canonical_product_id: 'u1', brand_name: null, pack_normalized_key: '100:ml' },
    { canonical_product_id: 'u2', brand_name: '', pack_normalized_key: '100:ml' },
    { canonical_product_id: 'a1', brand_name: 'Brand A', pack_normalized_key: '100:ml' },
  ];

  const out = composeCategoryResults({ products, selectedPackKey: '100:ml', limit: 10 });
  assert.deepEqual(out.map((row) => row.canonical_product_id), ['u1', 'a1']);
});

test('specific-product alternatives do not use multiple unknown-brand products as different brands', () => {
  const anchor = { canonical_product_id: 'anchor', product_fingerprint: 'anchor-fp', pack_normalized_key: '100:ml' };
  const alternatives = [
    { canonical_product_id: 'u1', brand_name: null, pack_normalized_key: '100:ml' },
    { canonical_product_id: 'u2', brand_name: '', pack_normalized_key: '100:ml' },
    { canonical_product_id: 'b1', brand_name: 'Brand B', pack_normalized_key: '100:ml' },
  ];

  const out = composeSpecificResults({ anchor, offers: [], alternatives, selectedPackKey: '100:ml' });
  assert.deepEqual(out.map((row) => row.canonical_product_id), ['u1', 'b1']);
});
