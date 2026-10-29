import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const DOC = 'docs/integrations/make/sp-us2-acquisition-v1.md';
const CONTRACT = 'tools/sp_us2/make_acquisition_contract_v1.json';
const PREWARM = 'tools/sp_us2/launch_prewarm_queries.json';
const RUNNER = 'scripts/sp-us2-prewarm.mjs';

function read(path) {
  assert.equal(existsSync(path), true, `${path} must exist`);
  return readFileSync(path, 'utf8');
}

function readJson(path) {
  return JSON.parse(read(path));
}

function flattened(value) {
  return JSON.stringify(value).toLowerCase();
}

test('versioned Make acquisition contract freezes specific 5+5 and generic comparable-pack objectives', () => {
  const doc = read(DOC);
  assert.match(doc, /SP-US2-MAKE-ACQUISITION\/1\.0/);
  assert.match(doc, /5\s+exact/i);
  assert.match(doc, /5\s+(?:distinct[- ]brand\s+)?alternatives?/i);
  assert.match(doc, /6[–-]10/i);
  assert.match(doc, /same[- ]pack|comparable normalized pack/i);
  assert.match(doc, /x-sp-us2-make-key/i);
  assert.match(doc, /sp-us2-make-callback-v1/i);
  assert.match(doc, /Safety Score/i);
  assert.match(doc, /must not|never/i);
});

test('machine contract contains one request and callback example but no credential or safety authority payload', () => {
  const contract = readJson(CONTRACT);
  assert.equal(contract.version, 'SP-US2-MAKE-ACQUISITION/1.0');
  assert.equal(contract.request_example.market_country_code, 'IN');
  assert.equal(contract.request_example.currency, 'INR');
  assert.equal(contract.callback_example.market_country_code, 'IN');
  assert.equal(contract.callback_example.currency, 'INR');
  assert.ok(Array.isArray(contract.callback_example.products));
  assert.ok(Array.isArray(contract.callback_example.offers));

  const text = flattened(contract);
  const forbidden = [
    ['service', 'role', 'key'].join('_'),
    'callback_key',
    'authorization',
    'apikey',
    'safety_score',
    'profile_score',
    'ingredient_evidence',
    'recommendation_class',
    'regulatory_status',
    'best_value_product',
  ];
  for (const token of forbidden) assert.equal(text.includes(token), false, `contract must not contain ${token}`);
});

test('launch prewarm corpus covers explicit ml, count, Indian gm, generic implicit-pack and generic explicit-pack cases', () => {
  const corpus = readJson(PREWARM);
  assert.ok(Array.isArray(corpus.queries));
  assert.ok(corpus.queries.length >= 5);
  const cases = new Set(corpus.queries.map((row) => row.case));
  for (const required of [
    'specific_ml',
    'specific_count',
    'specific_gm',
    'category_no_pack',
    'category_explicit_pack',
  ]) assert.equal(cases.has(required), true, `missing ${required}`);

  assert.ok(corpus.queries.some((row) => /\b\d+\s*ml\b/i.test(row.query)));
  assert.ok(corpus.queries.some((row) => /\b60\s+capsules?\b/i.test(row.query)));
  assert.ok(corpus.queries.some((row) => /\b75\s*gm\b/i.test(row.query)));
});

test('prewarm runner is canonical-project locked, supports dry-run, and does not embed Make or server secrets', () => {
  const source = read(RUNNER);
  assert.match(source, /wmxbdirvlwuagouraobr\.supabase\.co/);
  assert.match(source, /--dry-run/);
  assert.match(source, /launch_prewarm_queries\.json/);
  assert.match(source, /sp_us2_enqueue_acquisition_v1/);
  assert.match(source, /sp-us2-make-dispatch-v1/);
  assert.match(source, /sp-us2-search-v2/);
  assert.doesNotMatch(source, /hooks\.make\.com\/[^'"\s]+/i);
  assert.doesNotMatch(source, /sb_secret_[a-z0-9_-]+/i);
});
