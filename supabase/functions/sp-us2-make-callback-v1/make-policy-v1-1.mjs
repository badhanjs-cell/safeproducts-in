import { sourcePageKey } from './make-policy-v1-0.mjs';

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function number(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fail(code) {
  return { ok: false, code };
}

function packKey(value) {
  const raw = clean(value).toLowerCase();
  return /^\d+(?:\.\d+)?:(?:ml|g|count)$/.test(raw) ? raw.replace(/^0+(?=\d)/, '') : null;
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
    return `${Math.round(amount * 1000000) / 1000000}:${unit}`;
  }
  const count = raw.match(/(?:^|[^a-z0-9])(\d+(?:\.\d+)?)\s*(capsules?|caps?|tablets?|tabs?|softgels?|sachets?|pieces?|pcs?|counts?|ct)(?=$|[^a-z])/i);
  return count ? `${Math.round(Number(count[1]) * 1000000) / 1000000}:count` : null;
}

function isMultipack(value) {
  const text = clean(value);
  if (!text) return false;
  if (/\b(?:pack|set)\s*(?:of\s*)?[2-9]\d*\b/i.test(text)) return true;
  if (/\b[2-9]\d*\s*[x×]\s*\d+(?:\.\d+)?\s*(?:ml|g|gm|kg|l)\b/i.test(text)) return true;
  if (/\b\d+(?:\.\d+)?\s*(?:ml|g|gm|kg|l)\s*[x×]\s*[2-9]\d*\b/i.test(text)) return true;
  return /\b[2-9]\d*\s*(?:packs?|bottles?|tubes?|bars?)\b/i.test(text);
}

function normalizedPack(raw) {
  if (isMultipack(raw?.pack_size_text)) return null;
  const explicit = packKey(raw?.pack_normalized_key);
  const derived = parsePackText(raw?.pack_size_text);
  if (explicit && derived && explicit !== derived) return null;
  return explicit || derived;
}

function merchantPage(value) {
  const page = sourcePageKey(value);
  if (!page) return null;
  const url = new URL(page);
  if (/(^|\.)(?:google\.[a-z.]+|bing\.com|serpapi\.com|googleadservices\.com|googleusercontent\.com)$/.test(url.hostname)) return null;
  if (url.pathname === '/' || /^\/(?:search|s|url|redirect|shopping)(?:\/|$)/i.test(url.pathname)) return null;
  return page;
}

function observedPageMember(url, observed) {
  const page = merchantPage(url);
  if (!page || !Array.isArray(observed)) return false;
  return observed.map(merchantPage).filter(Boolean).includes(page);
}

function observedImageMember(url, observed) {
  if (!url) return true;
  const image = sourcePageKey(url);
  if (!image || !Array.isArray(observed)) return false;
  return observed.map(sourcePageKey).filter(Boolean).includes(image);
}

const FORBIDDEN = new Set([
  'safety_score','profile_score','safety_determined','safety_warnings','ingredients','detected_ingredients',
  'ingredient_declaration','recommendation','recommendation_class','best_choice','regulatory_approval','regulatory_status',
  'identity_status','review_resolution','review_decision','benchmark_gold','gold','holdout','holdout_state',
]);

function hasForbidden(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasForbidden);
  return Object.entries(value).some(([key, child]) => FORBIDDEN.has(key.toLowerCase()) || hasForbidden(child));
}

function norm(value) {
  return clean(value).normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function compact(value) {
  return norm(value).replace(/\s+/g, '');
}

function brandFamily(value) {
  return norm(value).split(' ').filter((token) => token && !['men','man','male','women','woman','female'].includes(token)).join('');
}

function words(value) {
  return norm(value).split(' ').filter(Boolean);
}

function exactAnchorIdentity(raw, anchor) {
  const title = norm(raw?.observed_title);
  if (!title || !anchor) return false;
  const brandWords = words(anchor.brand_name);
  const productWords = words(anchor.product_name);
  if (!brandWords.length || !productWords.length) return false;
  return brandWords.every((token) => title.includes(token)) && productWords.every((token) => title.includes(token));
}

function exactAnchorVariant(raw, anchor) {
  const expected = norm(anchor?.variant_name);
  if (!expected) return true;
  const title = norm(raw?.observed_title);
  return words(expected).every((token) => title.includes(token));
}

const PRODUCT_TYPES = [
  /\bafter\s*shave\b/i,
  /\bshav(?:e|ing)\s*(?:cream|creme|foam|gel)\b/i,
  /\bbaby\s+lotion\b/i,
  /\blotion\b/i,
  /\bshampoo\b/i,
  /\btoothpaste\b/i,
  /\bsunscreen\b/i,
  /\bsoap\b/i,
  /\b(?:perfume|parfum|eau\s+de\s+toilette)\b/i,
  /\bhair\s+oil\b/i,
];

function matchesProductType(raw, query) {
  const expected = PRODUCT_TYPES.find((pattern) => pattern.test(clean(query)));
  if (!expected) return true;
  return expected.test(`${clean(raw?.category)} ${clean(raw?.product_name)} ${clean(raw?.observed_title)}`);
}

function normalizedMerchant(raw, page) {
  return compact(raw?.merchant_name) || compact(raw?.platform_name) || (() => {
    try { return new URL(page).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
  })();
}

function validateCommonPayload(payload, context) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fail('PAYLOAD_OBJECT_REQUIRED');
  if (hasForbidden(payload)) return fail('AUTHORITY_FIELDS_FORBIDDEN');
  if (payload.contract_version !== 'SP-US2-MAKE-CALLBACK/1.1') return fail('CONTRACT_VERSION_INVALID');
  if (context?.contractVersion !== 'SP-US2-MAKE-ACQUISITION/1.1') return fail('CONTRACT_VERSION_MISMATCH');
  const requestId = clean(payload.request_id);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return fail('REQUEST_ID_INVALID');
  if (clean(payload.market_country_code || 'IN').toUpperCase() !== 'IN' || clean(context?.marketCountryCode || 'IN').toUpperCase() !== 'IN') return fail('MARKET_INVALID');
  if (clean(payload.currency || 'INR').toUpperCase() !== 'INR' || clean(context?.currency || 'INR').toUpperCase() !== 'INR') return fail('CURRENCY_INVALID');

  const requested = packKey(context?.requestedPackKey);
  const comparison = packKey(context?.comparisonPackKey);
  const payloadRequested = clean(payload.requested_pack_key) ? packKey(payload.requested_pack_key) : null;
  const payloadComparison = clean(payload.comparison_pack_key) ? packKey(payload.comparison_pack_key) : null;
  if (clean(context?.requestedPackKey) && !requested) return fail('PACK_RESOLUTION_INVALID');
  if (clean(context?.comparisonPackKey) && !comparison) return fail('PACK_RESOLUTION_INVALID');
  if (payloadRequested !== requested || payloadComparison !== comparison) return fail('PACK_RESOLUTION_INVALID');
  if (requested && comparison) return fail('PACK_RESOLUTION_INVALID');
  if (requested && clean(payload.pack_resolution).toUpperCase() === 'MARKET_STANDARD_FALLBACK') return fail('PACK_RESOLUTION_INVALID');
  const resolved = clean(payload.resolved_pack_key) ? packKey(payload.resolved_pack_key) : null;
  const effective = requested || comparison || null;
  if (clean(payload.resolved_pack_key) && !resolved) return fail('PACK_RESOLUTION_INVALID');
  if (resolved && resolved !== effective) return fail('PACK_RESOLUTION_INVALID');

  return { ok: true, requestId, requested, comparison, effective };
}

function validatePack(raw, required) {
  if (isMultipack(raw?.pack_size_text)) return 'MULTIPACK_INVALID';
  const actual = normalizedPack(raw);
  if (required && actual !== required) return 'PACK_MISMATCH';
  if (required && raw?.exact_pack_match !== true) return 'PACK_MISMATCH';
  return null;
}

function validateProvenance(raw) {
  if (!observedPageMember(raw?.source_url, raw?.observed_source_urls)) return 'SOURCE_PROVENANCE_INVALID';
  if (!observedImageMember(raw?.image_url, raw?.observed_image_urls)) return 'IMAGE_PROVENANCE_INVALID';
  return null;
}

function imageFact(raw, productRef) {
  if (!clean(raw?.image_url)) return null;
  return {
    product_ref: productRef,
    url: clean(raw.image_url),
    source_url: clean(raw.source_url),
    source_kind: 'MERCHANT_OBSERVED',
    exact_product: true,
  };
}

export function validateMakeCallbackV11(payload, requestContext = {}) {
  const common = validateCommonPayload(payload, requestContext);
  if (!common.ok) return common;
  const mode = clean(requestContext.searchMode).toUpperCase();
  if (!['SPECIFIC_PRODUCT','CATEGORY'].includes(mode)) return fail('SEARCH_MODE_INVALID');

  const exact = Array.isArray(payload.exact_offers) ? payload.exact_offers : null;
  const candidates = Array.isArray(payload.candidate_products) ? payload.candidate_products : null;
  if (!exact || !candidates) return fail('ARRAY_BOUNDS_INVALID');
  if (hasForbidden(exact) || hasForbidden(candidates)) return fail('AUTHORITY_FIELDS_FORBIDDEN');

  const targetExact = Math.min(5, Math.max(0, Math.trunc(number(requestContext.targetExactOffers) ?? 0)));
  const targetAlt = Math.min(5, Math.max(0, Math.trunc(number(requestContext.targetAlternatives) ?? 0)));
  const targetCategory = Math.min(10, Math.max(0, Math.trunc(number(requestContext.targetCategoryProducts) ?? 0)));
  if (mode === 'SPECIFIC_PRODUCT') {
    if (exact.length > targetExact || candidates.length > targetAlt) return fail('TARGET_BOUNDS_EXCEEDED');
  } else if (exact.length > 0 || candidates.length > targetCategory) {
    return fail('TARGET_BOUNDS_EXCEEDED');
  }

  const products = [];
  const offers = [];
  const images = [];
  const merchantSlots = new Set();
  const brandSlots = new Set();
  const refs = new Set();
  const anchor = requestContext.anchor || null;
  const anchorBrand = brandFamily(anchor?.brand_name);

  for (const raw of exact) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('FACT_VALIDATION_FAILED');
    if (isMultipack(raw.pack_size_text)) return fail('MULTIPACK_INVALID');
    const packError = validatePack(raw, common.effective);
    if (packError) return fail(packError);
    const provenanceError = validateProvenance(raw);
    if (provenanceError) return fail(provenanceError);
    if (raw.exact_product_match !== true || raw.exact_variant_match !== true) return fail('ANCHOR_IDENTITY_MISMATCH');
    if (!exactAnchorIdentity(raw, anchor)) return fail('ANCHOR_IDENTITY_MISMATCH');
    if (!exactAnchorVariant(raw, anchor)) return fail('ANCHOR_VARIANT_MISMATCH');
    const price = number(raw.price);
    if (price === null || price <= 0) return fail('FACT_VALIDATION_FAILED');
    const confidence = number(raw.confidence);
    if (confidence === null || confidence < 90 || confidence > 100) return fail('FACT_VALIDATION_FAILED');
    if (clean(raw.market_country_code || 'IN').toUpperCase() !== 'IN' || clean(raw.currency || 'INR').toUpperCase() !== 'INR') return fail('FACT_VALIDATION_FAILED');
    const page = merchantPage(raw.source_url);
    if (!page) return fail('SOURCE_PROVENANCE_INVALID');
    const merchant = normalizedMerchant(raw, page);
    if (!merchant) return fail('OFFER_MERCHANT_REQUIRED');
    if (merchantSlots.has(merchant)) return fail('DUPLICATE_MERCHANT_SLOT');
    merchantSlots.add(merchant);
    offers.push({
      product_ref: 'ANCHOR', merchant_name: clean(raw.merchant_name) || null, platform_name: clean(raw.platform_name) || null,
      source_url: clean(raw.source_url), observed_source_urls: raw.observed_source_urls.filter((value) => sourcePageKey(value)),
      price, currency: 'INR', market_country_code: 'IN', image_url: clean(raw.image_url) || null,
      pack_size_text: clean(raw.pack_size_text) || null, pack_normalized_key: common.effective,
      exact_product_match: true, variant_match: true, exact_pack_match: true, confidence,
    });
    const image = imageFact(raw, 'ANCHOR');
    if (image) images.push(image);
  }

  for (const raw of candidates) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('FACT_VALIDATION_FAILED');
    if (isMultipack(raw.pack_size_text)) return fail('MULTIPACK_INVALID');
    const packError = validatePack(raw, common.effective);
    if (packError) return fail(packError);
    const provenanceError = validateProvenance(raw);
    if (provenanceError) return fail(provenanceError);
    if (!matchesProductType(raw, requestContext.category || requestContext.query)) return fail('PRODUCT_RELEVANCE_INVALID');
    const ref = clean(raw.ref);
    const brand = clean(raw.brand_name);
    const product = clean(raw.product_name);
    if (!ref || !brand || !product) return fail('FACT_VALIDATION_FAILED');
    if (refs.has(ref)) return fail('DUPLICATE_PRODUCT_REF');
    refs.add(ref);
    const brandKey = compact(brand);
    if (!brandKey) return fail('FACT_VALIDATION_FAILED');
    if (brandSlots.has(brandKey)) return fail('DUPLICATE_BRAND');
    brandSlots.add(brandKey);
    if (mode === 'SPECIFIC_PRODUCT' && anchorBrand && brandFamily(brand) === anchorBrand) return fail('ANCHOR_BRAND_EXCLUDED');
    const confidence = number(raw.identity_confidence ?? raw.confidence);
    const price = number(raw.price);
    if (confidence === null || confidence < 90 || confidence > 100 || price === null || price <= 0) return fail('FACT_VALIDATION_FAILED');
    if (clean(raw.market_country_code || 'IN').toUpperCase() !== 'IN' || clean(raw.currency || 'INR').toUpperCase() !== 'INR') return fail('FACT_VALIDATION_FAILED');
    const page = merchantPage(raw.source_url);
    if (!page) return fail('SOURCE_PROVENANCE_INVALID');
    products.push({
      ref, brand_name: brand, product_name: product, variant_name: clean(raw.variant_name) || null,
      category: clean(raw.category) || clean(requestContext.category) || null,
      pack_size_text: clean(raw.pack_size_text) || null, pack_normalized_key: common.effective,
      source_url: clean(raw.source_url), source_page_key: page, source_name: clean(raw.source_name || raw.merchant_name || raw.platform_name) || null,
      identity_confidence: confidence, market_country_code: 'IN',
    });
    offers.push({
      product_ref: ref, merchant_name: clean(raw.merchant_name) || null, platform_name: clean(raw.platform_name) || null,
      source_url: clean(raw.source_url), observed_source_urls: raw.observed_source_urls.filter((value) => sourcePageKey(value)),
      price, currency: 'INR', market_country_code: 'IN', image_url: clean(raw.image_url) || null,
      pack_size_text: clean(raw.pack_size_text) || null, pack_normalized_key: common.effective,
      exact_product_match: true, variant_match: true, exact_pack_match: true, confidence,
    });
    const image = imageFact(raw, ref);
    if (image) images.push(image);
  }

  return {
    ok: true,
    value: {
      requestId: common.requestId,
      marketCountryCode: 'IN', currency: 'INR',
      requestedPackKey: common.requested,
      comparisonPackKey: common.comparison,
      effectivePackKey: common.effective,
      resolvedPackKey: common.effective,
      packResolution: common.requested ? 'REQUESTED' : common.effective ? 'COMPARISON_PACK' : 'UNRESOLVED',
      products, offers, images,
    },
  };
}
