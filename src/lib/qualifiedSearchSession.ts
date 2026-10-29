import type { Product } from './searchContract';
// Current-tab display state only. No product/cache DB writes or persistent scores.
const products=new Map<string,Product>();
// Retains any display-eligible product, including transparent price-only fallbacks.
export function rememberQualifiedProducts(items:Product[]) {
  if(typeof window==='undefined') return;
  for(const p of items) if(p.display_eligible) products.set(p.id,p);
  while(products.size>100) products.delete(products.keys().next().value!);
  window.dispatchEvent(new Event('sp_qualified_products_change'));
}
export function currentQualifiedProduct(id:string):Product|undefined {
  return typeof window==='undefined' ? undefined : products.get(id);
}
