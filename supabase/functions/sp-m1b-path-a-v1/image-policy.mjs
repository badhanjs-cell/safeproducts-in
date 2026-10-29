const PRIORITY = new Map([
  ['OFFICIAL_BRAND', 0],
  ['OFFICIAL_FIRST_PARTY_STORE', 1],
  ['OFFICIAL_SHOPIFY', 1],
  ['VERIFIED_MERCHANT', 2],
  ['TRUSTED_RETAILER', 2],
  ['VERIFIED_CACHED', 3],
]);

function httpsUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function recognizableNonProductArtwork(url) {
  const value = url.toLowerCase();
  return /(?:^|[\/_\-.])(logo|banner|placeholder|sprite|icon|favicon|category|collection|avatar)(?:[\/_\-.]|$)/i.test(value);
}

function finitePositive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function normalizeCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object' || candidate.exact !== true) return null;
  const sourceKind = String(candidate.sourceKind ?? '').trim().toUpperCase();
  const priority = PRIORITY.get(sourceKind);
  if (priority === undefined) return null;
  const imageUrl = httpsUrl(candidate.imageUrl);
  const sourceUrl = httpsUrl(candidate.sourceUrl);
  if (!imageUrl || !sourceUrl || recognizableNonProductArtwork(imageUrl)) return null;
  const widthPx = finitePositive(candidate.widthPx);
  const heightPx = finitePositive(candidate.heightPx);
  return {
    sourceKind,
    imageUrl,
    sourceUrl,
    exact: true,
    widthPx,
    heightPx,
    priority,
    area: widthPx && heightPx ? widthPx * heightPx : 0,
  };
}

export function chooseDisplayImage(candidates) {
  const usable = (Array.isArray(candidates) ? candidates : [])
    .map(normalizeCandidate)
    .filter(Boolean)
    .sort((a, b) => a.priority - b.priority || b.area - a.area || a.imageUrl.localeCompare(b.imageUrl));
  if (!usable.length) return null;
  const { priority: _priority, area: _area, ...selected } = usable[0];
  return selected;
}

export function isImageRequiredForEligibility() {
  return false;
}
