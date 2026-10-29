import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const MIGRATION = 'supabase/migrations/20260925010000_sp_us2_make_candidate_reuse_v1.sql';
const CALLBACK = 'supabase/functions/sp-us2-make-callback-v1/index.ts';
const DISCOVERY = 'supabase/functions/sp-us2-discovery-v1/index.ts';
const POLICY = 'supabase/functions/sp-us2-discovery-v1/discovery-policy.mjs';
const ORCHESTRATOR = 'supabase/functions/sp-us2-search-v2/index.ts';

test('acquisition-correlated candidate may bypass query-token relevance while ordinary candidates may not', async () => {
  const { prepareDiscoveryProducts } = await import('../supabase/functions/sp-us2-discovery-v1/discovery-policy.mjs');
  const candidate = {
    name: '100 ml Jermyn Street Collection Aftershave Lotion',
    product_name: '100 ml Jermyn Street Collection Aftershave Lotion',
    brand: 'Taylor of Old Bond Street',
    brand_name: 'Taylor of Old Bond Street',
    category: 'after shave lotion',
    source_url: 'https://merchant.example/jermyn-aftershave-100ml',
    price: 6720,
    currency: 'INR',
    pack_size_text: '100 ml',
    pack_normalized_key: '100:ml',
  };

  const query = 'nivea men deep comfort after shave lotion 100 ml';
  const ordinary = prepareDiscoveryProducts([candidate], { queryText: query, requestedPackKey: '100:ml', limit: 10 });
  assert.equal(ordinary.products.length, 0, 'uncorrelated alternative must still fail normal token relevance');

  const correlated = prepareDiscoveryProducts([
    { ...candidate, acquisition_correlated: true },
  ], { queryText: query, requestedPackKey: '100:ml', limit: 10 });
  assert.equal(correlated.products.length, 1, 'server-correlated acquisition alternative must survive token relevance');
  assert.equal(correlated.products[0].brand_name, 'Taylor of Old Bond Street');
  assert.equal(correlated.products[0].pack_normalized_key, '100:ml');
});

test('specific discovery reuses original and generalized acquisition cache queries once each', async () => {
  const policy = await import('../supabase/functions/sp-us2-discovery-v1/discovery-policy.mjs');
  assert.equal(typeof policy.acquisitionReuseQueries, 'function', 'reuse-query helper must be exported');
  if (typeof policy.acquisitionReuseQueries !== 'function') return;

  assert.deepEqual(
    policy.acquisitionReuseQueries(
      'nivea men deep comfort after shave lotion 100 ml',
      'after shave lotion',
    ),
    ['nivea men deep comfort after shave lotion 100 ml', 'after shave lotion'],
  );
  assert.deepEqual(
    policy.acquisitionReuseQueries('after shave lotion', 'after shave lotion'),
    ['after shave lotion'],
    'identical specific/general queries must not duplicate the reuse RPC',
  );

  const discovery = readFileSync(DISCOVERY, 'utf8');
  assert.match(discovery, /acquisitionReuseQueries/);
  assert.match(discovery, /sp_us2_recent_acquisition_results_v1/);
  assert.match(discovery, /reuseQueries/);
  assert.match(discovery, /p_query:\s*reuseQuery/);
});

test('recent Make acquisition reuse RPC is bounded, candidate-only, commerce-backed, and service-role only', () => {
  assert.equal(existsSync(MIGRATION), true, 'Make candidate reuse migration must exist');
  const sql = readFileSync(MIGRATION, 'utf8');

  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.sp_us2_recent_acquisition_results_v1/i);
  assert.match(sql, /sp_us2_acquisition_request_v1/i);
  assert.match(sql, /status\s*=\s*'COMPLETED'/i);
  assert.match(sql, /interval\s+'6 hours'/i);
  assert.match(sql, /result_summary\s*->\s*'candidate_product_ids'/i);
  assert.match(sql, /identity_status\s*=\s*'CANDIDATE'/i);
  assert.match(sql, /source_origin\s*=\s*'SEARCH'/i);
  assert.match(sql, /sp_catalog_commerce_offer_v1/i);
  assert.match(sql, /verified\s*=\s*true/i);
  assert.match(sql, /currency[^\n]*INR/i);
  assert.match(sql, /market_country_code[^\n]*IN/i);
  assert.match(sql, /exact_pack_match\s*=\s*true/i);
  assert.match(sql, /acquisition_correlated/i);
  assert.match(sql, /revoke\s+all\s+on\s+function\s+public\.sp_us2_recent_acquisition_results_v1[\s\S]*from\s+anon/i);
  assert.match(sql, /revoke\s+all\s+on\s+function\s+public\.sp_us2_recent_acquisition_results_v1[\s\S]*from\s+authenticated/i);
  assert.match(sql, /grant\s+execute\s+on\s+function\s+public\.sp_us2_recent_acquisition_results_v1[\s\S]*to\s+service_role/i);
  for (const forbidden of ['sp_catalog_safety_assessment_v1', 'sp_catalog_product_ingredient_v1', 'sp_catalog_ingredient_evidence_v1', 'sp_m1b_benchmark_gold', 'holdout']) {
    assert.doesNotMatch(sql, new RegExp(`(?:insert\\s+into|update|delete\\s+from)\\s+(?:public\\.)?${forbidden}`, 'i'));
  }
});

test('callback retains bounded candidate ids and discovery consumes recent acquisition results before paid discovery', () => {
  const callback = readFileSync(CALLBACK, 'utf8');
  const discovery = readFileSync(DISCOVERY, 'utf8');
  const policy = readFileSync(POLICY, 'utf8');
  const orchestrator = readFileSync(ORCHESTRATOR, 'utf8');

  assert.match(callback, /candidateProductIds/);
  assert.match(callback, /candidate_product_ids\s*:/);
  assert.match(discovery, /sp_us2_recent_acquisition_results_v1/);
  assert.match(discovery, /acquisitionRows/);
  assert.match(discovery, /acquisitionQuery/);
  assert.match(discovery, /p_query:/);
  assert.match(discovery, /\.\.\.acquisitionRows[\s\S]*\.\.\.\(resilience\.ok/);
  assert.match(policy, /acquisition_correlated\s*===\s*true/);
  assert.match(orchestrator, /acquisition_query:\s*query/);

  assert.doesNotMatch(callback, /identity_status\s*:\s*["']VERIFIED["']/i);
  assert.doesNotMatch(discovery, /sp_catalog_safety_assessment_v1/);
  assert.doesNotMatch(discovery, /sp_catalog_product_ingredient_v1/);
});