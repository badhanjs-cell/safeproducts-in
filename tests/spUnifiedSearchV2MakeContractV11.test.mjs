import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const MIGRATION = 'supabase/migrations/20260929180000_sp_us2_make_acquisition_contract_v1_1.sql';
const LEGACY_MIGRATION = 'supabase/migrations/20260923011000_sp_us2_make_acquisition_queue_v1.sql';
const DOC = 'docs/integrations/make/sp-us2-acquisition-v1.1.md';
const CONTRACT = 'tools/sp_us2/make_acquisition_contract_v1_1.json';
const SEARCH = 'supabase/functions/sp-us2-search-v2/index.ts';
const DISPATCHER = 'supabase/functions/sp-us2-make-dispatch-v1/index.ts';

function read(path) {
  assert.equal(existsSync(path), true, `${path} must exist`);
  return readFileSync(path, 'utf8');
}

function lowerJson(value) {
  return JSON.stringify(value).toLowerCase();
}

test('acquisition 1.1 is additive, version-tagged, service-role-only, and preserves frozen 1.0 RPCs', () => {
  const legacy = read(LEGACY_MIGRATION);
  const migration = read(MIGRATION);

  assert.match(legacy, /sp_us2_enqueue_acquisition_v1\s*\(/);
  assert.match(legacy, /sp_us2_claim_acquisition_v1\s*\(/);
  assert.match(legacy, /sp_us2_finish_acquisition_v1\s*\(/);

  assert.match(migration, /add\s+column\s+(?:if\s+not\s+exists\s+)?contract_version/i);
  assert.match(migration, /SP-US2-MAKE-ACQUISITION\/1\.0/);
  assert.match(migration, /sp_us2_enqueue_acquisition_v1_1\s*\(/);
  assert.match(migration, /sp_us2_claim_acquisition_v1_1\s*\(/);
  assert.match(migration, /SP-US2-MAKE-ACQUISITION\/1\.1/);
  assert.match(migration, /comparison_pack_key/i);
  assert.match(migration, /service_role/i);
  assert.match(migration, /revoke\s+all[\s\S]*anon/i);
  assert.match(migration, /revoke\s+all[\s\S]*authenticated/i);

  assert.match(migration, /dedupe[\s\S]{0,900}contract_version|contract_version[\s\S]{0,900}dedupe/i);
  assert.match(migration, /where[\s\S]{0,700}contract_version\s*=\s*['"]SP-US2-MAKE-ACQUISITION\/1\.1['"]/i);
});

test('1.1 documentation and machine contract freeze IN/INR, strict packs, bounded targets, and no authority secrets', () => {
  const doc = read(DOC);
  const contract = JSON.parse(read(CONTRACT));

  assert.match(doc, /SP-US2-MAKE-ACQUISITION\/1\.1/);
  assert.match(doc, /explicit pack[\s\S]{0,180}(?:immutable|never|no substitution)/i);
  assert.match(doc, /SPECIFIC_PRODUCT/);
  assert.match(doc, /CATEGORY/);
  assert.match(doc, /5\s+exact/i);
  assert.match(doc, /5\s+(?:distinct[- ]brand\s+)?alternatives?/i);
  assert.match(doc, /10\s+(?:genuine\s+)?products?/i);
  assert.match(doc, /India|\bIN\b/);
  assert.match(doc, /INR/);

  assert.equal(contract.version, 'SP-US2-MAKE-ACQUISITION/1.1');
  assert.equal(contract.request_example.market_country_code, 'IN');
  assert.equal(contract.request_example.currency, 'INR');
  assert.equal(contract.request_example.search_mode, 'SPECIFIC_PRODUCT');
  assert.equal(contract.request_example.requested_pack_key, '100:ml');
  assert.equal(contract.request_example.comparison_pack_key, null);
  assert.ok(contract.request_example.target_exact_offers >= 0 && contract.request_example.target_exact_offers <= 5);
  assert.ok(contract.request_example.target_alternatives >= 0 && contract.request_example.target_alternatives <= 5);
  assert.equal(contract.callback_example.contract_version, 'SP-US2-MAKE-CALLBACK/1.1');

  const flattened = lowerJson(contract);
  for (const forbidden of [
    'service_role_key', 'supabase_secret_keys', 'callback_key', 'authorization', 'apikey',
    'safety_score', 'profile_score', 'ingredient_evidence', 'recommendation_class',
    'regulatory_status', 'best_value_product', 'verified_identity', 'benchmark_gold', 'holdout',
  ]) assert.equal(flattened.includes(forbidden), false, `1.1 machine contract must not contain ${forbidden}`);
});

test('launch search enqueues successor semantics and keeps explicit requested pack distinct from no-pack comparison pack', () => {
  const source = read(SEARCH);
  assert.match(source, /sp_us2_enqueue_acquisition_v1_1/);
  assert.doesNotMatch(source, /rest\/v1\/rpc\/sp_us2_enqueue_acquisition_v1["'`]/);
  assert.match(source, /p_requested_pack_key/);
  assert.match(source, /p_comparison_pack_key/);
  assert.match(source, /parsePackKeyFromText\(query\)/);
  assert.match(source, /comparison_pack_key/);
  assert.match(source, /Deno\.env\.get\(["']SP_US2_MAKE_ACQUISITION_ENABLED["']\)\s*!==\s*["']true["']/);
});

test('dispatcher claims only 1.1 work and emits one bounded credential-free 1.1 job', () => {
  const source = read(DISPATCHER);
  assert.match(source, /sp_us2_claim_acquisition_v1_1/);
  assert.match(source, /SP-US2-MAKE-ACQUISITION\/1\.1/);
  assert.match(source, /requested_pack_key/);
  assert.match(source, /comparison_pack_key/);
  assert.match(source, /market_country_code:\s*["']IN["']/);
  assert.match(source, /currency:\s*["']INR["']/);
  assert.match(source, /SP_US2_MAKE_ACQUISITION_ENABLED/);
  assert.equal((source.match(/fetch\(webhookUrl/g) ?? []).length, 1, 'one claim may cause at most one Make webhook POST');

  const payloadStart = source.indexOf('const jobPayload');
  const postStart = source.indexOf('fetch(webhookUrl');
  assert.ok(payloadStart >= 0 && postStart > payloadStart);
  const payload = source.slice(payloadStart, postStart).toLowerCase();
  for (const forbidden of ['service_role', 'callback_key', 'supabase_secret_keys', 'authorization', 'apikey']) {
    assert.equal(payload.includes(forbidden), false, `dispatcher job payload must not contain ${forbidden}`);
  }
});
