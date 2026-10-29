import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePack,
  chooseStandardPack,
  isExactAnchorQuery,
} from '../supabase/functions/sp-m1b-search-v1/query-policy.mjs';
import {
  composeSpecificResults,
  composeCategoryResults,
} from '../supabase/functions/sp-m1b-search-v1/result-composition.mjs';
import {
  computeBestChoice,
  orderExactOffers,
} from '../supabase/functions/sp-m1b-search-v1/ranking-policy.mjs';
import {
  canUsePaidCommerceDiscovery,
} from '../supabase/functions/sp-us2-commerce-v1/offer-policy.mjs';

test('Indian gm aliases are pack-only detail for exact-product intent', () => {
  const anchor = {
    brand_name: 'Brand X',
    product_name: 'Baby Soap',
    variant_name: null,
    pack_size_text: '75 g',
  };

  assert.equal(parsePack('Brand X Baby Soap 75 gm').key, '75:g');
  assert.equal(isExactAnchorQuery('Brand X Baby Soap 75 gm', anchor), true);
  assert.equal(isExactAnchorQuery('Brand X Baby Soap 75 gms', anchor), true);
  assert.equal(isExactAnchorQuery('Brand X Baby Soap 75 grammes', anchor), true);
  assert.equal(isExactAnchorQuery('Brand X Baby Lotion 75 gm', anchor), false);
});

test('paid commerce discovery is impossible until exact normalized pack is resolved and explicitly authorized', () => {
  assert.equal(canUsePaidCommerceDiscovery(null, true), false);
  assert.equal(canUsePaidCommerceDiscovery('', true), false);
  assert.equal(canUsePaidCommerceDiscovery('200:ml', false), false);
  assert.equal(canUsePaidCommerceDiscovery('200:ml', undefined), false);
  assert.equal(canUsePaidCommerceDiscovery('200:ml', true), true);
});

test('specific-product production contract returns five exact offers then five distinct same-pack alternatives', () => {
  const anchor = {
    canonical_product_id: 'anchor',
    canonical_product_fingerprint: 'anchor-fp',
    brand_name: 'Brand X',
    product_name: 'Baby Lotion',
    pack_size_text: '200 ml',
    pack_normalized_key: '200:ml',
    display_basis: 'SAFETY_QUALIFIED',
    safety_determined: true,
    safety_score: 88,
    profile_score: 88,
    price: 250,
  };

  const offers = [
    { id: 'm4', productId: 'anchor', merchantName: 'Merchant D', sourceUrl: 'https://d.example/p', price: 240, packNormalizedKey: '200:ml', exactPackMatch: true },
    { id: 'wrong-pack', productId: 'anchor', merchantName: 'Merchant Z', sourceUrl: 'https://z.example/p', price: 100, packNormalizedKey: '400:ml', exactPackMatch: true },
    { id: 'm2', productId: 'anchor', merchantName: 'Merchant B', sourceUrl: 'https://b.example/p', price: 220, packNormalizedKey: '200:ml', exactPackMatch: true },
    { id: 'm1', productId: 'anchor', merchantName: 'Merchant A', sourceUrl: 'https://a.example/p', price: 210, packNormalizedKey: '200:ml', exactPackMatch: true },
    { id: 'm3', productId: 'anchor', merchantName: 'Merchant C', sourceUrl: 'https://c.example/p', price: 230, packNormalizedKey: '200:ml', exactPackMatch: true },
    { id: 'm5', productId: 'anchor', merchantName: 'Merchant E', sourceUrl: 'https://e.example/p', price: 250, packNormalizedKey: '200:ml', exactPackMatch: true },
    { id: 'duplicate-merchant', productId: 'anchor', merchantName: 'Merchant A', sourceUrl: 'https://a.example/p2', price: 205, packNormalizedKey: '200:ml', exactPackMatch: true },
  ];

  const alternatives = [
    { canonical_product_id: 'a1', canonical_product_fingerprint: 'a1-fp', brand_name: 'Brand Y', product_name: 'Baby Lotion Y', pack_normalized_key: '200:ml', display_basis: 'SAFETY_QUALIFIED', safety_determined: true, safety_score: 93, profile_score: 93, price: 260 },
    { canonical_product_id: 'a2', canonical_product_fingerprint: 'a2-fp', brand_name: 'Brand Z', product_name: 'Baby Lotion Z', pack_normalized_key: '200:ml', display_basis: 'SAFETY_QUALIFIED', safety_determined: true, safety_score: 84, profile_score: 84, price: 190 },
    { canonical_product_id: 'a3', canonical_product_fingerprint: 'a3-fp', brand_name: 'Brand A', product_name: 'Baby Lotion A', pack_normalized_key: '200:ml', display_basis: 'PRICE_ONLY_FALLBACK', safety_determined: false, safety_score: null, profile_score: null, price: 175 },
    { canonical_product_id: 'a4', canonical_product_fingerprint: 'a4-fp', brand_name: 'Brand B', product_name: 'Baby Lotion B', pack_normalized_key: '200:ml', display_basis: 'SAFETY_QUALIFIED', safety_determined: true, safety_score: 90, profile_score: 90, price: 225 },
    { canonical_product_id: 'a5', canonical_product_fingerprint: 'a5-fp', brand_name: 'Brand C', product_name: 'Baby Lotion C', pack_normalized_key: '200:ml', display_basis: 'SAFETY_QUALIFIED', safety_determined: true, safety_score: 89, profile_score: 89, price: 215 },
    { canonical_product_id: 'wrong-pack-alt', canonical_product_fingerprint: 'wrong-fp', brand_name: 'Brand D', product_name: 'Baby Lotion D', pack_normalized_key: '400:ml', display_basis: 'SAFETY_QUALIFIED', safety_determined: true, safety_score: 99, profile_score: 99, price: 150 },
    { canonical_product_id: 'duplicate-brand-alt', canonical_product_fingerprint: 'dup-fp', brand_name: 'Brand Y', product_name: 'Baby Lotion Y Plus', pack_normalized_key: '200:ml', display_basis: 'SAFETY_QUALIFIED', safety_determined: true, safety_score: 94, profile_score: 94, price: 270 },
  ];

  const out = composeSpecificResults({
    anchor,
    offers: orderExactOffers(offers),
    alternatives,
    selectedPackKey: '200:ml',
  });

  const exact = out.filter((row) => row.result_group === 'EXACT_OFFER');
  const other = out.filter((row) => row.result_group === 'ALTERNATIVE');

  assert.equal(exact.length, 5);
  assert.deepEqual(exact.map((row) => row.price), [205, 220, 230, 240, 250]);
  assert.equal(new Set(exact.map((row) => row.offer_merchant)).size, 5);
  assert.ok(exact.every((row) => row.canonical_product_id === 'anchor'));
  assert.ok(exact.every((row) => row.pack_normalized_key === '200:ml'));
  assert.ok(exact.every((row) => row.safety_score === 88));

  assert.equal(other.length, 5);
  assert.equal(new Set(other.map((row) => row.brand_name)).size, 5);
  assert.ok(other.every((row) => row.pack_normalized_key === '200:ml'));
  assert.ok(other.some((row) => row.safety_score === null));
  assert.ok(other.every((row) => row.canonical_product_id !== 'wrong-pack-alt'));
});

test('generic search freezes one deterministic standard pack and never fills with a different size', () => {
  const official = { explicit: true, value: 200, unit: 'ml', key: '200:ml' };
  const trustedOffers = [
    ...Array.from({ length: 7 }, () => ({ explicit: true, value: 100, unit: 'ml', key: '100:ml' })),
    ...Array.from({ length: 4 }, () => ({ explicit: true, value: 200, unit: 'ml', key: '200:ml' })),
  ];

  assert.equal(chooseStandardPack({ explicitUserPack: null, officialDefault: official, trustedOffers }).key, '200:ml');
  assert.equal(chooseStandardPack({ explicitUserPack: null, officialDefault: null, trustedOffers }).key, '100:ml');

  const products = [
    ...Array.from({ length: 8 }, (_, i) => ({
      canonical_product_id: `p100-${i}`,
      canonical_product_fingerprint: `fp100-${i}`,
      brand_name: `Brand ${i}`,
      product_name: `Baby Hair Oil ${i}`,
      pack_normalized_key: '100:ml',
      display_basis: 'SAFETY_QUALIFIED',
      safety_determined: true,
      safety_score: 80 + i,
      profile_score: 80 + i,
      price: 100 + i * 10,
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      canonical_product_id: `p200-${i}`,
      canonical_product_fingerprint: `fp200-${i}`,
      brand_name: `Other Brand ${i}`,
      product_name: `Baby Hair Oil Large ${i}`,
      pack_normalized_key: '200:ml',
      display_basis: 'SAFETY_QUALIFIED',
      safety_determined: true,
      safety_score: 95,
      profile_score: 95,
      price: 90,
    })),
  ];

  const out = composeCategoryResults({ products, selectedPackKey: '100:ml', limit: 10 });
  assert.equal(out.length, 8);
  assert.equal(new Set(out.map((row) => row.brand_name)).size, 8);
  assert.ok(out.every((row) => row.pack_normalized_key === '100:ml'));
  assert.ok(out.every((row) => row.result_group === 'CATEGORY_PRODUCT'));
});

test('Best Choice is canonical-product based and keeps the frozen 70/30 safety-price policy', () => {
  const products = [
    { canonical_product_id: 'x', display_basis: 'SAFETY_QUALIFIED', safety_determined: true, profile_score: 88, price: 210 },
    { canonical_product_id: 'x', display_basis: 'SAFETY_QUALIFIED', safety_determined: true, profile_score: 88, price: 250 },
    { canonical_product_id: 'y', display_basis: 'SAFETY_QUALIFIED', safety_determined: true, profile_score: 93, price: 260 },
    { canonical_product_id: 'z', display_basis: 'SAFETY_QUALIFIED', safety_determined: true, profile_score: 84, price: 190 },
    { canonical_product_id: 'u', display_basis: 'PRICE_ONLY_FALLBACK', safety_determined: false, profile_score: null, price: 100 },
  ];

  const best = computeBestChoice(products);
  assert.ok(best);
  assert.notEqual(best.canonical_product_id, 'u');
  assert.equal(best.canonical_product_id, 'z');
});
