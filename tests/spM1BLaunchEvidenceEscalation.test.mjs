import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const PATH_A = 'supabase/functions/sp-m1b-path-a-v1/index.ts';
const RECOVERY = 'supabase/functions/sp-m1br-recovery-worker-v1/index.ts';
const HUMAN = 'supabase/migrations/20260921114500_sp_m1b_qualification_policy_v2_human_recovery_v2.sql';
const ROUTE = 'src/routes/admin.ingredient-recovery.tsx';
const SNAPSHOT = 'docs/architecture/sp-m1b-launch-evidence-boundary.json';

const read = (path) => readFileSync(path, 'utf8');

test('launch evidence boundary snapshot is frozen and keeps Make outside safety authority', () => {
  assert.equal(existsSync(SNAPSHOT), true, 'launch evidence boundary snapshot must exist');
  const policy = JSON.parse(read(SNAPSHOT));
  assert.deepEqual(policy.evidence_order, ['OFFICIAL', 'TRUSTED_STRUCTURED', 'M1BR_OCR_VLM', 'HUMAN_REVIEW']);
  assert.equal(policy.official_complete_stops_escalation, true);
  assert.equal(policy.commerce_acquisition_can_score, false);
  assert.equal(policy.image_presence_is_eligibility_gate, false);
  assert.equal(policy.image_only_paid_search, false);
});

test('Path A prefers qualified official evidence and stops before M1-BR recovery', () => {
  const source = read(PATH_A);
  const official = source.indexOf('candidate.official && qualifiesOfficialV2');
  const trusted = source.indexOf('candidate.trust && qualifiesTrustedV2');
  assert.ok(official >= 0 && trusted > official, 'official evidence must be selected before trusted evidence');
  assert.match(source, /official_early_stop\s*=\s*ingredient_status\s*===\s*"QUALIFIED"[\s\S]{0,120}chosen\?\.official\s*===\s*true/);
  assert.match(source, /SUFFICIENT_OFFICIAL_EVIDENCE/);
  assert.doesNotMatch(source, /PRIMARY_OCR|SECONDARY_OCR_IF_NEEDED|VLM_RESCUE_IF_NEEDED/);
});

test('trusted structured evidence remains behind official and under qualification gates', () => {
  const source = read('supabase/functions/sp-m1b-path-a-v1/qualification.mjs');
  assert.match(source, /qualifiesTrustedV2/);
  assert.match(source, /passesRuntimeHardGatesV2\(c\)\s*&&\s*finalConfidence\(c\)\s*>=\s*80/);
  assert.match(source, /unresolvedConflict\s*===\s*false/);
  assert.match(source, /completeDeclaration\s*===\s*true/);
  assert.match(source, /provenanceComplete\s*===\s*true/);
});

test('OCR and VLM exist only in M1-BR escalation and uncertainty terminates in human review', () => {
  const recovery = read(RECOVERY);
  const order = [
    'BROADER_TRUSTED_DISCOVERY',
    'INGREDIENT_IMAGE_DISCOVERY',
    'PRIMARY_OCR',
    'SECONDARY_OCR_IF_NEEDED',
    'OCR_RECONCILIATION',
    'VLM_RESCUE_IF_NEEDED',
    'FINAL_EVIDENCE_QUALIFICATION',
  ].map((token) => recovery.indexOf(`"${token}"`));
  assert.ok(order.every((index) => index >= 0));
  assert.deepEqual([...order].sort((a,b)=>a-b), order, 'recovery stages must remain low-cost-first');
  assert.match(recovery, /CONFLICT_REQUIRES_REVIEW|ADMIN_REVIEW|HUMAN_REVIEW/i);
  assert.match(recovery, /Do not search for price or display images/i);
});

test('human reviewer validates evidence while backend computes score; no manual numeric score input exists', () => {
  const sql = read(HUMAN);
  const route = read(ROUTE);
  assert.match(sql, /sp_m1b_submit_human_recovery_v2/i);
  assert.match(sql, /sp_m1b_score_qualified_product_v1/i);
  assert.match(route, /Validate & Recalculate/);
  assert.doesNotMatch(route, /manual[_ -]?safety[_ -]?score/i);
  assert.doesNotMatch(sql, /p_(?:manual_)?safety_score\s+(?:numeric|integer|double|real)/i);
});

test('images remain optional presentation assets and never trigger image-only paid discovery', () => {
  const pathA = read(PATH_A);
  assert.match(pathA, /never make a separate image-only search/i);
  assert.match(pathA, /Image and price are independent commerce assets and never safety evidence/i);
  const imagePolicy = read('supabase/functions/sp-m1b-path-a-v1/image-policy.mjs');
  assert.match(imagePolicy, /chooseDisplayImage/);
});
