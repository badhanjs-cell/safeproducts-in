function stableNumber(value) {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function pack(value, unit) {
  const normalized = stableNumber(value);
  if (normalized === null || normalized <= 0) return null;
  return {
    explicit: true,
    value: normalized,
    unit,
    key: `${normalized}:${unit}`,
  };
}

const PACK_DETAIL_PATTERN = /\b\d+(?:\.\d+)?\s*(?:ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|gm|gms|grams?|grammes?|g|kg|kilograms?|capsules?|caps?|tablets?|tabs?|softgels?|sachets?|pieces?|pcs?|counts?|ct)\b/gi;

export function identityQuery(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(PACK_DETAIL_PATTERN, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeIdentityWords(value) {
  return identityQuery(value);
}

export function parsePack(text) {
  const source = String(text ?? '').trim();
  if (!source) return { explicit: false, value: null, unit: null, key: null };

  const metric = source.match(/(?:^|[^a-z0-9])(\d+(?:\.\d+)?)\s*(ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|gm|gms|grams?|grammes?|g|kg|kilograms?)(?=$|[^a-z])/i);
  if (metric) {
    const raw = Number(metric[1]);
    const token = metric[2].toLowerCase();
    if (token === 'l' || token.startsWith('lit')) return pack(raw * 1000, 'ml') ?? { explicit: false, value: null, unit: null, key: null };
    if (token === 'kg' || token.startsWith('kilogram')) return pack(raw * 1000, 'g') ?? { explicit: false, value: null, unit: null, key: null };
    if (token === 'ml' || token.startsWith('millilit')) return pack(raw, 'ml') ?? { explicit: false, value: null, unit: null, key: null };
    return pack(raw, 'g') ?? { explicit: false, value: null, unit: null, key: null };
  }

  const count = source.match(/(?:^|[^a-z0-9])(\d+(?:\.\d+)?)\s*(capsules?|caps?|tablets?|tabs?|softgels?|sachets?|pieces?|pcs?|counts?|ct)(?=$|[^a-z])/i);
  if (count) return pack(Number(count[1]), 'count') ?? { explicit: false, value: null, unit: null, key: null };

  return { explicit: false, value: null, unit: null, key: null };
}

export function packDisplayTextFromQuery(text) {
  const source = String(text ?? '').trim();
  if (!source) return null;

  const metric = source.match(/(?:^|[^a-z0-9])((?:\d+(?:\.\d+)?)\s*(?:ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|gm|gms|grams?|grammes?|g|kg|kilograms?))(?=$|[^a-z])/i);
  if (metric) return metric[1].trim();

  const count = source.match(/(?:^|[^a-z0-9])((?:\d+(?:\.\d+)?)\s*(?:capsules?|caps?|tablets?|tabs?|softgels?|sachets?|pieces?|pcs?|counts?|ct))(?=$|[^a-z])/i);
  return count ? count[1].trim() : null;
}

function validPack(value) {
  return !!value && typeof value === 'object' && typeof value.key === 'string' && value.key.length > 0;
}

export function samePack(a, b) {
  return validPack(a) && validPack(b) && a.key === b.key;
}

function modalPack(candidates) {
  const counts = new Map();
  const first = new Map();
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    if (!validPack(candidate)) continue;
    if (!first.has(candidate.key)) first.set(candidate.key, candidate);
    counts.set(candidate.key, (counts.get(candidate.key) ?? 0) + 1);
  }

  let bestKey = null;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestKey = key;
      bestCount = count;
    }
  }
  return bestKey ? first.get(bestKey) : null;
}

function normalizedEvidenceText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function sourceDomain(candidate) {
  const explicit = normalizedEvidenceText(candidate?.source_domain ?? candidate?.domain);
  if (explicit) return explicit;
  const sourceUrl = typeof candidate?.source_url === 'string' ? candidate.source_url.trim() : '';
  if (!sourceUrl) return '';
  try {
    const url = new URL(sourceUrl);
    return normalizedEvidenceText(url.hostname.replace(/^www\./i, ''));
  } catch {
    return '';
  }
}

function evidenceLineage(candidate) {
  return normalizedEvidenceText(
    candidate?.source_lineage
    ?? candidate?.source_id
    ?? candidate?.source_name
    ?? sourceDomain(candidate)
    ?? '',
  );
}

function evidenceBrand(candidate) {
  return normalizedEvidenceText(candidate?.brand_name ?? candidate?.brand ?? candidate?.normalized_brand) || '__unknown_brand__';
}

export function selectDefensibleModalPack(candidates = []) {
  const groupedLineages = new Map();
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    if (!validPack(candidate)) continue;
    const brand = evidenceBrand(candidate);
    const domain = sourceDomain(candidate) || '__unknown_domain__';
    const lineage = evidenceLineage(candidate) || domain;
    const evidenceKey = `${brand}|${lineage}`;
    if (!groupedLineages.has(evidenceKey)) {
      groupedLineages.set(evidenceKey, { candidate, brand, domain, keys: new Set([candidate.key]) });
    } else {
      groupedLineages.get(evidenceKey).keys.add(candidate.key);
    }
  }

  const stats = new Map();
  for (const group of groupedLineages.values()) {
    if (group.keys.size !== 1) continue;
    const key = [...group.keys][0];
    if (!stats.has(key)) {
      stats.set(key, {
        candidate: group.candidate,
        count: 0,
        brands: new Set(),
        domains: new Set(),
      });
    }
    const row = stats.get(key);
    row.count += 1;
    row.brands.add(group.brand);
    row.domains.add(group.domain);
  }

  const ranked = [...stats.entries()].map(([key, row]) => ({
    key,
    candidate: row.candidate,
    count: row.count,
    brandCount: row.brands.size,
    domainCount: row.domains.size,
  })).sort((a, b) =>
    b.count - a.count
    || b.brandCount - a.brandCount
    || b.domainCount - a.domainCount
    || a.key.localeCompare(b.key));

  if (!ranked.length) return null;
  if (ranked.length > 1) {
    const first = ranked[0];
    const second = ranked[1];
    if (
      first.count === second.count
      && first.brandCount === second.brandCount
      && first.domainCount === second.domainCount
    ) return null;
  }
  return ranked[0].candidate;
}

export function chooseLaunchStandardPack({
  searchMode = 'CATEGORY',
  explicitUserPack = null,
  officialDefault = null,
  officialDefaults = [],
  trustedOffers = [],
} = {}) {
  if (validPack(explicitUserPack)) return explicitUserPack;

  const mode = String(searchMode ?? '').toUpperCase() === 'SPECIFIC_PRODUCT'
    ? 'SPECIFIC_PRODUCT'
    : 'CATEGORY';
  if (mode === 'SPECIFIC_PRODUCT') {
    if (validPack(officialDefault)) return officialDefault;
    return selectDefensibleModalPack(trustedOffers);
  }

  const officialMode = selectDefensibleModalPack(officialDefaults);
  if (officialMode) return officialMode;
  return selectDefensibleModalPack(trustedOffers);
}

export function chooseStandardPack({
  explicitUserPack = null,
  officialDefault = null,
  trustedOffers = [],
  allowExplicitFallback = false,
} = {}) {
  const trusted = Array.isArray(trustedOffers) ? trustedOffers.filter(validPack) : [];

  if (validPack(explicitUserPack)) {
    if (!allowExplicitFallback) return explicitUserPack;
    if (trusted.some((candidate) => candidate.key === explicitUserPack.key)) return explicitUserPack;

    const sameUnit = trusted.filter((candidate) => candidate.unit === explicitUserPack.unit);
    return modalPack(sameUnit);
  }

  if (validPack(officialDefault)) return officialDefault;
  return modalPack(trusted);
}

export function isExactAnchorQuery(query, candidate) {
  if (!candidate || typeof candidate !== 'object') return false;
  const normalizedQuery = normalizeIdentityWords(query);
  const brand = normalizeIdentityWords(candidate.brand_name);
  const name = normalizeIdentityWords(candidate.product_name);
  const combined = normalizeIdentityWords(`${candidate.brand_name ?? ''} ${candidate.product_name ?? ''}`);
  if (!normalizedQuery || !name || !brand || !normalizedQuery.includes(brand)) return false;
  // Variant-bearing exact queries must be anchored by the whole brand+product
  // identity, and any remaining words must be a prefix of the saved variant.
  // This keeps "Tata 1mg Tejasya KSM-66 Ashwagandha 60 Capsules" exact while
  // preventing unrelated category queries from being promoted to exact offers.
  const suffix = normalizedQuery.startsWith(`${combined} `)
    ? normalizedQuery.slice(combined.length + 1).trim()
    : '';
  const variant = normalizeIdentityWords(candidate.variant_name);
  const storedVariantPrefix = !!suffix && !!variant
    && (variant === suffix || variant.startsWith(`${suffix} `));
  return normalizedQuery === name
    || normalizedQuery === combined
    || storedVariantPrefix
    || combined.startsWith(`${normalizedQuery} `);
}

export function classifySearchMode({ anchorExact = false } = {}) {
  return anchorExact === true ? 'SPECIFIC_PRODUCT' : 'CATEGORY';
}
