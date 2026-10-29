import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const POLICY = '../supabase/functions/sp-us2-discovery-v1/discovery-policy.mjs';
const MIGRATION = new URL('../supabase/migrations/20260922184500_sp_us2_search_discovery_bridge_v1.sql', import.meta.url);

test('discovery separates embedded brand and pack from canonical product identity before staging', async () => {
  const { prepareDiscoveryProducts } = await import(POLICY);
  const prepared = prepareDiscoveryProducts([
    {
      name: 'Brand A Baby Hair Oil 100 ml',
      brand: 'Brand A',
      source_url: 'https://merchant.example/brand-a-baby-hair-oil-100ml',
      price: 220,
      currency: 'INR',
    },
  ], { queryText: 'baby hair oil', requestedPackKey: '100:ml', limit: 10 });

  assert.equal(prepared.products.length, 1);
  assert.equal(prepared.products[0].name, 'Brand A Baby Hair Oil 100 ml', 'display title remains source-faithful');
  assert.equal(prepared.products[0].product_name, 'Baby Hair Oil', 'canonical identity excludes duplicate brand and pack text');
  assert.equal(prepared.products[0].pack_size_text, '100 ml');
  assert.equal(prepared.products[0].pack_normalized_key, '100:ml');
});

test('explicit pack_size_text is preserved while duplicate brand and trailing pack text are removed from product_name', async () => {
  const { prepareDiscoveryProducts } = await import(POLICY);
  const prepared = prepareDiscoveryProducts([
    {
      product_name: 'Brand B Baby Lotion 200 ml',
      brand_name: 'Brand B',
      pack_size_text: '200 ml',
      source_url: 'https://merchant.example/brand-b-baby-lotion',
      price: 260,
      currency: 'INR',
    },
  ], { queryText: 'baby lotion', requestedPackKey: '200:ml', limit: 10 });

  assert.equal(prepared.products[0].product_name, 'Baby Lotion');
  assert.equal(prepared.products[0].pack_size_text, '200 ml');
  assert.equal(prepared.products[0].pack_normalized_key, '200:ml');
});

test('duplicate free-source URLs consume only one discovery slot and prefer the row with known brand identity', async () => {
  const { prepareDiscoveryProducts } = await import(POLICY);
  const sourceUrl = 'https://merchant.example/search/product-123?offer=abc';
  const prepared = prepareDiscoveryProducts([
    {
      name: 'Park Avenue Anti Dandruff Beer Shampoo For Men',
      brand: 'Park Avenue',
      source_url: sourceUrl,
      price: 142,
      currency: 'INR',
    },
    {
      name: 'Park Avenue Anti Dandruff Beer Shampoo For Men',
      brand: null,
      source_url: sourceUrl,
      price: 142,
      currency: 'INR',
    },
  ], { queryText: 'shampoo for men', limit: 4 });

  assert.equal(prepared.products.length, 1, 'the same exact product URL must not fill multiple distinct-brand slots');
  assert.equal(prepared.products[0].brand_name, 'Park Avenue', 'better identity metadata must win over the brandless duplicate');
});

test('catalog staging matches canonical pack/no-pack fingerprint semantics and is race-safe for new brands', () => {
  const sql = readFileSync(MIGRATION, 'utf8');

  assert.match(
    sql,
    /v_fingerprint\s*:=\s*case\s+when\s+v_pack_text\s+is\s+null\s+then[\s\S]*v_brand_norm\s*\|\|\s*'\|'\s*\|\|\s*v_product_norm\s*\|\|\s*'\|'\s*\|\|\s*v_variant_norm\s*\|\|\s*'\|IN'[\s\S]*else[\s\S]*v_pack_norm[\s\S]*end/i,
    'no-pack search candidates must hash exactly like canonical no-pack label identities',
  );
  assert.match(
    sql,
    /insert\s+into\s+public\.sp_catalog_brand_v1[\s\S]*on\s+conflict\s+do\s+nothing\s+returning\s+id\s+into\s+v_brand_id[\s\S]*if\s+v_brand_id\s+is\s+null\s+then[\s\S]*select\s+id\s+into\s+v_brand_id/i,
    'concurrent discovery of the same new brand must recover from the normalized-brand unique index',
  );
});
