import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const POLICY_IMPORT = '../supabase/functions/sp-us2-google-cluster-v1/google-cluster-policy.mjs';
const EDGE_PATH = 'supabase/functions/sp-us2-google-cluster-v1/index.ts';

const anchor = {
  canonical_product_id: '0b479259-06ab-4c7c-ab09-98011f1d544e',
  brand_name: 'NIVEA MEN',
  product_name: 'Deep Comfort After Shave Lotion',
  variant_name: 'Anti-Bacterial',
};

function hint(overrides = {}) {
  return {
    product_id: anchor.canonical_product_id,
    merchant_name: 'Merchant',
    source_domain: 'merchant.example',
    source_url: 'https://merchant.example/product/nivea-men-deep-impact-comfort-after-shave-lotion-100-ml',
    offer_confidence: 88,
    market_country_code: 'IN',
    ...overrides,
  };
}

test('consensus retail alias inserts only repeated extra identity tokens into the single shopping query', async () => {
  const { deriveShoppingQueryFromCommerceHints } = await import(POLICY_IMPORT);
  assert.equal(typeof deriveShoppingQueryFromCommerceHints, 'function');

  const query = deriveShoppingQueryFromCommerceHints(
    'NIVEA MEN Deep Comfort After Shave Lotion 100 ml',
    [
      hint({ merchant_name: 'Beauty Baskets', source_domain: 'beautybaskets.in', source_url: 'https://beautybaskets.in/product/nivea-deep-impact-comfort-after-shave/' }),
      hint({ merchant_name: 'Truemeds', source_domain: 'truemeds.in', source_url: 'https://www.truemeds.in/otc/nivea-men-deep-impact-comfort-after-shave-lotion-100ml-tm-loes1-002462' }),
      hint({ merchant_name: 'Netmeds', source_domain: 'netmeds.com', source_url: 'https://www.netmeds.com/product/nivea-men-shaving-deep-impact-comfort-after-shave-lotion-100-ml-lui1m8-8227084' }),
      hint({ merchant_name: 'Flipkart', source_domain: 'flipkart.com', source_url: 'https://www.flipkart.com/nivea-men-deep-comfort-maxxtech-antibacterial-after-shave-lotion/p/itm3729b6631a253' }),
    ],
    { anchor },
  );

  assert.equal(query.toLowerCase(), 'nivea men deep impact comfort after shave lotion 100 ml');
  assert.doesNotMatch(query, /maxxtech|truemeds|netmeds|beautybaskets|002462|8227084/i);
});

test('one merchant cannot inject an alias token and unsafe or cross-product hints are ignored', async () => {
  const { deriveShoppingQueryFromCommerceHints } = await import(POLICY_IMPORT);
  const original = 'NIVEA MEN Deep Comfort After Shave Lotion 100 ml';
  const query = deriveShoppingQueryFromCommerceHints(original, [
    hint({ source_domain: 'one.example', source_url: 'https://one.example/product/nivea-men-deep-hijack-comfort-after-shave-lotion' }),
    hint({ source_domain: 'bad.example', source_url: 'http://bad.example/product/nivea-men-deep-hijack-comfort-after-shave-lotion' }),
    hint({ source_domain: 'other.example', product_id: '11111111-1111-1111-1111-111111111111', source_url: 'https://other.example/product/nivea-men-deep-hijack-comfort-after-shave-lotion' }),
    hint({ source_domain: 'foreign.example', market_country_code: 'US', source_url: 'https://foreign.example/product/nivea-men-deep-hijack-comfort-after-shave-lotion' }),
  ], { anchor });

  assert.equal(query, original);
});

test('low-confidence historical rows cannot influence provider query wording', async () => {
  const { deriveShoppingQueryFromCommerceHints } = await import(POLICY_IMPORT);
  const original = 'NIVEA MEN Deep Comfort After Shave Lotion 100 ml';
  const query = deriveShoppingQueryFromCommerceHints(original, [
    hint({ source_domain: 'a.example', offer_confidence: 70, source_url: 'https://a.example/nivea-deep-impact-comfort-after-shave' }),
    hint({ source_domain: 'b.example', offer_confidence: 79, source_url: 'https://b.example/nivea-deep-impact-comfort-after-shave' }),
  ], { anchor });
  assert.equal(query, original);
});

test('consensus query hints are query-only and never relax exact cluster, pack, store, or safety validation', async () => {
  const src = readFileSync(EDGE_PATH, 'utf8');
  assert.match(src, /deriveShoppingQueryFromCommerceHints/);
  assert.match(src, /sp_catalog_commerce_offer_v1/);
  assert.match(src, /offer_confidence/);
  assert.match(src, /market_country_code/);
  assert.match(src, /limit[^\n]*20/i);
  assert.match(src, /shoppingUrl\.searchParams\.set\(["']q["']/);
  assert.match(src, /selectGoogleProductCluster/);
  assert.match(src, /sp_us2_stage_commerce_offer_v1/);
  assert.doesNotMatch(src, /identity_status\s*:\s*["']VERIFIED["']/i);
});

test('alias hint read is bounded and does not treat candidate history as current verified exact offers', () => {
  const src = readFileSync(EDGE_PATH, 'utf8');
  assert.match(src, /offer_confidence[^\n]*(?:gte|80)/i);
  assert.doesNotMatch(src, /valid_until[^\n]*(?:gt|gte|now)/i);
  assert.doesNotMatch(src, /historical[^\n]*verified\s*=\s*true/i);
});
