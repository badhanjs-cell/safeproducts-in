import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const MIGRATION = 'supabase/migrations/20260922184500_sp_us2_search_discovery_bridge_v1.sql';
const POLICY = 'supabase/functions/sp-us2-discovery-v1/discovery-policy.mjs';
const WORKER = 'supabase/functions/sp-us2-discovery-v1/index.ts';
const ORCHESTRATOR = 'supabase/functions/sp-us2-search-v2/index.ts';
const ORCHESTRATION_POLICY = 'supabase/functions/sp-us2-search-v2/orchestration-policy.mjs';
const ADAPTER = 'src/lib/productSearch.functions.ts';

test('search discovery stages only candidate identities and reuses existing enrichment review pipeline', () => {
  assert.equal(existsSync(MIGRATION), true, 'search-discovery bridge migration must exist');
  const sql = readFileSync(MIGRATION, 'utf8');

  assert.match(sql, /sp_catalog_stage_search_discovery_v1/i);
  assert.match(sql, /identity_status[^\n]*'CANDIDATE'/i);
  assert.match(sql, /v_identity_confidence\s*,\s*'CANDIDATE'\s*,\s*'SEARCH'\s*,\s*true/i);
  assert.match(sql, /sp_catalog_enqueue_default_enrichment_v1/i);
  assert.match(sql, /sp_catalog_review_queue_v1/i);
  assert.match(sql, /SEARCH_DISCOVERY_IDENTITY_CONFIRMATION/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path/i);

  assert.doesNotMatch(sql, /identity_status[^\n]*'VERIFIED'/i);
  assert.doesNotMatch(sql, /insert\s+into\s+public\.sp_catalog_safety_assessment_v1/i);
  assert.doesNotMatch(sql, /insert\s+into\s+public\.sp_catalog_product_ingredient_v1/i);
});

test('candidate staging reports the persisted origin and review requirement truthfully when an existing canonical identity is reused', () => {
  const sql = readFileSync(MIGRATION, 'utf8');
  const worker = readFileSync(WORKER, 'utf8');

  assert.match(sql, /v_existing_origin\s+text/i);
  assert.match(sql, /returning\s+id\s*,\s*identity_status\s*,\s*source_origin\s+into\s+v_product_id\s*,\s*v_existing_status\s*,\s*v_existing_origin/i);
  assert.match(sql, /'source_origin'\s*,\s*v_existing_origin/i);
  assert.match(worker, /staged\?\.review_required\s*===\s*true[\s\S]*"IDENTITY_REVIEW_QUEUED"/);
  assert.match(worker, /staged\?\.review_required\s*===\s*false[\s\S]*"NOT_REQUIRED"/);
  assert.match(worker, /IDENTITY_REVIEW_NOT_STAGED/);
});

test('discovery policy enforces query relevance, one brand, and one comparable pack', async () => {
  assert.equal(existsSync(POLICY), true, 'discovery policy must exist');
  const { prepareDiscoveryProducts, shouldUsePaidDiscovery } = await import('../supabase/functions/sp-us2-discovery-v1/discovery-policy.mjs');

  const products = [
    { name: 'Brand A Baby Hair Oil 100 ml', brand: 'Brand A', source_url: 'https://a.example/hair-oil', price: 220, currency: 'INR' },
    { name: 'Brand B Baby Hair Oil 100 ml', brand: 'Brand B', source_url: 'https://b.example/hair-oil', price: 180, currency: 'INR' },
    { name: 'Brand A Baby Hair Oil Premium 100 ml', brand: 'Brand A', source_url: 'https://a.example/premium', price: 260, currency: 'INR' },
    { name: 'Brand C Baby Hair Oil 200 ml', brand: 'Brand C', source_url: 'https://c.example/hair-oil', price: 300, currency: 'INR' },
    { name: 'Brand D Baby Soap 100 ml', brand: 'Brand D', source_url: 'https://d.example/soap', price: 90, currency: 'INR' },
    { name: 'Brand E Baby Hair Oil 100 ml', brand: 'Brand E', source_url: 'http://e.example/hair-oil', price: 210, currency: 'INR' },
  ];

  const explicit = prepareDiscoveryProducts(products, { queryText: 'baby hair oil', requestedPackKey: '100:ml', limit: 10 });
  assert.equal(explicit.selectedPackKey, '100:ml');
  assert.deepEqual(explicit.products.map((row) => row.brand), ['Brand B', 'Brand A']);
  assert.ok(explicit.products.every((row) => row.pack_normalized_key === '100:ml'));
  assert.ok(explicit.products.every((row) => row.price > 0));

  const modal = prepareDiscoveryProducts([
    ...products,
    { name: 'Brand F Baby Hair Oil 100 ml', brand: 'Brand F', source_url: 'https://f.example/hair-oil', price: 240, currency: 'INR' },
  ], { queryText: 'baby hair oil', requestedPackKey: null, limit: 10 });
  assert.equal(modal.selectedPackKey, '100:ml');
  assert.ok(modal.products.every((row) => row.pack_normalized_key === '100:ml'));

  const unknownPack = prepareDiscoveryProducts([
    { name: 'Brand G Baby Hair Oil', brand: 'Brand G', source_url: 'https://g.example/hair-oil', price: 199, currency: 'INR' },
  ], { queryText: 'baby hair oil', requestedPackKey: null, limit: 10 });
  assert.equal(unknownPack.selectedPackKey, null);
  assert.equal(unknownPack.products[0].price, null);

  assert.equal(shouldUsePaidDiscovery({ currentCount: 2, targetCount: 6, allowPaidDiscovery: true }), true);
  assert.equal(shouldUsePaidDiscovery({ currentCount: 6, targetCount: 6, allowPaidDiscovery: true }), false);
  assert.equal(shouldUsePaidDiscovery({ currentCount: 0, targetCount: 6, allowPaidDiscovery: false }), false);
});

test('discovery worker is resilience-first, one-paid-call bounded, and safety-blind', () => {
  assert.equal(existsSync(WORKER), true, 'discovery worker must exist');
  const source = readFileSync(WORKER, 'utf8');

  const resilienceAt = source.indexOf('sp_web_search_resilience_v1');
  const recentAt = source.indexOf('sp_web_recent_discovery_fallback_v1');
  const paidAt = source.indexOf('https://api.openai.com/v1/responses');
  assert.ok(resilienceAt >= 0 && recentAt >= 0 && paidAt > resilienceAt && paidAt > recentAt);
  assert.equal((source.match(/https:\/\/api\.openai\.com\/v1\/responses/g) || []).length, 1);
  assert.match(source, /shouldUsePaidDiscovery/);
  assert.match(source, /sp_catalog_stage_search_discovery_v1/);
  assert.match(source, /x-us2-internal-key/);
  assert.match(source, /paid_discovery_calls/);
  assert.match(source, /cost_usd:\s*null/);
  assert.match(source, /Do not research or return ingredients/i);
  assert.match(source, /safety_score:\s*null/);
  assert.match(source, /safety_determined:\s*false/);

  assert.doesNotMatch(source, /sp_catalog_safety_assessment_v1/);
  assert.doesNotMatch(source, /sp_catalog_product_ingredient_v1/);
  assert.doesNotMatch(source, /sp_catalog_ingredient_evidence_v1/);
});

test('versioned v2 orchestrator falls through sparse core results to bounded discovery', () => {
  assert.equal(existsSync(ORCHESTRATOR), true, 'v2 search orchestrator must exist');
  const source = readFileSync(ORCHESTRATOR, 'utf8');
  const adapter = readFileSync(ADAPTER, 'utf8');

  assert.match(source, /invokeCore/);
  assert.match(source, /sp-m1b-search-v1/);
  assert.match(source, /invokeDiscovery/);
  assert.match(source, /sp-us2-discovery-v1/);
  assert.match(source, /coreProducts[\s\S]*length\s*>=\s*6/);
  assert.match(source, /discoveryQuery\s*=\s*searchMode\s*===\s*"SPECIFIC_PRODUCT"[\s\S]*specificAlternativeQuery/);
  assert.match(source, /requested_pack_key:\s*selectedPackKey/);
  assert.match(source, /allow_paid_discovery:\s*remainingForDiscovery\s*>\s*6000/);
  assert.match(source, /discoveredProducts/);
  assert.match(source, /if\s*\(!selectedPackKey\s*&&\s*discoveryPackKey\)/);
  assert.match(source, /discovery_telemetry:/);
  assert.match(adapter, /sp-us2-search-v2/);
});

test('v2 merge preserves exact offer safety, adds only same-pack distinct alternatives, and keeps Best Choice scored-only', async () => {
  assert.equal(existsSync(ORCHESTRATION_POLICY), true, 'v2 orchestration policy must exist');
  const { mergeSearchResponses, specificAlternativeQuery } = await import('../supabase/functions/sp-us2-search-v2/orchestration-policy.mjs');

  const core = {
    profile: 'ALL',
    search_mode: 'SPECIFIC_PRODUCT',
    selected_pack: { text: '200 ml', normalized_key: '200:ml', source: 'USER' },
    products: [
      { canonical_product_id: 'x', product_fingerprint: 'x::a', product_name: 'Brand X Baby Lotion 200 ml', brand_name: 'Brand X', result_group: 'EXACT_OFFER', pack_normalized_key: '200:ml', price: 220, display_basis: 'SAFETY_QUALIFIED', safety_determined: true, safety_score: 88, profile_score: 88 },
      { canonical_product_id: 'x', product_fingerprint: 'x::b', product_name: 'Brand X Baby Lotion 200 ml', brand_name: 'Brand X', result_group: 'EXACT_OFFER', pack_normalized_key: '200:ml', price: 229, display_basis: 'SAFETY_QUALIFIED', safety_determined: true, safety_score: 88, profile_score: 88 },
      { canonical_product_id: 'y', product_fingerprint: 'y', product_name: 'Brand Y Baby Lotion 200 ml', brand_name: 'Brand Y', result_group: 'ALTERNATIVE', pack_normalized_key: '200:ml', price: 260, display_basis: 'SAFETY_QUALIFIED', safety_determined: true, safety_score: 93, profile_score: 93 },
    ],
    m1b_meta: { run_id: 'r1', engine: 'M1-B', m1br_queued_count: 0, foreground_latency_ms: 100 },
  };
  const discovery = {
    selected_pack: { text: '200 ml', normalized_key: '200:ml', source: 'USER' },
    products: [
      { canonical_product_id: 'z', product_fingerprint: 'z', product_name: 'Brand Z Baby Lotion 200 ml', brand_name: 'Brand Z', pack_normalized_key: '200:ml', price: 190, display_basis: 'PRICE_ONLY_FALLBACK', safety_determined: false, safety_score: null, profile_score: null },
      { canonical_product_id: 'y2', product_fingerprint: 'y2', product_name: 'Brand Y Baby Lotion 200 ml', brand_name: 'Brand Y', pack_normalized_key: '200:ml', price: 150, display_basis: 'PRICE_ONLY_FALLBACK', safety_determined: false, safety_score: null, profile_score: null },
      { canonical_product_id: 'q', product_fingerprint: 'q', product_name: 'Brand Q Baby Lotion 100 ml', brand_name: 'Brand Q', pack_normalized_key: '100:ml', price: 120, display_basis: 'PRICE_ONLY_FALLBACK', safety_determined: false, safety_score: null, profile_score: null },
    ],
    telemetry: { paid_discovery_calls: 1, cost_usd: null },
  };

  assert.equal(specificAlternativeQuery(core, 'Brand X Baby Lotion 200 ml'), 'baby lotion');
  const merged = mergeSearchResponses(core, discovery, { query: 'Brand X Baby Lotion 200 ml', limit: 10 });
  assert.deepEqual(merged.products.map((p) => p.result_group), ['EXACT_OFFER', 'EXACT_OFFER', 'ALTERNATIVE', 'ALTERNATIVE']);
  assert.deepEqual(merged.products.slice(0, 2).map((p) => p.safety_score), [88, 88]);
  assert.deepEqual(merged.products.slice(2).map((p) => p.brand_name), ['Brand Y', 'Brand Z']);
  assert.ok(merged.products.every((p) => p.pack_normalized_key === '200:ml'));
  assert.equal(merged.safest_product.canonical_product_id, 'y');
  assert.equal(merged.lowest_price_product.canonical_product_id, 'z');
  assert.equal(merged.best_value_product.canonical_product_id, 'x');
});

test('v2 generic merge adopts discovery modal pack and excludes different-size core products', async () => {
  const { mergeSearchResponses } = await import('../supabase/functions/sp-us2-search-v2/orchestration-policy.mjs');
  const core = {
    profile: 'ALL',
    search_mode: 'CATEGORY',
    selected_pack: { text: null, normalized_key: null, source: null },
    products: [
      { canonical_product_id: 'a', product_fingerprint: 'a', product_name: 'Brand A Baby Hair Oil 100 ml', brand_name: 'Brand A', result_group: 'CATEGORY_PRODUCT', pack_normalized_key: '100:ml', price: 220, display_basis: 'SAFETY_QUALIFIED', safety_determined: true, safety_score: 90, profile_score: 90 },
      { canonical_product_id: 'b', product_fingerprint: 'b', product_name: 'Brand B Baby Hair Oil 200 ml', brand_name: 'Brand B', result_group: 'CATEGORY_PRODUCT', pack_normalized_key: '200:ml', price: 200, display_basis: 'SAFETY_QUALIFIED', safety_determined: true, safety_score: 95, profile_score: 95 },
    ],
  };
  const discovery = {
    selected_pack: { text: '100 ml', normalized_key: '100:ml', source: 'TRUSTED_DISCOVERY_MODE' },
    products: [
      { canonical_product_id: 'c', product_fingerprint: 'c', product_name: 'Brand C Baby Hair Oil 100 ml', brand_name: 'Brand C', pack_normalized_key: '100:ml', price: 180, display_basis: 'PRICE_ONLY_FALLBACK', safety_determined: false, safety_score: null, profile_score: null },
    ],
  };

  const merged = mergeSearchResponses(core, discovery, { query: 'baby hair oil', limit: 10 });
  assert.equal(merged.selected_pack.normalized_key, '100:ml');
  assert.deepEqual(merged.products.map((p) => p.canonical_product_id), ['a', 'c']);
  assert.equal(merged.safest_product.canonical_product_id, 'a');
  assert.equal(merged.lowest_price_product.canonical_product_id, 'c');
  assert.equal(merged.best_value_product.canonical_product_id, 'a');
});
