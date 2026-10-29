import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  finalConfidence,
  qualifiesOfficial,
  qualifiesTrusted,
  nextIngredientTierAfterOfficial,
} from '../supabase/functions/sp-m1b-path-a-v1/qualification.mjs';
import { normalizeSearchResponse } from '../src/lib/searchContract.ts';

const official = {
  sourceAuthority: 100,
  identity: 98,
  completeness: 100,
  extraction: 98,
  freshness: 95,
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
    sufficientlyFresh: true,
    unresolvedConflict: false,
  },
};

test('official evidence qualifies and stops lower ingredient tiers', () => {
  assert.ok(finalConfidence(official) >= 92);
  assert.equal(qualifiesOfficial(official), true);
  assert.equal(nextIngredientTierAfterOfficial(official), null);
});

test('trusted evidence uses stricter 95 threshold and all hard gates', () => {
  const trusted = { ...official, sourceAuthority: 95, identity: 100, freshness: 100, corroboration: 100 };
  assert.ok(finalConfidence(trusted) >= 95);
  assert.equal(qualifiesTrusted(trusted), true);
  assert.equal(qualifiesTrusted({ ...trusted, hardGates: { ...trusted.hardGates, completeDeclaration: false } }), false);
});

test('conflict always disables early stop', () => {
  const conflicting = {
    ...official,
    conflictPenalty: 0,
    hardGates: { ...official.hardGates, unresolvedConflict: true },
  };
  assert.equal(qualifiesOfficial(conflicting), false);
});

test('runtime Path A uses declaration scope rather than ingredient count and records evidence early-stop', () => {
  const source = readFileSync('supabase/functions/sp-m1b-path-a-v1/index.ts', 'utf8');
  assert.match(source, /ingredients\.length\s*>\s*0/);
  assert.match(source, /SUFFICIENT_OFFICIAL_EVIDENCE/);
  assert.match(source, /SUFFICIENT_TRUSTED_EVIDENCE/);
  assert.match(source, /evidence_stop_reason/);
  assert.match(source, /let\s+recovery_enqueued\s*=\s*false/);
  assert.match(source, /if\s*\(ingredient_status\s*!==\s*["']QUALIFIED["']\)/);
  assert.match(source, /recovery_enqueued:\s*ingredient_status\s*===\s*["']QUALIFIED["']\s*\?\s*false\s*:\s*recovery_enqueued/);
});

test('independent image and commerce lanes never create a safety score', () => {
  const path = 'supabase/functions/sp-m1b-path-a-v1/index.ts';
  const source = readFileSync(path, 'utf8');
  assert.match(source, /image_saved/i);
  assert.match(source, /commerce_saved/i);
  assert.match(source, /sp_m1b_enqueue_recovery_v1/i);
  assert.doesNotMatch(source, /sp_catalog_safety_assessment_v1/i);
  assert.doesNotMatch(source, /safety_score\s*:/i);
});

test('M1-BR worker is ingredient-only and contains bounded escalation stages', () => {
  const source = readFileSync('supabase/functions/sp-m1br-recovery-worker-v1/index.ts', 'utf8');
  for (const stage of [
    'BROADER_TRUSTED_DISCOVERY',
    'INGREDIENT_IMAGE_DISCOVERY',
    'PRIMARY_OCR',
    'SECONDARY_OCR_IF_NEEDED',
    'OCR_RECONCILIATION',
    'VLM_RESCUE_IF_NEEDED',
    'FINAL_EVIDENCE_QUALIFICATION',
  ]) assert.match(source, new RegExp(stage));
  assert.match(source, /sp_m1br_apply_ingredient_result_v1/);
  assert.match(source, /sp_m1br_complete_task_v1/);
  assert.doesNotMatch(source, /sp_catalog_apply_web_enrichment_v1/);
  assert.doesNotMatch(source, /sp_catalog_commerce_offer_v1/);
  assert.doesNotMatch(source, /is_primary_display/);
});

test('M1-B foreground search is bounded and never waits for M1-BR', () => {
  const source = readFileSync('supabase/functions/sp-m1b-search-v1/index.ts', 'utf8');
  assert.match(source, /sp-m1b-path-a-v1/);
  assert.match(source, /foreground_deadline_ms/i);
  assert.match(source, /m1br_queued_count/i);
  assert.doesNotMatch(source, /sp-m1br-recovery-worker-v1/);
  assert.doesNotMatch(source, /sp_m1br_claim_tasks_v1/);
});

test('qualified Path A results pass a strict regulatory gate and enter SAFETY_QUALIFIED lane', () => {
  const source = readFileSync('supabase/functions/sp-m1b-search-v1/index.ts', 'utf8');
  assert.match(source, /pathA\.ingredient_status\s*===\s*["']QUALIFIED["']/);
  assert.match(source, /sp_m1b_score_qualified_product_v1/);
  assert.match(source, /score_available/);
  assert.match(source, /SAFETY_QUALIFIED/);
  assert.match(source, /ingredient_qualification_decision:\s*["']QUALIFIED["']/);
});

test('M1-B price-only fallback preserves no-score invariant and audit metadata', () => {
  const fallback = {
    product_fingerprint: 'm1b-fallback-1',
    product_name: 'Synthetic fallback',
    brand_name: 'Fixture',
    category: 'Hair Care',
    offer_merchant: 'Fixture merchant',
    price: 199,
    price_text: '₹199',
    currency: 'INR',
    original_product_url: 'https://example.com/p',
    image_url: 'https://example.com/i.png',
    safety_score: null,
    profile_score: null,
    child_score: null,
    pregnancy_score: null,
    senior_score: null,
    display_basis: 'PRICE_ONLY_FALLBACK',
    safety_determined: false,
    safety_status_label: 'Safety analysis pending',
    safety_unavailable_reason: 'M1-B foreground deadline reached',
    ingredient_qualification_decision: 'NOT_QUALIFIED',
    engine: 'M1-B',
    recovery_status: 'QUEUED',
  };
  const envelope = {
    status: 'PRICE_ONLY_FALLBACK_READY',
    profile: 'ALL',
    products: [fallback],
    safest_product: null,
    lowest_price_product: fallback,
    best_value_product: null,
    price_fallback_count: 1,
    safety_qualified_count: 0,
    fallback_safety_claim: false,
    trust_promise: null,
    trust_promise_display_required: false,
    consumer_notice: 'Safety analysis is still pending.',
    ranking_version: 'C2-v6.0-SP-PROD-H4.6',
    m1b_meta: { run_id: '00000000-0000-0000-0000-000000000001', engine: 'M1-B', m1br_queued_count: 1, foreground_latency_ms: 25000 },
  };
  const result = normalizeSearchResponse(envelope, 'all');
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].safety_score, null);
  assert.equal(result.results[0].profile_score, null);
  assert.equal(result.results[0].engine, 'M1-B');
  assert.equal(result.results[0].recovery_status, 'QUEUED');
  assert.equal(result.m1bMeta?.m1br_queued_count, 1);

  const unsafe = structuredClone(envelope);
  unsafe.products[0].safety_score = 71;
  assert.equal(normalizeSearchResponse(unsafe, 'all').status, 'INVALID_RESPONSE');
});

test('server search adapter is explicitly feature-gated to M1-B with no legacy fallback when enabled', () => {
  const source = readFileSync('src/lib/productSearch.functions.ts', 'utf8');
  assert.match(source, /selectSearchRoute\(runtime\)/);
  assert.match(source, /route === "M1B"\) return callM1BSearch/);
});
