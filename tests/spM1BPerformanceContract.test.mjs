import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migrationPath = 'supabase/migrations/20260919161000_sp_m1b_runtime_performance_hotfix_v1.sql';

function source(path) {
  return readFileSync(path, 'utf8');
}

test('M1-B runtime performance hotfix covers recovery product FK', () => {
  const sql = source(migrationPath);
  assert.match(sql, /create index if not exists\s+sp_m1br_recovery_queue_v1_product_idx/i);
  assert.match(sql, /on\s+public\.sp_m1br_recovery_queue_v1\s*\(\s*product_id\s*,\s*created_at\s+desc\s*\)/i);
});

test('M1-B admin-read RLS policies cache auth context once per statement', () => {
  const sql = source(migrationPath);
  for (const policy of [
    'sp_m1b_run_admin_read_v1',
    'sp_m1b_attempt_admin_read_v1',
    'sp_m1br_queue_admin_read_v1',
  ]) {
    assert.match(sql, new RegExp(`create policy\\s+${policy}`, 'i'));
  }
  assert.match(sql, /\(select\s+auth\.jwt\(\)\)/i);
  assert.match(sql, /\(select\s+auth\.uid\(\)\)/i);
  assert.match(sql, /sp_web_has_role_v1\s*\(\s*\(select\s+auth\.uid\(\)\)/i);
});
