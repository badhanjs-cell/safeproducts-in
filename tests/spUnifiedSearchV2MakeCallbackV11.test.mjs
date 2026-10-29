import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const POLICY_PATH = '../supabase/functions/sp-us2-make-callback-v1/make-policy.mjs';
const CALLBACK = 'supabase/functions/sp-us2-make-callback-v1/index.ts';
const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

const queueSpecific = {
  contractVersion: 'SP-US2-MAKE-ACQUISITION/1.1',
  searchMode: 'SPECIFIC_PRODUCT',
  query: 'nivea men deep comfort after shave lotion 100 ml',
  requestedPackKey: '100:ml',
  comparisonPackKey: null,
  category: 'after shave lotion',
  targetExactOffers: 2,
  targetAlternatives: 2,
  targetCategoryProducts: 0,
  marketCountryCode: 'IN',
  currency: 'INR',
  anchor: {
    id: '22222222-2222-4222-8222-222222222222',
    brand_name: 'NIVEA MEN',
    product_name: 'Deep Comfort After Shave Lotion',
    variant_name: null,
    category: 'after shave lotion',
  },
};

function exactOffer(overrides = {}) {
  const source_url = overrides.source_url ?? 'https://merchant-a.example/products/nivea-deep-comfort-100ml';
  const image_url = overrides.image_url ?? 'https://merchant-a.example/images/nivea-deep-comfort-100ml.jpg';
  return {
    candidate_rank: 2,
    merchant_name: 'Merchant A',
    platform_name: 'Merchant A',
    source_url,
    observed_source_urls: [source_url],
    observed_title: 'NIVEA MEN Deep Comfort After Shave Lotion 100 ml',
    price: 598,
    currency: 'INR',
    market_country_code: 'IN',
    pack_size_text: '100 ml',
    pack_normalized_key: '100:ml',
    exact_product_match: true,
    exact_variant_match: true,
    exact_pack_match: true,
    confidence: 98,
    image_url,
    observed_image_urls: [image_url],
    ...overrides,
  };
}

function alternative(overrides = {}) {
  const ref = overrides.ref ?? 'alt-old-spice';
  const source_url = overrides.source_url ?? 'https://oldspice.example/products/after-shave-100ml';
  const image_url = overrides.image_url ?? 'https://oldspice.example/images/after-shave-100ml.jpg';
  return {
    ref,
    candidate_rank: 2,
    brand_name: 'Old Spice',
    product_name: 'Original After Shave Lotion',
    variant_name: null,
    category: 'after shave lotion',
    source_url,
    observed_source_urls: [source_url],
    observed_title: 'Old Spice Original After Shave Lotion 100 ml',
    price: 270,
    currency: 'INR',
    market_country_code: 'IN',
    pack_size_text: '100 ml',
    pack_normalized_key: '100:ml',
    exact_pack_match: true,
    identity_confidence: 96,
    confidence: 96,
    image_url,
    observed_image_urls: [image_url],
    ...overrides,
  };
}

function validPayload(overrides = {}) {
  return {
    contract_version: 'SP-US2-MAKE-CALLBACK/1.1',
    request_id: REQUEST_ID,
    requested_pack_key: '100:ml',
    comparison_pack_key: null,
    market_country_code: 'IN',
    currency: 'INR',
    exact_offers: [exactOffer()],
    candidate_products: [alternative()],
    ...overrides,
  };
}

test('v1.1 accepts one strict specific-product callback and derives staging facts without safety authority', async () => {
  const { validateMakeCallbackV11 } = await import(POLICY_PATH);
  assert.equal(typeof validateMakeCallbackV11, 'function');
  const actual = validateMakeCallbackV11(validPayload(), queueSpecific);
  assert.equal(actual.ok, true);
  assert.equal(actual.value.requestId, REQUEST_ID);
  assert.equal(actual.value.requestedPackKey, '100:ml');
  assert.equal(actual.value.effectivePackKey, '100:ml');
  assert.equal(actual.value.offers.length, 2, 'exact and alternative commerce observations both become protected commerce facts');
  assert.equal(actual.value.offers[0].product_ref, 'ANCHOR');
  assert.equal(actual.value.products.length, 1);
  assert.equal(actual.value.products[0].ref, 'alt-old-spice');
  assert.ok(actual.value.images.length >= 1, 'observed exact images may be persisted opportunistically');
  assert.equal(JSON.stringify(actual.value).includes('safety_score'), false);
});

test('v1.1 explicit requested pack rejects fallback semantics, wrong pack, and multipacks', async () => {
  const { validateMakeCallbackV11 } = await import(POLICY_PATH);

  const fallback = validateMakeCallbackV11(validPayload({
    pack_resolution: 'MARKET_STANDARD_FALLBACK',
    resolved_pack_key: '200:ml',
  }), queueSpecific);
  assert.equal(fallback.ok, false);
  assert.equal(fallback.code, 'PACK_RESOLUTION_INVALID');

  const wrongPack = validateMakeCallbackV11(validPayload({ exact_offers: [exactOffer({
    pack_size_text: '200 ml', pack_normalized_key: '200:ml',
  })] }), queueSpecific);
  assert.equal(wrongPack.ok, false);
  assert.equal(wrongPack.code, 'PACK_MISMATCH');

  const multipack = validateMakeCallbackV11(validPayload({ exact_offers: [exactOffer({
    pack_size_text: 'Pack of 3 - 100 ml',
  })] }), queueSpecific);
  assert.equal(multipack.ok, false);
  assert.equal(multipack.code, 'MULTIPACK_INVALID');
});

test('v1.1 independently rejects wrong product family, formula/title, and contradictory variant despite Make match flags', async () => {
  const { validateMakeCallbackV11 } = await import(POLICY_PATH);

  for (const observed_title of [
    'NIVEA MEN Black Carbon After Shave Lotion 100 ml',
    'NIVEA MEN Deep Comfort Shaving Foam 100 ml',
  ]) {
    const actual = validateMakeCallbackV11(validPayload({ exact_offers: [exactOffer({ observed_title })] }), queueSpecific);
    assert.equal(actual.ok, false, observed_title);
    assert.equal(actual.code, 'ANCHOR_IDENTITY_MISMATCH');
  }

  const variantContext = { ...queueSpecific, anchor: { ...queueSpecific.anchor, variant_name: 'Sensitive' } };
  const variantMismatch = validateMakeCallbackV11(validPayload({ exact_offers: [exactOffer({
    observed_title: 'NIVEA MEN Deep Comfort Original After Shave Lotion 100 ml',
  })] }), variantContext);
  assert.equal(variantMismatch.ok, false);
  assert.equal(variantMismatch.code, 'ANCHOR_VARIANT_MISMATCH');
});

test('v1.1 enforces queue residual targets, exact merchant dedupe, alternative brand dedupe, and anchor-brand exclusion', async () => {
  const { validateMakeCallbackV11 } = await import(POLICY_PATH);

  const tooManyExact = validateMakeCallbackV11(validPayload({
    exact_offers: [
      exactOffer(),
      exactOffer({ merchant_name: 'Merchant B', source_url: 'https://merchant-b.example/products/nivea-deep-comfort-100ml', observed_source_urls: ['https://merchant-b.example/products/nivea-deep-comfort-100ml'], image_url: null, observed_image_urls: [] }),
      exactOffer({ merchant_name: 'Merchant C', source_url: 'https://merchant-c.example/products/nivea-deep-comfort-100ml', observed_source_urls: ['https://merchant-c.example/products/nivea-deep-comfort-100ml'], image_url: null, observed_image_urls: [] }),
    ],
  }), queueSpecific);
  assert.equal(tooManyExact.ok, false);
  assert.equal(tooManyExact.code, 'TARGET_BOUNDS_EXCEEDED');

  const duplicateMerchant = validateMakeCallbackV11(validPayload({
    exact_offers: [
      exactOffer(),
      exactOffer({ source_url: 'https://merchant-a.example/products/nivea-deep-comfort-second', observed_source_urls: ['https://merchant-a.example/products/nivea-deep-comfort-second'], image_url: null, observed_image_urls: [] }),
    ],
  }), queueSpecific);
  assert.equal(duplicateMerchant.ok, false);
  assert.equal(duplicateMerchant.code, 'DUPLICATE_MERCHANT_SLOT');

  const duplicateBrand = validateMakeCallbackV11(validPayload({ candidate_products: [
    alternative(),
    alternative({ ref: 'alt-old-spice-2', product_name: 'Classic After Shave Lotion', source_url: 'https://shop-two.example/products/old-spice-100ml', observed_source_urls: ['https://shop-two.example/products/old-spice-100ml'], image_url: null, observed_image_urls: [] }),
  ] }), queueSpecific);
  assert.equal(duplicateBrand.ok, false);
  assert.equal(duplicateBrand.code, 'DUPLICATE_BRAND');

  const anchorBrand = validateMakeCallbackV11(validPayload({ candidate_products: [alternative({
    brand_name: 'NIVEA', product_name: 'Sensitive After Shave Lotion', observed_title: 'NIVEA Sensitive After Shave Lotion 100 ml',
  })] }), queueSpecific);
  assert.equal(anchorBrand.ok, false);
  assert.equal(anchorBrand.code, 'ANCHOR_BRAND_EXCLUDED');
});

test('v1.1 alternatives require same category/product type and the exact requested/comparison pack', async () => {
  const { validateMakeCallbackV11 } = await import(POLICY_PATH);

  const offCategory = validateMakeCallbackV11(validPayload({ candidate_products: [alternative({
    brand_name: 'Versace', product_name: 'Oud Noir Eau de Parfum', category: 'perfume', observed_title: 'Versace Oud Noir Eau de Parfum 100 ml',
  })] }), queueSpecific);
  assert.equal(offCategory.ok, false);
  assert.equal(offCategory.code, 'PRODUCT_RELEVANCE_INVALID');

  const wrongPack = validateMakeCallbackV11(validPayload({ candidate_products: [alternative({
    pack_size_text: '200 ml', pack_normalized_key: '200:ml', observed_title: 'Old Spice Original After Shave Lotion 200 ml',
  })] }), queueSpecific);
  assert.equal(wrongPack.ok, false);
  assert.equal(wrongPack.code, 'PACK_MISMATCH');
});

test('v1.1 category mode dedupes normalized brands and obeys backend comparison pack and target', async () => {
  const { validateMakeCallbackV11 } = await import(POLICY_PATH);
  const categoryContext = {
    contractVersion: 'SP-US2-MAKE-ACQUISITION/1.1',
    searchMode: 'CATEGORY',
    query: 'baby lotion',
    requestedPackKey: null,
    comparisonPackKey: '200:ml',
    category: 'baby lotion',
    targetExactOffers: 0,
    targetAlternatives: 0,
    targetCategoryProducts: 2,
    marketCountryCode: 'IN', currency: 'INR', anchor: null,
  };
  const categoryProduct = (brand, ref, source) => alternative({
    ref, brand_name: brand, product_name: 'Baby Lotion', category: 'baby lotion', observed_title: `${brand} Baby Lotion 200 ml`,
    pack_size_text: '200 ml', pack_normalized_key: '200:ml', source_url: source, observed_source_urls: [source], image_url: null, observed_image_urls: [],
  });
  const payload = {
    contract_version: 'SP-US2-MAKE-CALLBACK/1.1', request_id: REQUEST_ID,
    requested_pack_key: null, comparison_pack_key: '200:ml', market_country_code: 'IN', currency: 'INR', exact_offers: [],
    candidate_products: [categoryProduct('Brand A', 'a', 'https://a.example/p/lotion'), categoryProduct('Brand B', 'b', 'https://b.example/p/lotion')],
  };
  assert.equal(validateMakeCallbackV11(payload, categoryContext).ok, true);

  const duplicate = validateMakeCallbackV11({ ...payload, candidate_products: [
    categoryProduct('Brand A', 'a', 'https://a.example/p/lotion'), categoryProduct('BRAND-A', 'a2', 'https://a2.example/p/lotion'),
  ] }, categoryContext);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.code, 'DUPLICATE_BRAND');

  const wrongPack = validateMakeCallbackV11({ ...payload, candidate_products: [
    categoryProduct('Brand A', 'a', 'https://a.example/p/lotion'),
    { ...categoryProduct('Brand B', 'b', 'https://b.example/p/lotion'), pack_size_text: '100 ml', pack_normalized_key: '100:ml', observed_title: 'Brand B Baby Lotion 100 ml' },
  ] }, categoryContext);
  assert.equal(wrongPack.ok, false);
  assert.equal(wrongPack.code, 'PACK_MISMATCH');
});

test('v1.1 rejects authority injection including review, Gold, HOLDOUT, safety, ingredients, recommendation and VERIFIED identity', async () => {
  const { validateMakeCallbackV11 } = await import(POLICY_PATH);
  for (const injected of [
    { safety_score: 99 }, { ingredients: ['x'] }, { identity_status: 'VERIFIED' },
    { regulatory_status: 'APPROVED' }, { recommendation_class: 'acceptable' }, { best_choice: true },
    { review_resolution: 'APPROVED' }, { benchmark_gold: true }, { holdout: true },
  ]) {
    const actual = validateMakeCallbackV11(validPayload({ candidate_products: [{ ...alternative(), ...injected }] }), queueSpecific);
    assert.equal(actual.ok, false, JSON.stringify(injected));
    assert.equal(actual.code, 'AUTHORITY_FIELDS_FORBIDDEN');
  }
});

test('v1.1 requires observed HTTPS provenance for product pages and submitted images', async () => {
  const { validateMakeCallbackV11 } = await import(POLICY_PATH);

  const unobservedProduct = validateMakeCallbackV11(validPayload({ candidate_products: [alternative({ observed_source_urls: [] })] }), queueSpecific);
  assert.equal(unobservedProduct.ok, false);
  assert.equal(unobservedProduct.code, 'SOURCE_PROVENANCE_INVALID');

  const unobservedImage = validateMakeCallbackV11(validPayload({ exact_offers: [exactOffer({ observed_image_urls: [] })] }), queueSpecific);
  assert.equal(unobservedImage.ok, false);
  assert.equal(unobservedImage.code, 'IMAGE_PROVENANCE_INVALID');

  const insecureImage = validateMakeCallbackV11(validPayload({ exact_offers: [exactOffer({
    image_url: 'http://merchant-a.example/image.jpg', observed_image_urls: ['http://merchant-a.example/image.jpg'],
  })] }), queueSpecific);
  assert.equal(insecureImage.ok, false);
  assert.equal(insecureImage.code, 'IMAGE_PROVENANCE_INVALID');
});

test('callback Edge routes queue/callback versions fail-closed, stages only through canonical RPCs, and persists observed images non-authoritatively', () => {
  const source = readFileSync(CALLBACK, 'utf8');
  assert.match(source, /validateMakeCallbackV11/);
  assert.match(source, /contract_version/);
  assert.match(source, /comparison_pack_key/);
  assert.match(source, /target_category_products/);
  assert.match(source, /SP-US2-MAKE-ACQUISITION\/1\.1/);
  assert.match(source, /SP-US2-MAKE-CALLBACK\/1\.1/);
  assert.match(source, /CONTRACT_VERSION_MISMATCH/);
  assert.match(source, /sp_catalog_stage_search_discovery_v1/);
  assert.match(source, /sp_us2_stage_commerce_offer_v1/);
  assert.match(source, /sp_us2_upsert_display_image_v1/);
  assert.match(source, /exact_product_match:\s*true/);
  assert.doesNotMatch(source, /insert\s+into|update\s+public\.|delete\s+from/i);
  assert.doesNotMatch(source, /sp_catalog_safety_assessment_v1|sp_catalog_ingredient_evidence_v1|sp_catalog_product_ingredient_v1|benchmark_gold|holdout/i);
});
