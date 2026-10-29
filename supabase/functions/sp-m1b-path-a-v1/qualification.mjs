const clamp = (n) => Math.max(0, Math.min(100, Number.isFinite(Number(n)) ? Number(n) : 0));

export function finalConfidence(c) {
  return clamp(
    clamp(c.sourceAuthority) * 0.24 +
    clamp(c.identity) * 0.24 +
    clamp(c.completeness) * 0.20 +
    clamp(c.extraction) * 0.14 +
    clamp(c.freshness) * 0.08 +
    clamp(c.lineage) * 0.05 +
    clamp(c.corroboration) * 0.05 -
    clamp(c.conflictPenalty)
  );
}

// Frozen v1 benchmark/history gate. Do not relax in place.
export function passesHardGates(c) {
  const g = c?.hardGates ?? {};
  return g.exactIdentity === true &&
    g.packMarketResolved === true &&
    g.completeDeclaration === true &&
    g.notTruncated === true &&
    g.provenanceComplete === true &&
    g.extractionAcceptable === true &&
    g.sufficientlyFresh === true &&
    g.unresolvedConflict === false;
}

export function qualifiesOfficial(c) {
  return passesHardGates(c) && finalConfidence(c) >= 92;
}

export function qualifiesTrusted(c) {
  return passesHardGates(c) && finalConfidence(c) >= 95;
}

export function nextIngredientTierAfterOfficial(c) {
  return qualifiesOfficial(c) ? null : 'TRUSTED_STRUCTURED';
}

// Runtime-only successor policy. Freshness still contributes to confidence but
// does not by itself block an otherwise exact, complete and provenance-bound
// declaration. Genuine identity/completeness/provenance/conflict failures stay hard.
export function passesRuntimeHardGatesV2(c) {
  const g = c?.hardGates ?? {};
  return g.exactIdentity === true &&
    g.packMarketResolved === true &&
    g.completeDeclaration === true &&
    g.notTruncated === true &&
    g.provenanceComplete === true &&
    g.extractionAcceptable === true &&
    g.unresolvedConflict === false;
}

export function evidenceTierV2(value) {
  const score = clamp(value);
  if (score >= 90) return 'HIGH';
  if (score >= 80) return 'MODERATE';
  return 'LOW';
}

// Runtime official evidence is admitted by scope and hard provenance gates.
// The numeric confidence remains audit/consumer metadata; it is not a second
// arbitrary blocker after the exact official declaration has passed all gates.
export function qualifiesOfficialV2(c) {
  return passesRuntimeHardGatesV2(c);
}

// Approved trusted structured evidence retains the v2 confidence floor.
export function qualifiesTrustedV2(c) {
  return passesRuntimeHardGatesV2(c) && finalConfidence(c) >= 80;
}
