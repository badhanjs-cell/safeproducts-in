import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const POLICY_PATH = 'supabase/functions/sp-us2-google-cluster-v1/google-cluster-policy.mjs';
const POLICY_IMPORT = '../supabase/functions/sp-us2-google-cluster-v1/google-cluster-policy.mjs';

const context = {
  query: 'NIVEA MEN Deep Comfort After Shave Lotion 100 ml',
  requestedPackKey: '100:ml',
  targetExactOffers: 5,
  anchor: {
    canonical_product_id: '0b479259-06ab-4c7c-ab09-98011f1d544e',
    brand_name: 'NIVEA MEN',
    product_name: 'Deep Comfort After Shave Lotion',
    variant_name: 'Deep Comfort',
    pack_normalized_key: '100:ml',
  },
};

function shoppingResult(overrides = {}) {
  return {
    position: 1,
    title: 'NIVEA MEN Deep Comfort After Shave Lotion 100 ml',
    product_id: 'google-product-100',
    immersive_product_page_token: 'immersive-token-100',
    source: 'Example Store',
    price: '₹499',
    extracted_price: 499,
    product_link: 'https://www.google.com/shopping/product/google-product-100?gl=in',
    ...overrides,
  };
}

function store(overrides = {}) {
  return {
    name: 'Merchant One',
    link: 'https://merchant-one.example/nivea-deep-comfort',
    title: 'NIVEA MEN Deep Comfort After Shave Lotion',
    price: '₹499',
    extracted_price: 499,
    ...overrides,
  };
}

async function policy() {
  assert.equal(existsSync(POLICY_PATH), true, 'Google cluster policy module must exist');
  return import(POLICY_IMPORT);
}

test('selects the exact Google product cluster for canonical brand, variant and 100 ml pack', async () => {
  const { selectGoogleProductCluster } = await policy();
  const selected = selectGoogleProductCluster({ shopping_results: [
    shoppingResult({ position: 2, title: 'NIVEA MEN Sensitive Cooling After Shave Lotion 100 ml', product_id: 'wrong-variant', immersive_product_page_token: 'wrong-variant-token' }),
    shoppingResult(),
    shoppingResult({ position: 3, title: 'NIVEA MEN Deep Comfort After Shave Lotion 200 ml', product_id: 'wrong-pack', immersive_product_page_token: 'wrong-pack-token' }),
  ] }, context);

  assert.ok(selected);
  assert.equal(selected.productId, 'google-product-100');
  assert.equal(selected.pageToken, 'immersive-token-100');
  assert.equal(selected.packNormalizedKey, '100:ml');
});

test('rejects explicit wrong variant and wrong pack clusters', async () => {
  const { selectGoogleProductCluster } = await policy();
  const wrongVariant = selectGoogleProductCluster({ shopping_results: [
    shoppingResult({ title: 'NIVEA MEN Sensitive Cooling After Shave Lotion 100 ml', product_id: 'wrong-v', immersive_product_page_token: 'wrong-v-token' }),
  ] }, context);
  const wrongPack = selectGoogleProductCluster({ shopping_results: [
    shoppingResult({ title: 'NIVEA MEN Deep Comfort After Shave Lotion 200 ml', product_id: 'wrong-p', immersive_product_page_token: 'wrong-p-token' }),
  ] }, context);

  assert.equal(wrongVariant, null);
  assert.equal(wrongPack, null);
});

test('rejects ambiguous equal-strength exact clusters instead of choosing arbitrarily', async () => {
  const { selectGoogleProductCluster } = await policy();
  const selected = selectGoogleProductCluster({ shopping_results: [
    shoppingResult({ product_id: 'cluster-a', immersive_product_page_token: 'token-a' }),
    shoppingResult({ product_id: 'cluster-b', immersive_product_page_token: 'token-b', position: 2 }),
  ] }, context);
  assert.equal(selected, null);
});

test('requires the immersive cluster token even when product wording matches', async () => {
  const { selectGoogleProductCluster } = await policy();
  const selected = selectGoogleProductCluster({ shopping_results: [
    shoppingResult({ immersive_product_page_token: undefined }),
  ] }, context);
  assert.equal(selected, null);
});

test('accepts merchant title with omitted pack after cluster lock and rejects explicit contradictory pack', async () => {
  const { normalizeClusterStores } = await policy();
  const payload = { product_results: { stores: [
    store({ name: 'No Pack Merchant', title: 'NIVEA MEN Deep Comfort After Shave Lotion', extracted_price: 450 }),
    store({ name: 'Wrong Pack Merchant', title: 'NIVEA MEN Deep Comfort After Shave Lotion 200 ml', link: 'https://wrong-pack.example/product', extracted_price: 350 }),
  ] } };

  const stores = normalizeClusterStores(payload, { ...context, shortfall: 5, lockedCluster: shoppingResult() });
  assert.equal(stores.length, 1);
  assert.equal(stores[0].merchant_name, 'No Pack Merchant');
  assert.equal(stores[0].pack_normalized_key, '100:ml');
  assert.equal(stores[0].exact_pack_match, true);
  assert.deepEqual(stores[0].observed_source_urls, [stores[0].source_url]);
});

test('filters unsafe URLs, non-positive prices and non-INR prices from clustered stores', async () => {
  const { normalizeClusterStores } = await policy();
  const stores = normalizeClusterStores({ product_results: { stores: [
    store({ name: 'HTTP', link: 'http://merchant.example/item' }),
    store({ name: 'Credentialed', link: 'https://user:pass@merchant.example/item' }),
    store({ name: 'Zero', link: 'https://zero.example/item', extracted_price: 0 }),
    store({ name: 'USD', link: 'https://usd.example/item', price: '$12', extracted_price: 12 }),
    store({ name: 'Good', link: 'https://good.example/item', price: '₹399', extracted_price: 399 }),
  ] } }, { ...context, shortfall: 5, lockedCluster: shoppingResult() });

  assert.deepEqual(stores.map((row) => row.merchant_name), ['Good']);
});

test('dedupes merchants/pages, prefers the lowest valid price and caps output to the exact shortfall and five', async () => {
  const { normalizeClusterStores } = await policy();
  const rows = [
    store({ name: 'Merchant A', link: 'https://a.example/item?utm=1', extracted_price: 550 }),
    store({ name: 'Merchant A', link: 'https://a.example/item#offer', extracted_price: 500 }),
    ...['B','C','D','E','F','G'].map((letter, index) => store({ name: `Merchant ${letter}`, link: `https://${letter.toLowerCase()}.example/item`, extracted_price: 510 + index })),
  ];

  const two = normalizeClusterStores({ product_results: { stores: rows } }, { ...context, shortfall: 2, lockedCluster: shoppingResult() });
  assert.equal(two.length, 2);
  assert.equal(two[0].merchant_name, 'Merchant A');
  assert.equal(two[0].price, 500);

  const many = normalizeClusterStores({ product_results: { stores: rows } }, { ...context, shortfall: 99, lockedCluster: shoppingResult() });
  assert.equal(many.length, 5);
  assert.equal(new Set(many.map((row) => row.merchant_name.toLowerCase())).size, 5);
});

test('normalizes metric and count pack aliases and canonical HTTPS page identity', async () => {
  const { parseClusterPackKey, canonicalHttpsPage } = await policy();
  assert.equal(parseClusterPackKey('0.1 L'), '100:ml');
  assert.equal(parseClusterPackKey('100 gm'), '100:g');
  assert.equal(parseClusterPackKey('60 capsules'), '60:count');
  assert.equal(canonicalHttpsPage('https://Example.COM/a//b/?utm=x#section'), 'https://example.com/a/b');
  assert.equal(canonicalHttpsPage('http://example.com/a'), null);
});

test('cluster shortfall is zero at five and clamped to the five-offer contract', async () => {
  const { clusterAcquisitionNeed } = await policy();
  assert.deepEqual(clusterAcquisitionNeed(5), { needed: false, shortfall: 0, target: 5 });
  assert.deepEqual(clusterAcquisitionNeed(1), { needed: true, shortfall: 4, target: 5 });
  assert.deepEqual(clusterAcquisitionNeed(-10, 99), { needed: true, shortfall: 5, target: 5 });
});

test('malformed provider payloads fail closed with no normalized stores', async () => {
  const { selectGoogleProductCluster, normalizeClusterStores } = await policy();
  assert.equal(selectGoogleProductCluster(null, context), null);
  assert.equal(selectGoogleProductCluster({ shopping_results: 'bad' }, context), null);
  assert.deepEqual(normalizeClusterStores(null, { ...context, shortfall: 5, lockedCluster: shoppingResult() }), []);
  assert.deepEqual(normalizeClusterStores({ product_results: { stores: 'bad' } }, { ...context, shortfall: 5, lockedCluster: shoppingResult() }), []);
});
