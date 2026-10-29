import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const REPORTING_MIGRATION = 'supabase/migrations/20260921154000_sp_m1b_economy_reporting_v1.sql';

test('versioned economy report reads persisted metrics JSON and never converts unknown paid cost to zero', () => {
  assert.equal(existsSync(REPORTING_MIGRATION), true, 'economy reporting migration must exist');
  const sql = readFileSync(REPORTING_MIGRATION, 'utf8');
  assert.match(sql, /sp_m1b_get_report_v1/i);
  assert.match(sql, /a\.metrics\s*->>\s*'paid_model_calls'/i);
  assert.match(sql, /a\.metrics\s*->>\s*'provider_input_tokens'/i);
  assert.match(sql, /a\.metrics\s*->>\s*'provider_output_tokens'/i);
  assert.match(sql, /a\.metrics\s*->>\s*'provider_total_tokens'/i);
  assert.match(sql, /commerce_discovery_calls/i);
  assert.match(sql, /unknown_paid_cost_attempts/i);
  assert.match(sql, /m1br_cost_usd[\s\S]*then\s+null/i);
  assert.match(sql, /cost_per_recovery_usd[\s\S]*then\s+null/i);
  assert.match(sql, /sp_web_has_role_v1[\s\S]*admin/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path/i);
});

test('search orchestrator persists bounded commerce discovery telemetry on an existing M1-B run', () => {
  const source = readFileSync('supabase/functions/sp-m1b-search-v1/index.ts', 'utf8');
  assert.match(source, /commerceTelemetry/);
  assert.match(source, /p_stage:\s*"COMMERCE"/);
  assert.match(source, /commerce_discovery_calls/);
  assert.match(source, /paid_model_calls/);
  assert.match(source, /provider_input_tokens/);
  assert.match(source, /cost_usd/);
  assert.match(source, /sp_m1b_record_attempt_v1/);
});
