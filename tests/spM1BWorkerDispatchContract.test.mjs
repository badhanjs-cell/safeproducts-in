import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const migrationPath = 'supabase/migrations/20260919152000_sp_m1br_worker_dispatch_v1.sql';

function migrationSource() {
  return existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
}

test('M1-BR queue-aware worker dispatch migration exists', () => {
  assert.equal(existsSync(migrationPath), true, `${migrationPath} must exist`);
});

test('dispatcher wakes only for eligible recovery work including stale locks', () => {
  const source = migrationSource();
  assert.match(source, /create\s+or\s+replace\s+function\s+sp_internal\.dispatch_m1br_if_pending_v1\s*\(\s*\)/i);
  assert.match(source, /sp_m1br_recovery_queue_v1/i);
  assert.match(source, /status\s+in\s*\(\s*'PENDING'\s*,\s*'RETRY'\s*\)/i);
  assert.match(source, /next_attempt_at\s*<=\s*now\s*\(\s*\)/i);
  assert.match(source, /(?:q\.)?attempt_count\s*<\s*(?:q\.)?max_attempts/i);
  assert.match(source, /status\s*=\s*'IN_PROGRESS'/i);
  assert.match(source, /locked_at\s*<\s*now\s*\(\s*\)\s*-\s*interval\s*'20 minutes'/i);
});

test('dispatcher reuses the secret-safe common Edge dispatcher and never embeds worker credentials', () => {
  const source = migrationSource();
  assert.match(source, /sp_internal\.dispatch_edge_worker_v1\s*\(\s*'M1BR_INGREDIENT_RECOVERY'\s*,\s*'sp-m1br-recovery-worker-v1'\s*\)/i);
  assert.doesNotMatch(source, /x-sp-worker-token/i);
  assert.doesNotMatch(source, /sp_internal\.worker_secret_v1/i);
  assert.doesNotMatch(source, /net\.http_post/i);
});

test('cron registration is idempotent, staggered, and does not expose dispatcher to public roles', () => {
  const source = migrationSource();
  assert.match(source, /sp_m1br_recovery_dispatch_v1/i);
  assert.match(source, /cron\.unschedule/i);
  assert.match(source, /cron\.schedule/i);
  assert.match(source, /7-59\/10 \* \* \* \*/);
  assert.match(source, /revoke\s+all\s+on\s+function\s+sp_internal\.dispatch_m1br_if_pending_v1\s*\(\s*\)\s+from\s+public/i);
  assert.doesNotMatch(source, /grant\s+execute[^;]+\b(?:anon|authenticated)\b/i);
});
