import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('discovery card reports queued, not-required, and not-staged identity review states distinctly', () => {
  const source = readFileSync('supabase/functions/sp-us2-discovery-v1/index.ts', 'utf8');
  assert.match(source, /staged\?\.review_required\s*===\s*true\s*\?\s*"IDENTITY_REVIEW_QUEUED"/);
  assert.match(source, /staged\?\.review_required\s*===\s*false\s*\?\s*"NOT_REQUIRED"/);
  assert.match(source, /IDENTITY_REVIEW_NOT_STAGED/);
});
