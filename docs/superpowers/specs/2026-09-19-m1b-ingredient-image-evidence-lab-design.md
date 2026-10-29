# M1-B + M1-BR Ingredient Evidence Architecture — Design Specification

**Date:** 2026-09-19  
**Status:** DESIGN APPROVED / WRITTEN SPEC REVIEW REQUIRED  
**Repository:** `badhanjs-cell/safeproducts`  
**Backend:** SafeProducts_ValuLenz / `wmxbdirvlwuagouraobr`

## 1. Purpose

M1-B is the preferred, fast, cost-controlled ingredient acquisition engine. M1-BR is an automatic deep ingredient-recovery engine that is invoked only when M1-B cannot qualify ingredient evidence. The present weak extractor is retained only as a historical benchmark comparator, not as the new runtime fallback.

The architecture must improve ingredient recovery without fabricating ingredients, preserve useful image/commerce results, strengthen the production cache from successful runs, keep user-facing search fast, and keep the existing frozen Safety Engine downstream of evidence qualification.

Core rule:

> **Safety is calculated only from sufficiently qualified ingredient evidence plus regulatory qualification. Product image and price are valuable independent assets but never inputs to the Safety Score.**

## 2. Canonical runtime architecture

The production candidate flow is:

**Qualified cache → M1-B Path A → immediate user response → automatic asynchronous M1-BR for unresolved ingredient cases → human review if still unresolved → cache promotion when qualified**

Only qualified ingredient evidence proceeds to:

**Ingredient qualification → regulatory qualification → existing frozen Safety Engine → numeric Safety Score**

Parallel independent lanes are preserved:

- identity lane;
- ingredient/safety lane;
- image lane;
- commerce/price lane.

A failure in one lane must not erase valid results from another lane.

Examples:

- image qualified + price qualified + ingredients insufficient → persist image/price; no Safety Score;
- ingredients qualified + no current price → Safety Score may still be calculated;
- ingredients conflicting → no numeric score; send to review;
- qualified ingredients from M1-BR → admit to cache after required benchmark/production checks.

## 3. User-facing speed contract

Normal product/category search must not wait for M1-BR.

The synchronous user path is:

1. return qualified cache hits immediately;
2. run M1-B within the configured foreground response budget;
3. return all safety-qualified results available at that point;
4. separately return commerce-only products when identity/image/price are useful but ingredient evidence is not yet qualified;
5. enqueue M1-BR automatically for unresolved ingredient cases after the foreground response path.

Products without a qualified Safety Score must never be mixed into numerical safety ranking. They may appear in a separate section such as **Other products — safety analysis pending** with image, product identity, pack, price, merchant and availability when those data are qualified.

No wording, ordering, badge, colour or score may imply that a safety-pending product has been determined safer or less safe than qualified products.

## 4. M1-B Path A — efficient primary engine

M1-B is optimized for authority, fidelity, early stopping, low latency and controlled cost.

Normal acquisition order:

1. exact qualified cache;
2. verified official manufacturer/brand domain;
3. official product page / structured data / JSON-LD;
4. official Shopify/product JSON where legitimately exposed;
5. official product media and ingredient text;
6. trusted structured pharmacy/retailer;
7. suitable open structured product source where needed;
8. marketplace evidence only where needed for identity/corroboration/image/commerce.

M1-B may acquire and persist qualified identity, product image and commerce data while ingredient acquisition is still unresolved.

### 4.1 Early stop

Official-source ingredient evidence may terminate ingredient acquisition when all hard gates pass and final evidence confidence is **>= 92/100**.

Trusted structured source evidence may terminate ingredient acquisition when all hard gates pass and final evidence confidence is **>= 95/100**.

Hard gates include:

- exact or strongly equivalent product identity;
- correct market/variant/pack where relevant;
- apparently complete ingredient declaration;
- no obvious truncation;
- provenance preserved;
- extraction/parsing quality acceptable;
- evidence sufficiently fresh;
- no unresolved credible formulation conflict.

Once M1-B qualifies ingredients, lower ingredient-recovery tiers are bypassed in production routing. Benchmark forced modes may still exercise them for measurement.

## 5. M1-BR — automatic asynchronous ingredient-only recovery engine

M1-BR starts **automatically** whenever M1-B fails the ingredient qualification gate. No human initiation is required.

For normal search, M1-BR runs asynchronously after the foreground response. It must not extend the normal user-facing search latency budget.

M1-BR is **ingredient-recovery only**. It must not spend additional calls on:

- display-image discovery or catalog-image enrichment;
- price extraction;
- merchant-price comparison;
- general commerce enrichment.

M1-B's qualified display image and price results are retained and reused.

**Important distinction:** M1-BR may retrieve, inspect, OCR, or otherwise process back-label, ingredient-panel, INCI, composition or supplement-facts images solely as ingredient evidence. Those calls are not a second display-image acquisition lane.

### 5.1 Recovery strategy

For Path-A failures, cost is measured but becomes secondary to trustworthy recovery. M1-BR may use:

1. broader authoritative/trusted ingredient-source discovery;
2. ingredient-panel/back-label image discovery;
3. exact full-resolution source-image retrieval rather than thumbnails;
4. image deduplication and source-lineage clustering;
5. image preprocessing/orientation/cropping;
6. a primary OCR engine;
7. an independent secondary OCR engine for difficult panels;
8. OCR consensus/reconciliation;
9. VLM rescue for unresolved visual/layout ambiguity;
10. independent adjudication where material ambiguity remains;
11. human review after automated recovery is exhausted or a credible conflict persists.

OCR/VLM output is evidence, never regulatory truth and never permission to invent unreadable ingredients.

### 5.2 M1-BR final states

M1-BR finishes as exactly one of:

- `QUALIFIED`
- `INSUFFICIENT_EVIDENCE`
- `CONFLICT_REQUIRES_REVIEW`

Only `QUALIFIED` may progress to regulatory qualification and Safety Score calculation.

## 6. Human review — terminal fallback

Human review is the terminal fallback after M1-B and M1-BR, rather than creating an unlimited chain of increasingly expensive automated engines.

Cases enter `sp_catalog_review_queue_v1` when automated recovery is exhausted or material conflict remains.

The reviewer receives a consolidated evidence packet including:

- exact product/variant/pack/market identity;
- M1-B evidence and failure reason;
- M1-BR evidence and recovery trace;
- source URLs/domains and lineage groups;
- ingredient-panel images used as evidence;
- OCR outputs and disagreement spans;
- VLM outputs and explicit uncertainty markers;
- competing ingredient declarations;
- confidence components and conflict reason.

Human review metrics must include referral count/rate, reason, resolution rate, time-to-resolution, outcome and recurring failure pattern. Recurring human-resolution patterns should feed versioned improvements back into M1-B and/or M1-BR.

## 7. Ingredient confidence contract

Final ingredient evidence confidence must be decomposable. Store at least:

- source authority;
- identity match;
- ingredient completeness;
- extraction quality;
- freshness;
- source-lineage independence;
- corroboration;
- conflict penalty;
- final evidence confidence.

OCR/VLM self-reported confidence cannot be substituted for final evidence confidence. Copied merchant text/images do not count as independent corroboration.

## 8. Safety gate

The Safety Engine remains downstream and unchanged unless separately versioned and approved.

A numeric Safety Score is allowed only when:

1. exact product identity is sufficiently resolved;
2. ingredient evidence is `QUALIFIED`;
3. regulatory qualification succeeds under existing safety-confidence rules.

If ingredients are incomplete, unresolved, stale or materially conflicting, no numeric Safety Score is shown.

Consumer-facing states may include:

- `Safety analysis pending — ingredient evidence is insufficient`;
- `Safety analysis in progress`;
- `Safety analysis requires review due to conflicting formulation evidence`.

Image quality and price availability never raise or lower the Safety Score.

## 9. Independent image lane

M1-B should collect and persist a suitable product image when available.

Image preference order:

1. verified official clean packshot;
2. official product image;
3. verified trusted retailer image;
4. quality-approved user front-label image with valid reuse/consent basis;
5. marketplace image.

Use the existing `sp_catalog_product_image_v1` layer rather than create a parallel image catalog.

### 9.1 Check My Label front image

Check My Label already requires a front image. It may support:

- brand/product/variant/pack identity evidence;
- exact physical-pack matching;
- potential catalog display-image enrichment.

Evidence use and public-display use are separate states. A user-uploaded front image must not automatically become a public catalog image merely because it helped identify the product. Public reuse requires the applicable consent/reuse and quality/privacy gates.

## 10. Independent commerce lane

M1-B may collect and persist useful commerce data independently, including:

- seller/platform;
- exact pack match;
- price/list price;
- currency;
- availability;
- source URL;
- retrieval time;
- offer confidence;
- image URL where relevant.

Use the existing `sp_catalog_commerce_offer_v1` layer. M1-BR does not repeat commerce extraction. Commerce freshness expires independently from ingredient/safety freshness.

## 11. Cache strengthening and production admission

Successful runs must not be wasted.

After a product reaches qualified ingredient evidence and passes applicable regulatory/safety admission checks, reusable identity/evidence/image/commerce/safety artifacts should strengthen the production cache/catalog.

Cache components have independent freshness policies:

- identity;
- ingredient evidence;
- image;
- commerce;
- safety assessment.

A future exact product/variant/pack/market request should use qualified cache first and avoid unnecessary reacquisition.

M1-BR recoveries that reach `QUALIFIED` are especially important: they become future Tier-0 cache hits and therefore convert an expensive difficult product into a cheap future result.

## 12. 150-product benchmark

The existing M1-A structure remains mandatory:

- 25 Cosmetics;
- 25 Personal Care;
- 25 Baby Products;
- 25 Supplements;
- 25 Nutraceuticals;
- 25 Special Dietary Products.

Split:

- 30 DEV;
- 120 HOLDOUT.

Products must be real. No invented benchmark identities or gold declarations.

The set should intentionally include normal successful products plus difficult products with prior acquisition failures, image-only labels, multilingual/curved panels, formulation conflicts and incomplete evidence.

## 13. Benchmark cache-promotion rule

A benchmark product that becomes eligible for safety determination should ultimately strengthen the cache, while benchmark validity remains protected.

Required sequence per product:

1. run acquisition;
2. freeze/seal that product's benchmark result;
3. compare against frozen gold and record metrics;
4. only then promote qualified production-admissible identity/evidence/image/commerce/safety artifacts to cache/catalog.

A HOLDOUT product must never become a cache hit during its own evaluation.

Failed M1-B candidates automatically continue through M1-BR. If M1-BR qualifies them, they may be promoted after the same result-sealing rule.

## 14. Separate engine audit and success accounting

M1-B and M1-BR must be audited separately and together. A combined success figure alone is insufficient.

For every benchmark run and production-reporting window record at least:

- M1-B attempted count;
- M1-B qualified count;
- M1-B success rate;
- M1-B failure rate;
- M1-BR invocation count;
- M1-BR qualified count;
- **M1-BR recovery rate among M1-B failures**;
- combined qualification count/rate;
- absolute percentage-point lift contributed by M1-BR;
- human-review referral count/rate;
- human-review resolution count/rate;
- false qualification rate;
- unsupported ingredient count;
- full-declaration recovery rate;
- cache-promotion count/rate;
- p50/p95 latency by M1-B and M1-BR;
- cost/product and cost per additional recovered failure.

Canonical formulas:

`M1-B success rate = M1-B qualified / M1-B attempted`

`M1-BR recovery rate = M1-BR qualified / M1-B failures sent to M1-BR`

`Combined qualification rate = (M1-B qualified + M1-BR qualified) / total attempted`

`M1-BR absolute lift = Combined qualification rate - M1-B success rate`

The report must make it obvious when M1-BR provides no meaningful incremental recovery.

## 15. M1-BR usefulness gate

M1-BR must earn its continued production role rather than remain enabled merely because it occasionally succeeds.

On the 30-product DEV split, measure its incremental recovery and cost. Freeze the M1-BR usefulness criterion before HOLDOUT execution.

Initial candidate criterion for DEV evaluation:

- M1-BR recovers at least **20% of M1-B failures**, **or** adds at least **5 percentage points** absolute combined qualification;
- and it maintains zero unsupported/fabricated ingredients;
- and it does not increase false safety qualification.

DEV results may justify revising the numerical threshold, but the final criterion must be frozen before the 120-product HOLDOUT and cannot be tuned on HOLDOUT results.

If M1-BR fails the frozen usefulness gate, it is not adopted as a routine production recovery engine; its failure corpus still feeds human review and future redesign.

## 16. Benchmark and production report

The final benchmark report must show side-by-side columns for:

- baseline/historical comparator;
- M1-B;
- M1-BR incremental contribution;
- combined M1-B + M1-BR;
- human-review requirement.

At minimum show qualification rate, full ingredient recovery, precision, recall, unsupported ingredients, conflicts, review referrals, p50/p95 latency, cost and cache promotions.

Equivalent reporting must be available for controlled production windows after activation so engine performance drift is auditable.

## 17. Check My Label controlled integration

Check My Label is a special case because the user has deliberately supplied front and ingredient-panel images.

Foreground flow:

**front image → pair/identity validation → qualified cache/M1-B reconciliation → uploaded ingredient-panel evidence → ingredient qualification → regulatory qualification → existing Safety Engine**

Target a bounded foreground analysis window rather than an unbounded spinner. The implementation plan should choose and test an initial **20–30 second** user-facing budget.

If safety qualification completes within that budget, show the result. If deeper recovery is required:

- preserve the user's valid identity/image/evidence;
- show a clear non-numeric state such as `Deeper ingredient verification in progress`;
- trigger M1-BR automatically in the backend;
- never fabricate or show a provisional numeric Safety Score.

The user front image may separately qualify for the image lane under the consent/privacy rules in Section 9.

## 18. Normal search result presentation

For category/profile searches, return two logically separate result groups when necessary:

### Safety-qualified products

May show:

- verified identity;
- qualified ingredients;
- regulatory result;
- Safety Score/profile score;
- image;
- price/availability when present.

Only these products participate in safety ranking.

### Other products — safety analysis pending

May show:

- verified identity;
- image;
- pack;
- price;
- merchant/availability;
- explicit `Safety analysis pending` state.

These products have no Safety Score and are never placed into the numerical safety ordering.

## 19. Failure reason taxonomy

At minimum record M1-B failure reasons such as:

- `OFFICIAL_SOURCE_NOT_FOUND`
- `OFFICIAL_INGREDIENTS_INCOMPLETE`
- `IDENTITY_AMBIGUOUS`
- `INGREDIENT_IMAGE_REQUIRED`
- `OCR_REQUIRED`
- `SOURCE_CONFLICT`
- `TRUSTED_SOURCE_INSUFFICIENT`
- `FORMULATION_VERSION_UNRESOLVED`

M1-BR records its own terminal reason and recovery method. These taxonomies must support reporting on what M1-BR and human review are teaching the primary engine.

## 20. Backend integration

Use the existing SafeProducts catalog foundation where possible:

- `sp_catalog_product_v1` — identity;
- `sp_catalog_ingredient_evidence_v1` — ingredient evidence;
- `sp_catalog_product_ingredient_v1` — qualified ingredient consensus;
- `sp_catalog_product_image_v1` — image lane;
- `sp_catalog_commerce_offer_v1` — commerce lane;
- `sp_catalog_pipeline_state_v1` — independent stage state;
- `sp_catalog_safety_assessment_v1` — qualified safety result;
- `sp_catalog_review_queue_v1` — unresolved/conflict review.

Any new persistence surface must be additive/versioned, RLS-protected, auditable and idempotent, and must not bypass existing catalog/safety controls.

## 21. Security and safety constraints

- no secrets in client code or logs;
- authenticated/authorized mutation surfaces only;
- no raw service-role exposure;
- idempotent persistence;
- source URLs/content treated as untrusted input;
- file/image validation before processing;
- bounded payload sizes/timeouts;
- audit trail for automated qualification and human overrides;
- user-upload reuse separated from public-display consent;
- regulatory publication remains outside M1-B/M1-BR;
- no numeric score when ingredient/regulatory qualification is insufficient.

## 22. Acceptance gates

The architecture cannot be declared production-qualified unless the frozen HOLDOUT demonstrates:

1. 100% provenance integrity for emitted ingredient evidence;
2. zero unsupported/fabricated ingredients;
3. precision not below the accepted baseline;
4. materially improved recall/full-declaration recovery;
5. no regression in abstention/conflict handling;
6. no increase in false safety qualification;
7. exact identity integrity sufficient for formulation-specific scoring;
8. automatic M1-B → M1-BR routing works deterministically;
9. M1-BR performs no display-image or price/commerce enrichment while ingredient-panel evidence processing remains allowed;
10. benchmark cache promotion occurs only after result sealing;
11. image/commerce persistence does not affect Safety Score calculation;
12. frontend and Check My Label never display a numeric score for unqualified ingredients;
13. normal search is not blocked on M1-BR completion;
14. engine-by-engine audit metrics and combined metrics are reproducible;
15. the frozen M1-BR usefulness gate is met if M1-BR is to remain a routine production recovery engine;
16. human-review queue receives unresolved automated cases with complete evidence packets.

## 23. Implementation milestones

Implementation should be planned as separate testable milestones:

- **M1-B1:** orchestration, cache lookup, ingredient qualification contract and metrics envelope;
- **M1-B2:** Path-A official/trusted acquisition plus independent image/commerce persistence;
- **M1-BR1:** automatic asynchronous recovery queue and deep ingredient-only adapters;
- **M1-BR2:** OCR ensemble, VLM rescue, conflict handling and human-review handoff;
- **M1-B3:** 150-product DEV/HOLDOUT harness, engine-by-engine report and sealed-result cache promotion;
- **M1-B4:** backend catalog integration, audit persistence and safe promotion controls;
- **M1-B5:** fast normal-search integration with separate safety-qualified vs safety-pending presentation;
- **M1-B6:** Check My Label bounded-foreground integration and background recovery;
- **M1-B7:** end-to-end qualification, security, performance, cost and regression certification.

## 24. Definition of success

The system succeeds when:

- M1-B resolves most normal products quickly and stops early when sufficient evidence exists;
- users receive useful results without waiting for deep recovery;
- M1-BR starts automatically for unresolved ingredient cases and produces measurable incremental recovery;
- M1-BR does not redo display-image or commerce work;
- human review is the terminal fallback for unresolved automated cases;
- every useful image/price/evidence result is retained independently;
- qualified benchmark products strengthen the cache only after evaluation sealing;
- no ingredient-confidence failure produces a numeric Safety Score;
- products without Safety Scores are not mixed into numerical safety ranking;
- future searches become faster and cheaper from accumulated qualified cache;
- engine success/failure rates and M1-BR incremental lift remain continuously auditable;
- the current weak extractor is not relied upon as the runtime fallback;
- the existing frozen Safety Engine remains downstream of evidence and regulatory qualification.
