import type { Product } from './searchContract';

type DisplayProduct = Product & { canonical_product_id?: string | null };

const canonicalId = (product: DisplayProduct) => product.canonical_product_id?.trim() || product.id;
const validPrice = (product: Pick<Product, 'price'>) => product.price !== null && Number.isFinite(product.price) && product.price > 0;
const validSafety = (product: Pick<Product, 'display_basis' | 'safety_determined' | 'profile_score'>) =>
  product.display_basis === 'SAFETY_QUALIFIED'
  && product.safety_determined === true
  && product.profile_score !== null
  && Number.isFinite(product.profile_score);

/**
 * Category/generic-search ordering mandated by Unified Search v2:
 * 1. highest selected-profile Safety Score;
 * 2. lowest-priced DISTINCT remaining canonical product, irrespective of safety;
 * 3. remaining distinct products by ascending price; unpriced products remain visible last.
 */
export function orderDistinctProductsForDisplay<T extends DisplayProduct>(products: T[]): T[] {
  const firstByCanonical = new Map<string, { product: T; index: number }>();
  products.forEach((product, index) => {
    const id = canonicalId(product);
    if (!firstByCanonical.has(id)) firstByCanonical.set(id, { product, index });
  });
  const indexed = [...firstByCanonical.values()];
  if (indexed.length <= 1) return indexed.map(({ product }) => product);

  const safetyQualified = indexed.filter(({ product }) => validSafety(product));
  const safest = safetyQualified.reduce<(typeof indexed)[number] | null>((best, current) => {
    if (!best) return current;
    const currentScore = current.product.profile_score ?? -Infinity;
    const bestScore = best.product.profile_score ?? -Infinity;
    if (currentScore !== bestScore) return currentScore > bestScore ? current : best;
    return canonicalId(current.product).localeCompare(canonicalId(best.product)) < 0 ? current : best;
  }, null);

  const used = new Set<string>();
  const ordered: T[] = [];
  if (safest) {
    ordered.push(safest.product);
    used.add(canonicalId(safest.product));
  }

  const pricedRemaining = indexed
    .filter(({ product }) => !used.has(canonicalId(product)) && validPrice(product))
    .sort((a, b) => {
      const diff = (a.product.price ?? Infinity) - (b.product.price ?? Infinity);
      return diff !== 0 ? diff : a.index - b.index;
    });
  if (pricedRemaining.length) {
    ordered.push(pricedRemaining[0].product);
    used.add(canonicalId(pricedRemaining[0].product));
  }

  const rest = indexed
    .filter(({ product }) => !used.has(canonicalId(product)))
    .sort((a, b) => {
      const ap = validPrice(a.product) ? a.product.price! : Infinity;
      const bp = validPrice(b.product) ? b.product.price! : Infinity;
      return ap !== bp ? ap - bp : a.index - b.index;
    })
    .map(({ product }) => product);
  return [...ordered, ...rest];
}

/** Same canonical product across merchants: price is the differentiator. */
export function orderExactMerchantOffers<T extends Pick<Product, 'price'> & { id: string }>(products: T[]): T[] {
  return products.map((product, index) => ({ product, index })).sort((a, b) => {
    const ap = validPrice(a.product) ? a.product.price! : Infinity;
    const bp = validPrice(b.product) ? b.product.price! : Infinity;
    return ap !== bp ? ap - bp : a.index - b.index;
  }).map(({ product }) => product);
}

/**
 * One Best Choice among DISTINCT products with both a valid Safety Score and price.
 * best_choice_score = 0.7 * (safety / 100) + 0.3 * normalized price value.
 * Equal displayed prices get price value 1. Ties: higher safety, lower price,
 * then stable canonical product id.
 */
export function computeBestChoice<T extends DisplayProduct>(products: T[]): T | null {
  const distinct = new Map<string, T>();
  for (const product of products) {
    if (!validSafety(product) || !validPrice(product)) continue;
    const id = canonicalId(product);
    const previous = distinct.get(id);
    if (!previous || product.price! < previous.price!) distinct.set(id, product);
  }
  const candidates = [...distinct.values()];
  if (!candidates.length) return null;
  const prices = candidates.map((product) => product.price!);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const scored = candidates.map((product) => {
    const safety = (product.profile_score ?? 0) / 100;
    const priceValue = max === min ? 1 : 1 - ((product.price! - min) / (max - min));
    return { product, score: 0.7 * safety + 0.3 * priceValue };
  });
  scored.sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (Math.abs(scoreDiff) > Number.EPSILON) return scoreDiff;
    const safetyDiff = (b.product.profile_score ?? -Infinity) - (a.product.profile_score ?? -Infinity);
    if (safetyDiff !== 0) return safetyDiff;
    const priceDiff = (a.product.price ?? Infinity) - (b.product.price ?? Infinity);
    if (priceDiff !== 0) return priceDiff;
    return canonicalId(a.product).localeCompare(canonicalId(b.product));
  });
  return scored[0].product;
}

/** Backward-compatible alias while callers migrate to the explicit v2 name. */
export function orderProductsForDisplay(products: Product[]): Product[] {
  return orderDistinctProductsForDisplay(products as DisplayProduct[]);
}
