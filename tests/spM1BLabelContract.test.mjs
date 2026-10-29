import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(path) { return readFileSync(path, 'utf8'); }

test('M1-B label endpoint is bounded, exact-pack aware and fail-closed', () => {
  const edge = source('supabase/functions/sp-m1b-label-analyze-v2/index.ts');
  assert.match(edge, /CHECK_MY_LABEL/);
  assert.match(edge, /foreground_deadline_ms/i);
  assert.match(edge, /25_000|25000/);
  assert.match(edge, /ingredientImageSha256/);
  assert.match(edge, /frontImageSha256/);
  assert.match(edge, /pack_size_text/);
  assert.match(edge, /sp_m1b_enqueue_recovery_v1/);
  assert.match(edge, /DEEPER_VERIFICATION_IN_PROGRESS/);
});

test('server label adapter is feature gated and does not fall back when M1-B is enabled', () => {
  const adapter = source('src/lib/labels.functions.ts');
  assert.match(adapter, /SP_M1B_LABEL_ENABLED/);
  assert.match(adapter, /sp-m1b-label-analyze-v2/);
  assert.match(adapter, /25_000|25000/);
  assert.match(adapter, /safety_score:\s*null/);
});

test('pending label result cannot carry a numeric safety score', () => {
  const adapter = source('src/lib/labels.functions.ts');
  assert.match(adapter, /type PendingLabelResult/);
  assert.match(adapter, /safety_score:\s*null/);
  assert.match(adapter, /DEEPER_VERIFICATION_IN_PROGRESS/);
  assert.match(adapter, /CONFLICT_REQUIRES_REVIEW/);
});

test('Check My Label keeps non-scored unreadable/pending cases distinct from provisional numeric screening', () => {
  const route = source('src/routes/check-my-label.tsx');
  const pendingCard = source('src/components/LabelPendingResult.tsx');
  const renderedPendingSurface = `${route}\n${pendingCard}`;

  assert.match(route, /DEEPER_VERIFICATION_IN_PROGRESS/);
  assert.match(route, /LabelPendingResult/);
  assert.match(pendingCard, /Unable to finish this label analysis/i);
  assert.match(source("src/components/LabelQualifiedResult.tsx"), /PROVISIONAL SCREEN/);
  assert.match(pendingCard, /No Safety Score is shown for this pending result/i);
  assert.doesNotMatch(renderedPendingSurface, /PROVISIONAL — evidence research is still in progress/);
});
