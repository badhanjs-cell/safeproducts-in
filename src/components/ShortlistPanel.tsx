import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ShoppingCart, X } from 'lucide-react';
import { clearShortlist, removeFromShortlist, useShortlistEntries } from '@/lib/shortlist';
import { currentQualifiedProduct } from '@/lib/qualifiedSearchSession';
import { ProductCard } from '@/components/ProductCard';

export function ShortlistPanel() {
  const entries=useShortlistEntries();
  return <Sheet>
    <SheetTrigger asChild><button type="button" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-divider px-2.5 text-xs font-semibold text-heading transition hover:border-brand-blue/50 hover:text-brand-blue sm:h-10 sm:min-w-[116px] sm:justify-center sm:gap-2 sm:px-4 sm:text-sm" aria-label={`Shortlist, ${entries.length} items`}>
      <ShoppingCart className="h-4 w-4 sm:h-[18px] sm:w-[18px]"/> <span className="hidden sm:inline">Shortlist</span> <span>{entries.length}</span>
    </button></SheetTrigger>
    <SheetContent side="right" className="flex w-full flex-col bg-background sm:max-w-md">
      <SheetHeader><SheetTitle>Your Shortlist / Cart</SheetTitle></SheetHeader>
      <p className="mt-2 rounded-md border border-divider bg-card px-3 py-2 text-xs text-body">
        Your SafeProducts cart is a shortlist. Buy Now opens the merchant in a new tab.
      </p>
      <div className="mt-4 flex-1 space-y-4 overflow-y-auto">
        {entries.length===0 && <p className="text-sm text-body">No products added yet.</p>}
        {entries.map(entry=>{const p=entry.product ?? currentQualifiedProduct(entry.id);return <div key={entry.id} className="space-y-2">
          {p ? <ProductCard p={p} profile="ALL"/> : <p className="rounded-md border border-divider p-3 text-sm text-body">Search again to refresh this saved product's current checks.</p>}
          <button onClick={()=>removeFromShortlist(entry.id)} className="inline-flex items-center gap-1 text-xs text-body"><X className="h-3 w-3"/> Remove product</button>
        </div>;})}
      </div>
      {entries.length>0 && <button onClick={clearShortlist} className="mt-4 rounded-md border border-divider px-4 py-2 text-sm">Clear shortlist</button>}
    </SheetContent>
  </Sheet>;
}
