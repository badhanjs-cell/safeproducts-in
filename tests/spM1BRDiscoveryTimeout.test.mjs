import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync('supabase/functions/sp-m1br-recovery-worker-v1/index.ts', 'utf8');

test('M1-BR broader trusted discovery allows slow provider search without changing other bounded stages', () => {
  assert.match(worker, /const WEB_DISCOVERY_TIMEOUT_MS\s*=\s*75000/);
  assert.match(worker, /broaderDiscovery[\s\S]*AbortSignal\.timeout\(WEB_DISCOVERY_TIMEOUT_MS\)/);
  assert.match(worker, /PRIMARY_OCR_[\s\S]*AbortSignal\.timeout\(30000\)/);
  assert.match(worker, /M1BR_VLM_[\s\S]*AbortSignal\.timeout\(45000\)/);
});
