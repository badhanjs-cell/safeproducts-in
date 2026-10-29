import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const MIGRATION = 'supabase/migrations/20260925013000_sp_us2_make_fallback_reuse_v1.sql';
const DISCOVERY = 'supabase/functions/sp-us2-discovery-v1/index.ts';
const ORCHESTRATION = '../supabase/functions/sp-us2-search-v2/orchestration-policy.mjs';

function product(id, brand, pack) {
  return {
    canonical_product_id: id,
    product_fingerprint: id,
    brand_name: brand,
    product_name: `${brand} Lotion`,
    pack_normalized_key: pack,
    result_group: 'CATEGORY_PRODUCT',
    display_basis: 'PRICE_ONLY_FALLBACK',
    safety_determined: false,
    price: 200,
  };
}

test('recent acquisition reuse correlates on requested pack but reads the server-resolved fallback pack', () => {
  assert.equal(existsSync(MIGRATION), true, 'fallback reuse successor migration must exist');
  const sql = readFileSync(MIGRATION, 'utf8');
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.sp_us2_recent_acquisition_results_v1/i);
  assert.match(sql, /requested_pack_key\s+is\s+not\s+distinct\s+from\s+v_requested_pack/i);
  assert.match(sql, /result_summary\s*->>\s*'resolved_pack_key'/i);
  assert.match(sql, /result_summary\s*->>\s*'pack_resolution'/i);
  assert.match(sql, /effective_pack_key/i);
  assert.match(sql, /(?:lower\()?co\.pack_normalized_key\)?\s*=\s*rr\.effective_pack_key/i);
  assert.match(sql, /'resolved_pack_key'/i);
  assert.match(sql, /'pack_resolution'/i);
});

test('discovery uses a correlated market-standard fallback pack instead of re-filtering on the unavailable request', () => {
  const source = readFileSync(DISCOVERY, 'utf8');
  assert.match(source, /acquisitionResolvedPackKey/);
  assert.match(source, /MARKET_STANDARD_FALLBACK/);
  assert.match(source, /effectiveRequestedPackKey/);
  assert.match(source, /requested_normalized_key/);
  assert.match(source, /fallback_applied/);
});

test('v2 merge preserves discovery market-standard fallback when core had no fallback evidence', async () => {
  const { mergeSearchResponses } = await import(ORCHESTRATION);
  const core = {
    search_mode: 'CATEGORY',
    selected_pack: {
      text: '250 ml',
      normalized_key: '250:ml',
      source: 'USER',
      requested_text: '250 ml',
      requested_normalized_key: '250:ml',
      fallback_applied: false,
    },
    products: [],
  };
  const discovery = {
    selected_pack: {
      text: '100 ml',
      normalized_key: '100:ml',
      source: 'MARKET_STANDARD_FALLBACK',
      requested_text: '250 ml',
      requested_normalized_key: '250:ml',
      fallback_applied: true,
    },
    products: [product('p1', 'Brand A', '100:ml'), product('p2', 'Brand B', '100:ml')],
  };
  const response = mergeSearchResponses(core, discovery, { query: 'baby lotion 250 ml', limit: 10 });
  assert.equal(response.selected_pack.normalized_key, '100:ml');
  assert.equal(response.selected_pack.source, 'MARKET_STANDARD_FALLBACK');
  assert.equal(response.selected_pack.requested_normalized_key, '250:ml');
  assert.equal(response.selected_pack.fallback_applied, true);
  assert.equal(response.products.length, 2);
  assert.ok(response.products.every((row) => row.pack_normalized_key === '100:ml'));
  assert.match(response.consumer_notice, /250 ml/i);
  assert.match(response.consumer_notice, /100 ml/i);
});
