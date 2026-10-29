import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const POLICY = 'supabase/functions/sp-us2-make-callback-v1/make-policy.mjs';
const CALLBACK = 'supabase/functions/sp-us2-make-callback-v1/index.ts';

function requireFiles() {
  assert.equal(existsSync(POLICY), true, 'pure Make callback policy must exist');
  assert.equal(existsSync(CALLBACK), true, 'protected Make callback Edge Function must exist');
}

const validProduct = {
  ref: 'alt-1',
  brand_name: 'Brand A',
  product_name: 'Baby Lotion',
  variant_name: null,
  category: 'baby lotion',
  pack_size_text: '200 ml',
  pack_normalized_key: '200:ml',
  source_url: 'https://shop.example/products/baby-lotion?utm_source=make',
  source_name: 'Shop',
  identity_confidence: 96,
  market_country_code: 'IN',
};

const validOffer = {
  product_ref: 'alt-1',
  merchant_name: 'Shop',
  platform_name: 'Shop',
  source_url: 'https://shop.example/products/baby-lotion?utm_source=make',
  observed_source_urls: ['https://shop.example/products/baby-lotion?utm_source=provider'],
  price: 249,
  currency: 'INR',
  market_country_code: 'IN',
  pack_size_text: '200 ml',
  pack_normalized_key: '200:ml',
  exact_product_match: true,
  variant_match: true,
  exact_pack_match: true,
  confidence: 96,
};

const validPayload = {
  contract_version: 'SP-US2-MAKE-CALLBACK/1.0',
  request_id: '11111111-1111-4111-8111-111111111111',
  market_country_code: 'IN',
  currency: 'INR',
  products: [validProduct],
  offers: [validOffer],
};

test('callback rejects search clusters, redirects and merchant homepages as direct offer evidence', async () => {
  const { normalizeMakeOffer, normalizeMakeProduct } = await import('../supabase/functions/sp-us2-make-callback-v1/make-policy.mjs');
  for (const source_url of ['https://www.google.com/shopping/product/123', 'https://www.google.co.in/url?q=x', 'https://bing.com/search?q=lotion', 'https://shop.example/', 'https://shop.example/search?q=lotion']) {
    assert.equal(normalizeMakeOffer({ ...validOffer, source_url, observed_source_urls: [source_url] }), null, source_url);
    assert.equal(normalizeMakeProduct({ ...validProduct, source_url }), null, source_url);
  }
});

test('requested-pack callbacks reject another pack instead of silently discarding it', async () => {
  const { validateMakeCallback } = await import('../supabase/functions/sp-us2-make-callback-v1/make-policy.mjs');
  const actual = validateMakeCallback({ ...validPayload, requested_pack_key: '200:ml', pack_resolution: 'REQUESTED',
    offers: [validOffer, { ...validOffer, pack_normalized_key: '100:ml', pack_size_text: '100 ml' }] });
  assert.equal(actual.ok, false);
  assert.equal(actual.code, 'PACK_RESOLUTION_INVALID');
});

test('pure Make callback policy normalizes HTTPS page identity and contains no network/database access', async () => {
  requireFiles();
  const policySource = readFileSync(POLICY, 'utf8');
  assert.doesNotMatch(policySource, /\bfetch\s*\(|\bDeno\.|\/rest\/v1|\/functions\/v1/i);
  const { sourcePageKey } = await import('../supabase/functions/sp-us2-make-callback-v1/make-policy.mjs');
  assert.equal(sourcePageKey('https://Shop.Example/products/x?utm_source=a#frag'), 'https://shop.example/products/x');
  assert.equal(sourcePageKey('http://shop.example/products/x'), null);
  assert.equal(sourcePageKey('https://user:pass@shop.example/products/x'), null);
});

test('pure Make policy rejects wrong geography, pack/product flags, malformed price and duplicate merchant slots', async () => {
  requireFiles();
  const { normalizeMakeProduct, normalizeMakeOffer, validateMakeCallback } = await import('../supabase/functions/sp-us2-make-callback-v1/make-policy.mjs');
  assert.ok(normalizeMakeProduct(validProduct, { marketCountryCode: 'IN', requestedPackKey: '200:ml' }));
  assert.equal(normalizeMakeProduct({ ...validProduct, source_url: 'http://shop.example/x' }, { marketCountryCode: 'IN' }), null);
  assert.equal(normalizeMakeProduct({ ...validProduct, market_country_code: 'US' }, { marketCountryCode: 'IN' }), null);

  assert.ok(normalizeMakeOffer(validOffer, { marketCountryCode: 'IN', currency: 'INR', requestedPackKey: '200:ml' }));
  assert.equal(normalizeMakeOffer({ ...validOffer, pack_normalized_key: '400:ml' }, { marketCountryCode: 'IN', currency: 'INR', requestedPackKey: '200:ml' }), null);
  assert.equal(normalizeMakeOffer({ ...validOffer, exact_product_match: false }, { marketCountryCode: 'IN', currency: 'INR', requestedPackKey: '200:ml' }), null);
  assert.equal(normalizeMakeOffer({ ...validOffer, variant_match: false }, { marketCountryCode: 'IN', currency: 'INR', requestedPackKey: '200:ml' }), null);
  assert.equal(normalizeMakeOffer({ ...validOffer, price: 'not-a-price' }, { marketCountryCode: 'IN', currency: 'INR', requestedPackKey: '200:ml' }), null);

  assert.equal(validateMakeCallback(validPayload).ok, true);
  assert.equal(validateMakeCallback({ ...validPayload, offers: [validOffer, { ...validOffer, source_url: 'https://shop.example/products/baby-lotion-2', observed_source_urls: ['https://shop.example/products/baby-lotion-2'] }] }).ok, false);
  assert.equal(validateMakeCallback({ ...validPayload, products: Array.from({ length: 11 }, (_, i) => ({ ...validProduct, ref: `p-${i}` })) }).ok, false);
});

test('pure Make callback policy rejects any attempted safety, ingredient, authority or VERIFIED-identity injection', async () => {
  requireFiles();
  const { validateMakeCallback } = await import('../supabase/functions/sp-us2-make-callback-v1/make-policy.mjs');
  for (const injected of [
    { safety_score: 99 },
    { ingredients: ['x'] },
    { ingredient_declaration: 'x' },
    { recommendation: 'safe' },
    { best_choice: true },
    { regulatory_approval: true },
  ]) {
    assert.equal(validateMakeCallback({ ...validPayload, products: [{ ...validProduct, ...injected }] }).ok, false);
  }
  assert.equal(validateMakeCallback({ ...validPayload, products: [{ ...validProduct, identity_status: 'VERIFIED' }] }).ok, false);
});

test('callback authenticates with dedicated constant-time key, bounds body size and writes only through canonical RPCs', () => {
  requireFiles();
  const source = readFileSync(CALLBACK, 'utf8');
  assert.match(source, /x-sp-us2-make-key/i);
  assert.match(source, /SP_US2_MAKE_CALLBACK_KEY/);
  assert.match(source, /constantTimeEqual/);
  assert.match(source, /524288|512\s*\*\s*1024/);
  assert.match(source, /sp_us2_acquisition_request_v1/);
  assert.match(source, /sp_catalog_stage_search_discovery_v1/);
  assert.match(source, /sp_us2_stage_commerce_offer_v1/);
  assert.match(source, /sp_us2_finish_acquisition_v1/);
  assert.ok(source.indexOf('x-sp-us2-make-key') < source.indexOf('sp_catalog_stage_search_discovery_v1'));
  assert.doesNotMatch(source, /insert\s+into|update\s+public\.|delete\s+from/i);
  assert.doesNotMatch(source, /sp_catalog_safety_assessment_v1|sp_catalog_ingredient_evidence_v1|sp_catalog_product_ingredient_v1|benchmark_gold|holdout/i);
});

test('declared market-standard fallback accepts one uniform same-unit pack and rejects mixed fallback packs', async () => {
  requireFiles();
  const { validateMakeCallback } = await import('../supabase/functions/sp-us2-make-callback-v1/make-policy.mjs');
  const fallbackProduct = {
    ...validProduct,
    pack_size_text: '100 ml',
    pack_normalized_key: '100:ml',
  };
  const fallbackOffer = {
    ...validOffer,
    pack_size_text: '100 ml',
    pack_normalized_key: '100:ml',
  };
  const fallbackPayload = {
    ...validPayload,
    requested_pack_key: '250:ml',
    resolved_pack_key: '100:ml',
    pack_resolution: 'MARKET_STANDARD_FALLBACK',
    products: [fallbackProduct],
    offers: [fallbackOffer],
  };
  const accepted = validateMakeCallback(fallbackPayload, {
    marketCountryCode: 'IN',
    currency: 'INR',
    requestedPackKey: '250:ml',
  });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.value.requestedPackKey, '250:ml');
  assert.equal(accepted.value.resolvedPackKey, '100:ml');
  assert.equal(accepted.value.packResolution, 'MARKET_STANDARD_FALLBACK');

  const mixed = validateMakeCallback({
    ...fallbackPayload,
    offers: [fallbackOffer, {
      ...fallbackOffer,
      product_ref: 'alt-1',
      merchant_name: 'Second Shop',
      source_url: 'https://second.example/products/baby-lotion',
      observed_source_urls: ['https://second.example/products/baby-lotion'],
      pack_size_text: '200 ml',
      pack_normalized_key: '200:ml',
    }],
  }, {
    marketCountryCode: 'IN',
    currency: 'INR',
    requestedPackKey: '250:ml',
  });
  assert.equal(mixed.ok, false);
});
