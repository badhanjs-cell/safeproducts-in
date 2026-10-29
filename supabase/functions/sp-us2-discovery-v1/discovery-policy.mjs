function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function https(value) {
  const raw = clean(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function sourcePageKey(value) {
  const raw = clean(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const pathname = (url.pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/');
    return `${url.origin.toLowerCase()}${pathname}`;
  } catch {
    return null;
  }
}

export function sourceUrlSupportedByProvider(value, sources = []) {
  const target = sourcePageKey(value);
  if (!target) return false;
  return (Array.isArray(sources) ? sources : []).some((source) => sourcePageKey(source) === target);
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

const PACK_DETAIL_PATTERN = /\b\d+(?:\.\d+)?\s*(?:ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|gm|gms|grams?|grammes?|g|kg|kilograms?|capsules?|caps?|tablets?|tabs?|softgels?|sachets?|pieces?|pcs?|counts?|ct)\b/i;
const PACK_DETAIL_PATTERN_GLOBAL = /\b\d+(?:\.\d+)?\s*(?:ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|gm|gms|grams?|grammes?|g|kg|kilograms?|capsules?|caps?|tablets?|tabs?|softgels?|sachets?|pieces?|pcs?|counts?|ct)\b/gi;

export function parseDiscoveryPackKey(text) {
  const source = clean(text);
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

function extractPackSizeText(value) {
  const match = clean(value).match(PACK_DETAIL_PATTERN);
  return match?.[0]?.replace(/\s+/g, ' ').trim() ?? '';
}

function stripPackDetail(value) {
  return clean(value)
    .replace(PACK_DETAIL_PATTERN_GLOBAL, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:|/\-–—]+|[\s,;:|/\-–—]+$/g, '')
    .trim();
}

function textTokens(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .match(/[a-z0-9]+/g) ?? [];
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripLeadingBrand(value, brand) {
  const source = clean(value);
  const brandTokens = textTokens(brand);
  if (!source || !brandTokens.length) return source;
  const separator = '[\\s._&+\\-–—/]*';
  const boundary = '[\\s._&+\\-–—/:]+';
  const pattern = new RegExp(`^\\s*${brandTokens.map(escapeRegex).join(separator)}${boundary}`, 'i');
  const stripped = source.replace(pattern, '').trim();
  return stripped || source;
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

function queryRelevant(product, queryText) {
  const required = relevanceTokens(queryText);
  if (!required.length) return true;
  const haystack = textTokens(`${clean(product?.name)} ${clean(product?.brand)} ${clean(product?.category)}`);
  return required.every((token) => tokenMatches(token, haystack));
}

function normalizedProduct(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = clean(raw.name ?? raw.product_name ?? raw.title);
  const brand = clean(raw.brand ?? raw.brand_name);
  const category = clean(raw.category);
  const sourceUrl = https(raw.source_url ?? raw.product_link ?? raw.affiliate_url);
  const price = number(raw.price ?? raw.extracted_price);
  const currency = clean(raw.currency || 'INR').toUpperCase();
  if (!name || !sourceUrl || price === null || price <= 0 || currency !== 'INR') return null;

  const identitySource = clean(raw.product_name) || name;
  const packSizeText = clean(raw.pack_size_text) || extractPackSizeText(identitySource) || extractPackSizeText(name);
  const packFreeIdentity = stripPackDetail(identitySource);
  const canonicalProductName = stripLeadingBrand(packFreeIdentity, brand) || packFreeIdentity || identitySource;
  const explicitPack = clean(raw.pack_normalized_key).toLowerCase();
  const packNormalizedKey = explicitPack || parseDiscoveryPackKey(packSizeText) || parseDiscoveryPackKey(name);

  return {
    ...raw,
    name,
    product_name: canonicalProductName,
    brand,
    brand_name: clean(raw.brand_name) || brand,
    category,
    source_url: sourceUrl,
    price,
    currency: 'INR',
    pack_size_text: packSizeText || null,
    pack_normalized_key: packNormalizedKey,
  };
}

function brandKey(product) {
  return clean(product?.brand ?? product?.brand_name).toLowerCase() || '__unknown_brand__';
}

function preferExactSourceIdentity(current, candidate) {
  const currentBrand = clean(current?.brand ?? current?.brand_name);
  const candidateBrand = clean(candidate?.brand ?? candidate?.brand_name);
  if (!currentBrand && candidateBrand) return candidate;
  return current;
}

function dedupeExactSourceUrls(products) {
  const bySource = new Map();
  for (const product of products) {
    const key = clean(product?.source_url);
    const existing = bySource.get(key);
    bySource.set(key, existing ? preferExactSourceIdentity(existing, product) : product);
  }
  return [...bySource.values()];
}

function modalPackKey(products) {
  const counts = new Map();
  const first = new Map();
  products.forEach((product, index) => {
    const key = clean(product?.pack_normalized_key).toLowerCase();
    if (!key) return;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!first.has(key)) first.set(key, index);
  });

  let best = null;
  let bestCount = 0;
  let bestFirst = Number.POSITIVE_INFINITY;
  for (const [key, count] of counts) {
    const index = first.get(key) ?? Number.POSITIVE_INFINITY;
    if (count > bestCount || (count === bestCount && index < bestFirst)) {
      best = key;
      bestCount = count;
      bestFirst = index;
    }
  }
  return best;
}

function onePerBrandByPrice(products, limit) {
  const sorted = [...products].sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
  const out = [];
  const seen = new Set();
  for (const product of sorted) {
    if (out.length >= limit) break;
    const key = brandKey(product);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(product);
  }
  return out;
}

export function acquisitionReuseQueries(acquisitionQuery, query) {
  const values = [clean(acquisitionQuery), clean(query)].filter(Boolean);
  return [...new Set(values)];
}

export function prepareDiscoveryProducts(products = [], {
  queryText = '', requestedPackKey = null, limit = 10,
  acquisitionResolvedPackKey = null, acquisitionPackResolution = null,
} = {}) {
  const cap = Math.max(1, Math.min(Number(limit) || 10, 10));
  const eligible = dedupeExactSourceUrls((Array.isArray(products) ? products : [])
    .map(normalizedProduct)
    .filter(Boolean)
    .filter((product) => product.acquisition_correlated === true || queryRelevant(product, queryText)));

  const requested = clean(requestedPackKey).toLowerCase() || null;
  const resolved = clean(acquisitionResolvedPackKey).toLowerCase();
  const fallbackApplied = !!requested
    && acquisitionPackResolution === 'MARKET_STANDARD_FALLBACK'
    && /^\d+(?:\.\d+)?:(ml|g|count)$/.test(resolved)
    && Number(resolved.split(':')[0]) > 0
    && resolved !== requested
    && resolved.split(':')[1] === requested.split(':')[1]
    && !eligible.some((product) => product.pack_normalized_key === requested)
    && eligible.some((product) => product.acquisition_correlated === true && product.pack_normalized_key === resolved);
  const selectedPackKey = fallbackApplied ? resolved : (requested || modalPackKey(eligible));
  if (!selectedPackKey) {
    return {
      selectedPackKey: null,
      products: onePerBrandByPrice(eligible, cap).map((product) => ({ ...product, price: null, price_text: null })),
      priceComparisonAvailable: false,
    };
  }

  const comparable = eligible.filter((product) => clean(product.pack_normalized_key).toLowerCase() === selectedPackKey);
  return {
    selectedPackKey,
    fallbackApplied,
    products: onePerBrandByPrice(comparable, cap),
    priceComparisonAvailable: comparable.length > 0,
  };
}

export function shouldUsePaidDiscovery({ currentCount = 0, targetCount = 6, allowPaidDiscovery = false } = {}) {
  const current = Math.max(0, Math.trunc(Number(currentCount) || 0));
  const target = Math.max(1, Math.min(Math.trunc(Number(targetCount) || 6), 10));
  return allowPaidDiscovery === true && current < target;
}