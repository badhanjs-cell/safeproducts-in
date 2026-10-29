import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migrationPath = 'supabase/migrations/20260921155000_sp_unified_search_pack_resolution_v2.sql';

test('unified v2 persistence adds canonical and offer pack metadata with least-privilege read RPCs', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  assert.match(sql, /alter\s+table\s+public\.sp_catalog_product_v1/i);
  assert.match(sql, /pack_is_official_default\s+boolean\s+not\s+null\s+default\s+false/i);
  assert.match(sql, /pack_source_kind\s+text/i);

  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.sp_us2_exact_offers_v1/i);
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.sp_m1b_search_catalog_candidates_v1/i);
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.sp_us2_category_cards_v1/i);
  assert.match(sql, /set\s+search_path\s+to\s+'pg_catalog',\s*'public'/i);

  assert.match(sql, /p_pack_normalized_key\s+is\s+null[\s\S]*pack_normalized_key\s*=\s*p_pack_normalized_key/i);
  assert.match(sql, /market_country_code\s*=\s*'IN'/i);
  assert.match(sql, /is_active\s*=\s*true/i);

  assert.match(sql, /'pack_is_official_default'\s*,\s*p\.pack_is_official_default/i);
  assert.match(sql, /'pack_source_kind'\s*,\s*p\.pack_source_kind/i);
  assert.match(sql, /'pack_normalized_key'\s*,\s*o\.pack_normalized_key/i);
  assert.match(sql, /'exact_pack_match'\s*,\s*o\.exact_pack_match/i);
  assert.match(sql, /ingredient_snapshot_sha256[\s\S]*string_agg\(pi2\.normalized_name/i);
  assert.doesNotMatch(sql, /\band\s+o\.id\s+is\s+not\s+null\b/i, 'product discovery must not require a priced merchant offer');

  assert.match(sql, /revoke\s+all\s+on\s+function\s+public\.sp_us2_exact_offers_v1[\s\S]*?from\s+anon/i);
  assert.match(sql, /revoke\s+all\s+on\s+function\s+public\.sp_us2_exact_offers_v1[\s\S]*?from\s+authenticated/i);
  assert.match(sql, /grant\s+execute\s+on\s+function\s+public\.sp_us2_exact_offers_v1[\s\S]*?to\s+service_role/i);
  assert.match(sql, /revoke\s+all\s+on\s+function\s+public\.sp_m1b_search_catalog_candidates_v1[\s\S]*?from\s+anon/i);
  assert.match(sql, /revoke\s+all\s+on\s+function\s+public\.sp_m1b_search_catalog_candidates_v1[\s\S]*?from\s+authenticated/i);
  assert.match(sql, /grant\s+execute\s+on\s+function\s+public\.sp_m1b_search_catalog_candidates_v1[\s\S]*?to\s+service_role/i);

  assert.doesNotMatch(sql, /insert\s+into\s+public\.sp_catalog_safety_assessment_v1/i);
  assert.doesNotMatch(sql, /update\s+public\.sp_catalog_safety_assessment_v1/i);
});
