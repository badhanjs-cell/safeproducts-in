function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function finiteNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedPackNumber(value) {
  const parsed = finiteNumber(value);
  if (parsed === null || parsed <= 0) return null;
  const rounded = Math.round(parsed * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function packKey(value, unit) {
  const amount = normalizedPackNumber(value);
  if (amount === null || !['ml', 'g', 'count'].includes(unit)) return null;
  return `${amount}:${unit}`;
}

function parsePackKeyText(value) {
  const raw = clean(value).toLowerCase();
  const match = raw.match(/^(\d+(?:\.\d+)?):(ml|g|count)$/);
  return match ? packKey(match[1], match[2]) : null;
}

function packTextFromKey(value) {
  const key = parsePackKeyText(value);
  if (!key) return null;
  const [amount, unit] = key.split(':');
  return unit === 'count' ? `${amount} count` : `${amount} ${unit}`;
}

function parsePackText(value) {
  const raw = clean(value);
  if (!raw) return null;
  const metric = raw.match(/(?:^|[^a-z0-9])(\d+(?:\.\d+)?)\s*(ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|gm|gms|grams?|grammes?|g|kg|kilograms?)(?=$|[^a-z])/i);
  if (metric) {
    let amount = Number(metric[1]);
    const token = metric[2].toLowerCase();
    let unit = 'g';
    if (token === 'l' || token.startsWith('lit')) { amount *= 1000; unit = 'ml'; }
    else if (token === 'kg' || token.startsWith('kilogram')) { amount *= 1000; unit = 'g'; }
    else if (token === 'ml' || token.startsWith('millilit')) unit = 'ml';
    return packKey(amount, unit);
  }
  const count = raw.match(/(?:^|[^a-z0-9])(\d+(?:\.\d+)?)\s*(capsules?|caps?|tablets?|tabs?|softgels?|sachets?|pieces?|pcs?|counts?|ct)(?=$|[^a-z])/i);
  return count ? packKey(count[1], 'count') : null;
}

function ambiguousPackText(value) {
  const text = clean(value);
  const unit = '(?:ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|gm|gms|grams?|grammes?|g|kg|kilograms?|capsules?|caps?|tablets?|tabs?|softgels?|sachets?|pieces?|pcs?|counts?|ct)';
  const amounts = [...text.matchAll(new RegExp(`(?:^|[^a-z0-9])([0-9]+(?:[.][0-9]+)?[ ]*${unit})(?=$|[^a-z])`, 'gi'))];
  const keys = new Set(amounts.map((match) => parsePackText(match[1])).filter(Boolean));
  if (keys.size > 1 || new RegExp(`${unit}[ ]*\\+[ ]*[0-9]`, 'i').test(text)) return true;
  const multiplier = text.match(new RegExp(`\\b([0-9]+)[ ]*[x×][ ]*[0-9]+(?:[.][0-9]+)?[ ]*${unit}\\b`, 'i'));
  if (multiplier && Number(multiplier[1]) > 1) return true;
  const suffixMultiplier = text.match(new RegExp(`[0-9]+(?:[.][0-9]+)?[ ]*${unit}[ ]*[x×][ ]*([0-9]+)\\b`, 'i'));
  if (suffixMultiplier && Number(suffixMultiplier[1]) > 1) return true;
  const packCount = text.match(/\b(?:pack|set)[ -]*(?:of[ -]*)?([0-9]+)\b/i);
  if (packCount && Number(packCount[1]) > 1 && !keys.has(`${Number(packCount[1])}:count`)) return true;
  const packageCount = text.match(/\b([0-9]+)[ -]*(?:packs?|bottles?|tubes?|bars?)\b/i);
  return !!packageCount && Number(packageCount[1]) > 1;
}

function normalizedPack(raw) {
  if (ambiguousPackText(raw?.pack_size_text)) return null;
  const explicit = parsePackKeyText(raw?.pack_normalized_key);
  const derived = parsePackText(raw?.pack_size_text);
  if (explicit && derived && explicit !== derived) return null;
  return explicit || derived;
}

function packUnit(key) {
  const parsed = parsePackKeyText(key);
  return parsed ? parsed.split(':')[1] : null;
}

function eligibleObservation(raw) {
  const rank = finiteNumber(raw?.candidate_rank);
  return rank === null || rank >= 1;
}

function modalObservedPack(rows, unit = null) {
  const counts = new Map();
  const order = [];
  for (const raw of rows) {
    if (!eligibleObservation(raw)) continue;
    const key = normalizedPack(raw);
    if (!key || (unit && packUnit(key) !== unit)) continue;
    if (!counts.has(key)) order.push(key);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = null;
  let count = 0;
  for (const key of order) {
    const current = counts.get(key) ?? 0;
    if (current > count) { best = key; count = current; }
  }
  return best;
}

export function sourcePageKey(value) {
  const raw = clean(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const path = (url.pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/');
    return `${url.origin.toLowerCase()}${path}`;
  } catch {
    return null;
  }
}

const FORBIDDEN_KEYS = new Set([
  'safety_score',
  'profile_score',
  'safety_determined',
  'safety_warnings',
  'ingredients',
  'detected_ingredients',
  'ingredient_declaration',
  'recommendation',
  'best_choice',
  'regulatory_approval',
  'regulatory_status',
  'identity_status',
]);

function hasForbiddenAuthorityField(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasForbiddenAuthorityField);
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) return true;
    if (hasForbiddenAuthorityField(child)) return true;
  }
  return false;
}

function normalizedCountry(raw, fallback = 'IN') {
  return clean(raw || fallback).toUpperCase();
}

function normalizedCurrency(raw, fallback = 'INR') {
  return clean(raw || fallback).toUpperCase();
}

function sourceHost(pageKey) {
  try { return new URL(pageKey).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}

function merchantPageKey(value) {
  const page = sourcePageKey(value);
  if (!page) return null;
  const url = new URL(page);
  if (/(^|\.)(?:google\.[a-z.]+|bing\.com|serpapi\.com|googleadservices\.com|googleusercontent\.com)$/.test(url.hostname)) return null;
  if (url.pathname === '/' || /^\/(?:search|s|url|redirect|shopping)(?:\/|$)/i.test(url.pathname)) return null;
  return page;
}

export function normalizeMakeProduct(raw, context = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || hasForbiddenAuthorityField(raw)) return null;
  if (ambiguousPackText(raw.pack_size_text)) return null;
  const ref = clean(raw.ref);
  const brand = clean(raw.brand_name);
  const product = clean(raw.product_name);
  const sourceUrl = clean(raw.source_url);
  const page = merchantPageKey(sourceUrl);
  const market = normalizedCountry(raw.market_country_code, context.marketCountryCode || 'IN');
  const expectedMarket = normalizedCountry(context.marketCountryCode || 'IN');
  const confidence = finiteNumber(raw.identity_confidence);
  const pack = normalizedPack(raw);
  const requiredPack = parsePackKeyText(context.effectivePackKey || context.requestedPackKey);

  if (!ref || ref.length > 100 || !brand || brand.length > 200 || !product || product.length > 300 || !page) return null;
  if (market !== expectedMarket || expectedMarket !== 'IN') return null;
  if (confidence === null || confidence < 0 || confidence > 100) return null;
  if (clean(raw.pack_normalized_key) && !parsePackKeyText(raw.pack_normalized_key)) return null;
  if (requiredPack && pack !== requiredPack) return null;

  return {
    ref,
    brand_name: brand,
    product_name: product,
    variant_name: clean(raw.variant_name) || null,
    category: clean(raw.category) || null,
    pack_size_text: packTextFromKey(pack) || clean(raw.pack_size_text) || null,
    pack_normalized_key: pack,
    source_url: sourceUrl,
    source_page_key: page,
    source_name: clean(raw.source_name) || null,
    identity_confidence: confidence,
    market_country_code: 'IN',
  };
}

export function normalizeMakeOffer(raw, context = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || hasForbiddenAuthorityField(raw)) return null;
  if (ambiguousPackText(raw.pack_size_text)) return null;
  const productRef = clean(raw.product_ref);
  const sourceUrl = clean(raw.source_url);
  const page = merchantPageKey(sourceUrl);
  const observedRaw = Array.isArray(raw.observed_source_urls) ? raw.observed_source_urls : [];
  const observedPages = [...new Set(observedRaw.map(sourcePageKey).filter(Boolean))];
  const market = normalizedCountry(raw.market_country_code, context.marketCountryCode || 'IN');
  const expectedMarket = normalizedCountry(context.marketCountryCode || 'IN');
  const currency = normalizedCurrency(raw.currency, context.currency || 'INR');
  const expectedCurrency = normalizedCurrency(context.currency || 'INR');
  const price = finiteNumber(raw.price);
  const confidence = finiteNumber(raw.confidence);
  const pack = normalizedPack(raw);
  const requiredPack = parsePackKeyText(context.effectivePackKey || context.requestedPackKey);

  if (!productRef || productRef.length > 100 || !page || !observedPages.includes(page)) return null;
  if (market !== expectedMarket || expectedMarket !== 'IN' || currency !== expectedCurrency || expectedCurrency !== 'INR') return null;
  if (price === null || price <= 0 || confidence === null || confidence < 90 || confidence > 100) return null;
  if (raw.exact_product_match !== true || raw.variant_match !== true) return null;
  if (clean(raw.pack_normalized_key) && !parsePackKeyText(raw.pack_normalized_key)) return null;
  if (requiredPack && (pack !== requiredPack || raw.exact_pack_match !== true)) return null;
  if (pack && raw.exact_pack_match !== true) return null;

  return {
    product_ref: productRef,
    merchant_name: clean(raw.merchant_name) || null,
    platform_name: clean(raw.platform_name) || null,
    source_url: sourceUrl,
    source_page_key: page,
    source_domain: sourceHost(page),
    observed_source_urls: observedRaw.filter((value) => sourcePageKey(value)),
    price,
    currency: 'INR',
    market_country_code: 'IN',
    image_url: sourcePageKey(raw.image_url) ? clean(raw.image_url) : null,
    pack_size_text: packTextFromKey(pack) || clean(raw.pack_size_text) || null,
    pack_normalized_key: pack,
    exact_product_match: true,
    variant_match: true,
    exact_pack_match: raw.exact_pack_match === true,
    confidence,
  };
}

function fail(code) {
  return { ok: false, code };
}

// A Shopping query can return adjacent product types. These lexical checks only
// exclude mismatches; they do not establish canonical identity or category.
function matchesRequestedProductType(product, query) {
  const patterns = [
    /\bafter[ -]?shave\b/i,
    /\bshav(?:e|ing)[ -]*(?:cream|creme|foam|gel)\b/i,
    /\bshampoo\b/i,
    /\btoothpaste\b/i,
    /\bsunscreen\b/i,
    /\bsoap\b/i,
    /\blotion\b/i,
    /\b(?:perfume|parfum|eau de toilette)\b/i,
  ];
  const expected = patterns.find(pattern => pattern.test(clean(query)));
  if (!expected) return true;
  return expected.test(clean(product.product_name)) && expected.test(clean(product.pack_size_text));
}

function resolvePack(payload, requestContext, rawFacts) {
  const contextRequestedRaw = clean(requestContext.requestedPackKey);
  const payloadRequestedRaw = clean(payload.requested_pack_key);
  const contextRequested = contextRequestedRaw ? parsePackKeyText(contextRequestedRaw) : null;
  const payloadRequested = payloadRequestedRaw ? parsePackKeyText(payloadRequestedRaw) : null;
  if ((contextRequestedRaw && !contextRequested) || (payloadRequestedRaw && !payloadRequested)) return fail('PACK_RESOLUTION_INVALID');
  if (contextRequested && payloadRequested && contextRequested !== payloadRequested) return fail('PACK_RESOLUTION_INVALID');

  const requestedPackKey = contextRequested || payloadRequested || null;
  const resolutionRequested = clean(payload.pack_resolution).toUpperCase() || 'REQUESTED';
  if (!['REQUESTED', 'MARKET_STANDARD_FALLBACK', 'AUTO_REQUESTED_OR_MARKET_STANDARD'].includes(resolutionRequested)) {
    return fail('PACK_RESOLUTION_INVALID');
  }
  const resolvedRaw = clean(payload.resolved_pack_key);
  const explicitResolved = resolvedRaw ? parsePackKeyText(resolvedRaw) : null;
  if (resolvedRaw && !explicitResolved) return fail('PACK_RESOLUTION_INVALID');

  const observed = rawFacts.filter((raw) => eligibleObservation(raw)
    && (normalizeMakeOffer(raw) || normalizeMakeProduct(raw)));
  const requestedObserved = requestedPackKey && observed.some((raw) => normalizedPack(raw) === requestedPackKey);
  let resolvedPackKey = explicitResolved || requestedPackKey || null;
  let packResolution = resolutionRequested;

  if (resolutionRequested === 'REQUESTED') {
    if (requestedPackKey && explicitResolved && explicitResolved !== requestedPackKey) return fail('PACK_RESOLUTION_INVALID');
    resolvedPackKey = requestedPackKey || explicitResolved || null;
  } else if (resolutionRequested === 'MARKET_STANDARD_FALLBACK') {
    if (!requestedPackKey) return fail('PACK_RESOLUTION_INVALID');
    resolvedPackKey = explicitResolved || modalObservedPack(observed, packUnit(requestedPackKey));
    if (!resolvedPackKey || resolvedPackKey === requestedPackKey || packUnit(resolvedPackKey) !== packUnit(requestedPackKey)) {
      return fail('PACK_RESOLUTION_INVALID');
    }
  } else {
    if (requestedPackKey && requestedObserved) {
      resolvedPackKey = requestedPackKey;
      packResolution = 'REQUESTED';
    } else if (requestedPackKey) {
      resolvedPackKey = modalObservedPack(observed, packUnit(requestedPackKey));
      if (resolvedPackKey && resolvedPackKey !== requestedPackKey) packResolution = 'MARKET_STANDARD_FALLBACK';
      else { resolvedPackKey = requestedPackKey; packResolution = 'REQUESTED'; }
    } else {
      resolvedPackKey = modalObservedPack(observed);
      packResolution = resolvedPackKey ? 'MARKET_STANDARD_FALLBACK' : 'REQUESTED';
    }
    if (explicitResolved && explicitResolved !== resolvedPackKey) return fail('PACK_RESOLUTION_INVALID');
  }

  if (requestedPackKey && resolvedPackKey && packUnit(requestedPackKey) !== packUnit(resolvedPackKey)) {
    return fail('PACK_RESOLUTION_INVALID');
  }
  return { ok: true, requestedPackKey, resolvedPackKey, packResolution, resolutionRequested };
}

export function validateMakeCallback(payload, requestContext = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fail('PAYLOAD_OBJECT_REQUIRED');
  if (hasForbiddenAuthorityField(payload)) return fail('AUTHORITY_FIELDS_FORBIDDEN');
  if (payload.contract_version !== 'SP-US2-MAKE-CALLBACK/1.0') return fail('CONTRACT_VERSION_INVALID');
  const requestId = clean(payload.request_id);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return fail('REQUEST_ID_INVALID');

  const marketCountryCode = normalizedCountry(requestContext.marketCountryCode || payload.market_country_code || 'IN');
  const currency = normalizedCurrency(requestContext.currency || payload.currency || 'INR');
  if (marketCountryCode !== 'IN' || normalizedCountry(payload.market_country_code || 'IN') !== 'IN') return fail('MARKET_INVALID');
  if (currency !== 'INR' || normalizedCurrency(payload.currency || 'INR') !== 'INR') return fail('CURRENCY_INVALID');

  const rawProducts = Array.isArray(payload.products) ? payload.products : null;
  const rawOffers = Array.isArray(payload.offers) ? payload.offers : null;
  if (!rawProducts || !rawOffers || rawProducts.length > 10 || rawOffers.length > 10) return fail('ARRAY_BOUNDS_INVALID');

  const rawFacts = [...rawProducts, ...rawOffers];
  const packResolution = resolvePack(payload, requestContext, rawFacts);
  if (!packResolution.ok) return packResolution;
  const effectivePackKey = packResolution.resolvedPackKey;

  if (effectivePackKey && packResolution.resolutionRequested !== 'AUTO_REQUESTED_OR_MARKET_STANDARD') {
    const eligibleFacts = rawFacts.filter(eligibleObservation);
    if (eligibleFacts.some((raw) => normalizedPack(raw) !== effectivePackKey)) return fail('PACK_RESOLUTION_INVALID');
  }

  const productsToValidate = rawProducts.filter((raw) => eligibleObservation(raw) && (!effectivePackKey || normalizedPack(raw) === effectivePackKey));
  const offersToValidate = rawOffers.filter((raw) => eligibleObservation(raw) && (!effectivePackKey || normalizedPack(raw) === effectivePackKey));

  if (productsToValidate.some(product => product.ref !== 'ANCHOR' && !matchesRequestedProductType(product, requestContext.query))) {
    return fail('PRODUCT_RELEVANCE_INVALID');
  }

  const context = {
    marketCountryCode: 'IN',
    currency: 'INR',
    requestedPackKey: packResolution.requestedPackKey,
    effectivePackKey,
  };
  const products = productsToValidate.map((raw) => normalizeMakeProduct(raw, context));
  const offers = offersToValidate.map((raw) => normalizeMakeOffer(raw, context));
  if (products.some((row) => !row) || offers.some((row) => !row)) return fail('FACT_VALIDATION_FAILED');

  const refs = new Set();
  for (const product of products) {
    if (refs.has(product.ref)) return fail('DUPLICATE_PRODUCT_REF');
    refs.add(product.ref);
  }
  const merchantSlots = new Set();
  for (const offer of offers) {
    if (offer.product_ref !== 'ANCHOR' && !refs.has(offer.product_ref)) return fail('OFFER_PRODUCT_REF_UNKNOWN');
    const merchant = clean(offer.merchant_name).toLowerCase()
      || offer.source_domain
      || clean(offer.platform_name).toLowerCase();
    if (!merchant) return fail('OFFER_MERCHANT_REQUIRED');
    const key = `${offer.product_ref.toLowerCase()}|${merchant}`;
    if (merchantSlots.has(key)) return fail('DUPLICATE_MERCHANT_SLOT');
    merchantSlots.add(key);
  }

  return {
    ok: true,
    value: {
      requestId,
      marketCountryCode: 'IN',
      currency: 'INR',
      requestedPackKey: packResolution.requestedPackKey,
      resolvedPackKey: packResolution.resolvedPackKey,
      packResolution: packResolution.packResolution,
      products,
      offers,
    },
  };
}
