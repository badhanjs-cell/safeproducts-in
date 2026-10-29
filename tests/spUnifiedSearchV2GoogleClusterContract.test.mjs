import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const EDGE = 'supabase/functions/sp-us2-google-cluster-v1/index.ts';
const POLICY = 'supabase/functions/sp-us2-google-cluster-v1/google-cluster-policy.mjs';
const PROBE = 'supabase/functions/sp-us2-google-cluster-probe-v1/index.ts';

function source() {
  assert.equal(existsSync(EDGE), true, 'Google cluster acquisition Edge Function must exist');
  return readFileSync(EDGE, 'utf8');
}

test('internal cluster acquisition requires POST and constant-time internal authentication', () => {
  const src = source();
  assert.match(src, /req\.method\s*!==\s*["']POST["']/);
  assert.match(src, /x-us2-internal-key/i);
  assert.match(src, /constantTimeEqual|constant_time|\bct\s*\(/);
  assert.match(src, /INTERNAL_AUTH_REQUIRED/);
  assert.doesNotMatch(src, /Access-Control-Allow-Origin[^\n]*\*/i);
});

test('controlled production probe relay is worker-token authenticated and fixed to the qualified NIVEA 100 ml case', () => {
  assert.equal(existsSync(PROBE), true, 'Google cluster controlled probe relay must exist');
  const src = readFileSync(PROBE, 'utf8');
  assert.match(src, /x-sp-worker-token/i);
  assert.match(src, /sp_internal_worker_token_valid_v1/);
  assert.match(src, /US2_GOOGLE_CLUSTER_PROBE/);
  assert.match(src, /0b479259-06ab-4c7c-ab09-98011f1d544e/);
  assert.match(src, /NIVEA MEN/i);
  assert.match(src, /Deep Comfort After Shave Lotion/i);
  assert.match(src, /100:ml/);
  assert.match(src, /sp-us2-google-cluster-v1/);
  assert.match(src, /x-us2-internal-key/i);
  assert.doesNotMatch(src, /SP_US2_SERPAPI_API_KEY/);
  assert.doesNotMatch(src, /Access-Control-Allow-Origin[^\n]*\*/i);
});

test('SerpApi credential remains server-side and missing credential fails open without throwing search', () => {
  const src = source();
  assert.match(src, /Deno\.env\.get\(["']SP_US2_SERPAPI_API_KEY["']\)/);
  assert.match(src, /SERPAPI_KEY_UNAVAILABLE/);
  assert.doesNotMatch(src, /console\.(?:log|info|warn|error)\([^\n]*SERPAPI/i);
  assert.doesNotMatch(src, /api_key\s*:\s*["'][^"']+["']/i);
  assert.doesNotMatch(src, /throw\s+new\s+Error\([^\n]*SERPAPI_KEY_UNAVAILABLE/i);
});

test('provider sequence is one Shopping call then at most one Immersive Stores call with caching preserved', () => {
  const src = source();
  assert.match(src, /engine[^\n]*google_shopping/i);
  assert.match(src, /engine[^\n]*google_immersive_product/i);
  assert.match(src, /more_stores[^\n]*true/i);
  assert.match(src, /AbortSignal\.timeout/);
  assert.match(src, /shoppingCalls\s*=\s*1|shopping_calls/);
  assert.match(src, /storesCalls\s*=\s*1|stores_calls/);
  assert.doesNotMatch(src, /no_cache[^\n]*(?:true|1)/i);
  assert.doesNotMatch(src, /while\s*\(|for\s*\([^\n]*cluster/i, 'must not fan out across multiple product clusters');
});

test('cluster path stages commerce only through the existing protected staging RPC', () => {
  const src = source();
  assert.match(src, /sp_us2_stage_commerce_offer_v1/);
  assert.match(src, /observed_source_urls/);
  assert.match(src, /market_country_code[^\n]*IN/);
  assert.match(src, /currency[^\n]*INR/);
  assert.match(src, /exact_product_match[^\n]*true/);
  assert.match(src, /variant_match[^\n]*true/);
  assert.match(src, /exact_pack_match/);
  assert.match(src, /confidence/);
  assert.doesNotMatch(src, /(?:insert\s+into|update\s+|delete\s+from)\s+(?:public\.)?sp_catalog_commerce_offer_v1/i);
});

test('cluster acquisition remains safety and identity-authority blind', () => {
  const src = source();
  for (const forbidden of [
    'sp_catalog_safety_assessment_v1',
    'sp_catalog_ingredient_evidence_v1',
    'sp_catalog_product_ingredient_v1',
    'benchmark_gold',
    'holdout',
  ]) {
    assert.doesNotMatch(src, new RegExp(forbidden, 'i'));
  }
  assert.doesNotMatch(src, /identity_status\s*:\s*["']VERIFIED["']/i);
});

test('canonical exact offers are read before and after staging and response exposes bounded cost telemetry', () => {
  const src = source();
  const occurrences = [...src.matchAll(/sp_us2_exact_offers_v1/g)].length;
  assert.ok(occurrences >= 1, 'must read canonical exact offers through the existing RPC');
  assert.match(src, /exactBefore|exact_before/);
  assert.match(src, /exactAfter|exact_after/);
  assert.match(src, /residualShortfall|residual_shortfall/);
  assert.match(src, /storesObserved|stores_observed/);
  assert.match(src, /storesAccepted|stores_accepted/);
  assert.match(src, /storesStaged|stores_staged/);
  assert.match(src, /latency_ms/);
});

test('provider and staging failures use explicit fail-open reason vocabulary', () => {
  const src = source();
  for (const reason of [
    'SHOPPING_TIMEOUT',
    'SHOPPING_PROVIDER_ERROR',
    'NO_QUALIFIED_CLUSTER',
    'CLUSTER_TOKEN_MISSING',
    'STORES_TIMEOUT',
    'STORES_PROVIDER_ERROR',
    'NO_QUALIFIED_STORES',
    'PARTIAL_STORE_COVERAGE',
    'STAGING_REJECTED',
  ]) {
    assert.match(src, new RegExp(reason));
  }
});

test('Edge Function delegates all product-cluster and store validation to the pure policy module', () => {
  const src = source();
  assert.equal(existsSync(POLICY), true);
  assert.match(src, /selectGoogleProductCluster/);
  assert.match(src, /normalizeClusterStores/);
  assert.match(src, /clusterAcquisitionNeed/);
});
