# SafeProducts Production Search Engine Qualification — 2026-09-22

## Scope

This certificate qualifies the production-search engine against the already-approved Unified Search/Safety/Commerce v2 architecture. It does **not** certify that the current canonical catalog contains enough verified products/offers to fill every possible 5+5 or 6–10 result set.

Canonical repository: `badhanjs-cell/safeproducts`  
Canonical Supabase project: `wmxbdirvlwuagouraobr` (`SafeProducts_ValuLenz`)  
Qualification branch: `feat/production-search-engine-qualification-2026-09-22`

## Frozen consumer search contract

### Specific-product search

1. Up to five exact merchant offers for the same canonical product/formula/pack.
2. Exact offers are sorted by valid displayed price and deduplicated by merchant/domain.
3. Every exact merchant offer reuses the same canonical product Safety Score; safety never belongs to the merchant.
4. Up to five same-category alternatives follow the exact offers.
5. Alternatives are distinct canonical products and preferably distinct brands/manufacturers.
6. Every alternative retains its own Safety Score only when its own ingredient evidence qualifies; otherwise Safety Score remains unavailable.
7. An explicit user pack such as `200 ml` is absolute. Different/unknown packs are not used to fill missing slots.
8. Fewer genuine results are preferred over cross-pack or fabricated filler.

### Generic/category search

1. Up to ten distinct canonical products, one product per brand.
2. A single comparable normalized pack is frozen for the result set.
3. When no pack is supplied: official manufacturer primary/default India pack wins when explicitly verified; otherwise the modal pack among trusted exact-pack merchant offers is selected.
4. Different pack sizes are not used merely to fill the result count.

### Ranking and presentation

- Best Choice remains `70% Safety + 30% normalized price` across distinct scored, priced canonical products.
- Price-only/unscored products are never promoted as safest and never receive an inferred Safety Score.
- Image availability is independent from eligibility and Safety Score.
- Images may be captured opportunistically from already-consulted exact official/merchant pages; no extra paid search exists solely for image acquisition.

## Production hardening added by this qualification

1. Exact-product intent now uses one canonical identity normalizer shared by the search query policy. Indian pack aliases `gm`, `gms`, `gramme`, and `grammes` are treated as pack-only identity detail, aligned with pack parsing.
2. Paid commerce discovery is now impossible unless a non-empty normalized pack has already been resolved **and** paid discovery is explicitly authorized.
3. When the normalized pack is unresolved, commerce returns `PACK_UNRESOLVED` with no offers and zero paid discovery rather than searching across mixed pack sizes.
4. The commerce prompt now always requires the resolved normalized pack instead of permitting a `not specified` pack.

## RED → GREEN evidence

### RED

A tests-only commit added production acceptance contracts. Unified Search CI failed before implementation because `canUsePaidCommerceDiscovery` did not exist, while the pre-existing Unified Search contracts passed. This established a meaningful failure for the new pack-safe commerce requirement.

### GREEN

The final production-search gate passed all of the following on the branch head:

- `node --test tests/spUnifiedSearchV2*.test.mjs`
- backend guards
- production build / generated routes
- TypeScript checking
- scoped M1-B semantic lint

The new acceptance suite proves:

- Indian `gm/gms/gramme(s)` pack aliases do not break exact-product intent;
- paid commerce requires both resolved normalized pack and explicit authorization;
- specific-product composition produces five exact merchant offers followed by five distinct same-pack alternatives when valid data is available;
- exact offers remain same canonical product/formula, share the canonical Safety Score, dedupe merchants, and sort by price;
- wrong pack alternatives/offers do not fill slots;
- generic composition keeps one deterministic pack and one product per brand, returning fewer than ten when appropriate;
- official default pack has precedence over trusted-merchant modal pack;
- Best Choice remains the frozen 70/30 policy and excludes unscored products.

## Broad CI note

The repository-wide M1-B/M1-BR workflow still fails on the pre-existing Human Review route assertion that expects `sp_m1b_submit_human_recovery_v2`. The production-search branch does not modify Human Review files. The dedicated production-search gate passes independently.

## Canonical production-data readiness observation

Read-only inspection of the canonical database during qualification found:

- canonical products: `4`
- canonical products with normalized pack key: `0`
- canonical products marked official default pack: `0`
- commerce offers: `20`
- commerce offers with normalized pack key: `0`
- commerce offers marked exact-pack match: `0`

Therefore the engine is qualified to enforce 5+5 / 6–10 semantics, but the current canonical catalog cannot naturally fill those result counts for most searches yet. Existing resilience/discovery stores contain additional marketplace products, but they are not silently promoted into canonical Safety Scores or verified exact-pack commerce records.

This is an intentional fail-closed distinction: **engine qualification does not fabricate catalog qualification**.

## Safety and economy invariants

- No HOLDOUT data used.
- No benchmark Gold data mutated.
- No Safety Scores fabricated.
- No ingredient evidence gates weakened.
- No paid provider call required for this qualification.
- No production catalog data mutated by the qualification tests.
- Unknown monetary cost remains unknown rather than zero.
- Exact product/formula/pack identity remains mandatory for exact-pack price comparison.

## Release gate

Merge/deploy is permitted only after the final branch head re-runs the dedicated production-search gate successfully. After deployment, smoke qualification must verify the deployed Edge-function versions and the published frontend rendering separately.
