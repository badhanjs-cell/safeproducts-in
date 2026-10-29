import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const MIGRATION = 'supabase/migrations/20260922203000_sp_us2_paid_discovery_budget_v1.sql';
const WORKER = 'supabase/functions/sp-us2-discovery-v1/index.ts';

test('paid discovery is protected by a service-role-only query cooldown and global hourly/daily caps', () => {
  assert.equal(existsSync(MIGRATION), true, 'paid discovery budget migration must exist');
  const sql = readFileSync(MIGRATION, 'utf8');

  assert.match(sql, /sp_us2_paid_discovery_budget_v1/i);
  assert.match(sql, /sp_us2_claim_paid_discovery_v1/i);
  assert.match(sql, /v_query_limit\s+integer\s*:=\s*1/i);
  assert.match(sql, /v_hour_limit\s+integer\s*:=\s*60/i);
  assert.match(sql, /v_day_limit\s+integer\s*:=\s*500/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /QUERY_COOLDOWN/i);
  assert.match(sql, /GLOBAL_HOUR_LIMIT/i);
  assert.match(sql, /GLOBAL_DAY_LIMIT/i);
  assert.match(sql, /revoke all on function public\.sp_us2_claim_paid_discovery_v1\(text\)/i);
  assert.match(sql, /grant execute on function public\.sp_us2_claim_paid_discovery_v1\(text\) to service_role/i);
  assert.doesNotMatch(sql, /grant execute on function public\.sp_us2_claim_paid_discovery_v1\(text\) to (?:anon|authenticated|public)/i);
});

test('discovery worker claims budget before any paid provider request and fails closed to free results when denied', () => {
  const source = readFileSync(WORKER, 'utf8');
  const claimAt = source.indexOf('sp_us2_claim_paid_discovery_v1');
  const providerAt = source.indexOf('https://api.openai.com/v1/responses');
  assert.ok(claimAt >= 0, 'worker must claim paid discovery budget');
  assert.ok(providerAt > claimAt, 'budget claim must precede provider request');
  assert.match(source, /budgetClaim\.ok[\s\S]*budgetClaim\.data\?\.allowed\s*===\s*true/);
  assert.match(source, /paid_discovery_budget_reason/);
  assert.match(source, /cost_usd:\s*null/);
});
