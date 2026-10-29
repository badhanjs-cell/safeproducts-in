import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pathA = readFileSync('supabase/functions/sp-m1b-path-a-v1/index.ts', 'utf8');
const recovery = readFileSync('supabase/functions/sp-m1br-recovery-worker-v1/index.ts', 'utf8');
const commerce = readFileSync('supabase/functions/sp-us2-commerce-v1/index.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260921143000_sp_unified_search_safety_commerce_v2.sql', 'utf8');

test('Path A records provider usage and explicit paid-stage telemetry without inventing monetary cost', () => {
  assert.match(pathA, /paid_model_calls/);
  assert.match(pathA, /provider_input_tokens/);
  assert.match(pathA, /provider_output_tokens/);
  assert.match(pathA, /provider_total_tokens/);
  assert.match(pathA, /official_early_stop/);
  assert.match(pathA, /provider_usage/);
  assert.match(pathA, /cost_usd:\s*null/);
  assert.match(pathA, /ingredient_status\s*!==\s*"QUALIFIED"[\s\S]*sp_m1b_enqueue_recovery_v1/);
  assert.match(pathA, /never make a separate image-only search/i);
});

test('M1-BR records paid web, OCR, VLM and provider token usage and preserves lower-cost escalation order', () => {
  assert.match(recovery, /paid_model_calls/);
  assert.match(recovery, /provider_input_tokens/);
  assert.match(recovery, /provider_output_tokens/);
  assert.match(recovery, /provider_total_tokens/);
  assert.match(recovery, /provider_usage/);
  assert.match(recovery, /cost_usd/);
  assert.ok(recovery.indexOf('structuredQualification') < recovery.indexOf('imageQualification'));
  assert.ok(recovery.indexOf('primaryOcr') < recovery.indexOf('secondaryOcr'));
  assert.ok(recovery.indexOf('secondaryOcr') < recovery.indexOf('vlmExtract'));
  assert.match(recovery, /sq\.status==="QUALIFIED"[\s\S]*else\{await record[\s\S]*imageQualification/);
});

test('commerce is cache-first and exposes bounded paid discovery and provider usage with unknown cost left null', () => {
  assert.match(commerce, /CACHE_SUFFICIENT/);
  assert.match(commerce, /cache_hit/);
  assert.match(commerce, /commerce_discovery_calls/);
  assert.match(commerce, /paid_model_calls/);
  assert.match(commerce, /provider_input_tokens/);
  assert.match(commerce, /provider_output_tokens/);
  assert.match(commerce, /provider_total_tokens/);
  assert.match(commerce, /provider_usage/);
  assert.match(commerce, /cost_usd:\s*null/);
  const webCalls = commerce.match(/tools:\s*\[\{type:\s*"web_search"\}\]/g) ?? [];
  assert.ok(webCalls.length <= 1, 'commerce must use at most one bounded paid web-search configuration');
  assert.doesNotMatch(commerce, /image[_ -]?only/i);
});

test('reporting preserves unknown monetary cost after paid calls instead of silently reporting zero', () => {
  assert.match(migration, /unknown_paid_cost_attempts/i);
  assert.match(migration, /provider_input_tokens/i);
  assert.match(migration, /provider_output_tokens/i);
  assert.match(migration, /provider_total_tokens/i);
  assert.match(migration, /paid_model_calls/i);
  assert.match(migration, /commerce_discovery_calls/i);
  assert.match(migration, /m1br_cost_usd[\s\S]*null/i);
  assert.match(migration, /sp_m1b_get_report_v1/i);
});
