import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migrationPath = 'supabase/migrations/20260920224500_sp_m1b_benchmark_execution_v1.sql';
const runnerPath = 'supabase/functions/sp-m1b-benchmark-runner-v1/index.ts';

function read(path) {
  assert.equal(fs.existsSync(path), true, `${path} must exist`);
  return fs.readFileSync(path, 'utf8');
}

test('benchmark execution persistence is gold-bound, RLS-protected, and non-publishing', () => {
  const sql = read(migrationPath);
  for (const marker of [
    'sp_m1b_benchmark_execution_batch_v1',
    'sp_m1b_benchmark_execution_item_v1',
    'sp_m1b_create_benchmark_execution_v1',
    'sp_m1b_claim_benchmark_execution_item_v1',
    'sp_m1b_record_benchmark_path_a_v1',
    'sp_m1b_reconcile_benchmark_execution_v1',
    'sp_m1b_dispatch_benchmark_recovery_v1',
    'M1B_BENCHMARK_EXECUTOR',
    'publication_allowed boolean not null default false',
    'runtime_promotion_allowed boolean not null default false',
    'enable row level security',
  ]) assert.match(sql, new RegExp(marker, 'i'));
  assert.match(sql, /grant execute on function public\.sp_m1b_create_benchmark_execution_v1\(uuid\) to service_role/i);
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete|all).*to\s+(anon|authenticated)/i);
  assert.doesNotMatch(sql, /sp_catalog_safety_assessment_v1\s+(set|values|update|insert|delete)/i);
  assert.doesNotMatch(sql, /ingredient_declaration\s+text/i, 'execution tables must not copy gold ingredient truth');
});

test('benchmark runner executes production Path A without receiving gold ingredients', () => {
  const src = read(runnerPath);
  assert.match(src, /M1B_BENCHMARK_EXECUTOR/);
  assert.match(src, /sp_internal_worker_token_valid_v1/);
  assert.match(src, /sp_m1b_claim_benchmark_execution_item_v1/);
  assert.match(src, /sp_m1b_begin_run_v1/);
  assert.match(src, /context:\s*['"]BENCHMARK['"]/);
  assert.match(src, /sp-m1b-path-a-v1/);
  assert.match(src, /benchmark_mode:\s*true/);
  assert.match(src, /sp_m1b_record_benchmark_path_a_v1/);
  assert.match(src, /sp_m1b_dispatch_benchmark_recovery_v1/);
  assert.match(src, /sp_m1b_reconcile_benchmark_execution_v1/);
  assert.doesNotMatch(src, /gold_ingredients|ingredient_declaration/);
  assert.doesNotMatch(src, /sp_catalog_(product|ingredient|safety|commerce)/);
  assert.doesNotMatch(src, /sp_m1b_promote_after_display_v1/);
});
