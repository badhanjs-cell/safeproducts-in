import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const spec = readFileSync('docs/superpowers/specs/2026-09-19-m1b-m1br-final-approved.md', 'utf8');
const migrationPath = 'supabase/migrations/20260919110000_sp_m1b_m1br_runtime_foundation_v1.sql';

function source(path) { return readFileSync(path, 'utf8'); }

test('M1-BR is automatic asynchronous ingredient-only recovery', () => {
  assert.match(spec, /automatic asynchronous ingredient-only recovery/i);
  assert.match(spec, /normal user search never waits for M1-BR/i);
  assert.match(spec, /does not redo display-image discovery, price extraction/i);
});

test('benchmark display precedes cache promotion', () => {
  const display = spec.indexOf('expose/display the newly qualified result');
  const promote = spec.indexOf('promote the qualified production-admissible');
  assert.ok(display >= 0 && promote > display);
});

test('runtime migration defines orchestration, recovery and display-before-promotion guards', () => {
  const sql = readFileSync(migrationPath, 'utf8');
  assert.match(sql, /create table if not exists public\.sp_m1b_run_v1/i);
  assert.match(sql, /create table if not exists public\.sp_m1b_engine_attempt_v1/i);
  assert.match(sql, /create table if not exists public\.sp_m1br_recovery_queue_v1/i);
  assert.match(sql, /sp_m1b_begin_run_v1/i);
  assert.match(sql, /sp_m1b_record_attempt_v1/i);
  assert.match(sql, /sp_m1b_enqueue_recovery_v1/i);
  assert.match(sql, /sp_m1br_claim_tasks_v1/i);
  assert.match(sql, /sp_m1br_complete_task_v1/i);
  assert.match(sql, /sp_m1b_get_report_v1/i);
  assert.match(sql, /sp_m1b_ack_benchmark_display_v1/i);
  assert.match(sql, /sp_m1b_promote_after_display_v1/i);
  assert.match(sql, /benchmark_sealed_at is null/i);
  assert.match(sql, /displayed_at is null/i);
  assert.match(sql, /BENCHMARK_DISPLAY_OR_SEAL_REQUIRED/i);
  assert.match(sql, /unique index[^;]+sp_m1br_recovery_queue_v1[^;]+run_id/is);
  assert.match(sql, /enable row level security/i);
});

test('admin ingredient recovery dashboard exposes required M1-B audit metrics', () => {
  const route = source('src/routes/admin.ingredient-recovery.tsx');
  for (const label of [
    'M1-B success rate',
    'M1-BR recovery rate',
    'Combined qualification rate',
    'M1-BR absolute lift',
    'Human review rate',
    'p50',
    'p95',
    'Cost per recovery',
  ]) assert.match(route, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  assert.match(route, /sp_m1b_get_report_v1/);
  assert.match(route, /sp_catalog_review_queue_v1/);
  assert.doesNotMatch(route, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
});

test('admin shell links to ingredient recovery audit', () => {
  const shell = source('src/components/admin/AdminShell.tsx');
  assert.match(shell, /\/admin\/ingredient-recovery/);
  assert.match(shell, /Ingredient Recovery/);
});

test('final certification CI runs the complete reproducible quality gate', () => {
  const workflow = source('.github/workflows/m1b-m1br-ci.yml');
  const pkg = JSON.parse(source('package.json'));
  assert.match(workflow, /bun run check:backend/);
  assert.match(workflow, /bun run typecheck/);
  assert.match(workflow, /bun run lint:m1b/);
  assert.match(workflow, /bun run build/);
  assert.match(workflow, /python tools\/m1a\/test_benchmark\.py/);
  assert.match(workflow, /pytest test_runner\.py test_report\.py -q/);
  assert.match(workflow, /pytest test_app\.py -q/);
  assert.equal(pkg.scripts.typecheck, 'tsc --noEmit');
  assert.match(pkg.scripts['lint:m1b'], /^eslint /);
  assert.equal(pkg.scripts.lint, 'eslint .');
});
