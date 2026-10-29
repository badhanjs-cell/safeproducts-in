import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const MIGRATION = 'supabase/migrations/20260923012000_sp_us2_make_commerce_stage_v1.sql';
const PACK_GUARD_HOTFIX = 'supabase/migrations/20260928073000_sp_us2_exact_offer_pack_guard_v1.sql';

function source() {
  assert.equal(existsSync(MIGRATION), true, 'Make commerce staging migration must exist');
  return readFileSync(MIGRATION, 'utf8');
}

function packGuardHotfixSource() {
  assert.equal(existsSync(PACK_GUARD_HOTFIX), true, 'exact-offer pack guard hotfix migration must exist');
  return readFileSync(PACK_GUARD_HOTFIX, 'utf8');
}

test('Make commerce staging is service-role-only and delegates only after strict validation', () => {
  const sql = source();
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.sp_us2_stage_commerce_offer_v1\s*\(\s*p_payload\s+jsonb\s*\)/i);
  assert.match(sql, /security\s+definer/i);
  assert.match(sql, /set\s+search_path/i);
  assert.match(sql, /sp_us2_upsert_commerce_offer_v1/i);
  assert.match(sql, /revoke\s+all\s+on\s+function\s+public\.sp_us2_stage_commerce_offer_v1\(jsonb\)\s+from\s+public/i);
  assert.match(sql, /revoke\s+all\s+on\s+function\s+public\.sp_us2_stage_commerce_offer_v1\(jsonb\)\s+from\s+anon/i);
  assert.match(sql, /revoke\s+all\s+on\s+function\s+public\.sp_us2_stage_commerce_offer_v1\(jsonb\)\s+from\s+authenticated/i);
  assert.match(sql, /grant\s+execute\s+on\s+function\s+public\.sp_us2_stage_commerce_offer_v1\(jsonb\)\s+to\s+service_role/i);
});

test('Make commerce staging enforces canonical identity, India INR, HTTPS observed provenance, exact product/variant/pack, price and trust floor', () => {
  const sql = source();
  assert.match(sql, /sp_catalog_product_v1/i);
  assert.match(sql, /PRODUCT_NOT_FOUND/i);
  assert.match(sql, /market_country_code/i);
  assert.match(sql, /(?:MARKET|INDIA)[_A-Z]*INVALID|INDIA_MARKET_REQUIRED/i);
  assert.match(sql, /currency/i);
  assert.match(sql, /INR/i);
  assert.match(sql, /source_url/i);
  assert.match(sql, /\^https:\/\//i);
  assert.match(sql, /observed_source_urls/i);
  assert.match(sql, /jsonb_array_elements_text/i);
  assert.match(sql, /SOURCE[_A-Z]*(?:NOT_OBSERVED|PROVENANCE)/i);
  assert.match(sql, /exact_product_match/i);
  assert.match(sql, /EXACT_PRODUCT_REQUIRED/i);
  assert.match(sql, /variant_match/i);
  assert.match(sql, /VARIANT_MATCH_REQUIRED/i);
  assert.match(sql, /requested_pack_key/i);
  assert.match(sql, /exact_pack_match/i);
  assert.match(sql, /EXACT_PACK_REQUIRED|PACK_MISMATCH/i);
  assert.match(sql, /pack_size_text/i);
  assert.match(sql, /(?:ml|millilit)[\s\S]*(?:kg|kilogram)[\s\S]*(?:capsules|tablets|count)/i);
  assert.match(sql, /price/i);
  assert.match(sql, /PRICE_INVALID/i);
  assert.match(sql, /confidence/i);
  assert.match(sql, /(?:<\s*90|>=\s*90)/i);
});

test('Make commerce staging canonicalizes source page identity, dedupes same product/merchant/pack/page and preserves verified offers', () => {
  const sql = source();
  assert.match(sql, /regexp_replace\([^\n]*source_url[^\n]*[?#]/i);
  assert.match(sql, /source_domain/i);
  assert.match(sql, /merchant_name/i);
  assert.match(sql, /pack_normalized_key/i);
  assert.match(sql, /existing_verified_preserved/i);
  assert.match(sql, /verified/i);
  assert.match(sql, /offer_id/i);
});

test('Make commerce staging remains safety- and ingredient-blind', () => {
  const sql = source();
  for (const table of [
    'sp_catalog_safety_assessment_v1',
    'sp_catalog_ingredient_evidence_v1',
    'sp_catalog_product_ingredient_v1',
  ]) {
    assert.doesNotMatch(sql, new RegExp(`(?:insert\\s+into|update|delete\\s+from)\\s+(?:public\\.)?${table}`, 'i'));
  }
  assert.doesNotMatch(sql, /benchmark_gold|holdout/i);
});

test('offer-level exact-pack evidence survives the legacy product-pack guard without weakening unknown-pack protection', () => {
  const sql = packGuardHotfixSource();
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.sp_catalog_commerce_pack_guard_v1\s*\(\s*\)/i);
  assert.match(sql, /v_product_pack\s+is\s+null/i);
  assert.match(sql, /coalesce\(new\.exact_pack_match\s*,\s*false\)\s*=\s*true/i);
  assert.match(sql, /nullif\(btrim\(new\.pack_normalized_key\)\s*,\s*''\)\s+is\s+not\s+null/i);
  assert.match(sql, /new\.pack_normalized_value\s*>\s*0/i);
  assert.match(sql, /new\.pack_normalized_unit\s+in\s*\(\s*'ml'\s*,\s*'g'\s*,\s*'count'\s*\)/i);
  assert.match(sql, /new\.offer_confidence\s*>=\s*90/i);
  assert.match(sql, /new\.source_url\s*~\s*'\^https:\/\/'/i);
  assert.match(sql, /not\s+v_offer_pack_qualified/i);
  assert.match(sql, /Consumer price verification withheld because the exact product pack size is not yet known/i);
  assert.match(sql, /where\s+verified\s*=\s*false[\s\S]*exact_pack_match\s*=\s*true[\s\S]*pack_normalized_key\s+is\s+not\s+null/i);
  assert.doesNotMatch(sql, /sp_catalog_safety_assessment_v1|sp_catalog_product_ingredient_v1|benchmark_gold|holdout/i);
});