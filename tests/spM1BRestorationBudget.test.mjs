import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const v2 = readFileSync('supabase/functions/sp-us2-search-v2/index.ts','utf8');
const v3 = readFileSync('supabase/functions/sp-us2-search-v3/index.ts','utf8');

test('restored M1B acquisition window preserves bounded overall deadline',()=>{
  assert.match(v2,/Math\.min\(22000, Math\.max\(5000, overallDeadline - 6500\)\)/);
  const budget=(overall)=>Math.min(22000,Math.max(5000,overall-6500));
  assert.equal(budget(28000),21500);
  assert.equal(budget(16000),9500);
  assert.equal(budget(8000),5000);
});

test('specific-pack searches receive larger window without disabling qualification',()=>{
  assert.match(v3,/restorationCoreWindowMs=\(requestedPackKey\|\|String\(input\.search_mode/);
  assert.match(v3,/\?28000:16000/);
  assert.match(v3,/foreground_deadline_ms:restorationCoreWindowMs/);
  assert.match(v3,/AbortSignal\.timeout\(restorationCoreWindowMs\+2000\)/);
  assert.match(v3,/restoration_core_window_ms:restorationCoreWindowMs/);
  assert.match(v3,/finalizeSpecificResults/);
  assert.match(v3,/applySafetyRows/);
});
