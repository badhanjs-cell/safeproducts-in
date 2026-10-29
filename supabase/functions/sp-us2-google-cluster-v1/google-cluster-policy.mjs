function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function finiteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stableNumber(value) {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function packKey(value, unit) {
  const normalized = stableNumber(value);
  return normalized !== null && normalized > 0 ? `${normalized}:${unit}` : null;
}

export function parseClusterPackKey(value) {
  const source = clean(value);
  if (!source) return null;

  const metric = source.match(/(?:^|[^a-z0-9])(\d+(?:\.\d+)?)\s*(ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|gm|gms|grams?|grammes?|g|kg|kilograms?)(?=$|[^a-z])/i);
  if (metric) {
    const raw = Number(metric[1]);
    const token = metric[2].toLowerCase();
    if (token === 'l' || token.startsWith('lit')) return packKey(raw * 1000, 'ml');
    if (token === 'kg' || token.startsWith('kilogram')) return packKey(raw * 1000, 'g');
    if (token === 'ml' || token.startsWith('millilit')) return packKey(raw, 'ml');
    return packKey(raw, 'g');
  }

  const count = source.match(/(?:^|[^a-z0-9])(\d+(?:\.\d+)?)\s*(capsules?|caps?|tablets?|tabs?|softgels?|sachets?|pieces?|pcs?|counts?|ct)(?=$|[^a-z])/i);
  return count ? packKey(Number(count[1]), 'count') : null;
}

export function canonicalHttpsPage(value) {
  const source = clean(value);
  if (!source) return null;
  try {
    const url = new URL(source);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const pathname = (url.pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/');
    return `${url.origin.toLowerCase()}${pathname}`;
  } catch {
    return null;
  }
}

function tokens(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .match(/[a-z0-9]+/g) ?? [];
}

const IDENTITY_IGNORED = new Set([
  'ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres', 'l', 'liter', 'liters', 'litre', 'litres',
  'g', 'gm', 'gms', 'gram', 'grams', 'gramme', 'grammes', 'kg', 'kilogram', 'kilograms',
  'capsule', 'capsules', 'cap', 'caps', 'tablet', 'tablets', 'tab', 'tabs', 'softgel', 'softgels',
  'sachet', 'sachets', 'piece', 'pieces', 'pcs', 'count', 'counts', 'ct', 'pack', 'packs', 'of',
]);

const RETAIL_HINT_NOISE = new Set([
  ...IDENTITY_IGNORED,
  'product', 'products', 'item', 'items', 'itm', 'sku', 'otc', 'buy', 'online', 'offer', 'offers', 'sale',
  'india', 'shop', 'store', 'stores', 'combo', 'set', 'with', 'for', 'the', 'and', 'new', 'original', 'genuine',
]);

function normalizedDomain(value) {
  return clean(value).toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
}

function hintIdentity(row, anchorId) {
  if (!row || typeof row !== 'object') return null;
  if (!anchorId || clean(row.product_id) !== anchorId) return null;
  if (clean(row.market_country_code).toUpperCase() !== 'IN') return null;
  const confidence = finiteNumber(row.offer_confidence);
  if (confidence === null || confidence < 80) return null;
  const canonical = canonicalHttpsPage(row.source_url);
  if (!canonical) return null;

  const url = new URL(canonical);
  const host = normalizedDomain(url.hostname);
  const declared = normalizedDomain(row.source_domain);
  if (declared && host !== declared && !host.endsWith(`.${declared}`)) return null;
  const domain = declared || host;
  if (!domain) return null;
  return { domain, pathTokens: tokens(url.pathname) };
}

function nearestOriginalPair(pathTokens, index, originalSet) {
  let previous = null;
  let next = null;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (originalSet.has(pathTokens[cursor])) { previous = pathTokens[cursor]; break; }
  }
  for (let cursor = index + 1; cursor < pathTokens.length; cursor += 1) {
    if (originalSet.has(pathTokens[cursor])) { next = pathTokens[cursor]; break; }
  }
  return previous && next ? { previous, next } : null;
}

export function deriveShoppingQueryFromCommerceHints(query, hintRows = [], context = {}) {
  const original = clean(query);
  if (!original) return original;
  const originalTokens = tokens(original);
  if (!originalTokens.length) return original;

  const anchor = context?.anchor && typeof context.anchor === 'object' ? context.anchor : {};
  const anchorId = clean(anchor.canonical_product_id);
  if (!anchorId) return original;
  const originalSet = new Set(originalTokens);
  const variantSet = new Set(identityTokens(anchor.variant_name));
  const evidence = new Map();

  for (const row of Array.isArray(hintRows) ? hintRows : []) {
    const hint = hintIdentity(row, anchorId);
    if (!hint) continue;
    for (let index = 0; index < hint.pathTokens.length; index += 1) {
      const token = hint.pathTokens[index];
      if (!/^[a-z]{4,}$/.test(token) || originalSet.has(token) || variantSet.has(token) || RETAIL_HINT_NOISE.has(token)) continue;
      const pair = nearestOriginalPair(hint.pathTokens, index, originalSet);
      if (!pair) continue;
      const key = `${token}\u0000${pair.previous}\u0000${pair.next}`;
      if (!evidence.has(key)) evidence.set(key, new Set());
      evidence.get(key).add(hint.domain);
    }
  }

  const candidates = [...evidence.entries()]
    .filter(([, domains]) => domains.size >= 2)
    .map(([key, domains]) => {
      const [token, previous, next] = key.split('\u0000');
      return { token, previous, next, support: domains.size };
    })
    .sort((a, b) => b.support - a.support || a.token.localeCompare(b.token))
    .slice(0, 2);
  if (!candidates.length) return original;

  const output = [...originalTokens];
  let inserted = 0;
  for (const candidate of candidates) {
    const previousIndex = output.indexOf(candidate.previous);
    if (previousIndex < 0) continue;
    const nextIndex = output.indexOf(candidate.next, previousIndex + 1);
    if (nextIndex < 0 || nextIndex !== previousIndex + 1 + inserted) continue;
    output.splice(nextIndex, 0, candidate.token);
    inserted += 1;
  }
  return inserted ? output.join(' ') : original;
}

function identityTokens(value) {
  return tokens(value).filter((token) => token.length >= 2 && !/^\d+(?:\.\d+)?$/.test(token) && !IDENTITY_IGNORED.has(token));
}

function tokenPresent(token, values) {
  return values.some((candidate) => candidate === token || (token.length >= 5 && candidate.includes(token)));
}

function coverage(required, haystack) {
  if (!required.length) return 1;
  const matched = required.filter((token) => tokenPresent(token, haystack)).length;
  return matched / required.length;
}

function brandMatches(anchorBrand, title) {
  const required = identityTokens(anchorBrand);
  if (!required.length) return false;
  const haystack = identityTokens(title);
  return required.every((token) => tokenPresent(token, haystack));
}

function variantMatches(anchorVariant, title) {
  const required = identityTokens(anchorVariant);
  if (!required.length) return true;
  const haystack = identityTokens(title);
  return required.every((token) => tokenPresent(token, haystack));
}

function contextPackKey(context) {
  return clean(context?.requestedPackKey).toLowerCase()
    || clean(context?.anchor?.pack_normalized_key).toLowerCase()
    || parseClusterPackKey(context?.query)
    || null;
}

function normalizedShoppingRows(results) {
  return Array.isArray(results?.shopping_results) ? results.shopping_results : [];
}

function clusterCandidate(row, context, index) {
  if (!row || typeof row !== 'object') return null;
  const title = clean(row.title);
  const pageToken = clean(row.immersive_product_page_token);
  if (!title || !pageToken) return null;

  const anchor = context?.anchor && typeof context.anchor === 'object' ? context.anchor : {};
  const brand = clean(anchor.brand_name ?? anchor.brand);
  const productName = clean(anchor.product_name ?? anchor.name);
  if (!brand || !productName || !brandMatches(brand, title)) return null;

  const titleTokens = identityTokens(title);
  const productTokens = identityTokens(productName);
  const productCoverage = coverage(productTokens, titleTokens);
  if (productCoverage < 0.75) return null;

  const variantName = clean(anchor.variant_name);
  if (variantName && !variantMatches(variantName, title)) return null;

  const requestedPackKey = contextPackKey(context);
  const observedPackKey = parseClusterPackKey(title);
  if (requestedPackKey && observedPackKey && observedPackKey !== requestedPackKey) return null;

  const productId = clean(row.product_id) || null;
  const packEvidence = requestedPackKey && observedPackKey === requestedPackKey ? 1 : 0;
  const score = Math.round(productCoverage * 1000) + packEvidence * 100 + (variantName ? 25 : 0);

  return {
    raw: row,
    index,
    title,
    productId,
    pageToken,
    packNormalizedKey: observedPackKey ?? requestedPackKey,
    score,
  };
}

export function selectGoogleProductCluster(results, context = {}) {
  const candidates = normalizedShoppingRows(results)
    .map((row, index) => clusterCandidate(row, context, index))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  if (!candidates.length) return null;
  if (candidates.length > 1 && candidates[0].score === candidates[1].score) return null;

  const selected = candidates[0];
  return {
    productId: selected.productId,
    pageToken: selected.pageToken,
    title: selected.title,
    packNormalizedKey: selected.packNormalizedKey ?? null,
    providerPosition: Number.isFinite(Number(selected.raw?.position)) ? Number(selected.raw.position) : selected.index + 1,
    thumbnail: canonicalHttpsPage(selected.raw?.thumbnail) ? clean(selected.raw.thumbnail) : null,
  };
}

function currencyIsInr(row) {
  const explicit = clean(row?.currency).toUpperCase();
  if (explicit) return explicit === 'INR';
  const priceText = clean(row?.price);
  return /(?:₹|\bINR\b|\bRs\.?\s*)/i.test(priceText);
}

function hasMultipackEvidence(value) {
  const source = clean(value).toLowerCase().replace(/[-_]+/g, ' ');
  if (!source) return false;
  if (/\b(?:pack|packs|set|bundle)\s+(?:of\s+)?(?:[2-9]\d*)\b/i.test(source)) return true;
  if (/\b(?:[2-9]\d*)\s*(?:x|×|\*)\s*\d+(?:\.\d+)?\s*(?:ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|gm|gms|grams?|grammes?|g|kg|kilograms?)\b/i.test(source)) return true;
  if (/\b\d+(?:\.\d+)?\s*(?:ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|gm|gms|grams?|grammes?|g|kg|kilograms?)\s*(?:x|×|\*)\s*(?:[2-9]\d*)\b/i.test(source)) return true;
  return false;
}

function normalizedStore(row, context) {
  if (!row || typeof row !== 'object') return null;
  const merchant = clean(row.name ?? row.merchant_name ?? row.source);
  const sourceUrl = canonicalHttpsPage(row.link ?? row.source_url);
  const price = finiteNumber(row.extracted_price ?? row.price_value ?? row.price);
  if (!merchant || !sourceUrl || price === null || price <= 0 || !currencyIsInr(row)) return null;

  const anchor = context?.anchor && typeof context.anchor === 'object' ? context.anchor : {};
  const brand = clean(anchor.brand_name ?? anchor.brand);
  const productName = clean(anchor.product_name ?? anchor.name);
  const identityText = `${clean(row.title)} ${new URL(sourceUrl).pathname}`;
  if (hasMultipackEvidence(identityText)) return null;
  if (!brand || !productName || !brandMatches(brand, identityText)) return null;
  const productCoverage = coverage(identityTokens(productName), identityTokens(identityText));
  if (productCoverage < 0.75) return null;

  const requestedPackKey = contextPackKey(context);
  if (!requestedPackKey) return null;
  const storePackKey = parseClusterPackKey(row.title);
  if (storePackKey && storePackKey !== requestedPackKey) return null;

  const [packValueText, packUnit] = requestedPackKey.split(':');
  const packValue = finiteNumber(packValueText);
  if (packValue === null || packValue <= 0 || !['ml', 'g', 'count'].includes(packUnit)) return null;
  const packSizeText = `${stableNumber(packValue)} ${packUnit === 'count' ? 'count' : packUnit}`;

  return {
    merchant_name: merchant,
    platform_name: merchant,
    source_url: sourceUrl,
    observed_source_urls: [sourceUrl],
    price,
    currency: 'INR',
    market_country_code: 'IN',
    image_url: null,
    pack_size_text: packSizeText,
    pack_normalized_value: stableNumber(packValue),
    pack_normalized_unit: packUnit,
    pack_normalized_key: requestedPackKey,
    requested_pack_key: requestedPackKey,
    exact_product_match: true,
    variant_match: true,
    exact_pack_match: true,
    confidence: 96,
  };
}

function merchantKey(row) {
  return clean(row?.merchant_name).toLowerCase();
}

export function normalizeClusterStores(payload, context = {}) {
  const rows = Array.isArray(payload?.product_results?.stores) ? payload.product_results.stores : [];
  const cap = Math.max(0, Math.min(5, Math.trunc(Number(context?.shortfall) || 0)));
  if (!cap) return [];

  const byMerchant = new Map();
  for (const raw of rows) {
    const candidate = normalizedStore(raw, context);
    if (!candidate) continue;
    const key = merchantKey(candidate);
    const existing = byMerchant.get(key);
    if (!existing || candidate.price < existing.price || (candidate.price === existing.price && candidate.source_url.localeCompare(existing.source_url) < 0)) {
      byMerchant.set(key, candidate);
    }
  }

  return [...byMerchant.values()]
    .sort((a, b) => a.price - b.price || a.merchant_name.localeCompare(b.merchant_name) || a.source_url.localeCompare(b.source_url))
    .slice(0, cap);
}

export function clusterAcquisitionNeed(currentExactOffers = 0, target = 5) {
  const current = Math.max(0, Math.trunc(Number(currentExactOffers) || 0));
  const boundedTarget = Math.max(0, Math.min(5, Math.trunc(Number(target) || 0)));
  const shortfall = Math.max(0, boundedTarget - current);
  return { needed: shortfall > 0, shortfall, target: boundedTarget };
}
