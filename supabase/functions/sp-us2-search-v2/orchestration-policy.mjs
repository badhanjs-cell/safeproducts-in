function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function tokens(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function normalizeKey(value) {
  return tokens(value).join('');
}

export function parsePackKeyFromText(text) {
  const source = clean(text);
  const metric = source.match(/(?:^|[^a-z0-9])(\d+(?:\.\d+)?)\s*(ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|gm|gms|grams?|grammes?|g|kg|kilograms?)(?=$|[^a-z])/i);
  if (metric) {
    let value = Number(metric[1]);
    const token = metric[2].toLowerCase();
    let unit = 'g';
    if (token === 'l' || token.startsWith('lit')) { value *= 1000; unit = 'ml'; }
    else if (token === 'kg' || token.startsWith('kilogram')) { value *= 1000; unit = 'g'; }
    else if (token === 'ml' || token.startsWith('millilit')) unit = 'ml';
    const rounded = Math.round(value * 1_000_000) / 1_000_000;
    return rounded > 0 ? `${rounded}:${unit}` : null;
  }
  const count = source.match(/(?:^|[^a-z0-9])(\d+(?:\.\d+)?)\s*(capsules?|caps?|tablets?|tabs?|softgels?|sachets?|pieces?|pcs?|counts?|ct)(?=$|[^a-z])/i);
  if (!count) return null;
  const value = Math.round(Number(count[1]) * 1_000_000) / 1_000_000;
  return value > 0 ? `${value}:count` : null;
}

function productId(product) {
  return clean(product?.canonical_product_id) || clean(product?.product_fingerprint) || clean(product?.id);
}

function brandKey(product) {
  const brand = clean(product?.brand_name ?? product?.brand).replace(/\s+(?:men|women|baby|kids)$/i, '');
  return normalizeKey(brand) || '__unknown_brand__';
}

function packKey(product) {
  return clean(product?.pack_normalized_key).toLowerCase() || parsePackKeyFromText(product?.pack_size_text) || parsePackKeyFromText(product?.product_name ?? product?.name);
}

function price(product) {
  const parsed = number(product?.price);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function safetyScore(product) {
  if (product?.display_basis !== 'SAFETY_QUALIFIED' || product?.safety_determined !== true) return null;
  const parsed = number(product?.profile_score);
  return parsed !== null && parsed >= 0 && parsed <= 100 ? parsed : null;
}

function qualified(product) {
  return safetyScore(product) !== null;
}

function samePack(product, selectedPackKey) {
  return !selectedPackKey || packKey(product) === selectedPackKey;
}

function prefer(current, candidate) {
  if (qualified(current) !== qualified(candidate)) return qualified(candidate) ? candidate : current;
  const currentPrice = price(current);
  const candidatePrice = price(candidate);
  if (currentPrice === null && candidatePrice !== null) return candidate;
  if (currentPrice !== null && candidatePrice !== null && candidatePrice < currentPrice) return candidate;
  return current;
}

function onePerBrand(products, limit, excludedBrands = new Set()) {
  const byBrand = new Map();
  const order = [];
  for (const product of products) {
    const id = productId(product);
    if (!id) continue;
    const brand = brandKey(product);
    if (excludedBrands.has(brand)) continue;
    if (!byBrand.has(brand)) {
      byBrand.set(brand, product);
      order.push(brand);
    } else {
      byBrand.set(brand, prefer(byBrand.get(brand), product));
    }
  }
  return order.slice(0, limit).map((brand) => byBrand.get(brand));
}

function exactOffers(products, selectedPackKey) {
  return products
    .filter((product) => product?.result_group === 'EXACT_OFFER' && samePack(product, selectedPackKey))
    .sort((a, b) => (price(a) ?? Infinity) - (price(b) ?? Infinity))
    .slice(0, 5);
}

function coreAlternatives(products, selectedPackKey) {
  return products.filter((product) => product?.result_group === 'ALTERNATIVE' && samePack(product, selectedPackKey));
}

function categoryProducts(products, selectedPackKey) {
  return products.filter((product) => (product?.result_group === 'CATEGORY_PRODUCT' || !product?.result_group) && samePack(product, selectedPackKey));
}

function bestChoice(products) {
  const distinct = new Map();
  for (const product of products) {
    const id = productId(product);
    const s = safetyScore(product);
    const p = price(product);
    if (!id || s === null || p === null) continue;
    const existing = distinct.get(id);
    if (!existing || p < price(existing)) distinct.set(id, product);
  }
  const rows = [...distinct.values()];
  if (!rows.length) return null;
  const prices = rows.map(price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const scored = rows.map((product) => {
    const priceValue = max === min ? 1 : 1 - ((price(product) - min) / (max - min));
    return { product, value: 0.7 * (safetyScore(product) / 100) + 0.3 * priceValue };
  });
  scored.sort((a, b) => b.value - a.value || safetyScore(b.product) - safetyScore(a.product) || price(a.product) - price(b.product));
  return scored[0].product;
}

function safest(products) {
  return products.filter((product) => safetyScore(product) !== null).sort((a, b) => safetyScore(b) - safetyScore(a))[0] ?? null;
}

function lowest(products) {
  return products.filter((product) => price(product) !== null).sort((a, b) => price(a) - price(b))[0] ?? null;
}

const SPECIFIC_PRODUCT_TYPE_QUERIES = [
  [/\bafter[ -]?shave\s+lotion\b/i, 'after shave lotion'],
  [/\bafter[ -]?shave\s+balm\b/i, 'after shave balm'],
  [/\bafter[ -]?shave\b/i, 'after shave'],
  [/\bshav(?:e|ing)[ -]*(?:cream|creme)\b/i, 'shaving cream'],
  [/\bshav(?:e|ing)[ -]*foam\b/i, 'shaving foam'],
  [/\bshav(?:e|ing)[ -]*gel\b/i, 'shaving gel'],
];

function specificProductTypeQuery(anchor) {
  for (const value of [clean(anchor?.category), clean(anchor?.product_name ?? anchor?.name)]) {
    if (!value) continue;
    const match = SPECIFIC_PRODUCT_TYPE_QUERIES.find(([pattern]) => pattern.test(value));
    if (match) return match[1];
  }
  return null;
}

export function specificAlternativeQuery(coreResponse, fallbackQuery) {
  const products = Array.isArray(coreResponse?.products) ? coreResponse.products : [];
  const anchor = products.find((product) => product?.result_group === 'EXACT_OFFER') ?? products[0] ?? null;
  if (!anchor) return fallbackQuery;
  const productTypeQuery = specificProductTypeQuery(anchor);
  if (productTypeQuery) return productTypeQuery;
  const brandTokens = new Set(tokens(anchor.brand_name ?? anchor.brand));
  const ignored = new Set(['ml','milliliter','milliliters','millilitre','millilitres','l','liter','liters','litre','litres','g','gm','gms','gram','grams','gramme','grammes','kg','kilogram','kilograms','capsule','capsules','cap','caps','tablet','tablets','tab','tabs','softgel','softgels','sachet','sachets','piece','pieces','pcs','count','counts','ct']);
  const productTokens = tokens(anchor.product_name ?? anchor.name).filter((token) => !brandTokens.has(token) && !ignored.has(token) && !/^\d+(?:\.\d+)?$/.test(token));
  const query = productTokens.join(' ').trim();
  return query || clean(anchor.category) || fallbackQuery;
}

export function coreNeedsDiscovery(coreResponse, limit = 10) {
  const products = Array.isArray(coreResponse?.products) ? coreResponse.products : [];
  const mode = coreResponse?.search_mode === 'SPECIFIC_PRODUCT' ? 'SPECIFIC_PRODUCT' : 'CATEGORY';
  if (mode === 'SPECIFIC_PRODUCT') return products.filter((product) => product?.result_group === 'ALTERNATIVE').length < 5;
  const brands = new Set(products.map(brandKey));
  return brands.size < Math.min(6, Math.max(1, Number(limit) || 10));
}

export function discoveryTargetCount(coreResponse, limit = 10) {
  const products = Array.isArray(coreResponse?.products) ? coreResponse.products : [];
  const mode = coreResponse?.search_mode === 'SPECIFIC_PRODUCT' ? 'SPECIFIC_PRODUCT' : 'CATEGORY';
  if (mode === 'SPECIFIC_PRODUCT') return Math.max(1, 5 - products.filter((product) => product?.result_group === 'ALTERNATIVE').length);
  const brands = new Set(products.map(brandKey));
  return Math.max(1, Math.min(6, Math.max(1, Number(limit) || 10)) - brands.size);
}

export function googleClusterAcquisitionNeed(response = {}) {
  const mode = response?.search_mode === 'SPECIFIC_PRODUCT' ? 'SPECIFIC_PRODUCT' : 'CATEGORY';
  if (mode !== 'SPECIFIC_PRODUCT') {
    return { eligible: false, currentExactOffers: 0, targetExactOffers: 0 };
  }
  const products = Array.isArray(response?.products) ? response.products : [];
  const currentExactOffers = Math.min(5, products.filter((product) => product?.result_group === 'EXACT_OFFER').length);
  const targetExactOffers = Math.max(0, 5 - currentExactOffers);
  const anchor = response?.anchor_product;
  return {
    eligible: targetExactOffers > 0 && !!clean(anchor?.canonical_product_id),
    currentExactOffers,
    targetExactOffers,
  };
}

function safeHttps(value) {
  const raw = clean(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function exactMerchantKey(product) {
  return clean(product?.offer_merchant ?? product?.merchant_name ?? product?.platform_name ?? product?.source_domain).toLowerCase();
}

function priceOnlyExactBase(anchor) {
  const fingerprint = clean(anchor?.canonical_product_fingerprint) || clean(anchor?.product_fingerprint) || clean(anchor?.canonical_product_id);
  return {
    ...anchor,
    canonical_product_fingerprint: fingerprint,
    product_fingerprint: fingerprint,
    display_basis: 'PRICE_ONLY_FALLBACK',
    safety_determined: false,
    safety_score: null,
    profile_score: null,
    child_score: null,
    pregnancy_score: null,
    senior_score: null,
    ingredient_qualification_decision: 'NOT_QUALIFIED',
    safety_status_label: 'Safety Score could not be determined due to insufficient ingredient evidence.',
    safety_unavailable_reason: 'SEARCH_DISCOVERY_IDENTITY_OR_INGREDIENT_EVIDENCE_PENDING',
    safety_warnings: [],
    recovery_status: 'NOT_REQUIRED',
  };
}

function clusterOfferCard(row, anchor, template, selectedPackKey) {
  if (!row || typeof row !== 'object' || row.verified !== true || row.exact_pack_match !== true) return null;
  const anchorId = clean(anchor?.canonical_product_id);
  const rowProductId = clean(row.product_id);
  if (!anchorId || (rowProductId && rowProductId !== anchorId)) return null;
  const rowPack = clean(row.pack_normalized_key).toLowerCase();
  if (selectedPackKey && rowPack !== clean(selectedPackKey).toLowerCase()) return null;
  const rowPrice = price(row);
  const sourceUrl = safeHttps(row.source_url);
  const merchant = clean(row.merchant_name ?? row.platform_name ?? row.source_domain);
  const currency = clean(row.currency || 'INR').toUpperCase();
  if (rowPrice === null || !sourceUrl || !merchant || currency !== 'INR') return null;

  const base = template ? { ...template } : priceOnlyExactBase(anchor);
  const canonicalFingerprint = clean(base.canonical_product_fingerprint) || clean(anchor?.canonical_product_fingerprint) || clean(anchorId);
  const offerId = clean(row.id ?? row.offer_id) || sourceUrl;
  return {
    ...base,
    canonical_product_id: anchorId,
    canonical_product_fingerprint: canonicalFingerprint,
    product_fingerprint: `${canonicalFingerprint}::offer::${offerId}`,
    merchant_offer_id: offerId,
    result_group: 'EXACT_OFFER',
    offer_merchant: merchant,
    price: rowPrice,
    price_text: `₹${rowPrice}`,
    currency: 'INR',
    original_product_url: sourceUrl,
    image_url: safeHttps(row.image_url) ?? base.image_url ?? null,
    pack_size_text: clean(row.pack_size_text) || base.pack_size_text || null,
    pack_normalized_key: rowPack || selectedPackKey || base.pack_normalized_key || null,
  };
}

export function mergeGoogleClusterExactOffers(coreResponse = {}, exactOfferRows = [], selectedPackKey = null) {
  if (coreResponse?.search_mode !== 'SPECIFIC_PRODUCT') return coreResponse;
  const products = Array.isArray(coreResponse?.products) ? coreResponse.products : [];
  const anchor = coreResponse?.anchor_product ?? products.find((product) => product?.result_group === 'EXACT_OFFER') ?? null;
  if (!anchor?.canonical_product_id) return coreResponse;

  const existingExact = products.filter((product) => product?.result_group === 'EXACT_OFFER' && samePack(product, selectedPackKey)).slice(0, 5);
  const template = existingExact.find((product) => qualified(product)) ?? existingExact[0] ?? null;
  const existingMerchants = new Set(existingExact.map(exactMerchantKey).filter(Boolean));
  const newByMerchant = new Map();
  for (const row of Array.isArray(exactOfferRows) ? exactOfferRows : []) {
    const candidate = clusterOfferCard(row, anchor, template, selectedPackKey);
    if (!candidate) continue;
    const merchant = exactMerchantKey(candidate);
    if (!merchant || existingMerchants.has(merchant)) continue;
    const current = newByMerchant.get(merchant);
    if (!current || (price(candidate) ?? Infinity) < (price(current) ?? Infinity)) newByMerchant.set(merchant, candidate);
  }
  const shortfall = Math.max(0, 5 - existingExact.length);
  const additions = [...newByMerchant.values()]
    .sort((a, b) => (price(a) ?? Infinity) - (price(b) ?? Infinity) || exactMerchantKey(a).localeCompare(exactMerchantKey(b)))
    .slice(0, shortfall);
  const mergedExact = [...existingExact, ...additions]
    .sort((a, b) => (price(a) ?? Infinity) - (price(b) ?? Infinity) || exactMerchantKey(a).localeCompare(exactMerchantKey(b)));
  const nonExact = products.filter((product) => product?.result_group !== 'EXACT_OFFER');
  return { ...coreResponse, products: [...mergedExact, ...nonExact] };
}

export function acquisitionNeed(response = {}, limit = 10) {
  const products = Array.isArray(response?.products) ? response.products : [];
  const mode = response?.search_mode === 'SPECIFIC_PRODUCT' ? 'SPECIFIC_PRODUCT' : 'CATEGORY';

  if (mode === 'SPECIFIC_PRODUCT') {
    const currentExactOffers = products.filter((product) => product?.result_group === 'EXACT_OFFER').length;
    const currentAlternatives = new Set(
      products
        .filter((product) => product?.result_group === 'ALTERNATIVE')
        .map(brandKey),
    ).size;
    return {
      needed: currentExactOffers < 5 || currentAlternatives < 5,
      foregroundEligible: true,
      searchMode: 'SPECIFIC_PRODUCT',
      currentExactOffers,
      currentAlternatives,
      currentDistinctBrands: 0,
      targetExactOffers: Math.max(0, 5 - currentExactOffers),
      targetAlternatives: Math.max(0, 5 - currentAlternatives),
      targetCategoryProducts: 0,
      minimumUsefulFloor: 0,
    };
  }

  const targetCategoryProducts = Math.max(1, Math.min(Math.trunc(Number(limit) || 10), 10));
  const currentDistinctBrands = new Set(
    products
      .filter((product) => product?.result_group === 'CATEGORY_PRODUCT' || !product?.result_group)
      .map(brandKey),
  ).size;
  const minimumUsefulFloor = Math.min(6, targetCategoryProducts);
  return {
    needed: currentDistinctBrands < targetCategoryProducts,
    foregroundEligible: currentDistinctBrands < minimumUsefulFloor,
    searchMode: 'CATEGORY',
    currentExactOffers: 0,
    currentAlternatives: 0,
    currentDistinctBrands,
    targetExactOffers: 0,
    targetAlternatives: Math.max(0, targetCategoryProducts - currentDistinctBrands),
    targetCategoryProducts,
    minimumUsefulFloor,
  };
}

export function mergeSearchResponses(coreResponse = {}, discoveryResponse = null, { query = '', limit = 10 } = {}) {
  const coreProducts = Array.isArray(coreResponse?.products) ? coreResponse.products : [];
  const discoveredProducts = Array.isArray(discoveryResponse?.products) ? discoveryResponse.products : [];
  const searchMode = coreResponse?.search_mode === 'SPECIFIC_PRODUCT' ? 'SPECIFIC_PRODUCT' : 'CATEGORY';
  const explicitPackKey = parsePackKeyFromText(query);
  const corePackKey = clean(coreResponse?.selected_pack?.normalized_key).toLowerCase() || null;
  const discoveryPackKey = clean(discoveryResponse?.selected_pack?.normalized_key).toLowerCase() || null;
  const coreFallback = coreResponse?.selected_pack?.source === 'MARKET_STANDARD_FALLBACK'
    && coreResponse?.selected_pack?.fallback_applied === true
    && !!corePackKey;
  const discoveryFallback = discoveryResponse?.selected_pack?.source === 'MARKET_STANDARD_FALLBACK'
    && discoveryResponse?.selected_pack?.fallback_applied === true
    && !!discoveryPackKey
    && (!explicitPackKey || (
      discoveryResponse.selected_pack.requested_normalized_key === explicitPackKey
      && discoveryPackKey.split(':')[1] === explicitPackKey.split(':')[1]
    ));
  const requestedSupply = explicitPackKey && [...coreProducts, ...discoveredProducts].some((product) => packKey(product) === explicitPackKey);
  const selectedPackKey = requestedSupply ? explicitPackKey
    : coreFallback ? corePackKey
      : discoveryFallback ? discoveryPackKey
        : (explicitPackKey || corePackKey || discoveryPackKey);

  let products;
  if (searchMode === 'SPECIFIC_PRODUCT') {
    const exact = exactOffers(coreProducts, selectedPackKey);
    const anchor = coreResponse?.anchor_product ?? exact[0];
    const anchorId = productId(anchor);
    const anchorBrand = anchor ? brandKey(anchor) : null;
    const excludedBrands = new Set(anchorBrand ? [anchorBrand] : []);
    const notAnchor = (product) => !anchorId || productId(product) !== anchorId;
    const existing = coreAlternatives(coreProducts, selectedPackKey).filter(notAnchor);
    const discovered = discoveredProducts.filter((product) => notAnchor(product) && samePack(product, selectedPackKey)).map((product) => ({ ...product, result_group: 'ALTERNATIVE' }));
    const alternatives = onePerBrand([...existing, ...discovered], 5, excludedBrands).map((product) => ({ ...product, result_group: 'ALTERNATIVE' }));
    products = [...exact, ...alternatives];
  } else {
    const existing = categoryProducts(coreProducts, selectedPackKey);
    const discovered = discoveredProducts.filter((product) => samePack(product, selectedPackKey)).map((product) => ({ ...product, result_group: 'CATEGORY_PRODUCT' }));
    products = onePerBrand([...existing, ...discovered], Math.max(1, Math.min(Number(limit) || 10, 10))).map((product) => ({ ...product, result_group: 'CATEGORY_PRODUCT' }));
  }

  if (!selectedPackKey) products = products.map((product) => ({ ...product, price: null, price_text: null }));

  const safetyQualified = products.filter((product) => qualified(product));
  const safetyPending = products.filter((product) => !qualified(product));
  const selectedPack = corePackKey === selectedPackKey && coreResponse?.selected_pack
    ? { ...coreResponse.selected_pack }
    : discoveryPackKey === selectedPackKey && discoveryResponse?.selected_pack
      ? { ...discoveryResponse.selected_pack, text: discoveryResponse.selected_pack.text ?? selectedPackKey }
      : { text: selectedPackKey, normalized_key: selectedPackKey, source: explicitPackKey ? 'USER' : null };
  const requestedText = clean(selectedPack?.requested_text) || (explicitPackKey ? clean(query).match(/\d+(?:\.\d+)?\s*(?:ml|g|gm|grams?|capsules?|tablets?|count|ct)/i)?.[0] ?? explicitPackKey : '');
  const selectedText = clean(selectedPack?.text) || selectedPackKey || '';
  const packFallbackNotice = selectedPack?.source === 'MARKET_STANDARD_FALLBACK' && selectedPack?.fallback_applied === true
    ? `Requested pack ${requestedText || selectedPack?.requested_normalized_key || 'size'} was not available in comparable market evidence; showing uniform market-standard pack ${selectedText}.`
    : null;
  const safetyNotice = safetyPending.length
    ? 'Some displayed products do not yet have sufficient identity or ingredient evidence for a Safety Score.'
    : safetyQualified.length
      ? 'Safety Scores are based on qualified ingredient evidence for the identified product formula.'
      : 'No matching products were available.';

  return {
    contract_version: 'SP-US2/1.0',
    status: safetyQualified.length && safetyPending.length
      ? 'PARTIAL_SAFETY_WITH_PRICE_FALLBACK'
      : safetyQualified.length
        ? 'READY'
        : products.length ? 'PRICE_ONLY_FALLBACK_READY' : 'SOURCE_SHORTFALL_BELOW_SIX',
    profile: coreResponse?.profile ?? 'ALL',
    search_mode: searchMode,
    selected_pack: selectedPack,
    anchor_product: coreResponse?.anchor_product ?? null,
    products,
    safest_product: safest(products),
    lowest_price_product: lowest(products),
    best_value_product: selectedPackKey ? bestChoice(products) : null,
    price_fallback_count: safetyPending.length,
    safety_qualified_count: safetyQualified.length,
    fallback_safety_claim: false,
    trust_promise: coreResponse?.trust_promise ?? 'We determine safety from qualified ingredient evidence when possible. If ingredient evidence is insufficient, the product may still be shown with a clear notice that its Safety Score could not be determined.',
    trust_promise_display_required: safetyPending.length > 0,
    consumer_notice: packFallbackNotice ? `${packFallbackNotice} ${safetyNotice}` : safetyNotice,
    ranking_version: 'SP-US2-RANKING/1.0',
    m1b_meta: {
      ...(coreResponse?.m1b_meta && typeof coreResponse.m1b_meta === 'object' ? coreResponse.m1b_meta : {}),
      discovery_telemetry: discoveryResponse?.telemetry ?? null,
    },
    function_version: 'SP-US2-SEARCH/2.0',
  };
}