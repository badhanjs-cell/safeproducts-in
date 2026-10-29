import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('paid product discovery finishes inside the v2 outer discovery budget so free results survive slow providers', () => {
  const source = readFileSync('supabase/functions/sp-us2-discovery-v1/index.ts', 'utf8');
  const paidCall = source.indexOf('https://api.openai.com/v1/responses');
  assert.ok(paidCall >= 0, 'paid discovery call must exist');
  const paidWindow = source.slice(paidCall, paidCall + 2500);
  assert.match(paidWindow, /AbortSignal\.timeout\(8000\)/, 'provider call must stop at 8s inside the ~10.5s outer discovery budget');
  assert.doesNotMatch(paidWindow, /AbortSignal\.timeout\(18000\)/);
});
