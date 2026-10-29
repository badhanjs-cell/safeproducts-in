import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const SNAPSHOT = 'docs/architecture/sp-us2-make-acquisition-v1-1-sanitized.json';

function load() {
  assert.equal(existsSync(SNAPSHOT), true, 'sanitized Make v1.1 topology snapshot must exist');
  return JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
}

test('Make v1.1 topology is contract-versioned and remains inactive during qualification', () => {
  const blueprint = load();
  assert.equal(blueprint.scenario_id, 7613424);
  assert.equal(blueprint.contract_version, 'SP-US2-MAKE-ACQUISITION/1.1');
  assert.equal(blueprint.callback_contract_version, 'SP-US2-MAKE-CALLBACK/1.1');
  assert.equal(blueprint.expected_status_after_qualification, 'inactive');
});

test('specific acquisition has a hard ceiling of three provider calls and only one exact Stores call', () => {
  const blueprint = load();
  assert.deepEqual(blueprint.provider_budget.specific, {
    shopping_anchor_max: 1,
    immersive_stores_max: 1,
    shopping_alternatives_max: 1,
    total_provider_calls_max: 3,
  });
  assert.equal(blueprint.module_policy.exact_cluster_feeder_limit, 1);
  assert.deepEqual(blueprint.module_policy.removed_provider_fanout_modules.sort((a,b)=>a-b), [12,18,23,24]);
  assert.deepEqual(blueprint.module_policy.disabled_provider_fanout_modules ?? [], []);
});

test('category acquisition has one Shopping call, direct feeder-to-aggregator wiring, and no per-candidate Stores fan-out', () => {
  const blueprint = load();
  assert.deepEqual(blueprint.provider_budget.category, {
    shopping_category_max: 1,
    immersive_stores_max: 0,
    total_provider_calls_max: 1,
  });
  assert.deepEqual(blueprint.module_policy.category_execution_path, [4,16,27,17,19,20,21]);
  assert.equal(blueprint.module_policy.category_aggregator_feeder_module, 17);
  assert.equal(blueprint.direct_shopping_observations.require_https_merchant_page, true);
  assert.equal(blueprint.direct_shopping_observations.incomplete_observation_action, 'SKIP_RETURN_FEWER');
});

test('Make snapshot carries no safety, ingredient, review, Gold, HOLDOUT or verified-identity authority', () => {
  const text = readFileSync(SNAPSHOT, 'utf8').toLowerCase();
  for (const forbidden of [
    'safety_score', 'ingredients', 'ingredient_declaration', 'review_resolution',
    'benchmark_gold', 'holdout_state', 'identity_status":"verified', 'regulatory_approval',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});
