import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const MIGRATION = 'supabase/migrations/20260920220000_sp_m1b_benchmark_gold_v1.sql';

test('benchmark gold promotion is qualification-gated, isolated, immutable, and non-publishing', () => {
  const path = resolve(ROOT, MIGRATION);
  assert.equal(existsSync(path), true, `${MIGRATION} must exist`);
  const sql = readFileSync(path, 'utf8');

  assert.match(sql, /create table if not exists public\.sp_m1b_gold_qualification_v1/i);
  assert.match(sql, /create table if not exists public\.sp_m1b_benchmark_gold_batch_v1/i);
  assert.match(sql, /create table if not exists public\.sp_m1b_benchmark_gold_item_v1/i);
  assert.match(sql, /QUALIFIED_FOR_BENCHMARK_GOLD/);
  assert.match(sql, /BENCHMARK_GOLD/);
  assert.match(sql, /publication_allowed[^;]*false/is);
  assert.match(sql, /runtime_promotion_allowed[^;]*false/is);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /unique[^;]*staging_batch_id/is);
  assert.match(sql, /unique[^;]*source_staging_item_id/is);

  assert.match(sql, /create or replace function public\.sp_m1b_qualify_benchmark_gold_v1\s*\(p_staging_batch_id uuid\)/i);
  assert.match(sql, /create or replace function public\.sp_m1b_promote_benchmark_gold_v1\s*\(p_staging_batch_id uuid\)/i);
  assert.match(sql, /STAGING_BATCH_NOT_FOUND/);
  assert.match(sql, /STAGING_BATCH_STATE_INVALID/);
  assert.match(sql, /STAGING_ITEM_COUNT_MISMATCH/);
  assert.match(sql, /STAGING_DUPLICATE_CANDIDATE/);
  assert.match(sql, /STAGING_DUPLICATE_SLOT/);
  assert.match(sql, /STAGING_DUPLICATE_FINGERPRINT/);
  assert.match(sql, /BLOCKED_CANDIDATE_STAGED/);
  assert.match(sql, /STAGING_HUMAN_APPROVAL_INVALID/);
  assert.match(sql, /STAGING_EVIDENCE_INVALID/);
  assert.match(sql, /GOLD_QUALIFICATION_REQUIRED/);

  assert.match(sql, /revoke execute on function public\.sp_m1b_qualify_benchmark_gold_v1\(uuid\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.sp_m1b_qualify_benchmark_gold_v1\(uuid\) to service_role/i);
  assert.match(sql, /revoke execute on function public\.sp_m1b_promote_benchmark_gold_v1\(uuid\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.sp_m1b_promote_benchmark_gold_v1\(uuid\) to service_role/i);

  assert.doesNotMatch(sql, /insert\s+into\s+public\.sp_catalog_/i);
  assert.doesNotMatch(sql, /update\s+public\.sp_catalog_/i);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.sp_catalog_/i);
  assert.doesNotMatch(sql, /sp_m1b_promote_after_display_v1/i);
  assert.doesNotMatch(sql, /safety_score|child_score|pregnancy_score|senior_score/i);
  assert.doesNotMatch(sql, /update\s+public\.sp_m1b_gold_staging_/i);
});
