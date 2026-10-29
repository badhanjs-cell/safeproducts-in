import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePack,
  samePack,
  chooseStandardPack,
  classifySearchMode,
} from '../supabase/functions/sp-m1b-search-v1/query-policy.mjs';

test('normalizes explicit volume, mass, and count packs', () => {
  assert.deepEqual(parsePack('Baby Lotion 200 ml'), { explicit: true, value: 200, unit: 'ml', key: '200:ml' });
  assert.equal(parsePack('Baby Lotion 0.2 L').key, '200:ml');
  assert.equal(parsePack('Protein 0.4 kg').key, '400:g');
  assert.equal(parsePack('Vitamin A 30 capsules').key, '30:count');
  assert.equal(parsePack('Baby hair oil').explicit, false);
});

test('compares normalized pack equivalence', () => {
  assert.equal(samePack(parsePack('200 ml'), parsePack('0.2 L')), true);
  assert.equal(samePack(parsePack('200 ml'), parsePack('400 ml')), false);
});

test('chooses explicit then official then modal trusted pack', () => {
  assert.equal(chooseStandardPack({
    explicitUserPack: parsePack('200 ml'),
    officialDefault: parsePack('400 ml'),
    trustedOffers: [parsePack('100 ml'), parsePack('100 ml')],
  }).key, '200:ml');

  assert.equal(chooseStandardPack({
    explicitUserPack: null,
    officialDefault: parsePack('400 ml'),
    trustedOffers: [parsePack('100 ml'), parsePack('100 ml')],
  }).key, '400:ml');

  assert.equal(chooseStandardPack({
    explicitUserPack: null,
    officialDefault: null,
    trustedOffers: [parsePack('100 ml'), parsePack('200 ml'), parsePack('100 ml')],
  }).key, '100:ml');

  assert.equal(chooseStandardPack({
    explicitUserPack: null,
    officialDefault: null,
    trustedOffers: [],
  }), null);
});

test('classifies exact anchor as specific product and generic query as category', () => {
  assert.equal(classifySearchMode({ query: 'Brand X Baby Lotion 200 ml', anchorExact: true }), 'SPECIFIC_PRODUCT');
  assert.equal(classifySearchMode({ query: 'baby hair oil', anchorExact: false }), 'CATEGORY');
});
