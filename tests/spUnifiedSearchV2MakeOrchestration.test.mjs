import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const POLICY = '../supabase/functions/sp-us2-search-v2/orchestration-policy.mjs';
const ORCHESTRATOR = 'supabase/functions/sp-us2-search-v2/index.ts';
const ADAPTER = 'src/lib/productSearch.functions.ts';

function product(id, brand, group, pack = '200:ml') {
  return {
    canonical_product_id: id,
    product_fingerprint: id,
    brand_name: brand,
    product_name: `${brand} Product`,
    pack_normalized_key: pack,
    result_group: group,
    display_basis: 'PRICE_ONLY_FALLBACK',
    safety_determined: false,
    price: 200,
  };
}

test('acquisition need tracks specific 5+5 shortfall without fabricating fill targets', async () => {
  const policy = await import(POLICY);
  assert.equal(typeof policy.acquisitionNeed, 'function', 'acquisitionNeed must be exported');

  const sparse = {
    search_mode: 'SPECIFIC_PRODUCT',
    products: [
      product('anchor::a', 'Anchor', 'EXACT_OFFER'),
      product('anchor::b', 'Anchor', 'EXACT_OFFER'),
      product('anchor::c', 'Anchor', 'EXACT_OFFER'),
      product('alt-a', 'Alt A', 'ALTERNATIVE'),
      product('alt-b', 'Alt B', 'ALTERNATIVE'),
    ],
  };
  assert.deepEqual(policy.acquisitionNeed(sparse, 10), {
    needed: true,
    foregroundEligible: true,
    searchMode: 'SPECIFIC_PRODUCT',
    currentExactOffers: 3,
    currentAlternatives: 2,
    currentDistinctBrands: 0,
    targetExactOffers: 2,
    targetAlternatives: 3,
    targetCategoryProducts: 0,
    minimumUsefulFloor: 0,
  });

  const full = {
    search_mode: 'SPECIFIC_PRODUCT',
    products: [
      ...Array.from({ length: 5 }, (_, i) => product(`anchor::${i}`, 'Anchor', 'EXACT_OFFER')),
      ...Array.from({ length: 5 }, (_, i) => product(`alt-${i}`, `Alt ${i}`, 'ALTERNATIVE')),
    ],
  };
  assert.equal(policy.acquisitionNeed(full, 10).needed, false);
});

test('category acquisition targets requested coverage but foreground pressure stops at the six-product useful floor', async () => {
  const { acquisitionNeed } = await import(POLICY);
  const category = (count) => ({
    search_mode: 'CATEGORY',
    products: Array.from({ length: count }, (_, i) => product(`p-${i}`, `Brand ${i}`, 'CATEGORY_PRODUCT')),
  });

  assert.deepEqual(acquisitionNeed(category(5), 10), {
    needed: true,
    foregroundEligible: true,
    searchMode: 'CATEGORY',
    currentExactOffers: 0,
    currentAlternatives: 0,
    currentDistinctBrands: 5,
    targetExactOffers: 0,
    targetAlternatives: 5,
    targetCategoryProducts: 10,
    minimumUsefulFloor: 6,
  });
  assert.equal(acquisitionNeed(category(6), 10).needed, true);
  assert.equal(acquisitionNeed(category(6), 10).foregroundEligible, false);
  assert.equal(acquisitionNeed(category(10), 10).needed, false);
});

test('search v2 queues only bounded acquisition work and background dispatch cannot become a foreground dependency', () => {
  const source = readFileSync(ORCHESTRATOR, 'utf8');
  assert.match(source, /acquisitionNeed/);
  assert.match(source, /sp_us2_enqueue_acquisition_v1/);
  assert.match(source, /AbortSignal\.timeout\(500\)/);
  assert.match(source, /SP_US2_MAKE_ACQUISITION_ENABLED/);
  assert.match(source, /EdgeRuntime/);
  assert.match(source, /waitUntil/);
  assert.match(source, /sp-us2-make-dispatch-v1/);
  assert.match(source, /BACKGROUND_ONLY_ABOVE_MINIMUM_FLOOR/);
  assert.match(source, /make_acquisition/);
  assert.match(source, /return\s+json\(response\)/);
  assert.doesNotMatch(source, /await\s+[^;\n]*sp-us2-make-dispatch-v1/i);

  assert.match(source, /sp-us2-discovery-v1/);
  assert.match(source, /allow_paid_discovery/);
  assert.match(source, /discoveryTargetCount/);
});

test('production server adapter keeps SP-US2 v2 ahead of the legacy Make search fallback', () => {
  const source = readFileSync(ADAPTER, 'utf8');
  const v2 = source.indexOf('sp-us2-search-v2');
  const legacy = source.indexOf('MAKE_SEARCH_WEBHOOK_URL');
  assert.ok(v2 >= 0 && legacy > v2, 'SP-US2 v2 must retain precedence over the legacy Make search path');
});

test('v2 composition preserves a core market-standard fallback pack instead of restoring an unavailable explicit pack', async () => {
  const { mergeSearchResponses } = await import(POLICY);
  const fallbackCore = {
    search_mode: 'CATEGORY',
    selected_pack: {
      text: '100 ml',
      normalized_key: '100:ml',
      source: 'MARKET_STANDARD_FALLBACK',
      requested_text: '250 ml',
      requested_normalized_key: '250:ml',
      fallback_applied: true,
    },
    products: [
      product('p-1', 'Brand A', 'CATEGORY_PRODUCT', '100:ml'),
      product('p-2', 'Brand B', 'CATEGORY_PRODUCT', '100:ml'),
    ],
  };
  const response = mergeSearchResponses(fallbackCore, null, {
    query: 'baby lotion 250 ml',
    limit: 10,
  });
  assert.equal(response.selected_pack.normalized_key, '100:ml');
  assert.equal(response.selected_pack.source, 'MARKET_STANDARD_FALLBACK');
  assert.equal(response.selected_pack.requested_normalized_key, '250:ml');
  assert.equal(response.selected_pack.fallback_applied, true);
  assert.equal(response.products.length, 2);
  assert.match(response.consumer_notice, /250 ml/i);
  assert.match(response.consumer_notice, /100 ml/i);
});
