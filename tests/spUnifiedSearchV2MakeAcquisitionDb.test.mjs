import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const MIGRATION = 'supabase/migrations/20260923011000_sp_us2_make_acquisition_queue_v1.sql';

function sql() {
  assert.equal(existsSync(MIGRATION), true, 'Make acquisition migration must exist');
  return readFileSync(MIGRATION, 'utf8');
}

test('Make acquisition queue is additive, RLS protected, and service-role only', () => {
  const source = sql();
  assert.match(source, /create\s+table\s+if\s+not\s+exists\s+public\.sp_us2_acquisition_request_v1/i);
  for (const field of [
    'id uuid primary key',
    'normalized_query text',
    'search_mode text',
    'anchor_product_id uuid',
    'dedupe_key text',
    'requested_pack_key text',
    'category text',
    'target_exact_offers integer',
    'target_alternatives integer',
    'status text',
    'attempt_count integer',
    'max_attempts integer',
    'next_attempt_at timestamptz',
    'dispatched_at timestamptz',
    'completed_at timestamptz',
    'last_error_code text',
    'payload jsonb',
    'result_summary jsonb',
    'created_at timestamptz',
    'updated_at timestamptz',
  ]) {
    assert.match(source, new RegExp(field.replaceAll(' ', '\\s+'), 'i'), `missing acquisition field: ${field}`);
  }
  assert.match(source, /alter\s+table\s+public\.sp_us2_acquisition_request_v1\s+enable\s+row\s+level\s+security/i);
  for (const role of ['public', 'anon', 'authenticated']) {
    assert.match(source, new RegExp(`revoke\\s+all\\s+on\\s+(?:table\\s+)?public\\.sp_us2_acquisition_request_v1\\s+from\\s+${role}`, 'i'));
  }
  assert.match(source, /create\s+unique\s+index[\s\S]*sp_us2_acquisition_request_v1[\s\S]*dedupe_key[\s\S]*where[\s\S]*status[\s\S]*(?:PENDING|DISPATCHING|DISPATCHED|RETRY)/i);
});

test('enqueue, claim, and finish RPCs enforce bounded acquisition without external HTTP', () => {
  const source = sql();
  for (const fn of [
    'sp_us2_enqueue_acquisition_v1',
    'sp_us2_claim_acquisition_v1',
    'sp_us2_finish_acquisition_v1',
  ]) {
    assert.match(source, new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}`, 'i'));
    assert.match(source, new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]*?from\\s+public`, 'i'));
    assert.match(source, new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]*?from\\s+anon`, 'i'));
    assert.match(source, new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]*?from\\s+authenticated`, 'i'));
    assert.match(source, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]*?to\\s+service_role`, 'i'));
  }

  assert.ok((source.match(/security\s+definer/gi) ?? []).length >= 3, 'all acquisition RPCs must be SECURITY DEFINER');
  assert.ok((source.match(/set\s+search_path/gi) ?? []).length >= 3, 'all acquisition RPCs must use a fixed search_path');
  assert.match(source, /pg_advisory_xact_lock/i);
  assert.match(source, /interval\s+'6 hours'/i);
  assert.match(source, /v_hour_limit\s+integer\s*:=\s*60/i);
  assert.match(source, /v_day_limit\s+integer\s*:=\s*500/i);
  assert.match(source, /max_attempts\s+integer\s+not\s+null\s+default\s+3/i);
  for (const reason of ['QUEUED', 'ACTIVE_REQUEST_EXISTS', 'QUERY_COOLDOWN', 'GLOBAL_HOUR_LIMIT', 'GLOBAL_DAY_LIMIT']) {
    assert.match(source, new RegExp(reason, 'i'));
  }
  assert.match(source, /for\s+update\s+skip\s+locked/i);
  assert.match(source, /status\s+in\s*\(\s*'PENDING'\s*,\s*'RETRY'\s*\)/i);
  assert.match(source, /status\s*=\s*'DISPATCHING'/i);
  assert.match(source, /attempt_count\s*=\s*[^,;\n]*attempt_count\s*\+\s*1/i);
  for (const status of ['DISPATCHED', 'COMPLETED', 'RETRY', 'FAILED']) {
    assert.match(source, new RegExp(`'${status}'`, 'i'));
  }
  assert.doesNotMatch(source, /(?:net\.|pg_net|http_post|http_get|https?:\/\/)/i, 'database queue must not perform external HTTP');
});

test('Make acquisition persistence cannot write safety, ingredient, benchmark-gold, or holdout truth', () => {
  const source = sql();
  for (const forbidden of [
    'sp_catalog_safety_assessment_v1',
    'sp_catalog_product_ingredient_v1',
    'sp_catalog_ingredient_evidence_v1',
    'sp_m1b_benchmark_gold',
    'holdout',
  ]) {
    const writePattern = new RegExp(`(?:insert\\s+into|update|delete\\s+from)\\s+(?:public\\.)?${forbidden}`, 'i');
    assert.doesNotMatch(source, writePattern, `acquisition queue must not mutate ${forbidden}`);
  }
});
