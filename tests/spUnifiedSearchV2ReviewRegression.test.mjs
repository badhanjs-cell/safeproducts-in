import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { mergeSearchResponses } from '../supabase/functions/sp-us2-search-v2/orchestration-policy.mjs';
import { chooseStandardPack, parsePack } from '../supabase/functions/sp-m1b-search-v1/query-policy.mjs';
import { validateMakeCallback, normalizeMakeOffer } from '../supabase/functions/sp-us2-make-callback-v1/make-policy.mjs';

async function edgeHandler(relativePath, fetcher) {
  const path = resolve(relativePath);
  let source = readFileSync(path, 'utf8').replace(/^import "jsr:[^\n]+\n/m, '');
  const dependencies = {};
  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"(\.[^"]+)";/g)) {
    dependencies[match[2]] = await import(pathToFileURL(resolve(dirname(path), match[2])).href);
  }
  source = source.replace(/import\s*\{([^}]+)\}\s*from\s*"(\.[^"]+)";/g, (_, names, path) => `const {${names}} = dependencies[${JSON.stringify(path)}];`);
  let handler;
  const runtime = { serve(fn) { handler = fn; }, env: { get(name) {
    if (name === 'SUPABASE_URL') return 'https://wmxbdirvlwuagouraobr.supabase.co';
    if (name.endsWith('SECRET_KEYS')) return JSON.stringify({ default: 'local-test-only' });
    if (name === 'SP_US2_MAKE_CALLBACK_KEY') return 'local-callback-test-only';
    return undefined;
  } } };
  new Function('Deno', 'fetch', 'dependencies', stripTypeScriptTypes(source))(runtime, fetcher, dependencies);
  return handler;
}

const reply = (value) => new Response(JSON.stringify(value), { status: 200 });
const request = (query) => new Request('https://wmxbdirvlwuagouraobr.supabase.co/functions/v1/test', {
  method: 'POST', body: JSON.stringify({ query }), headers: { 'Content-Type': 'application/json' },
});

test('normal v2 successor enqueue preserves the explicit query pack and sends no comparison fallback pack', async () => {
  let enqueued;
  const handler = await edgeHandler('supabase/functions/sp-us2-search-v2/index.ts', async (url, options) => {
    if (url.endsWith('/sp-m1b-search-v1')) return reply({ search_mode: 'CATEGORY', products: [],
      selected_pack: { normalized_key: '100:ml', source: 'MARKET_STANDARD_FALLBACK', requested_normalized_key: '250:ml', fallback_applied: true } });
    if (url.endsWith('/sp-us2-discovery-v1')) return reply({ products: [] });
    if (url.endsWith('/sp_us2_enqueue_acquisition_v1_1')) {
      enqueued = JSON.parse(options.body);
      return reply({ allowed: true, reason: 'QUEUED', request_id: '44444444-4444-4444-8444-444444444444' });
    }
    throw new Error(`Unexpected endpoint ${url}`);
  });
  await handler(request('baby lotion 250 ml'));
  assert.equal(enqueued.p_requested_pack_key, '250:ml');
  assert.equal(enqueued.p_comparison_pack_key, null);
});

test('an official default does not suppress the core requested-pack supply lookup', async () => {
  const calls = [];
  const candidate = { product_id: '11111111-1111-4111-8111-111111111111', product_fingerprint: 'anchor',
    brand_name: 'Brand A', product_name: 'Lotion', pack_normalized_key: '100:ml', pack_size_text: '100 ml',
    pack_is_official_default: true, pack_source_kind: 'OFFICIAL_MANUFACTURER',
    strict_safety: { assessment_status: 'QUALIFIED', safety_score: 80, profile_score: 80 } };
  const handler = await edgeHandler('supabase/functions/sp-m1b-search-v1/index.ts', async (url, options) => {
    const body = JSON.parse(options.body);
    if (url.endsWith('/sp_prod1_read_search_result_cache_v1')) return reply({ hit: false });
    if (url.endsWith('/sp_m1b_search_catalog_candidates_v1')) return reply({ candidates: [candidate] });
    if (url.endsWith('/sp_us2_exact_offers_v1')) { calls.push(body); return reply([{ verified: true, exact_pack_match: true,
      source_url: 'https://shop.example.in/lotion', pack_normalized_key: '250:ml', pack_size_text: '250 ml' }]); }
    if (url.endsWith('/sp-us2-commerce-v1')) return reply({ offers: [] });
    throw new Error(`Unexpected endpoint ${url}`);
  });
  const response = await (await handler(request('Brand A Lotion 250 ml'))).json();
  assert.equal(response.selected_pack?.normalized_key, '250:ml');
  assert.ok(calls.some(call => call.p_pack_normalized_key === '250:ml'));
});

test('explicit fallback uses observed modal supply rather than an unobserved official default', () => {
  const actual = chooseStandardPack({ explicitUserPack: parsePack('250 ml'), officialDefault: parsePack('300 ml'),
    trustedOffers: [parsePack('100 ml'), parsePack('100 ml'), parsePack('200 ml')], allowExplicitFallback: true });
  assert.equal(actual.key, '100:ml');
});

test('AUTO refuses an unobserved explicit resolution instead of completing an empty invented fallback', () => {
  const source_url = 'https://shop.example.in/lotion';
  const offer = { product_ref: 'ANCHOR', source_url, observed_source_urls: [source_url], price: 100, currency: 'INR',
    market_country_code: 'IN', pack_size_text: '100 ml', exact_pack_match: true, exact_product_match: true,
    variant_match: true, confidence: 95, merchant_name: 'Shop' };
  const actual = validateMakeCallback({ contract_version: 'SP-US2-MAKE-CALLBACK/1.0',
    request_id: '11111111-1111-4111-8111-111111111111', requested_pack_key: '250:ml', resolved_pack_key: '999:ml',
    pack_resolution: 'AUTO_REQUESTED_OR_MARKET_STANDARD', products: [], offers: [offer] });
  assert.equal(actual.ok, false);
  assert.equal(actual.code, 'PACK_RESOLUTION_INVALID');
});

test('specific search excludes its anchor identity and brand even with no exact offers', () => {
  const row = (id, brand) => ({ canonical_product_id: id, product_name: 'Lotion', brand_name: brand,
    pack_normalized_key: '100:ml', display_basis: 'PRICE_ONLY_FALLBACK', price: 100 });
  const actual = mergeSearchResponses({ search_mode: 'SPECIFIC_PRODUCT', products: [],
    anchor_product: { canonical_product_id: 'anchor', brand_name: 'Brand A' }, selected_pack: { normalized_key: '100:ml' } },
  { products: [row('anchor', 'Wrong brand'), row('samebrand', 'Brand A'), row('competitor', 'Brand B')] }, { query: 'Brand A Lotion 100 ml' });
  assert.deepEqual(actual.products.map(p => p.canonical_product_id), ['competitor']);
});

const callbackId = '11111111-1111-4111-8111-111111111111';
const callbackBody = { contract_version: 'SP-US2-MAKE-CALLBACK/1.0', request_id: callbackId,
  requested_pack_key: '100:ml', pack_resolution: 'AUTO_REQUESTED_OR_MARKET_STANDARD', products: [], offers: [] };
const callbackRequest = body => new Request('https://wmxbdirvlwuagouraobr.supabase.co/functions/v1/sp-us2-make-callback-v1', {
  method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', 'x-sp-us2-make-key': 'local-callback-test-only' },
});

test('a rejected authenticated callback closes its acquisition without catalog writes', async () => {
  let finished;
  const handler = await edgeHandler('supabase/functions/sp-us2-make-callback-v1/index.ts', async (url, options) => {
    if (url.includes('/sp_us2_acquisition_request_v1?')) return reply([{ id: callbackId, status: 'DISPATCHING', requested_pack_key: '100:ml' }]);
    if (url.endsWith('/sp_us2_finish_acquisition_v1')) { finished = JSON.parse(options.body); return reply({ success: true }); }
    throw new Error(`Unexpected catalog write or endpoint ${url}`);
  });
  const response = await handler(callbackRequest({ ...callbackBody, offers: [{ candidate_rank: 2, pack_size_text: '100 ml', source_url: 'http://invalid.example/product' }] }));
  assert.equal(response.status, 400);
  assert.equal(finished?.p_request_id, callbackId);
  assert.equal(finished?.p_status, 'FAILED');
  assert.equal(finished?.p_error_code, 'CALLBACK_VALIDATION_FAILED');
});

test('an empty genuine-source callback completes without writing products or offers', async () => {
  let finished;
  const handler = await edgeHandler('supabase/functions/sp-us2-make-callback-v1/index.ts', async (url, options) => {
    if (url.includes('/sp_us2_acquisition_request_v1?')) return reply([{ id: callbackId, status: 'DISPATCHING', requested_pack_key: '100:ml' }]);
    if (url.endsWith('/sp_us2_finish_acquisition_v1')) { finished = JSON.parse(options.body); return reply({ success: true }); }
    throw new Error(`Unexpected catalog write or endpoint ${url}`);
  });
  const response = await handler(callbackRequest(callbackBody));
  assert.equal(response.status, 200);
  assert.equal(finished.p_status, 'COMPLETED');
  assert.equal(finished.p_result_summary.offers_staged, 0);
  assert.equal(finished.p_result_summary.products_staged, 0);
});

test('merchant multipacks cannot be priced as one component pack', () => {
  const url = 'https://shop.example.in/product';
  const offer = { product_ref: 'ANCHOR', source_url: url, observed_source_urls: [url], price: 500, currency: 'INR',
    market_country_code: 'IN', confidence: 95, merchant_name: 'Shop', exact_product_match: true, variant_match: true, exact_pack_match: true };
  for (const pack_size_text of ['Lotion 2 x 100 ml', 'Lotion 100 ml (2 Pack)', 'Lotion 100 ml pack of 4', 'Lotion 100 ml + 50 ml']) {
    assert.equal(normalizeMakeOffer({ ...offer, pack_size_text, pack_normalized_key: '100:ml' }, { requestedPackKey: '100:ml' }), null, pack_size_text);
  }
  assert.ok(normalizeMakeOffer({ ...offer, pack_size_text: 'Lotion (1 x 100 ml)' }, { requestedPackKey: '100:ml' }));
});

test('a parent brand is excluded from alternatives to its gender-labelled line', () => {
  const row = (id, brand) => ({ canonical_product_id: id, product_name: 'Aftershave', brand_name: brand,
    pack_normalized_key: '100:ml', display_basis: 'PRICE_ONLY_FALLBACK', price: 100 });
  const result = mergeSearchResponses({ search_mode: 'SPECIFIC_PRODUCT', products: [],
    anchor_product: { canonical_product_id: 'anchor', brand_name: 'NIVEA MEN' }, selected_pack: { normalized_key: '100:ml' } },
  { products: [row('alias', 'NIVEA'), row('competitor', 'Old Spice')] }, { query: 'NIVEA MEN aftershave 100 ml' });
  assert.deepEqual(result.products.map(p => p.canonical_product_id), ['competitor']);
});

test('callback rejects off-category alternatives even when their pack and merchant are valid', () => {
  const product = { ref: 'ALT', brand_name: 'Versace', product_name: 'Oud Noir Eau de Parfum',
    pack_size_text: 'Versace perfume 100 ml', source_url: 'https://shop.example.in/products/perfume',
    market_country_code: 'IN', identity_confidence: 95, candidate_rank: 2 };
  const context = { query: 'NIVEA MEN Deep Comfort After Shave Lotion 100 ml', requestedPackKey: '100:ml' };
  const rejected = validateMakeCallback({ ...callbackBody, products: [product] }, context);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, 'PRODUCT_RELEVANCE_INVALID');
  const accepted = validateMakeCallback({ ...callbackBody, products: [{ ...product, brand_name: 'Adidas',
    product_name: 'Adidas Victory League After Shave Splash', pack_size_text: 'Adidas 100 ml After Shave' }] }, context);
  assert.equal(accepted.ok, true);
});

test('the protected callback checks alternative relevance against its stored request query', async () => {
  let finished;
  const handler = await edgeHandler('supabase/functions/sp-us2-make-callback-v1/index.ts', async (url, options) => {
    if (url.includes('/sp_us2_acquisition_request_v1?')) return reply([{ id: callbackId, status: 'DISPATCHED',
      requested_pack_key: '100:ml', normalized_query: 'after shave lotion 100 ml' }]);
    if (url.endsWith('/sp_us2_finish_acquisition_v1')) { finished = JSON.parse(options.body); return reply({ success: true }); }
    if (url.endsWith('/sp_catalog_stage_search_discovery_v1')) return reply({ product_id: callbackId, identity_status: 'CANDIDATE' });
    throw new Error(`Unexpected endpoint ${url}`);
  });
  const response = await handler(callbackRequest({ ...callbackBody, products: [{ ref: 'ALT', brand_name: 'Versace',
    product_name: 'Oud Noir Eau de Parfum', pack_size_text: 'Perfume 100 ml', source_url: 'https://shop.example.in/products/perfume',
    identity_confidence: 95, candidate_rank: 2 }] }));
  assert.equal(response.status, 400);
  assert.equal(finished.p_result_summary.validation_code, 'PRODUCT_RELEVANCE_INVALID');
});
