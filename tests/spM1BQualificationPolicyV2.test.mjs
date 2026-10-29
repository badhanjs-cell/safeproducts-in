import test from 'node:test';
import assert from 'node:assert/strict';
import {
  finalConfidence,
  qualifiesTrusted,
  passesRuntimeHardGatesV2,
  qualifiesOfficialV2,
  qualifiesTrustedV2,
  evidenceTierV2,
} from '../supabase/functions/sp-m1b-path-a-v1/qualification.mjs';

const base = {
  sourceAuthority: 96,
  identity: 100,
  completeness: 100,
  extraction: 98,
  freshness: 70,
  lineage: 100,
  corroboration: 0,
  conflictPenalty: 0,
  hardGates: {
    exactIdentity: true,
    packMarketResolved: true,
    completeDeclaration: true,
    notTruncated: true,
    provenanceComplete: true,
    extractionAcceptable: true,
    sufficientlyFresh: false,
    unresolvedConflict: false,
  },
};

test('v1 remains frozen while v2 accepts strong single-source runtime evidence', () => {
  assert.ok(finalConfidence(base) >= 80);
  assert.ok(finalConfidence(base) < 95);
  assert.equal(qualifiesTrusted(base), false, 'v1 trusted threshold must remain 95');
  assert.equal(passesRuntimeHardGatesV2(base), true);
  assert.equal(qualifiesTrustedV2(base), true);
});

test('v2 freshness is a confidence component, not a blocking gate', () => {
  assert.equal(base.hardGates.sufficientlyFresh, false);
  assert.equal(passesRuntimeHardGatesV2(base), true);
  assert.equal(qualifiesTrustedV2(base), true);
});

test('v2 preserves identity completeness provenance extraction and conflict hard gates', () => {
  for (const gate of [
    'exactIdentity',
    'packMarketResolved',
    'completeDeclaration',
    'notTruncated',
    'provenanceComplete',
    'extractionAcceptable',
  ]) {
    const candidate = { ...base, hardGates: { ...base.hardGates, [gate]: false } };
    assert.equal(passesRuntimeHardGatesV2(candidate), false, `${gate} must remain hard`);
    assert.equal(qualifiesTrustedV2(candidate), false);
    assert.equal(qualifiesOfficialV2(candidate), false);
  }
  const conflict = { ...base, hardGates: { ...base.hardGates, unresolvedConflict: true } };
  assert.equal(passesRuntimeHardGatesV2(conflict), false);
  assert.equal(qualifiesOfficialV2(conflict), false);
  assert.equal(qualifiesTrustedV2(conflict), false);
});

test('v2 evidence tier is independent from the safety score', () => {
  assert.equal(evidenceTierV2(94), 'HIGH');
  assert.equal(evidenceTierV2(90), 'HIGH');
  assert.equal(evidenceTierV2(89.999), 'MODERATE');
  assert.equal(evidenceTierV2(80), 'MODERATE');
  assert.equal(evidenceTierV2(79.999), 'LOW');
});

test('official v2 admission is scope-based while trusted structured evidence retains the runtime confidence floor', () => {
  const lowConfidenceButExactComplete = {
    ...base,
    sourceAuthority: 45,
    extraction: 55,
    freshness: 10,
    lineage: 50,
    corroboration: 0,
  };
  const score = finalConfidence(lowConfidenceButExactComplete);
  assert.ok(score < 80, 'fixture must prove official admission no longer depends on the numeric floor');
  assert.equal(passesRuntimeHardGatesV2(lowConfidenceButExactComplete), true);
  assert.equal(qualifiesOfficialV2(lowConfidenceButExactComplete), true);
  assert.equal(qualifiesTrustedV2(lowConfidenceButExactComplete), false);
  assert.equal(evidenceTierV2(score), 'LOW');
});
