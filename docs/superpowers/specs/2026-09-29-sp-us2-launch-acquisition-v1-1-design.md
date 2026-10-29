# SafeProducts SP-US2 Launch Acquisition v1.1 — Design

Date: 2026-09-29
Status: architecture approved; written successor specification pending final review
Repository: `badhanjs-cell/safeproducts`
Canonical Supabase project: `wmxbdirvlwuagouraobr`
Canonical Make scenario: `7613424` (`SP_US2_MAKE_ACQUISITION_V1`)

## 1. Purpose

This design freezes the launch-grade acquisition and evidence flow for SafeProducts search while preserving strict project isolation, backend-only safety authority, and cost control.

The user-visible objective is:

- specific-product search: up to 5 exact same-product/same-formula/same-variant/same-pack merchant offers, then up to 5 genuine same-category alternative products, preferably distinct brands, using the same comparison pack;
- generic/category search: 6–10 genuine relevant products, preferably one canonical product per brand, using one deterministic comparable pack;
- explicit user pack: exact pack only; return fewer results rather than substitute another size;
- specific product without an explicit pack: use that anchor manufacturer's verified official India primary/default pack first, otherwise the modal trusted-market pack;
- generic/category without an explicit pack: use the modal verified official-default pack across relevant candidate brands when a unique defensible mode exists, otherwise the modal trusted-market pack;
- safety score belongs to the canonical product/formula, never the merchant;
- product image capture is opportunistic from already consulted pages and never an eligibility or safety gate;
- automated evidence recovery ends in human review when trustworthy ingredient evidence still cannot be qualified.

## 2. Authority boundaries

### 2.1 Make.com

Make is a commerce/product-discovery worker only. It may discover observable facts such as:

- merchant/store identity;
- direct HTTPS product page;
- visible INR price;
- India-market context;
- product/brand/title/variant observations;
- pack observations;
- product image URL already present in consulted shopping/store data;
- Google Shopping product-cluster/store observations.

Make must never create or infer:

- Safety Score;
- profile-specific safety scores;
- authoritative ingredient evidence;
- regulatory approval/certification;
- VERIFIED product identity;
- Best Choice;
- Benchmark Gold or HOLDOUT state;
- human-review resolution.

### 2.2 Canonical SafeProducts backend

Supabase + M1-B remain the authority for:

- canonical identity;
- exact product/formula/variant matching;
- normalized pack validation;
- commerce persistence;
- ingredient qualification;
- official/trusted evidence hierarchy;
- OCR/VLM escalation;
- safety scoring;
- human-review creation and resolution workflow;
- frontend search composition.

The protected callback independently revalidates every Make observation before persistence.

## 3. Versioning and rollback

Do not mutate the frozen `SP-US2-MAKE-ACQUISITION/1.0` contract semantics in place.

Introduce successor contracts:

- inbound acquisition: `SP-US2-MAKE-ACQUISITION/1.1`;
- callback: `SP-US2-MAKE-CALLBACK/1.1`.

The current scenario remains inactive during implementation and qualification. Version 1.0 stays recoverable as rollback reference. The 1.1 scenario/blueprint is qualified before routine dispatch is enabled.

The production search engine may continue to understand 1.0 queue rows during migration, but all newly dispatched launch jobs use 1.1 after cutover.

## 4. Cost-control policy

Cost control is a launch requirement, not an optimization after launch.

The acquisition order is:

1. canonical cache/current verified offers;
2. existing Google product-cluster store path ahead of Make when eligible;
3. free/cached discovery;
4. Make residual acquisition only for the unresolved shortfall.

Make receives residual targets rather than unconditional 5+5 quotas.

### 4.1 Provider-call budgets

For one SPECIFIC_PRODUCT Make run:

- one Google Shopping exact-anchor lookup maximum;
- one Google Immersive Stores lookup maximum for the selected exact anchor cluster;
- one Google Shopping alternatives lookup maximum;
- no per-alternative Immersive Stores fan-out in the normal path;
- no image-only lookup;
- no retry fan-out inside a foreground acquisition execution.

For one CATEGORY Make run:

- one Google Shopping lookup maximum in the normal path;
- no per-product Immersive Stores fan-out;
- no image-only lookup.

If a direct shopping result lacks enough trustworthy evidence for a candidate/offer, skip it rather than spending additional calls merely to fill a slot. A later bounded retry/cooldown may occur through the queue policy, not within the same request fan-out.

## 5. Inbound webhook validation

The Make webhook accepts only `SP-US2-MAKE-ACQUISITION/1.1` jobs satisfying all of the following:

- valid UUID `request_id`;
- `search_mode` is `SPECIFIC_PRODUCT` or `CATEGORY`;
- `market_country_code` is `IN`;
- `currency` is `INR`;
- callback URL exactly matches the canonical SafeProducts callback;
- target counts are bounded by backend policy;
- requested pack key, when present, matches the normalized `value:unit` grammar supported by SafeProducts.

Invalid jobs are acknowledged as rejected and must not perform provider calls.

## 6. SPECIFIC_PRODUCT acquisition flow

### 6.1 Residual-target input

The backend supplies:

- canonical anchor facts when known;
- original query;
- requested pack key when the user supplied a pack;
- selected comparison pack only when no explicit user pack exists and backend pack resolution has established one;
- residual `target_exact_offers` from 0–5;
- residual `target_alternatives` from 0–5.

If both residual targets are zero, no Make acquisition is dispatched.

### 6.2 Exact anchor resolution

One Google Shopping lookup searches the exact product query.

Select one anchor cluster only when product-family, brand, formula/product title, variant requirements, India market, and requested/comparison pack evidence are compatible with the canonical anchor.

Reject:

- another product family;
- contradictory variant;
- contradictory formula/product identity;
- explicit wrong pack;
- multipacks when the requested comparison is a single pack;
- ambiguous cluster identity.

If no exact cluster qualifies, produce zero exact offers and continue only to the alternatives path if that residual target is nonzero.

### 6.3 Exact merchant stores

For the selected anchor cluster, perform at most one Immersive Stores lookup with `more_stores=true`.

For each store candidate require:

- HTTPS direct destination without embedded credentials;
- positive visible price;
- INR/India evidence;
- same locked Google product cluster;
- no product-family contradiction;
- no variant contradiction;
- exact requested/comparison pack, or no contradictory seller-level pack text when cluster-level pack identity is already locked by the backend-qualified anchor;
- single-pack semantics for ml/g units; reject `pack of N`, `N x size`, `size x N`, combo/set/value multipacks unless count itself is the canonical unit.

De-duplicate by normalized merchant/domain identity.

Sort accepted exact offers by numeric INR price ascending. Take only the residual target, capped at five total canonical exact offers after backend merge.

All merchant clones reuse the canonical anchor Safety Score because safety belongs to the canonical product/formula.

### 6.4 Alternatives

Perform one bounded Google Shopping query for the same product category/product type and the same requested/comparison pack, excluding the anchor brand.

Do not perform normal per-alternative Immersive Stores expansion. Use the direct shopping observation when it provides a valid merchant/source page and price; otherwise skip the candidate.

For every alternative candidate require:

- category/product-type relevance;
- brand present;
- normalized brand different from anchor brand;
- exact same pack key as the requested/comparison pack;
- no multipack mismatch;
- valid direct HTTPS source;
- India/INR evidence;
- positive price when a price is submitted.

De-duplicate by normalized brand first, then canonical product identity where possible.

Select up to the residual alternatives target, capped at five. Prefer five distinct brands when genuine supply permits it.

Alternative candidates are staged as CANDIDATE/review/enrichment facts only. They do not inherit the anchor Safety Score.

## 7. CATEGORY acquisition flow

### 7.1 Explicit user pack

When the user query contains a supported explicit pack, that pack is immutable for this result set.

Examples:

- `200 ml` means only `200:ml`;
- `75 g` means only `75:g`;
- `60 capsules` means only `60:count`.

If fewer genuine results exist, return fewer. Never silently substitute 100 ml, 400 ml, or another size.

### 7.2 No explicit user pack

When no pack is supplied, Make collects trustworthy pack observations from the bounded Google Shopping result set but does not choose the authoritative standard pack.

Backend chooses deterministically:

- for a resolved specific-product anchor: that manufacturer's verified official India primary/default pack first; otherwise the modal normalized pack among trusted current India merchant observations for the exact product;
- for a generic/category result set: the modal normalized pack among verified official India primary/default pack observations across relevant candidate brands, but only when a unique defensible official mode exists; otherwise the modal normalized pack among trusted current India merchant observations.

For any modal calculation, count at most one observation per normalized brand/source lineage so one merchant or one brand cannot dominate by duplication. Resolve ties deterministically by broader distinct-brand support, then broader distinct-domain support. If still tied, no standard pack is considered defensible and cross-product price comparison is disabled rather than mixing packs.

### 7.3 Category candidate selection

From one bounded Shopping result set:

- require category/product-type relevance;
- require valid brand/product identity observations;
- require the explicit pack when supplied, or preserve pack observations for backend selection when absent;
- reject incompatible multipacks;
- prefer one canonical product per normalized brand;
- cap at ten genuine products;
- never fabricate missing slots.

The callback/backend may later discard candidates that fail canonical validation or the chosen standard-pack rule.

## 8. Protected callback v1.1

The callback body includes only observable acquisition facts and references to the original request.

The backend must independently validate:

- request id and queue state;
- contract version;
- India/INR;
- HTTPS source safety;
- observed-source membership;
- product/variant/category relevance;
- requested/comparison pack equality whenever a pack constraint has been resolved;
- multipack rejection;
- merchant and brand deduplication;
- confidence/trust floor;
- target bounds.

Exact anchor offers are persisted only through the protected commerce-stage RPC.

New alternative/category identities are persisted only through canonical discovery staging and remain `CANDIDATE` until existing review/enrichment controls resolve them.

Make cannot write safety assessments, ingredient evidence, VERIFIED identity, or review decisions.

## 9. M1-B evidence qualification after acquisition

For each canonical/candidate product presented to M1-B, evidence authority remains:

1. existing qualified/cached safety evidence;
2. exact official brand/official brand-owned Shopify structured or visible page evidence;
3. trusted structured retailer/pharmacy evidence;
4. automated recovery only if prior tiers are insufficient;
5. ingredient/back-label image discovery;
6. primary OCR;
7. secondary OCR only when needed/configured;
8. VLM image reading only when OCR-supported evidence needs visual reconciliation;
9. human review when automated evidence remains insufficient or conflicting.

When exact complete official evidence qualifies, stop escalation and score at the backend. Do not invoke OCR/VLM merely because those capabilities exist.

A product with insufficient evidence may still appear as price-only/fallback, but it must not receive an invented Safety Score.

## 10. Human review fallback

Human review is a terminal evidence-recovery fallback, not a Make route.

M1-BR creates a canonical review item when:

- evidence remains insufficient after automated recovery;
- exact identity/pack/variant cannot be safely resolved;
- independent sources conflict;
- OCR/VLM remains uncertain;
- automated worker fails terminally after bounded retry policy.

The reviewer supplies/validates evidence. Backend computes any final Safety Score; a reviewer or Make does not directly submit a numeric safety score.

## 11. Image policy

Whenever official/merchant/product pages are already consulted, persist the best usable exact-product image already observed, subject to existing SafeProducts image controls.

No extra paid search may be made solely to obtain an image.

Image availability is independent of:

- product eligibility;
- ingredient qualification;
- Safety Score;
- ranking eligibility except purely visual presentation.

## 12. Frontend/result composition requirements

### Specific product

Display order:

1. exact product merchant offers, sorted by price ascending, up to five;
2. same-pack alternatives, up to five, preferably distinct brands.

All exact merchant offers reuse the same canonical safety result. Each alternative has its own evidence qualification and Safety Score, or an explicit safety-unavailable state.

### Category

Return 6–10 distinct products when genuine supply permits, preferably distinct brands, using one canonical comparable pack. Return fewer when the evidence/supply is insufficient.

No result composition layer may cross-fill with another pack merely to reach a visual count.

## 13. Failure and fail-open behavior

Commerce/provider failure must never invalidate already-qualified safety evidence or crash the foreground search.

The foreground path returns the best canonical/cache result available. Acquisition may remain queued for later bounded execution.

Callback rejection, provider timeout, missing tokens, empty Shopping results, ambiguous anchor cluster, insufficient stores, or insufficient alternatives all produce truthful shortfall metadata rather than fabricated results.

## 14. Security

- callback secret remains Make-side/server-side only;
- SerpApi credential remains in Make/Supabase server-side secrets only;
- no provider credential in browser, webhook job body, Git, logs, or callback payload;
- callback URL is allowlisted exactly;
- webhook rejects invalid contract before provider calls;
- all persistence remains through protected server-side RPC/function surfaces;
- custom-auth Edge Functions retain constant-time secret/token comparison where already established.

## 15. Qualification plan requirements

Implementation must use RED → GREEN deterministic tests before live provider calls.

Required deterministic coverage includes:

- explicit pack never falls back to another pack;
- exact anchor wrong product-family rejection;
- wrong variant/formula rejection;
- exact pack mismatch rejection;
- multipack rejection;
- merchant deduplication;
- exact price ascending ordering;
- exact cap five;
- anchor-brand exclusion from alternatives;
- same-pack alternatives only;
- brand deduplication;
- alternatives cap five;
- category explicit-pack strictness;
- no-pack official-default precedence;
- trusted-market modal-pack fallback;
- deterministic tie handling for modal pack selection;
- one product per brand preference;
- category cap ten;
- callback cannot create safety/ingredient/VERIFIED truth;
- official qualified evidence short-circuits OCR/recovery;
- unresolved evidence reaches human review;
- image absence never suppresses an eligible product;
- provider-call budget guards.

Only after deterministic CI is green may a tightly bounded live Make qualification run occur.

## 16. Live qualification acceptance

A specific-product qualification must prove:

- exact offers represent one canonical formula/variant/pack;
- up to five distinct merchants, sorted by price;
- no wrong variant or multipack leakage;
- alternatives use the same pack and exclude the anchor brand;
- safety is canonical for exact offers and independent for alternatives;
- no fabricated slots;
- provider calls remain within the documented budget.

A category qualification must prove:

- explicit pack is never substituted;
- no-pack standard-pack selection follows the deterministic official-default/market-mode policy in section 7.2;
- distinct-brand preference;
- 6–10 result target is a maximum/useful target, not a quota;
- safety-unavailable products remain clearly unscored.

Make remains inactive after qualification unless routine acquisition is separately authorized.

## 17. Dependency on Google product-cluster work

The already-qualified Google product-cluster → stores path remains ahead of Make in the acquisition hierarchy. The Make v1.1 scenario is residual fallback/coverage acquisition and must not duplicate provider calls that the foreground cluster path has already satisfied.

The implementation plan must reconcile the current production cluster worker/search orchestration with the repository branch containing that work before final merge/cutover, while also preserving the Lovable runtime-enable hotfix already present on `main`.

## 18. Definition of done

This milestone is complete only when:

- v1.1 contracts are versioned in Git;
- backend queue/dispatcher/callback accept and enforce v1.1;
- Make scenario is updated from the inspected live blueprint, not rebuilt from assumptions;
- exact and category paths obey strict pack semantics;
- provider fan-out is bounded as specified;
- deterministic tests and all required CI are green;
- controlled live qualification proves the callback roundtrip;
- protected safety/identity/Benchmark invariants remain unchanged except expected candidate/commerce staging;
- temporary qualification credentials/endpoints are removed or neutralized;
- routine Make remains disabled pending separate launch authorization;
- Lovable frontend acceptance can exercise the resulting canonical search behavior.
