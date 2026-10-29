import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const MIGRATION = 'supabase/migrations/20260920213000_sp_m1b_gold_staging_v1.sql';

test('gold staging persistence is isolated, RLS-protected, and non-promoting', () => {
  const path = resolve(ROOT, MIGRATION);
  assert.equal(existsSync(path), true, `${MIGRATION} must exist`);
  const sql = readFileSync(path, 'utf8');

  assert.match(sql, /create table if not exists public\.sp_m1b_gold_staging_batch_v1/i);
  assert.match(sql, /create table if not exists public\.sp_m1b_gold_staging_item_v1/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /STAGED_NOT_PROMOTED/);
  assert.match(sql, /UNASSIGNED/);
  assert.match(sql, /promotion_allowed[^;]*false/is);
  assert.match(sql, /HUMAN_APPROVED_FOR_GOLD_STAGING/);
  assert.match(sql, /identity_decision[^;]*APPROVE/is);
  assert.match(sql, /ingredient_declaration_decision[^;]*APPROVE/is);
  assert.match(sql, /unique[^;]*batch_id[^;]*candidate_id/is);
  assert.match(sql, /unique[^;]*batch_id[^;]*benchmark_slot_id/is);
  assert.match(sql, /unique[^;]*batch_id[^;]*product_fingerprint/is);

  assert.match(sql, /create or replace function public\.sp_m1b_stage_gold_batch_v1\s*\(p_payload jsonb\)/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path/i);
  assert.match(sql, /REVIEW_PACKET_INCOMPLETE/);
  assert.match(sql, /HUMAN_APPROVAL_REQUIRED/);
  assert.match(sql, /DUPLICATE_PRODUCT_FINGERPRINT/);
  assert.match(sql, /revoke execute on function public\.sp_m1b_stage_gold_batch_v1\(jsonb\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.sp_m1b_stage_gold_batch_v1\(jsonb\) to service_role/i);

  assert.doesNotMatch(sql, /insert\s+into\s+public\.sp_catalog_/i);
  assert.doesNotMatch(sql, /update\s+public\.sp_catalog_/i);
  assert.doesNotMatch(sql, /sp_m1b_promote_after_display_v1/i);
  assert.doesNotMatch(sql, /safety_score|child_score|pregnancy_score|senior_score/i);
});
