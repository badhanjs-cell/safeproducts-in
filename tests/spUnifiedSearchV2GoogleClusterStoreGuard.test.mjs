import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const POLICY_IMPORT = '../supabase/functions/sp-us2-google-cluster-v1/google-cluster-policy.mjs';
const EDGE_PATH = 'supabase/functions/sp-us2-google-cluster-v1/index.ts';

const context = {
  query: 'NIVEA MEN Deep Comfort After Shave Lotion 100 ml',
  requestedPackKey: '100:ml',
  shortfall: 5,
  anchor: {
    canonical_product_id: '0b479259-06ab-4c7c-ab09-98011f1d544e',
    brand_name: 'NIVEA MEN',
    product_name: 'Deep Comfort After Shave Lotion',
    variant_name: 'Anti-Bacterial',
    pack_normalized_key: '100:ml',
  },
  lockedCluster: {
    title: 'Nivea Men Deep Comfort After Shave Lotion Anti Bacterial 100 ml',
    pageToken: 'locked-exact-cluster',
    packNormalizedKey: '100:ml',
  },
};

function store(overrides = {}) {
  return {
    name: 'Exact Merchant',
    link: 'https://merchant.example/nivea-men-deep-comfort-after-shave-lotion-100ml',
    title: 'NIVEA MEN Deep Comfort After Shave Lotion',
    price: '₹499',
    extracted_price: 499,
    ...overrides,
  };
}

test('locked cluster still rejects an explicitly different product family at store level', async () => {
  const { normalizeClusterStores } = await import(POLICY_IMPORT);
  const result = normalizeClusterStores({ product_results: { stores: [
    store(),
    store({
      name: 'Wrong Variant Merchant',
      link: 'https://wrong.example/nivea-after-shave-lotion-black-carbon-woody-scent-100-ml',
      title: 'NIVEA After Shave Lotion Black Carbon Woody Scent 100 ml',
      extracted_price: 350,
    }),
  ] } }, context);

  assert.deepEqual(result.map((row) => row.merchant_name), ['Exact Merchant']);
});

test('store guard permits omitted variant and omitted pack when canonical product wording remains strong', async () => {
  const { normalizeClusterStores } = await import(POLICY_IMPORT);
  const result = normalizeClusterStores({ product_results: { stores: [
    store({
      name: 'Omission Merchant',
      link: 'https://omission.example/nivea-men-deep-comfort-after-shave-lotion',
      title: 'NIVEA MEN Deep Comfort After Shave Lotion',
      extracted_price: 475,
    }),
  ] } }, context);

  assert.equal(result.length, 1);
  assert.equal(result[0].merchant_name, 'Omission Merchant');
  assert.equal(result[0].pack_normalized_key, '100:ml');
});

test('store guard rejects multipacks even when the component size and canonical wording match', async () => {
  const { normalizeClusterStores } = await import(POLICY_IMPORT);
  const result = normalizeClusterStores({ product_results: { stores: [
    store({
      name: 'Pack Of Three',
      link: 'https://merchant.example/nivea-men-deep-comfort-after-shave-lotion-100ml-pack-of-3',
      title: 'NIVEA MEN Deep Comfort After Shave Lotion 100 ml Pack of 3',
      extracted_price: 1200,
    }),
    store({
      name: 'Three By One Hundred',
      link: 'https://merchant2.example/nivea-men-deep-comfort-after-shave-lotion-3x100ml',
      title: 'NIVEA MEN Deep Comfort After Shave Lotion 3 x 100 ml',
      extracted_price: 1350,
    }),
    store({
      name: 'Single Pack',
      link: 'https://merchant3.example/nivea-men-deep-comfort-after-shave-lotion-100ml',
      title: 'NIVEA MEN Deep Comfort After Shave Lotion 100 ml',
      extracted_price: 500,
    }),
  ] } }, context);

  assert.deepEqual(result.map((row) => row.merchant_name), ['Single Pack']);
});

test('valid clustered stores are staged concurrently within the foreground budget', () => {
  const src = readFileSync(EDGE_PATH, 'utf8');
  assert.match(src, /Promise\.all\s*\(/);
  assert.match(src, /acceptedStores\.map\s*\(/);
  assert.doesNotMatch(src, /for\s*\(const offer of acceptedStores\)[\s\S]{0,300}await\s+rpc/);
});
