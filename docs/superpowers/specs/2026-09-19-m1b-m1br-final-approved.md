# M1-B + M1-BR Final Approved Architecture

**Date:** 2026-09-19  
**Status:** FINAL APPROVED  
**Repository:** `badhanjs-cell/safeproducts`  
**Backend:** SafeProducts_ValuLenz / `wmxbdirvlwuagouraobr`

## Goal

Build M1-B as the fast primary ingredient-acquisition engine and M1-BR as an automatic asynchronous ingredient-only recovery engine. Preserve useful identity, image and commerce results independently. Calculate a Safety Score only when ingredient evidence and regulatory qualification are sufficient. Use human review as the terminal fallback.

## Canonical runtime flow

**Qualified cache → M1-B Path A → immediate user result → automatic asynchronous M1-BR for unresolved ingredient cases → human review if still unresolved → cache promotion after successful display/evaluation**

Only qualified ingredient evidence continues to:

**ingredient qualification → regulatory qualification → existing frozen Safety Engine → numeric Safety Score**

The present weak extractor is a historical benchmark comparator only and is not the new runtime fallback.

## Independent lanes

Keep identity, ingredient/safety, image and commerce/price as independent lanes. Failure in one lane never deletes or blocks valid results in another lane.

- Qualified image + price + insufficient ingredients: persist image/price, show no Safety Score.
- Qualified ingredients + no current price: Safety Score may still be calculated.
- Material ingredient conflict: no numeric score; send to review.

Image and price never increase or decrease the Safety Score.

## M1-B Path A

M1-B is the foreground engine. Acquisition order:

1. exact qualified cache;
2. verified official manufacturer/brand source;
3. official structured product data / JSON-LD;
4. official Shopify/product JSON where legitimately exposed;
5. official ingredient text and media;
6. trusted structured pharmacy/retailer;
7. suitable open structured source where needed;
8. marketplace evidence only where needed for identity, corroboration, image or commerce.

Early stop rules:

- official-source evidence may stop ingredient acquisition at `>= 92/100` final evidence confidence when all hard identity/completeness/provenance/freshness/conflict gates pass;
- trusted structured evidence may stop at `>= 95/100` with the same hard gates;
- lower-authority/model confidence alone cannot qualify ingredients.

M1-B may persist qualified identity, display image and commerce data even if ingredient qualification fails.

## M1-BR automatic recovery

M1-BR starts automatically whenever M1-B fails ingredient qualification. Normal user search never waits for M1-BR.

M1-BR is ingredient-recovery only. It does not redo display-image discovery, price extraction, merchant comparison or general commerce enrichment. It may retrieve and process back-label, INCI, composition and supplement-facts images solely as ingredient evidence.

Recovery sequence may include broader trusted/authoritative ingredient-source discovery, full-resolution ingredient-label retrieval, image deduplication, preprocessing, primary OCR, independent secondary OCR, OCR reconciliation, VLM rescue, independent adjudication and finally human review.

M1-BR returns exactly one of:

- `QUALIFIED`
- `INSUFFICIENT_EVIDENCE`
- `CONFLICT_REQUIRES_REVIEW`

Only `QUALIFIED` may continue to regulatory qualification and Safety Score calculation.

## Human review

Human review is the terminal fallback. The review packet contains exact identity, M1-B failure reason, M1-BR trace, source URLs and lineage, label images used as evidence, OCR/VLM outputs with uncertainty, competing ingredient declarations, confidence components and conflict reason.

Review metrics include referral rate, reason, resolution rate, time to resolution and recurring failure pattern. Recurring review resolutions feed future versioned improvements to M1-B/M1-BR.

## User-facing speed and presentation

Normal search must return useful results promptly.

Foreground behavior:

1. return qualified cache hits immediately;
2. run M1-B within the configured response budget;
3. return safety-qualified results available at that point;
4. return unresolved but commercially useful products in a separate **Other products — safety analysis pending** group when qualified identity/image/price are available;
5. enqueue M1-BR automatically after the foreground response.

Products without a Safety Score never participate in numerical safety ranking and must not be styled or ordered in a way that implies known relative safety.

## Check My Label

Use the existing two-image flow. The front image supports exact identity and may separately become a display-image candidate only under quality/privacy/reuse rules. The ingredient-panel image is direct evidence for the user's physical pack.

Target an initial 20–30 second bounded foreground analysis window. If qualification completes, show the result. If deeper recovery is required, show a non-numeric verification-in-progress state and trigger M1-BR automatically. Never show a provisional Safety Score for unqualified ingredients.

## 150-product benchmark

Preserve the M1-A benchmark structure:

- 25 Cosmetics
- 25 Personal Care
- 25 Baby Products
- 25 Supplements
- 25 Nutraceuticals
- 25 Special Dietary Products
- 30 DEV + 120 HOLDOUT

Products and gold declarations must be real. HOLDOUT must remain frozen and unavailable for threshold tuning.

### Display-before-cache rule

For a benchmark product that becomes safety-qualified, the required sequence is:

1. run M1-B and, if required, automatic M1-BR;
2. seal the benchmark result;
3. compare against frozen gold and record metrics;
4. expose/display the newly qualified result to the active test user/session;
5. only after the display response has been emitted successfully, promote the qualified production-admissible identity/evidence/image/commerce/safety artifacts into cache/catalog.

A HOLDOUT product must never become a cache hit during its own evaluation. Cache promotion is therefore strictly **after result sealing and after first successful display**.

## Separate engine audit

Always report M1-B and M1-BR separately and together.

Required metrics include:

- M1-B attempted, qualified, success and failure rates;
- M1-BR invocation count, qualified count and recovery rate among M1-B failures;
- combined qualification rate;
- absolute percentage-point lift from M1-BR;
- full-declaration recovery, precision, recall, unsupported ingredient count and false qualification rate;
- human-review referral and resolution rates;
- p50/p95 latency for each engine;
- cost per product and cost per additional M1-BR recovery;
- cache-promotion rate.

Formulas:

`M1-B success rate = M1-B qualified / M1-B attempted`

`M1-BR recovery rate = M1-BR qualified / M1-B failures sent to M1-BR`

`Combined qualification rate = (M1-B qualified + M1-BR qualified) / total attempted`

`M1-BR absolute lift = Combined qualification rate - M1-B success rate`

Initial M1-BR usefulness criterion on DEV: recover at least 20% of M1-B failures **or** add at least 5 percentage points absolute combined qualification, while maintaining zero unsupported/fabricated ingredients and no increase in false safety qualification. Freeze the final criterion before HOLDOUT.

## Existing backend surfaces to reuse

Use the existing catalog foundation rather than create parallel catalogs:

- `sp_catalog_product_v1`
- `sp_catalog_ingredient_evidence_v1`
- `sp_catalog_product_ingredient_v1`
- `sp_catalog_product_image_v1`
- `sp_catalog_commerce_offer_v1`
- `sp_catalog_pipeline_state_v1`
- `sp_catalog_safety_assessment_v1`
- `sp_catalog_review_queue_v1`

New persistence must be additive/versioned, RLS-protected, auditable and idempotent.

## Security and safety invariants

- canonical backend only: `wmxbdirvlwuagouraobr`;
- no client-side service-role secrets;
- authenticated/authorized mutation surfaces only;
- source URLs/content are untrusted input;
- bounded image/payload sizes and timeouts;
- no numeric Safety Score without ingredient + regulatory qualification;
- user-image evidence use is separate from public-display consent;
- no automatic regulatory publication;
- homepage/frozen visual design is out of scope.

## Acceptance gates

Production qualification requires: 100% provenance integrity, zero unsupported/fabricated ingredients on HOLDOUT, precision not below accepted baseline, materially improved recall/full-declaration recovery, no regression in abstention/conflict handling, no increase in false qualification, deterministic M1-B→M1-BR routing, no M1-BR commerce/display-image duplication, normal search not blocked on M1-BR, separate engine metrics reproducible, human-review handoff complete, and no numeric score shown for unqualified ingredients.
