export type ResiliencePolicyProduct = {
  id: string;
  canonical_product_id?: string | null;
  brand?: string | null;
  name?: string | null;
  category?: string | null;
  pack_size_text?: string | null;
  pack_normalized_key?: string | null;
  display_basis?: string | null;
  safety_determined?: boolean | null;
  safety_score?: number | null;
  profile_score?: number | null;
  price: number | null;
  price_text: string | null;
};

export type ResiliencePolicyResult<T extends ResiliencePolicyProduct> = {
  products: Array<T & { price: number | null; price_text: string | null; pack_normalized_key?: string | null }>;
  selectedPackKey: string | null;
  priceComparisonAvailable: boolean;
};

export function parsePackKeyFromText(text: unknown): string | null;

export function prepareResilienceProducts<T extends ResiliencePolicyProduct>(
  products: T[],
  limit?: number,
  requestedPackKey?: string | null,
  queryText?: string | null,
): ResiliencePolicyResult<T>;
