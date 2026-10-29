import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const POLICY = '../supabase/functions/sp-m1b-search-v1/query-policy.mjs';
const MIGRATION = 'supabase/migrations/20260923010000_sp_us2_pack_aware_candidate_search_v1.sql';
const SPEC = 'docs/superpowers/specs/2026-09-23-safeproducts-make-commerce-discovery-qualification-design.md';

test('identity query removes only recognized pack expressions and preserves product strength', async () => {
  const policy = await import(POLICY);
  assert.equal(typeof policy.identityQuery, 'function', 'identityQuery must be exported');
  assert.equal(policy.identityQuery('TATA 1mg Tejasya Ashwagandha 60 Capsules'), 'tata 1mg tejasya ashwagandha');
  assert.equal(policy.identityQuery('Brand X Baby Lotion 0.2 L'), 'brand x baby lotion');
  assert.equal(policy.identityQuery('Brand X Baby Soap 75 gm'), 'brand x baby soap');
  assert.equal(policy.identityQuery('Vitamin A 5000 IU 30 capsules'), 'vitamin a 5000 iu');
  assert.equal(policy.identityQuery('baby hair oil'), 'baby hair oil');
});

test('versioned candidate search keeps original query but matches identity on a pack-free query', () => {
  assert.equal(existsSync(MIGRATION), true, 'pack-aware candidate-search migration must exist');
  const sql = readFileSync(MIGRATION, 'utf8');

  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.sp_m1b_search_catalog_candidates_v1/i);
  assert.match(sql, /v_query\s+text\s*:=\s*lower\(btrim\(coalesce\(p_query,''\)\)\)/i);
  assert.match(sql, /v_identity_query\s+text/i);
  assert.match(sql, /regexp_replace\([\s\S]*capsules\?[\s\S]*'gi'/i);
  assert.match(sql, /regexp_replace\(v_identity_query\s*,\s*'\[\[:space:\]\]\+'\s*,\s*' '\s*,\s*'g'\)/i);
  assert.match(sql, /lower\(p\.product_name\)\s*=\s*v_identity_query/i);
  assert.match(sql, /lower\(p\.brand_name\s*\|\|\s*' '\s*\|\|\s*p\.product_name\)\s*=\s*v_identity_query/i);
  assert.match(sql, /like\s+'%'\s*\|\|\s*v_identity_query\s*\|\|\s*'%'/i);
  assert.match(sql, /'query'\s*,\s*v_query/i);

  for (const field of [
    'pack_size_text',
    'pack_normalized_value',
    'pack_normalized_unit',
    'pack_normalized_key',
    'pack_is_official_default',
    'pack_source_kind',
    'strict_safety',
  ]) {
    assert.match(sql, new RegExp(field, 'i'), `migration must preserve ${field}`);
  }

  assert.match(sql, /p\.is_active\s*=\s*true/i);
  assert.match(sql, /p\.market_country_code\s*=\s*'IN'/i);
  assert.match(sql, /p\.identity_status\s*=\s*'VERIFIED'/i);
  assert.match(sql, /v_category\s+in\s*\('\s*'\s*,\s*'ALL'\)/i);
});

test('approved design freezes the exact launch search objective', () => {
  const spec = readFileSync(SPEC, 'utf8');
  assert.match(spec, /\*\*Status:\*\*\s+APPROVED\s*\/\s*FROZEN\s+2026-09-23/i);
  assert.match(spec, /##\s+Frozen Search Objective/i);
  assert.match(spec, /specific\s*=\s*up to 5 exact same-product\/same-pack merchant offers \+ up to 5 distinct-brand same-pack alternatives/i);
  assert.match(spec, /generic\/category\s*=\s*6[–-]10 distinct genuine products using one comparable normalized pack/i);
  assert.match(spec, /never mix packs, duplicate results, or fabricate records to fill counts/i);
});
