function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function stableNumber(value) {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function normalizedPackKey(value, unit) {
  const normalized = stableNumber(value);
  return normalized !== null && normalized > 0 ? `${normalized}:${unit}` : null;
}

export function parsePackKeyFromText(text) {
  const source = String(text ?? '').trim();
  if (!source) return null;

  const metric = source.match(/(?:^|[^a-z0-9])(\d+(?:\.\d+)?)\s*(ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|gm|gms|grams?|grammes?|g|kg|kilograms?)(?=$|[^a-z])/i);
  if (metric) {
    const raw = Number(metric[1]);
    const token = metric[2].toLowerCase();
    if (token === 'l' || token.startsWith('lit')) return normalizedPackKey(raw * 1000, 'ml');
    if (token === 'kg' || token.startsWith('kilogram')) return normalizedPackKey(raw * 1000, 'g');
    if (token === 'ml' || token.startsWith('millilit')) return normalizedPackKey(raw, 'ml');
    return normalizedPackKey(raw, 'g');
  }

  const count = source.match(/(?:^|[^a-z0-9])(\d+(?:\.\d+)?)\s*(capsules?|caps?|tablets?|tabs?|softgels?|sachets?|pieces?|pcs?|counts?|ct)(?=$|[^a-z])/i);
  return count ? normalizedPackKey(Number(count[1]), 'count') : null;
}

function canonicalKey(product) {
  return clean(product?.canonical_product_id) || clean(product?.id);
}

function brandKey(product) {
  return clean(product?.brand).toLowerCase() || '__unknown_brand__';
}

function packKey(product) {
  return clean(product?.pack_normalized_key).toLowerCase()
    || parsePackKeyFromText(product?.pack_size_text)
    || parsePackKeyFromText(product?.name);
}

function withDerivedPack(product) {
  const derived = packKey(product);
  if (!derived || clean(product?.pack_normalized_key)) return product;
  return { ...product, pack_normalized_key: derived };
}

function textTokens(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .match(/[a-z0-9]+/g) ?? [];
}

const QUERY_IGNORED_TOKENS = new Set([
  'the', 'and', 'for', 'with', 'buy', 'online', 'india', 'product', 'products',
  'pack', 'packs', 'of', 'x', 'ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres',
  'l', 'liter', 'liters', 'litre', 'litres', 'g', 'gm', 'gms', 'gram', 'grams', 'gramme', 'grammes',
  'kg', 'kilogram', 'kilograms', 'capsule', 'capsules', 'cap', 'caps', 'tablet', 'tablets', 'tab', 'tabs',
  'softgel', 'softgels', 'sachet', 'sachets', 'piece', 'pieces', 'pcs', 'count', 'counts', 'ct',
]);

function relevanceTokens(queryText) {
  return textTokens(queryText).filter((token) => token.length >= 2 && !/^\d+(?:\.\d+)?$/.test(token) && !QUERY_IGNORED_TOKENS.has(token));
}

function tokenMatches(token, haystackTokens) {
  return haystackTokens.some((candidate) => candidate === token || (token.length >= 4 && candidate.includes(token)));
}

function isQueryRelevant(product, queryText) {
  const required = relevanceTokens(queryText);
  if (required.length === 0) return true;
  const haystack = textTokens(`${clean(product?.name)} ${clean(product?.brand)} ${clean(product?.category)}`);
  return required.every((token) => tokenMatches(token, haystack));
}

function normalizedTitleKey(product) {
  return textTokens(product?.name).join('');
}

function isSafetyQualified(product) {
  return clean(product?.display_basis).toUpperCase() === 'SAFETY_QUALIFIED' && product?.safety_determined === true;
}

function validPrice(product) {
  return Number.isFinite(Number(product?.price)) && Number(product?.price) > 0 ? Number(product.price) : null;
}

function preferProduct(current, candidate) {
  const currentQualified = isSafetyQualified(current);
  const candidateQualified = isSafetyQualified(candidate);
  if (currentQualified !== candidateQualified) return candidateQualified ? candidate : current;

  const currentBrand = clean(current?.brand);
  const candidateBrand = clean(candidate?.brand);
  if (!!currentBrand !== !!candidateBrand) return candidateBrand ? candidate : current;

  const currentPrice = validPrice(current);
  const candidatePrice = validPrice(candidate);
  if (currentPrice !== null && candidatePrice !== null && candidatePrice < currentPrice) return candidate;
  if (currentPrice === null && candidatePrice !== null) return candidate;
  return current;
}

function sameCrossSourceIdentity(left, right) {
  const leftCanonical = canonicalKey(left);
  const rightCanonical = canonicalKey(right);
  if (leftCanonical && rightCanonical && leftCanonical === rightCanonical) return true;

  const leftTitle = normalizedTitleKey(left);
  const rightTitle = normalizedTitleKey(right);
  if (!leftTitle || leftTitle !== rightTitle) return false;

  const leftBrand = clean(left?.brand).toLowerCase();
  const rightBrand = clean(right?.brand).toLowerCase();
  if (leftBrand && rightBrand) return leftBrand === rightBrand;
  return true;
}

function uniqueCanonicalProducts(products, queryText = null) {
  const out = [];

  for (const raw of Array.isArray(products) ? products : []) {
    const product = withDerivedPack(raw);
    if (!isQueryRelevant(product, queryText)) continue;
    if (!canonicalKey(product) && !normalizedTitleKey(product)) continue;

    const existingIndex = out.findIndex((existing) => sameCrossSourceIdentity(existing, product));
    if (existingIndex >= 0) {
      out[existingIndex] = preferProduct(out[existingIndex], product);
      continue;
    }

    out.push(product);
  }
  return out;
}

function modalPackKey(products) {
  const counts = new Map();
  const firstIndex = new Map();
  products.forEach((product, index) => {
    const key = packKey(product);
    if (!key) return;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!firstIndex.has(key)) firstIndex.set(key, index);
  });

  let best = null;
  let bestCount = 0;
  let bestFirst = Number.POSITIVE_INFINITY;
  for (const [key, count] of counts) {
    const first = firstIndex.get(key) ?? Number.POSITIVE_INFINITY;
    if (count > bestCount || (count === bestCount && first < bestFirst)) {
      best = key;
      bestCount = count;
      bestFirst = first;
    }
  }
  return best;
}

function onePerBrand(products, limit) {
  const out = [];
  const seenBrands = new Set();
  for (const product of products) {
    if (out.length >= limit) break;
    const brand = brandKey(product);
    if (seenBrands.has(brand)) continue;
    seenBrands.add(brand);
    out.push(product);
  }
  return out;
}

export function prepareResilienceProducts(products = [], limit = 10, requestedPackKey = null, queryText = null) {
  const cap = Math.max(1, Math.min(Number(limit) || 10, 10));
  const uniqueProducts = uniqueCanonicalProducts(products, queryText);
  const requested = clean(requestedPackKey).toLowerCase() || null;
  const selectedPackKey = requested || modalPackKey(uniqueProducts);

  if (!selectedPackKey) {
    const visible = onePerBrand(uniqueProducts, cap).map((product) => ({
      ...product,
      price: null,
      price_text: null,
    }));
    return { products: visible, selectedPackKey: null, priceComparisonAvailable: false };
  }

  const samePack = uniqueProducts.filter((product) => packKey(product) === selectedPackKey);
  return {
    products: onePerBrand(samePack, cap),
    selectedPackKey,
    priceComparisonAvailable: samePack.length > 0,
  };
}
