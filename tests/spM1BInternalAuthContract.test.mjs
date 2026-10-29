import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pathA = readFileSync('supabase/functions/sp-m1b-path-a-v1/index.ts', 'utf8');
const recovery = readFileSync('supabase/functions/sp-m1br-recovery-worker-v1/index.ts', 'utf8');
const search = readFileSync('supabase/functions/sp-m1b-search-v1/index.ts', 'utf8');

test('Path A requires the server-only internal M1-B header before doing paid work', () => {
  assert.match(pathA, /x-m1b-internal-key/i);
  assert.match(pathA, /INTERNAL_AUTH_REQUIRED/);
  assert.match(pathA, /constantTimeEqual|secureEqual/);
});

test('M1-BR preserves its dedicated backend-validated worker token before recovery work', () => {
  assert.match(recovery, /x-sp-worker-token/i);
  assert.match(recovery, /sp_internal_worker_token_valid_v1/);
  assert.match(recovery, /WORKER_AUTH_REQUIRED/);
  const authCheck = recovery.indexOf('sp_internal_worker_token_valid_v1');
  const openAiCheck = recovery.indexOf('OPENAI_NOT_CONFIGURED');
  const claim = recovery.indexOf('sp_m1br_claim_tasks_v1', authCheck);
  assert.ok(authCheck >= 0 && openAiCheck > authCheck && claim > authCheck);
});

test('foreground search calls Path A with the internal key rather than an anonymous bearer token', () => {
  assert.match(search, /x-m1b-internal-key/i);
  assert.match(search, /adminKey\(\)/);
  assert.doesNotMatch(search, /Authorization:\s*`Bearer \$\{anon\}`/);
});
