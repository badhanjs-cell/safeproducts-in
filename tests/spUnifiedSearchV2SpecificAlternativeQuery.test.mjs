import test from 'node:test';
import assert from 'node:assert/strict';
import { specificAlternativeQuery } from '../supabase/functions/sp-us2-search-v2/orchestration-policy.mjs';

test('specific-product alternative discovery uses product type instead of distinctive anchor wording', () => {
  const coreResponse = {
    search_mode: 'SPECIFIC_PRODUCT',
    products: [{
      result_group: 'EXACT_OFFER',
      brand_name: 'NIVEA MEN',
      product_name: 'Deep Comfort After Shave Lotion',
      category: null,
      pack_normalized_key: '100:ml',
    }],
  };

  assert.equal(
    specificAlternativeQuery(coreResponse, 'NIVEA MEN Deep Comfort After Shave Lotion 100 ml'),
    'after shave lotion',
  );
});
