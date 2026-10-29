import test from 'node:test';
import assert from 'node:assert/strict';

const POLICY = '../supabase/functions/sp-us2-discovery-v1/discovery-policy.mjs';

test('paid discovery accepts only the exact provider-observed product page, not another URL on the same merchant domain', async () => {
  const { sourceUrlSupportedByProvider } = await import(POLICY);
  const observed = [
    'https://shop.example/products/baby-oil?utm_source=search',
    'https://brand.example/in/baby-oil/',
  ];

  assert.equal(sourceUrlSupportedByProvider('https://shop.example/products/baby-oil?ref=affiliate', observed), true);
  assert.equal(sourceUrlSupportedByProvider('https://brand.example/in/baby-oil', observed), true);
  assert.equal(sourceUrlSupportedByProvider('https://shop.example/products/another-product', observed), false);
  assert.equal(sourceUrlSupportedByProvider('https://shop.example/category/baby-care', observed), false);
  assert.equal(sourceUrlSupportedByProvider('http://shop.example/products/baby-oil', observed), false);
});
