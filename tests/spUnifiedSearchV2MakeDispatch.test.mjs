import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const DISPATCHER = 'supabase/functions/sp-us2-make-dispatch-v1/index.ts';

function source() {
  assert.equal(existsSync(DISPATCHER), true, 'internal Make dispatcher must exist');
  return readFileSync(DISPATCHER, 'utf8');
}

// Missing flag may fall back to a valid configured webhook; explicit false remains the kill-switch.
test('Make dispatcher is internal-authenticated, rollout-gated, HTTPS-only, and claims only launch 1.1 work', () => {
  const text = source();
  assert.match(text, /x-us2-internal-key/i);
  assert.match(text, /constantTimeEqual/);
  assert.match(text, /SP_US2_MAKE_ACQUISITION_ENABLED/);
  assert.match(text, /flag === ["']true["']/);
  assert.match(text, /flag !== ["']false["'] && webhookUrl !== null/);
  assert.match(text, /MAKE_ACQUISITION_WEBHOOK_URL/);
  assert.match(text, /protocol\s*!==\s*["']https:["']/);
  assert.match(text, /username|password/);
  assert.match(text, /sp_us2_claim_acquisition_v1_1/);
  assert.match(text, /sp_us2_finish_acquisition_v1/);
});

test('Make dispatcher sends one bounded versioned 1.1 job and never sends server or callback credentials as job data', () => {
  const text = source();
  assert.match(text, /SP-US2-MAKE-ACQUISITION\/1\.1/);
  assert.match(text, /\/functions\/v1\/sp-us2-make-callback-v1/);
  assert.match(text, /requested_pack_key/);
  assert.match(text, /comparison_pack_key/);
  assert.match(text, /market_country_code:\s*["']IN["']/);
  assert.match(text, /currency:\s*["']INR["']/);
  assert.match(text, /AbortSignal\.timeout\(8000\)/);
  assert.equal((text.match(/fetch\(webhookUrl/g) ?? []).length, 1, 'one claimed request must cause at most one Make webhook POST');
  assert.doesNotMatch(text, /SP_US2_MAKE_CALLBACK_KEY/);
  const bodyStart = text.indexOf('const jobPayload');
  const postStart = text.indexOf('fetch(webhookUrl');
  assert.ok(bodyStart >= 0 && postStart > bodyStart);
  const jobSection = text.slice(bodyStart, postStart).toLowerCase();
  const forbiddenJobMarkers = [
    ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_'),
    ['SUPABASE', 'SECRET', 'KEYS'].join('_'),
    ['sb', 'secret', ''].join('_'),
    'callback_key',
    'service_role',
  ];
  for (const marker of forbiddenJobMarkers) {
    assert.equal(jobSection.includes(marker.toLowerCase()), false, `job payload must not contain ${marker}`);
  }
});

test('Make dispatcher records transient delivery as RETRY, terminal delivery/configuration as FAILED, and stays acquisition-only', () => {
  const text = source();
  assert.match(text, /RETRY/);
  assert.match(text, /FAILED/);
  assert.match(text, /408|429/);
  assert.match(text, />=\s*500|status\s*>?=\s*500/);
  assert.match(text, /DISPATCHED/);
  assert.match(text, /sp_us2_claim_acquisition_v1_1/);
  assert.match(text, /sp_us2_finish_acquisition_v1/);
  assert.doesNotMatch(text, /sp_catalog_safety_assessment_v1|sp_catalog_ingredient_evidence_v1|sp_catalog_product_ingredient_v1|benchmark_gold|holdout/i);
});
