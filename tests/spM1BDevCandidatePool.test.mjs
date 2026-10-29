import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const CATEGORIES = ['cosmetics','personal_care','baby_products','supplements','nutraceuticals','special_dietary'];
const poolPath = 'tools/m1b/dev_candidate_pool.json';

function load() {
  return JSON.parse(readFileSync(poolPath, 'utf8'));
}

test('M1-B DEV candidate pool is balanced and explicitly non-gold', () => {
  const pool = load();
  assert.equal(pool.schema_version, '1.0.0');
  assert.equal(pool.split, 'DEV');
  assert.equal(pool.market_country_code, 'IN');
  assert.equal(pool.candidate_count, 30);
  assert.equal(pool.gold_evidence_allowed, false);
  assert.equal(pool.human_adjudication_required, true);
  assert.equal(pool.candidates.length, 30);

  const counts = new Map(CATEGORIES.map((c) => [c, 0]));
  const identityKeys = new Set();
  const candidateIds = new Set();

  for (const row of pool.candidates) {
    assert.ok(CATEGORIES.includes(row.benchmark_category));
    counts.set(row.benchmark_category, counts.get(row.benchmark_category) + 1);
    assert.equal(row.market_country_code, 'IN');
    assert.equal(row.curation_status, 'CANDIDATE_REVIEW_REQUIRED');
    assert.equal(row.gold_status, 'UNASSIGNED');
    assert.equal(row.product_fingerprint, null);
    assert.equal(row.discovery_source_is_gold, false);
    assert.match(row.discovery_source_url, /^https:\/\//);
    assert.ok(typeof row.product_name === 'string' && row.product_name.trim());
    assert.ok(typeof row.candidate_id === 'string' && row.candidate_id.trim());
    assert.equal(candidateIds.has(row.candidate_id), false, `duplicate candidate_id ${row.candidate_id}`);
    candidateIds.add(row.candidate_id);
    const key = `${String(row.brand_name ?? '').trim().toLowerCase()}|${row.product_name.trim().toLowerCase()}`;
    assert.equal(identityKeys.has(key), false, `duplicate candidate identity ${key}`);
    identityKeys.add(key);
  }

  for (const category of CATEGORIES) assert.equal(counts.get(category), 5, `${category} must have exactly 5 DEV candidates`);
});

test('candidate pool cannot masquerade as the executable benchmark manifest', () => {
  const pool = load();
  for (const row of pool.candidates) {
    assert.equal(row.product_fingerprint, null);
    assert.notEqual(row.gold_status, 'ADJUDICATED');
    assert.notEqual(row.curation_status, 'CURATED');
  }
});
