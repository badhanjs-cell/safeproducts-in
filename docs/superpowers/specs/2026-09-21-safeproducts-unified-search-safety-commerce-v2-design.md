# SafeProducts Unified Search, Safety & Commerce v2 — Design Specification

**Date:** 2026-09-21  
**Status:** DESIGN FOR USER REVIEW  
**Repository:** `badhanjs-cell/safeproducts`  
**Branch:** `feat/m1b-m1br-architecture-spec-2026-09-19`  
**Canonical backend:** SafeProducts_ValuLenz / `wmxbdirvlwuagouraobr`

## 1. Purpose

SafeProducts should behave as one consumer-facing search and safety system that:

- finds real relevant products;
- identifies exact products and pack sizes correctly;
- determines safety whenever trusted ingredient evidence is sufficient;
- avoids unnecessary evidence retrieval once sufficient official evidence is found;
- uses deeper evidence recovery only when needed;
- always preserves a human-review fallback;
- separates product safety from merchant price and image availability;
- supports useful price comparison now; and
- remains affiliate-ready without allowing future commission to influence the Safety Score.

The system must optimize for production speed, cost, evidence quality, consumer clarity, and future scale.

## 2. Product principles

### 2.1 Safety belongs to the product/formula, not the merchant

A Safety Score is attached to a canonical product/formula version. Multiple merchants selling that exact formulation reuse the same Safety Score.

Merchant-specific data such as price, stock, merchant name, purchase URL, and later affiliate metadata are separate commerce facts.

### 2.2 Ingredient count is never a qualification threshold

A product with one declared ingredient may be fully scoreable if the evidence reliably represents its complete relevant composition. A product with forty ingredients may remain unscoreable if only a partial or hero-ingredient list is available.

Qualification asks whether the exact product identity and ingredient evidence are credible and sufficiently complete for scoring, not whether an arbitrary minimum number of ingredients was found.

### 2.3 Official-source evidence should short-circuit deeper evidence work

For an exact product, if an official manufacturer/brand source supplies sufficient identity and ingredient/composition evidence and there is no material formula conflict, the system should stop ingredient acquisition and proceed directly to safety scoring.

It must not continue to secondary retailers, OCR, VLM, or broader paid model/web research merely to increase confidence numerically.

### 2.4 Image is not a display or scoring prerequisite

A missing product image must never suppress a valid product result. The UI may render a neutral placeholder.

Image quality does not increase or decrease the Safety Score.

### 2.5 Price is not a safety prerequisite

A product can receive a Safety Score without a current price. Price affects commerce presentation and Best Choice eligibility, not the safety calculation.

### 2.6 Safety uncertainty must be explicit

When ingredient evidence remains insufficient after normal and recovery stages, the product may still display with the message:

**Safety Score could not be determined due to insufficient ingredient evidence.**

No provisional numeric Safety Score is shown.

## 3. One public engine

SafeProducts will expose one public search and safety engine, conceptually:

**SafeProducts Unified Search & Safety Engine v2**

The existing M1-B and M1-BR concepts become internal stages rather than two independent consumer-facing engines.

The internal flow is:

1. Query intent and pack resolver
2. Canonical product discovery
3. Qualified cache check
4. Official/trusted evidence acquisition
5. Ingredient evidence qualification
6. Safety/regulatory scoring when qualified
7. Evidence Recovery stage only when evidence is insufficient
8. Human Review only as terminal fallback
9. Commerce-offer discovery and price refresh
10. Result composition and ranking

The former M1-BR capability becomes the **Evidence Recovery stage** and must not execute when the normal evidence path has already qualified the product.

## 4. Search intent modes

The engine must classify the query into one of two user-intent modes.

### 4.1 Specific-product mode

Examples:

- `Brand X Baby Lotion 200 ml`
- `PMS Fine capsule`
- `Brand Y Vitamin A 5000 IU 30 capsules`

The output target is a **5 + 5 result structure**:

- up to 5 merchant offers for the same exact canonical product/formula and selected pack size; plus
- up to 5 comparable products from the same category, preferably one distinct manufacturer/brand per alternative, with official-source evidence preferred.

The specific product remains the primary user intent. Merchant offers for that product must not be represented as separate Safety Scores.

### 4.2 Generic/category mode

Examples:

- `baby hair oil`
- `baby lotion`
- `multivitamin for seniors`

The engine targets **10 distinct canonical products**, preferably distinct brands/manufacturers.

A minimum of **6 genuine relevant distinct products** is acceptable when the market/source set cannot supply 10 qualifying matches. SafeProducts must never fabricate, duplicate, or weaken relevance merely to fill ten slots.

Each distinct product receives its own evidence qualification and Safety Score if possible.

## 5. Query and pack-size policy

### 5.1 User specifies a pack size

When the query contains an explicit pack size or count, such as `200 ml`, `400 g`, or `30 capsules`:

- that normalized pack size becomes mandatory for displayed price comparison;
- exact-product merchant offers must match that pack size;
- comparable alternative products must also match that pack size where such a pack exists;
- unit-equivalent expressions such as `0.2 L` and `200 ml` are treated as the same size after normalization;
- the system must not silently substitute a materially different size to make a result look cheaper.

If fewer genuine matching products/offers exist for the requested size, return fewer rather than mix incomparable packs.

### 5.2 User does not specify a pack size

The engine selects one canonical standard pack size and uses it consistently for displayed price comparison.

Selection order:

1. official manufacturer/brand primary or default India pack size;
2. if no clear primary official pack exists, the most commonly available pack size across trusted merchants.

For a specific-product search, the standard pack is selected for the anchor product first and comparable alternatives should use the same normalized size when available.

For a generic/category search, the engine should select the category's most common practical pack size across trusted current offers and restrict the result set to that normalized size.

If the common pack-size restriction leaves fewer than the desired number of genuine results, the system returns fewer rather than mixing materially different pack sizes.

### 5.3 Merchant landing page may offer other sizes

The merchant URL may land on a product page where the consumer can choose another size. That is acceptable.

However, the price displayed by SafeProducts must correspond to the exact pack size represented in the SafeProducts result. If the selected-size price cannot be verified, display price as unavailable rather than borrowing another size's price.

## 6. Canonical data model

The system should preserve four independent logical objects.

### 6.1 Canonical Product

Represents exact brand/product/variant/market identity, including relevant strength/form and canonical pack attributes.

### 6.2 Formula Evidence

Represents ingredient/composition evidence, source, scope, retrieval date, provenance, pack/formula equivalence, and conflict metadata.

### 6.3 Safety Assessment

Represents the deterministic safety/regulatory result for a qualified formula version. It may be reused across merchants and across pack sizes only when formula equivalence is explicitly established.

### 6.4 Merchant Offer

Represents merchant name, matched canonical product, matched pack size, current price, currency, stock/availability where known, source URL, purchase URL, retrieval time, and future affiliate metadata.

A new merchant offer must not trigger a new ingredient search or Safety Engine run when it maps to an already qualified formula version.

## 7. Evidence acquisition and qualification policy v2

### 7.1 Source priority

Ingredient evidence acquisition should use the cheapest adequate trusted source in this order:

1. qualified cached formula evidence;
2. official manufacturer/brand page or official structured product data;
3. other approved first-party or authoritative structured evidence;
4. trusted pharmacy/retailer structured declaration;
5. approved broader trusted sources;
6. label-image/OCR evidence where useful;
7. VLM rescue only when lower-cost methods remain inadequate;
8. Human Review as terminal fallback.

### 7.2 Early stop

Once exact product identity and sufficient trusted ingredient evidence are established with no material conflict, ingredient discovery stops immediately and scoring begins.

No requirement exists to obtain two or three independent sources merely because they are available.

### 7.3 Evidence adequacy

A declaration is adequate when:

- it belongs to the exact identified product/variant/market/formula;
- its source is in an approved trust class;
- it represents the product's ingredients/composition rather than clearly being only marketing highlights or hero ingredients;
- it contains enough declared composition information to run the existing Safety Engine meaningfully; and
- there is no known material formula conflict that remains unresolved.

The number of ingredients does not determine adequacy.

### 7.4 One-ingredient and low-ingredient products

If an official/trusted declaration for an exact product legitimately contains one or only a few ingredients, those ingredients may still support a full safety assessment.

If a source explicitly exposes only active/key ingredients and omits known excipients or formulation components, that is an evidence-scope limitation and the declaration must not be misrepresented as a complete formula.

### 7.5 Material conflicts

A material conflict is one that can plausibly change the Safety Score or indicates different formula/variant/market identity.

Material conflicts still block automatic scoring until resolved. Minor formatting, synonym, naming, punctuation, or dosage-expression differences should be normalized rather than treated as formula conflicts when they are semantically equivalent.

## 8. Evidence Recovery stage

The Evidence Recovery stage is invoked only when the normal evidence path cannot qualify the product.

The recovery ladder should be cost-aware:

1. deterministic/structured source expansion;
2. already known trusted URLs and cached evidence;
3. broader trusted web evidence;
4. owned/free OCR where a label image can resolve the declaration;
5. secondary OCR/reconciliation only when useful;
6. VLM only as a last justified step;
7. Human Review when still unresolved or materially conflicting.

Recovery is not allowed to redo work that is already qualified.

## 9. Human Review v2

Human Review is a terminal evidence-recovery workstation, not a routine approval gate.

A review item should contain:

- exact product identity and pack context;
- failure reason;
- evidence already found;
- competing declarations/conflicts if any;
- source URLs;
- OCR/VLM outputs when relevant; and
- the current reason a Safety Score was withheld.

The reviewer may:

- verify/correct the exact identity;
- manually search the web;
- add or replace an ingredient/composition declaration;
- attach the supporting source URL and evidence scope;
- record pack/formula notes; and
- submit the recovered evidence for backend validation.

After submission, the backend reruns ingredient qualification and the existing safety/regulatory engine automatically.

The reviewer does **not** manually choose or edit the Safety Score.

## 10. Specific-product result composition — 5 + 5

### 10.1 First section: exact product offers

Display up to five verified merchant offers for the same canonical product/formula and selected pack size.

All offers share the same Safety Score because they share the same qualified formula.

Order merchant offers by ascending verified price.

The first offer receives **Lowest Price** when a valid price exists.

Do not duplicate the same merchant or same offer solely to fill five slots.

### 10.2 Second section: comparable alternatives

Display up to five distinct same-category products, preferably one product from each different manufacturer/brand.

Official-source ingredient evidence is preferred for each alternative. Each alternative receives its own Safety Score if its evidence qualifies.

Alternatives should match the selected normalized pack size where that pack exists.

Within the alternatives section:

1. highest Safety Score first;
2. lowest-priced remaining product second;
3. remaining products by ascending price;
4. products without a Safety Score may still display with the explicit safety-unavailable message and participate only in price ordering.

### 10.3 Shortfall behavior

The target is five exact merchant offers plus five alternatives. If genuine source availability cannot supply one side of the 5 + 5 split, the system must not invent or duplicate results.

It may return fewer than ten total results and clearly preserve section labels. The system may use additional genuine alternatives only when doing so does not misrepresent the requested exact-product section.

## 11. Generic/category result composition

For category searches, show 6–10 distinct canonical products.

Default ranking:

1. highest Safety Score, irrespective of price;
2. lowest-priced distinct remaining product, irrespective of Safety Score;
3. all remaining products by ascending price;
4. products with no valid price follow priced products;
5. products with undetermined safety remain eligible for display but never receive a numeric Safety Score or safety-ranking advantage.

One product per brand/manufacturer should be preferred until the distinct-brand pool is exhausted.

## 12. Best Choice — 70% safety / 30% price

Best Choice is a separate consumer aid, not the same as Highest Safety Score or Lowest Price.

Eligibility requires:

- a valid Safety Score; and
- a valid comparable price for the selected normalized pack size.

For each eligible distinct canonical product:

- `safety_component = safety_score / 100`
- price value is normalized within the comparable displayed distinct-product set so lower price receives the higher value;
- `best_choice_score = 0.70 * safety_component + 0.30 * normalized_price_value`.

The highest Best Choice score receives the animated/flashing **Best Choice** badge.

Tie behavior must be deterministic: higher Safety Score first, then lower price, then stable canonical product ID.

For specific-product mode, Best Choice is calculated across **distinct products**, not merchant clones. The searched product contributes its lowest verified merchant price as its comparable price. If it wins, the badge belongs to the canonical product and may be rendered on its representative/lowest-price merchant card with wording that makes clear the badge refers to the product choice, not merchant quality.

Affiliate commission, affiliate status, merchant revenue, or sponsorship must not enter the 70/30 calculation.

## 13. Image behavior

Image is optional throughout the system.

When no high-quality image is available:

- keep the result;
- show a neutral product-image-unavailable placeholder;
- do not delay scoring or display merely to discover an image.

Image discovery should be opportunistic and separately cached.

## 14. Commerce and price architecture

### 14.1 Commerce discovery is independent of safety evidence

After a product/formula is qualified, merchant discovery should focus only on exact offer matching, price, availability, and purchase URL.

Retailer ingredient pages do not need to be searched again simply because additional merchant prices are required.

### 14.2 Price freshness

Safety/formula evidence can use a longer versioned cache life because formulation changes are less frequent.

Merchant price/availability must use a shorter refresh policy.

A price record should retain retrieval timestamp and pack-size match metadata.

### 14.3 Current monetization state

No affiliate ranking or commission logic is implemented in this version.

Existing purchase/affiliate URL fields may remain nullable and the offer model should remain compatible with later fields such as affiliate URL/program/status.

### 14.4 Future monetization readiness

When affiliate relationships become available, SafeProducts should be able to replace or decorate purchase URLs at the Merchant Offer layer without changing:

- product identity;
- ingredient evidence;
- Safety Score;
- evidence qualification;
- regulatory logic; or
- the 70/30 Best Choice formula unless a separately approved future product decision changes presentation rules.

Outbound merchant click tracking may be preserved independently so future conversion attribution can be added without redesigning the core safety system.

## 15. Economy and cost-control policy

Cost control is a first-class production requirement.

The engine should:

- reuse qualified formula/safety cache across searches and merchants;
- stop ingredient research immediately after sufficient official evidence;
- never invoke Evidence Recovery for already-qualified products;
- prefer deterministic parsing and structured sources before model calls;
- use owned/free OCR before paid VLM when OCR can answer the question;
- place explicit per-stage time/call budgets around paid operations;
- cache merchant offers independently;
- avoid rescoring the same formula because a new merchant was discovered; and
- record real provider usage/cost telemetry rather than silently reporting zero.

## 16. Performance and concurrency

For a specific-product search, after exact identity is established the system may run in parallel:

- safety scoring from already-qualified evidence;
- exact-product merchant discovery; and
- discovery of comparable same-category alternatives.

For generic searches, distinct-product discovery happens first, followed by bounded parallel evidence qualification/scoring with concurrency controls.

Unresolved products must not block already available useful results.

## 17. Caching and invalidation

Use independent cache domains:

- canonical identity cache;
- formula/evidence cache;
- safety assessment cache;
- merchant offer/price cache;
- optional image cache.

A formula change or material evidence conflict invalidates the relevant Safety Assessment.

A price refresh does not invalidate the Safety Assessment.

An image change does not invalidate the Safety Assessment.

A newly discovered merchant does not trigger formula rescoring.

## 18. Consumer presentation states

Each displayed product must be in one of two safety states:

### 18.1 Safety determined

Show:

- Safety Score;
- relevant warnings/findings;
- evidence-confidence or source context where appropriate;
- price if available;
- image if available; and
- purchase link when available.

### 18.2 Safety not determined

Show:

- product identity;
- price if available;
- image if available;
- purchase link if available; and
- **Safety Score could not be determined due to insufficient ingredient evidence.**

Do not show a provisional numeric score.

## 19. Safety/legal presentation invariants

- SafeProducts performs an independent informational assessment; it is not regulatory certification or medical advice.
- Government/regulatory-source use must never imply government endorsement.
- No numeric Safety Score without qualified ingredient evidence and applicable regulatory evaluation.
- Price, image, affiliate status, sponsorship, or commission never change the Safety Score.
- Material formula conflict blocks automatic scoring.
- Hero/key ingredients must not be represented as a full formula when the source explicitly limits their scope.
- AI must not invent missing ingredients.

## 20. Security and scalability invariants

- canonical Supabase backend only;
- no client-side service-role secrets;
- service-side privileged mutation only;
- RLS/fail-closed policies for new persistence;
- untrusted source URLs/content treated as hostile input;
- strict payload/time/image limits;
- idempotent writes for identity/evidence/offers/assessments;
- stable product/formula/offer identifiers;
- auditable source provenance;
- independently refreshable safety and commerce data;
- no benchmark or test data promoted into live catalog without explicit production qualification.

## 21. Implementation direction

The implementation should evolve the current system rather than replace working foundations.

Expected areas of change include:

- search intent / pack-size resolver;
- unified search orchestration around the existing M1-B entry point;
- evidence qualification v2;
- M1-BR demotion into conditional Evidence Recovery stage;
- canonical product/formula/offer association and reuse;
- merchant-offer retrieval and deduplication;
- specific-product 5 + 5 result contract;
- generic 6–10 distinct-product result contract;
- deterministic pack-size selection and enforcement;
- ranking and 70/30 Best Choice calculation;
- frontend result composition into exact-product offers plus alternatives or generic distinct-product results;
- Human Review manual evidence recovery and automatic rescore;
- cost telemetry correction;
- benchmark scorer canonical ingredient arrays; and
- affiliate-ready but presently inactive offer fields/hooks.

Homepage visual redesign is out of scope unless required to represent the new result contract.

## 22. Acceptance tests

Implementation must be driven by RED → GREEN tests covering at least:

1. exact product + explicit pack size → only matching pack offers;
2. exact product without pack size → official primary India pack selected, else merchant-mode pack;
3. generic category + explicit pack → 6–10 distinct products at that pack where available;
4. generic category without pack → deterministic common standard pack;
5. sufficient official ingredient evidence → safety score produced and recovery not invoked;
6. adequate one-ingredient official declaration → score eligible;
7. key/hero-only declaration → not misclassified as full formula;
8. insufficient evidence → recovery invoked;
9. unresolved recovery → Human Review queued;
10. manual Human Review evidence insertion → automatic requalification/rescore;
11. missing image → result still displayed;
12. missing safety score → result displayed with explicit unavailable reason;
13. same formula across five merchants → one safety assessment reused;
14. merchant price changes → no safety rescore;
15. exact-product mode → up to 5 exact offers + up to 5 alternatives;
16. generic mode → distinct canonical products, preferably distinct brands;
17. highest Safety Score first in distinct-product ranking;
18. lowest-priced remaining product second;
19. remaining products ascending price;
20. Best Choice = 70% safety + 30% normalized price;
21. affiliate/commission fields have zero influence on safety/ranking;
22. pack-size mismatch cannot appear as a cheaper comparable offer;
23. no duplicate merchant offer used to fill result count;
24. no duplicate canonical product used to fake category diversity;
25. price unavailable does not suppress a safety-qualified product;
26. real paid-provider cost telemetry is recorded when paid calls occur;
27. security/RLS/secret guards remain intact;
28. no live catalog/safety side effects from benchmark-only execution.

## 23. Launch behavior summary

### Specific product search

**Target:** 5 exact merchant offers + 5 same-category alternatives.

- exact offers share one canonical Safety Score;
- exact offers sorted by price;
- alternatives each have independent Safety Scores where determinable;
- requested/default standard pack size enforced;
- Best Choice evaluated across distinct products using 70/30 safety/price.

### Generic/category search

**Target:** 10 distinct products; minimum 6 acceptable when genuine supply is insufficient.

- same standard pack size across comparable displayed results;
- highest Safety Score first;
- lowest-priced remaining product second;
- rest by ascending price;
- undetermined-safety products remain displayable with explicit disclosure;
- one Best Choice based on 70/30 safety/price.

## 24. Deferred monetization

Affiliate monetization is intentionally deferred until SafeProducts is live and merchant/platform relationships are available.

The launch architecture must make later affiliate activation a commerce-layer configuration/integration change rather than a safety-engine rewrite.

Any future proposal to let commercial relationships affect placement or presentation must be separately designed and approved. The Safety Score itself remains independent of monetization.
