import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const runtimeEnv = readFileSync('.env', 'utf8');
const exampleEnv = readFileSync('.env.example', 'utf8');
const serverAdapter = readFileSync('src/lib/productSearch.functions.ts', 'utf8');

test('Lovable runtime explicitly enables qualified SP-US2 search and keeps legacy Make search disabled', () => {
  assert.match(runtimeEnv, /^SP_M1B_SEARCH_ENABLED="true"$/m);
  assert.match(runtimeEnv, /^SP_PROD1_SEARCH_ENABLED="false"$/m);
  assert.match(serverAdapter, /const route = selectSearchRoute\(runtime\)/);
  assert.match(serverAdapter, /route !== "LEGACY_MAKE"\) return unavailable\("NOT_QUALIFIED"\)/);
});

test('environment template documents the same safe search rollout flags', () => {
  assert.match(exampleEnv, /^SP_M1B_SEARCH_ENABLED="true"$/m);
  assert.match(exampleEnv, /^SP_PROD1_SEARCH_ENABLED="false"$/m);
});
