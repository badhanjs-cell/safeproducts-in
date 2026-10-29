import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parsePack,
  chooseLaunchStandardPack,
  selectDefensibleModalPack,
} from '../supabase/functions/sp-m1b-search-v1/query-policy.mjs';

const ACTIVE_SEARCH = 'supabase/functions/sp-m1b-search-v1/index.ts';

function observation(text, brand, domain, lineage = domain) {
  return {
    ...parsePack(text),
    brand_name: brand,
    source_domain: domain,
    source_lineage: lineage,
  };
}

test('launch explicit pack is immutable even when trusted supply exists only at another size', () => {
  const selected = chooseLaunchStandardPack({
    searchMode: 'CATEGORY',
    explicitUserPack: parsePack('250 ml'),
    officialDefaults: [observation('100 ml', 'Brand A', 'brand-a.example')],
    trustedOffers: [
      observation('100 ml', 'Brand A', 'shop-a.example'),
      observation('100 ml', 'Brand B', 'shop-b.example'),
    ],
  });
  assert.equal(selected?.key, '250:ml');
});

test('specific no-pack uses the anchor official India default before trusted-market mode', () => {
  const selected = chooseLaunchStandardPack({
    searchMode: 'SPECIFIC_PRODUCT',
    explicitUserPack: null,
    officialDefault: parsePack('400 ml'),
    trustedOffers: [
      observation('100 ml', 'Anchor Brand', 'shop-a.example'),
      observation('100 ml', 'Anchor Brand', 'shop-b.example'),
    ],
  });
  assert.equal(selected?.key, '400:ml');
});

test('specific no-pack falls back to a defensible trusted-market mode when no official default exists', () => {
  const selected = chooseLaunchStandardPack({
    searchMode: 'SPECIFIC_PRODUCT',
    trustedOffers: [
      observation('100 ml', 'Anchor Brand', 'shop-a.example'),
      observation('100 ml', 'Anchor Brand', 'shop-b.example'),
      observation('200 ml', 'Anchor Brand', 'shop-c.example'),
    ],
  });
  assert.equal(selected?.key, '100:ml');
});

test('category no-pack prefers a unique modal official-default pack across relevant brands', () => {
  const selected = chooseLaunchStandardPack({
    searchMode: 'CATEGORY',
    officialDefaults: [
      observation('100 ml', 'Brand A', 'brand-a.example'),
      observation('100 ml', 'Brand B', 'brand-b.example'),
      observation('200 ml', 'Brand C', 'brand-c.example'),
    ],
    trustedOffers: [
      observation('200 ml', 'Brand D', 'shop-d.example'),
      observation('200 ml', 'Brand E', 'shop-e.example'),
    ],
  });
  assert.equal(selected?.key, '100:ml');
});

test('category no-pack uses trusted-market mode when official-default observations have no defensible winner', () => {
  const selected = chooseLaunchStandardPack({
    searchMode: 'CATEGORY',
    officialDefaults: [
      observation('100 ml', 'Brand A', 'brand-a.example'),
      observation('200 ml', 'Brand B', 'brand-b.example'),
    ],
    trustedOffers: [
      observation('200 ml', 'Brand C', 'shop-c.example'),
      observation('200 ml', 'Brand D', 'shop-d.example'),
      observation('100 ml', 'Brand E', 'shop-e.example'),
    ],
  });
  assert.equal(selected?.key, '200:ml');
});

test('modal selection counts at most one observation per normalized brand/source lineage', () => {
  const selected = selectDefensibleModalPack([
    observation('100 ml', 'Brand A', 'shop-a.example', 'same-feed'),
    observation('100 ml', 'Brand A', 'shop-a.example', 'same-feed'),
    observation('100 ml', 'BRAND A', 'shop-a.example', 'same-feed'),
    observation('200 ml', 'Brand B', 'shop-b.example'),
    observation('200 ml', 'Brand C', 'shop-c.example'),
  ]);
  assert.equal(selected?.key, '200:ml');
});

test('modal ties prefer broader distinct-brand support before distinct-domain support', () => {
  const selected = selectDefensibleModalPack([
    observation('100 ml', 'Brand A', 'a-one.example', 'feed-1'),
    observation('100 ml', 'Brand A', 'a-two.example', 'feed-2'),
    observation('200 ml', 'Brand B', 'shared.example', 'feed-3'),
    observation('200 ml', 'Brand C', 'shared.example', 'feed-4'),
  ]);
  assert.equal(selected?.key, '200:ml');
});

test('modal ties then prefer broader distinct-domain support', () => {
  const selected = selectDefensibleModalPack([
    observation('100 ml', 'Brand A', 'a.example', 'feed-a'),
    observation('100 ml', 'Brand B', 'b.example', 'feed-b'),
    observation('200 ml', 'Brand C', 'shared.example', 'feed-c'),
    observation('200 ml', 'Brand D', 'shared.example', 'feed-d'),
  ]);
  assert.equal(selected?.key, '100:ml');
});

test('fully unresolved modal tie returns null rather than arbitrarily mixing price comparisons', () => {
  const selected = selectDefensibleModalPack([
    observation('100 ml', 'Brand A', 'a.example'),
    observation('100 ml', 'Brand B', 'b.example'),
    observation('200 ml', 'Brand C', 'c.example'),
    observation('200 ml', 'Brand D', 'd.example'),
  ]);
  assert.equal(selected, null);
});

test('active launch search routes pack selection through strict launch policy and never substitutes an explicit pack', () => {
  const source = readFileSync(ACTIVE_SEARCH, 'utf8');
  assert.match(source, /chooseLaunchStandardPack/);
  assert.match(source, /searchMode\s*,/);
  assert.match(source, /officialDefaults\s*:/);
  assert.doesNotMatch(source, /allowExplicitFallback\s*:\s*true/);
  assert.doesNotMatch(source, /MARKET_STANDARD_FALLBACK/);
  assert.match(source, /explicitPack\.explicit[\s\S]{0,180}["']USER["']/);
});
