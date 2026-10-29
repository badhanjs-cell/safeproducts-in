import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const POLICY = '../supabase/functions/sp-us2-search-v2/orchestration-policy.mjs';
const ORCHESTRATOR = 'supabase/functions/sp-us2-search-v2/index.ts';

function exact(id, merchant, price = 500) {
  return {
    canonical_product_id: 'anchor-product',
    canonical_product_fingerprint: 'anchor-fingerprint',
    product_fingerprint: `anchor-fingerprint::offer::${id}`,
    merchant_offer_id: id,
    brand_name: 'NIVEA MEN',
    product_name: 'Deep Comfort After Shave Lotion',
    pack_normalized_key: '100:ml',
    pack_size_text: '100 ml',
    result_group: 'EXACT_OFFER',
    offer_merchant: merchant,
    price,
    currency: 'INR',
    display_basis: 'SAFETY_QUALIFIED',
    safety_determined: true,
    profile_score: 82,
    safety_score: 82,
  };
}

function alternative(id, brand) {
  return {
    canonical_product_id: id,
    canonical_product_fingerprint: id,
    product_fingerprint: id,
    brand_name: brand,
    product_name: `${brand} After Shave Lotion`,
    pack_normalized_key: '100:ml',
    pack_size_text: '100 ml',
    result_group: 'ALTERNATIVE',
    price: 300,
    currency: 'INR',
    display_basis: 'PRICE_ONLY_FALLBACK',
    safety_determined: false,
  };
}

function core(exactCount = 1, alternativeCount = 2) {
  return {
    contract_version: 'SP-US2/1.0',
    search_mode: 'SPECIFIC_PRODUCT',
    profile: 'ALL',
    anchor_product: {
      canonical_product_id: 'anchor-product',
      canonical_product_fingerprint: 'anchor-fingerprint',
      brand_name: 'NIVEA MEN',
      product_name: 'Deep Comfort After Shave Lotion',
      variant_name: 'Deep Comfort',
      category: 'after shave lotion',
      pack_size_text: '100 ml',
      pack_normalized_key: '100:ml',
      market_country_code: 'IN',
    },
    selected_pack: { text: '100 ml', normalized_key: '100:ml', source: 'USER' },
    products: [
      ...Array.from({ length: exactCount }, (_, index) => exact(`old-${index}`, `Existing ${index}`, 500 + index)),
      ...Array.from({ length: alternativeCount }, (_, index) => alternative(`alt-${index}`, `Alt ${index}`)),
    ],
    m1b_meta: { run_id: 'run', engine: 'CACHE' },
  };
}

function dbOffer(id, merchant, price) {
  return {
    id,
    product_id: 'anchor-product',
    platform_name: merchant,
    merchant_name: merchant,
    source_url: `https://${merchant.toLowerCase().replace(/\s+/g, '-')}.example/product`,
    price,
    currency: 'INR',
    image_url: null,
    pack_size_text: '100 ml',
    pack_normalized_key: '100:ml',
    exact_pack_match: true,
    offer_confidence: 96,
    verified: true,
  };
}

test('Google cluster eligibility is specific-only and targets only the exact-offer shortfall', async () => {
  const policy = await import(POLICY);
  assert.equal(typeof policy.googleClusterAcquisitionNeed, 'function');

  assert.deepEqual(policy.googleClusterAcquisitionNeed({ search_mode: 'CATEGORY', products: [] }), {
    eligible: false, currentExactOffers: 0, targetExactOffers: 0,
  });
  assert.deepEqual(policy.googleClusterAcquisitionNeed(core(5, 0)), {
    eligible: false, currentExactOffers: 5, targetExactOffers: 0,
  });
  assert.deepEqual(policy.googleClusterAcquisitionNeed(core(1, 0)), {
    eligible: true, currentExactOffers: 1, targetExactOffers: 4,
  });
});

test('cluster exact-offer merge preserves safety template, dedupes, sorts and caps at five', async () => {
  const policy = await import(POLICY);
  assert.equal(typeof policy.mergeGoogleClusterExactOffers, 'function');
  const response = core(1, 2);
  const merged = policy.mergeGoogleClusterExactOffers(response, [
    dbOffer('new-c', 'Merchant C', 420),
    dbOffer('new-a', 'Merchant A', 350),
    dbOffer('new-b', 'Merchant B', 390),
    dbOffer('new-a', 'Merchant A', 350),
    dbOffer('new-d', 'Merchant D', 440),
    dbOffer('new-e', 'Merchant E', 460),
  ], '100:ml');

  const exactRows = merged.products.filter((row) => row.result_group === 'EXACT_OFFER');
  assert.equal(exactRows.length, 5);
  assert.deepEqual(exactRows.map((row) => row.price), [350, 390, 420, 440, 500]);
  assert.equal(exactRows[0].display_basis, 'SAFETY_QUALIFIED');
  assert.equal(exactRows[0].safety_score, 82);
  assert.equal(merged.products.filter((row) => row.result_group === 'ALTERNATIVE').length, 2);
});

test('cluster exact-offer merge is price-only when no prior exact safety template exists', async () => {
  const { mergeGoogleClusterExactOffers } = await import(POLICY);
  const response = core(0, 2);
  const merged = mergeGoogleClusterExactOffers(response, [dbOffer('new-a', 'Merchant A', 350)], '100:ml');
  const row = merged.products.find((item) => item.result_group === 'EXACT_OFFER');
  assert.ok(row);
  assert.equal(row.display_basis, 'PRICE_ONLY_FALLBACK');
  assert.equal(row.safety_determined, false);
  assert.equal(row.safety_score, null);
});

test('five clustered exact offers reduce residual Make exact target to zero while alternatives remain independent', async () => {
  const policy = await import(POLICY);
  const response = core(1, 2);
  const merged = policy.mergeGoogleClusterExactOffers(response, [
    dbOffer('a', 'Merchant A', 350), dbOffer('b', 'Merchant B', 360),
    dbOffer('c', 'Merchant C', 370), dbOffer('d', 'Merchant D', 380),
  ], '100:ml');
  const need = policy.acquisitionNeed(merged, 10);
  assert.equal(need.currentExactOffers, 5);
  assert.equal(need.targetExactOffers, 0);
  assert.equal(need.currentAlternatives, 2);
  assert.equal(need.targetAlternatives, 3);
});

test('partial clustered coverage leaves only the residual exact shortfall for Make', async () => {
  const policy = await import(POLICY);
  const merged = policy.mergeGoogleClusterExactOffers(core(1, 5), [
    dbOffer('a', 'Merchant A', 350), dbOffer('b', 'Merchant B', 360),
  ], '100:ml');
  const need = policy.acquisitionNeed(merged, 10);
  assert.equal(need.currentExactOffers, 3);
  assert.equal(need.targetExactOffers, 2);
  assert.equal(need.targetAlternatives, 0);
});

test('search-v2 invokes Google cluster before alternative discovery and final Make residual calculation', () => {
  const src = readFileSync(ORCHESTRATOR, 'utf8');
  assert.match(src, /sp-us2-google-cluster-v1/);
  assert.match(src, /googleClusterAcquisitionNeed/);
  assert.match(src, /mergeGoogleClusterExactOffers/);
  assert.match(src, /google_cluster_acquisition/);

  const clusterIndex = src.indexOf('sp-us2-google-cluster-v1');
  const discoveryIndex = src.lastIndexOf('invokeDiscovery');
  const finalNeedIndex = src.indexOf('const need = acquisitionNeed');
  assert.ok(clusterIndex >= 0 && discoveryIndex > clusterIndex, 'cluster acquisition must precede alternative discovery');
  assert.ok(finalNeedIndex > clusterIndex, 'Make residual calculation must occur after cluster acquisition');
  assert.match(src, /SP_US2_MAKE_ACQUISITION_ENABLED/);
  assert.doesNotMatch(src, /SP_US2_MAKE_ACQUISITION_ENABLED\s*[=:]\s*["']true["']/);
});

test('cluster invocation is deadline-bounded and failure leaves existing search/discovery path intact', () => {
  const src = readFileSync(ORCHESTRATOR, 'utf8');
  assert.match(src, /invokeGoogleCluster/);
  assert.match(src, /AbortSignal\.timeout/);
  assert.match(src, /catch\s*\{[^}]*cluster|catch\s*\([^)]*\)\s*\{[^}]*cluster/is);
  assert.match(src, /specificAlternativeQuery/);
  assert.match(src, /invokeDiscovery/);
  assert.match(src, /mergeSearchResponses/);
});
