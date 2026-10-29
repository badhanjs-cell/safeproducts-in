import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const QUERY_POLICY = 'supabase/functions/sp-m1b-search-v1/query-policy.mjs';
const CORE = 'supabase/functions/sp-m1b-search-v1/index.ts';

const coreSource = readFileSync(CORE, 'utf8');

test('explicit pack display text ignores numeric brand tokens and returns the actual supported pack expression', async () => {
  const policy = await import(`../${QUERY_POLICY}`);
  assert.equal(typeof policy.packDisplayTextFromQuery, 'function', 'packDisplayTextFromQuery must be exported');
  assert.equal(policy.packDisplayTextFromQuery('TATA 1mg Tejasya Ashwagandha 60 Capsules'), '60 Capsules');
  assert.equal(policy.packDisplayTextFromQuery('NIVEA MEN Deep Comfort After Shave Lotion 100 ml'), '100 ml');
  assert.equal(policy.packDisplayTextFromQuery('Himalaya Neem Face Pack 75 gm'), '75 gm');
});

test('specific-product core response exposes canonical anchor even when no exact merchant offer is composed', () => {
  assert.match(coreSource, /anchor_product\s*:/, 'core response must expose anchor_product');
  assert.match(coreSource, /canonical_product_id\s*:\s*String\(anchorCandidate\.product_id/, 'anchor must carry canonical product id');
  assert.match(coreSource, /searchMode\s*===\s*["']SPECIFIC_PRODUCT["']/, 'anchor exposure must remain specific-mode bounded');
});

test('explicit selected pack display no longer uses generic number-plus-letters matching', () => {
  assert.doesNotMatch(coreSource, /query\.match\(\/\\d\+\(\?:\\\.\\d\+\)\?\\s\*\[a-z\]\+\/i\)/);
  assert.match(coreSource, /packDisplayTextFromQuery\(query\)/);
});

test('legacy pack helper remains compatible while active launch search never substitutes an explicit pack', async () => {
  const { chooseStandardPack } = await import(`../${QUERY_POLICY}`);
  const requested = { explicit: true, value: 250, unit: 'ml', key: '250:ml' };
  const offers = [
    { explicit: true, value: 100, unit: 'ml', key: '100:ml' },
    { explicit: true, value: 100, unit: 'ml', key: '100:ml' },
    { explicit: true, value: 200, unit: 'ml', key: '200:ml' },
    { explicit: true, value: 75, unit: 'g', key: '75:g' },
  ];
  assert.equal(chooseStandardPack({
    explicitUserPack: requested,
    trustedOffers: offers,
    allowExplicitFallback: true,
  })?.key, '100:ml');

  assert.equal(chooseStandardPack({
    explicitUserPack: requested,
    trustedOffers: [...offers, requested],
    allowExplicitFallback: true,
  })?.key, '250:ml', 'legacy helper keeps the requested pack authoritative when genuinely available');

  assert.equal(chooseStandardPack({
    explicitUserPack: requested,
    trustedOffers: [{ explicit: true, value: 75, unit: 'g', key: '75:g' }],
    allowExplicitFallback: true,
  }), null, 'legacy fallback helper must never cross the requested unit family');

  assert.match(coreSource, /chooseLaunchStandardPack/);
  assert.doesNotMatch(coreSource, /allowExplicitFallback\s*:\s*true/);
  assert.doesNotMatch(coreSource, /MARKET_STANDARD_FALLBACK/);
  assert.match(coreSource, /fallback_applied\s*:\s*false/);
});
