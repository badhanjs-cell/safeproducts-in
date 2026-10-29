import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  chooseDisplayImage,
  isImageRequiredForEligibility,
} from '../supabase/functions/sp-m1b-path-a-v1/image-policy.mjs';

test('display image policy prefers exact official product imagery over merchant imagery', () => {
  const best = chooseDisplayImage([
    { sourceKind: 'VERIFIED_MERCHANT', imageUrl: 'https://merchant.example/p.jpg', sourceUrl: 'https://merchant.example/p', exact: true, widthPx: 1600, heightPx: 1600 },
    { sourceKind: 'OFFICIAL_BRAND', imageUrl: 'https://brand.example/p.jpg', sourceUrl: 'https://brand.example/p', exact: true, widthPx: 800, heightPx: 800 },
  ]);
  assert.equal(best?.sourceKind, 'OFFICIAL_BRAND');
  assert.equal(best?.imageUrl, 'https://brand.example/p.jpg');
});

test('within the same source tier policy prefers the larger observed usable image', () => {
  const best = chooseDisplayImage([
    { sourceKind: 'OFFICIAL_BRAND', imageUrl: 'https://brand.example/small.jpg', sourceUrl: 'https://brand.example/p', exact: true, widthPx: 300, heightPx: 300 },
    { sourceKind: 'OFFICIAL_BRAND', imageUrl: 'https://brand.example/large.jpg', sourceUrl: 'https://brand.example/p', exact: true, widthPx: 1200, heightPx: 1200 },
  ]);
  assert.equal(best?.imageUrl, 'https://brand.example/large.jpg');
});

test('image policy rejects non-exact, insecure and recognizable non-product artwork', () => {
  const best = chooseDisplayImage([
    { sourceKind: 'OFFICIAL_BRAND', imageUrl: 'https://brand.example/logo.png', sourceUrl: 'https://brand.example/p', exact: true },
    { sourceKind: 'OFFICIAL_BRAND', imageUrl: 'http://brand.example/product.jpg', sourceUrl: 'https://brand.example/p', exact: true },
    { sourceKind: 'OFFICIAL_BRAND', imageUrl: 'https://brand.example/right-product.jpg', sourceUrl: 'https://brand.example/p', exact: false },
    { sourceKind: 'VERIFIED_MERCHANT', imageUrl: 'https://merchant.example/exact-product.jpg', sourceUrl: 'https://merchant.example/p', exact: true },
  ]);
  assert.equal(best?.imageUrl, 'https://merchant.example/exact-product.jpg');
});

test('image availability is never an eligibility requirement', () => {
  assert.equal(isImageRequiredForEligibility(null), false);
  assert.equal(isImageRequiredForEligibility('https://example.com/p.jpg'), false);
});

test('Path A carries image provenance, dimensions and exact-product flag and uses isolated image persistence', () => {
  const source = readFileSync('supabase/functions/sp-m1b-path-a-v1/index.ts', 'utf8');
  assert.match(source, /chooseDisplayImage/);
  assert.match(source, /display_images/);
  assert.match(source, /width_px/);
  assert.match(source, /height_px/);
  assert.match(source, /exact_product_match/);
  assert.match(source, /sp_us2_upsert_display_image_v1/);
});

test('legacy and active frontend normalizers do not require an image and ProductCard retains placeholder', () => {
  const contract = readFileSync('src/lib/searchContract.ts', 'utf8');
  const legacyStart = contract.indexOf('export function normalizeProduct');
  const legacyEnd = contract.indexOf('export const unavailable', legacyStart);
  const legacy = contract.slice(legacyStart, legacyEnd);
  assert.doesNotMatch(legacy, /&&\s*!!image_url/);

  const activeStart = contract.indexOf('function normalizeConsumerProduct');
  const activeEnd = contract.indexOf('export function normalizeSearchResponse', activeStart);
  const active = contract.slice(activeStart, activeEnd);
  assert.doesNotMatch(active, /commercialOk[^;]*image_url/s);

  const card = readFileSync('src/components/ProductCard.tsx', 'utf8');
  assert.match(card, /Product image unavailable/);
});

test('image persistence RPC is service-role-only and independent from safety tables', () => {
  const sql = readFileSync('supabase/migrations/20260921150000_sp_unified_search_image_capture_v2.sql', 'utf8');
  assert.match(sql, /sp_us2_upsert_display_image_v1/);
  assert.match(sql, /width_px/);
  assert.match(sql, /height_px/);
  assert.match(sql, /exact_product_match/i);
  assert.match(sql, /revoke\s+all[\s\S]*from\s+anon/i);
  assert.match(sql, /revoke\s+all[\s\S]*from\s+authenticated/i);
  assert.match(sql, /grant\s+execute[\s\S]*to\s+service_role/i);
  assert.doesNotMatch(sql, /sp_catalog_safety_assessment_v1/i);
});
