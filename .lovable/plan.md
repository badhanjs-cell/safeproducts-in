# SafeProducts search diagnosis — findings and proposed fix

Nothing was changed. Below: what the code does today, what the live search service returned when I tested it, and the proposed fix.

## 1. What happens when a search is submitted

```text
HeroSearch submit -> /search?q=...&profile=...
  -> src/components/SearchResults.tsx (useEffect on q/profile)
     -> searchProductsClient()            src/lib/searchClient.ts (125 s browser deadline)
        -> searchProducts server function  src/lib/productSearch.functions.ts:142
           SP_M1B_SEARCH_ENABLED true -> callM1BSearch()  (:90)
             - in parallel: exactLabelPackMatch() -> RPCs
                 sp_web_label_exact_pack_search_v1
                 sp_web_label_exact_pack_clinical_screen_v1
                 sp_web_label_exact_pack_multi_source_v1
             - POST {SUPABASE_URL}/functions/v1/sp-us2-search-v3 (40 s abort)
           -> normalizeSearchResponse()     src/lib/searchContract.ts:73-76
     -> optional 12 s / 30 s safety refreshes (same path)
```

- The app **does** call `sp-us2-search-v3` on every search. It no longer calls `sp-us2-search-v2`, which is kept only as the rollback endpoint mentioned in a comment (`productSearch.functions.ts:106`). Make is used only when `SP_PROD1_SEARCH_ENABLED` is on and M1-B is off.
- The project's own settings have all the values search needs: SP_M1B_SEARCH_ENABLED, SUPABASE_URL / PUBLISHABLE_KEY, and the VITE_ copies.
- **The saved label does not skip the market search.** The label lookup runs at the same time as the v3 search, and its result is attached to the v3 answer (`labelExactPack`). In `SearchResults.tsx:133-172`, the label panel shows when v3 returns zero products. That is why the label analysis appears on its own.

## 2. Root causes

**A. "Dove body wash": "We could not complete the product checks"**
- That message only comes from `unavailable()` (`searchContract.ts:54`). It is used for an error status from v3, a timeout, an abort, a failed check of the v3 answer, or a missing URL or key.
- When I sent the same request straight to v3, it returned HTTP 200 in 14.5 s. The status was `PRICE_ONLY_FALLBACK_READY`, with 1 product, from the `CACHE` engine. Running that answer through `normalizeSearchResponse` gave a valid result.
- So the app's code accepts today's answer. The failure you saw happened on an earlier attempt when nothing was cached yet. On that attempt, v3 either took longer than the 40 s limit, returned an error status, or sent a product that the strict checks rejected. All three end in the same generic message. The cause is **not yet confirmed**, because the preview server-function logs were not captured for that run.
- A separate quality issue: the one product returned for "body wash" was "Dove Bathing Bar 300 g". That is a matching problem in the search service, not in the app.

**B. "Tata 1mg Tejasya KSM-66 Ashwagandha 60 Capsules": zero shops**
- v3 returned HTTP 200 with status `SOURCE_SHORTFALL_BELOW_SIX` and `products: []`.
- From `m1b_meta`: `search_mode: CATEGORY`, `google_cluster_acquisition.reason: NOT_SPECIFIC_PRODUCT`, and `canonical_exact_offer_hydration.attempted: false`. Also `paid_discovery_budget_reason: BUDGET_UNAVAILABLE`, `free_discovery_count: 0`, and `make_acquisition.queued: true` (background only).
- So the search service treated a full brand + product + pack query as a general category search and skipped exact-offer lookup. Paid discovery was blocked by budget, and the Make lookup was only queued for later. The app showed exactly what it received.

## 3. Proposed fix

Search service fixes (no change to the frozen homepage):
1. Fix how `sp-us2-search-v3` decides whether a query names a specific product. "brand + product + pack size" queries should be `SPECIFIC_PRODUCT` so exact-offer lookup runs.
2. Look at why `BUDGET_UNAVAILABLE` blocks discovery when the cache is empty. When there are zero products, the foreground search should be allowed one bounded discovery attempt.
3. Tighten category matching (body wash should not return a bathing bar).

App-side changes (small, behaviour-neutral, all in `productSearch.functions.ts` and `SearchResults.tsx`):
4. Log a short reason on the server for each `unavailable()` path: HTTP status, timeout, or which check failed. No secrets or response bodies are logged. This lets us confirm cause A on the next failure.
5. When v3 returns `SOURCE_SHORTFALL_BELOW_SIX` with zero products but a saved label exists, show a neutral line under the label panel: "Store prices are still being gathered — search again shortly." No change to layout or styling.
6. Keep the 40 s limit unless the logs from step 4 show v3 regularly takes longer when nothing is cached. If they do, raise it while staying under the browser deadline.

## Verification
- Reproduce "Dove body wash" on the preview with step 4 in place, then read the server-function log for the exact reason.
- Re-run both queries straight against v3 and in the preview, and confirm the product counts and statuses match.
