# SafeProducts Unified Search, Safety & Commerce v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task with RED→GREEN tests and verification before completion.

**Goal:** Deliver one production-scalable SafeProducts search flow that distinguishes specific-product and category intent, enforces comparable pack sizes, reuses one formula/safety assessment across merchants, returns the approved 5+5 specific-product layout or 6–10 distinct category products, invokes Evidence Recovery only when normal evidence is inadequate, keeps Human Review as terminal recovery, extracts good product images opportunistically without making images an eligibility gate, and computes Best Choice as 70% Safety / 30% price.

**Architecture:** Keep one public search entry point (`sp-m1b-search-v1`, versioned internally to Unified Search v2) and reuse the canonical catalog/evidence/safety/review/offer tables. Add small pure policy modules for query/pack resolution, image selection, result composition, and ranking. Add normalized pack metadata to canonical products and merchant offers plus service-role-only RPCs for exact offers and same-category alternatives. Qualified cache and sufficient official evidence short-circuit paid evidence research. A separate internal commerce-discovery stage may enrich offers but cannot influence Safety Score. M1-BR becomes an internal Evidence Recovery stage and runs only after normal evidence fails. Human Review v2 remains the terminal fallback and resubmits evidence to the backend scorer.

**Tech Stack:** TypeScript/Deno Supabase Edge Functions, PostgreSQL/Supabase RPC + RLS, TanStack Start/React 19, Bun/Vite, Node `node:test`, Python/pytest benchmark suites, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-21-safeproducts-unified-search-safety-commerce-v2-design.md` plus `docs/superpowers/specs/2026-09-21-safeproducts-unified-search-safety-commerce-v2-image-amendment.md`.

## Global Constraints

- Canonical backend only: `wmxbdirvlwuagouraobr`.
- Preserve strict isolation from PEDOS, ValuLenz product work, and all other projects.
- Do not publish the website or enable production rollout flags in this implementation.
- No service-role/OpenAI/provider secrets in browser code.
- Do not mutate frozen 26-product benchmark-gold truth or the untouched 120-product HOLDOUT while tuning runtime behavior.
- Safety Score is formula/product-owned, never merchant-owned.
- Affiliate status/commission/revenue is excluded from Safety Score, ranking, and Best Choice.
- Ingredient count is never a qualification threshold.
- Missing image is never a display/safety qualification blocker.
- Missing price is never a safety qualification blocker.
- Material identity/formula conflicts still block automatic Safety Score determination.
- Never fabricate products, offers, pack matches, images, ingredients, prices, or evidence.
- Economy first: cache/deterministic parsing/official structured evidence before paid web/model calls; owned/free OCR before VLM; no extra paid call solely for an image.
- Persist provenance and retrieval time for sources, images, and offers.
- DDL is additive/versioned, RLS-aware, least-privilege, and idempotent.
- Every task follows RED test → minimal GREEN → targeted verification → commit.

## Review Focus

Review especially for: exact pack equivalence/no cross-pack price leakage; one Safety Score across same-formula merchant offers; official evidence early-stop; image extraction without image gating; deterministic 5+5/6–10 composition; Best Choice deduped by canonical product; no numeric score on insufficient/conflicting evidence; no affiliate influence; non-fabricated cost telemetry; and security/RLS on all new database surfaces.

---

## Task 1 — Query intent and pack normalization

**Files**
- Create `supabase/functions/sp-m1b-search-v1/query-policy.mjs`
- Create `tests/spUnifiedSearchV2QueryPolicy.test.mjs`
- Modify `.github/workflows/m1b-m1br-ci.yml`

**RED**

Add tests first:

```js
assert.deepEqual(parsePack('Baby Lotion 200 ml'), { explicit:true, value:200, unit:'ml', key:'200:ml' });
assert.equal(parsePack('Baby Lotion 0.2 L').key, '200:ml');
assert.equal(parsePack('Vitamin A 30 capsules').key, '30:count');
assert.equal(parsePack('Baby hair oil').explicit, false);
assert.equal(samePack(parsePack('200 ml'), parsePack('0.2 L')), true);
assert.equal(samePack(parsePack('200 ml'), parsePack('400 ml')), false);
assert.equal(classifySearchMode({ query:'Brand X Baby Lotion 200 ml', anchorExact:true }), 'SPECIFIC_PRODUCT');
assert.equal(classifySearchMode({ query:'baby hair oil', anchorExact:false }), 'CATEGORY');
```

Run `node --test tests/spUnifiedSearchV2QueryPolicy.test.mjs`; expect RED because the module does not exist.

**GREEN**

Export:

```js
export function parsePack(text) {}
export function samePack(a, b) {}
export function chooseStandardPack({ explicitUserPack, officialDefault, trustedOffers }) {}
export function classifySearchMode({ query, anchorExact }) {}
```

Rules: L→ml, kg→g; capsule/tablet/softgel/sachet/piece/count→`count`; explicit user pack always wins; no guessed pack when no evidence exists; official/default India pack precedes modal trusted-merchant pack.

Update CI to run `tests/spUnifiedSearchV2*.test.mjs`.

**Verify:** `node --test tests/spUnifiedSearchV2QueryPolicy.test.mjs`

**Commit:** `test+feat(search): add unified v2 query and pack policy`

---

## Task 2 — Canonical-product and offer pack metadata + read RPCs

**Files**
- Create `supabase/migrations/20260921143000_sp_unified_search_safety_commerce_v2.sql`
- Create `tests/spUnifiedSearchV2Persistence.test.mjs`

**RED**

Require the migration to add the following to **both** `sp_catalog_product_v1` and `sp_catalog_commerce_offer_v1` where applicable:

```sql
pack_normalized_value numeric,
pack_normalized_unit text,
pack_normalized_key text
```

For products also require:

```sql
pack_is_official_default boolean not null default false,
pack_source_kind text
```

For offers also require:

```sql
exact_pack_match boolean not null default false,
pack_match_confidence numeric
```

Require indexes for product category/pack and offer product/pack/freshness, plus `sp_us2_exact_offers_v1(...)` and `sp_us2_category_candidates_v1(...)`. Assert fixed `search_path`, no anon/auth mutation surface, and no safety-table writes from these read RPCs.

Run `node --test tests/spUnifiedSearchV2Persistence.test.mjs`; expected RED: migration missing.

**GREEN**

Create idempotent additive DDL and indexes. `sp_us2_exact_offers_v1(p_product_id uuid, p_pack_normalized_key text, p_limit integer default 5)` must return same-product, exact-pack offers, prefer verified/current entries, dedupe merchant/domain, order priced offers ascending, max five.

`sp_us2_category_candidates_v1(p_category text, p_exclude_product_id uuid, p_pack_normalized_key text, p_limit integer default 12)` must return active India products, exclude anchor, enforce normalized pack when supplied, and prefer distinct brands/manufacturers. It returns candidates, not final safety ranking.

Use service-role execution for internal RPCs and preserve base-table RLS.

**Verify:**

```bash
node --test tests/spUnifiedSearchV2Persistence.test.mjs
bun run check:backend
```

**Commit:** `feat(db): add unified v2 exact-pack commerce contracts`

---

## Task 3 — Scope-based runtime evidence admission and official early-stop

**Files**
- Modify `supabase/functions/sp-m1b-path-a-v1/qualification.mjs`
- Modify `supabase/functions/sp-m1b-path-a-v1/index.ts`
- Modify `tests/spM1BQualificationPolicyV2.test.mjs`
- Modify `tests/spM1BSearchContract.test.mjs`

**RED**

Add a one-ingredient official fixture and require qualification despite zero corroboration and non-blocking freshness:

```js
assert.equal(qualifiesOfficialV2(oneIngredientOfficial), true);
```

Also require: one ingredient can qualify; hero/key-only (`declaration_complete=false`) cannot; material conflict cannot; official complete evidence requires no second source; trusted structured single-source evidence may qualify under approved trust floor + hard gates; qualified Path A cannot enqueue recovery.

**GREEN**

Ingredient count checks only `> 0`, never a minimum. Preserve exact identity, requested/default pack, India market/formula match, complete/non-truncated scope, provenance, acceptable extraction, and no unresolved material conflict.

For official sources, passing hard gates is sufficient for runtime admission; the numeric evidence confidence remains audit/consumer metadata and must not become a second arbitrary barrier. Approved trusted structured sources retain the v2 trust floor and hard gates.

Return explicit stop reason:

```ts
{
  ingredient_status:'QUALIFIED',
  evidence_stop_reason:'SUFFICIENT_OFFICIAL_EVIDENCE' | 'SUFFICIENT_TRUSTED_EVIDENCE',
  recovery_enqueued:false
}
```

Do not alter benchmark-gold qualification rules.

**Verify:**

```bash
node --test tests/spM1BQualificationPolicyV2.test.mjs tests/spM1BSearchContract.test.mjs
bun run lint:m1b
```

**Commit:** `feat(m1b): make runtime evidence admission scope based`

---

## Task 4 — Opportunistic high-quality image capture, never eligibility gating

**Files**
- Create `supabase/functions/sp-m1b-path-a-v1/image-policy.mjs`
- Modify `supabase/functions/sp-m1b-path-a-v1/index.ts`
- Modify `src/lib/searchContract.ts`
- Create `tests/spUnifiedSearchV2ImagePolicy.test.mjs`
- Modify `tests/spM1BSearchContract.test.mjs`

**RED**

Require official > first-party store > verified merchant > verified cache priority, exact product only, https URL only, and:

```js
assert.equal(isImageRequiredForEligibility(null), false);
```

Static assertions must reject reintroduction of `!!image_url` as a safety/display qualification condition in both active consumer normalization and legacy `normalizeProduct`; ProductCard placeholder must remain.

**GREEN**

Export:

```js
export function chooseDisplayImage(candidates) {}
export const isImageRequiredForEligibility = () => false;
```

Extend Path A image output with `image_url`, `source_url`, `source_kind`, optional observed `width_px`/`height_px`, and `exact_product_match`. Reject recognizable logos/banners/placeholders/tiny thumbnails when a better exact-product candidate is available. Do not invent dimensions.

Persist suitable images already found during official/merchant work to `sp_catalog_product_image_v1` with `image_role='DISPLAY'`, provenance, market, retrieval time, and selected `is_primary_display`. Merchant image may also remain on `sp_catalog_commerce_offer_v1`.

Never trigger a separate paid image-only model/web/VLM call and never delay ready safety/commerce output for image persistence.

**Verify:**

```bash
node --test tests/spUnifiedSearchV2ImagePolicy.test.mjs tests/spM1BSearchContract.test.mjs
bun run typecheck
```

**Commit:** `feat(search): capture images without gating eligibility`

---

## Task 5 — Bounded commerce discovery independent from formula safety

**Files**
- Create `supabase/functions/sp-us2-commerce-v1/index.ts`
- Create `supabase/functions/sp-us2-commerce-v1/offer-policy.mjs`
- Create `tests/spUnifiedSearchV2Commerce.test.mjs`
- Modify `.github/workflows/m1b-m1br-ci.yml`
- Modify `package.json` lint scope to include `supabase/functions/sp-us2-commerce-v1/index.ts`

**RED**

Require cache-first behavior, merchant/domain dedupe, wrong-pack rejection, wrong-product/variant rejection, image optionality, no ingredient/safety writes, and no affiliate/commission input to ordering.

**GREEN**

Internal worker flow:
1. call `sp_us2_exact_offers_v1`;
2. return immediately if enough current verified offers exist (zero paid calls);
3. otherwise make at most one bounded commerce web/model discovery call for exact canonical product + pack;
4. verify identity/variant/pack before persistence;
5. persist pack metadata, price, URL, optional image, confidence, retrieval time;
6. return max five distinct merchants ascending price.

This worker must not request ingredient evidence or call the Safety Engine.

**Verify:**

```bash
node --test tests/spUnifiedSearchV2Commerce.test.mjs
bun run lint:m1b
```

**Commit:** `feat(search): add exact-pack commerce discovery lane`

---

## Task 6 — Unified result composition: specific 5+5 and category 6–10

**Files**
- Create `supabase/functions/sp-m1b-search-v1/result-composition.mjs`
- Modify `supabase/functions/sp-m1b-search-v1/index.ts`
- Create `tests/spUnifiedSearchV2Composition.test.mjs`

**RED**

Specific fixture must yield max five `EXACT_OFFER` rows for one anchor product plus max five `ALTERNATIVE` rows with distinct canonical products/brands, same selected pack where available, no duplicate merchant, no duplicate alternative product, and fewer results rather than fabricated fill.

Category fixture must yield 6–10 `CATEGORY_PRODUCT` rows and prefer distinct brands.

**GREEN**

Version response contract as `SP-US2/1.0` and add:

```ts
search_mode:'SPECIFIC_PRODUCT'|'CATEGORY';
selected_pack:{
  text:string|null;
  normalized_key:string|null;
  source:'USER'|'OFFICIAL_DEFAULT'|'TRUSTED_MERCHANT_MODE'|null;
};
result_group:'EXACT_OFFER'|'ALTERNATIVE'|'CATEGORY_PRODUCT';
canonical_product_id:string;
canonical_product_fingerprint:string;
merchant_offer_id:string|null;
pack_size_text:string|null;
pack_normalized_key:string|null;
```

Specific mode: resolve anchor+pack; score formula once; then run exact-offer discovery and alternative discovery in bounded parallel; alternatives use cache/official evidence first and enqueue Evidence Recovery only if normal evidence remains inadequate.

Category mode: resolve standard pack; discover pool; prefer distinct brands; bounded cache/official qualification; return up to 10, with 6 a normal acceptable shortfall floor when only six genuine relevant products exist.

Unresolved alternatives never block already-ready results.

**Verify:**

```bash
node --test tests/spUnifiedSearchV2Composition.test.mjs tests/spM1BSearchContract.test.mjs
```

**Commit:** `feat(search): compose unified v2 specific and category results`

---

## Task 7 — Deterministic ranking and 70/30 Best Choice

**Files**
- Modify `src/lib/productDisplayOrder.ts`
- Modify `src/lib/searchContract.ts`
- Create `tests/spUnifiedSearchV2Ranking.test.mjs`

**RED**

Require category order: highest safety first; lowest-priced distinct remaining second; rest ascending price. Require Best Choice across distinct canonical products only.

Formula:

```text
safety_component = safety_score / 100
price_value = 1 - ((price - min_price) / (max_price - min_price))
best_choice = 0.70 * safety_component + 0.30 * price_value
```

If all eligible prices are equal, set `price_value=1` for all. Composite ties: higher safety, then lower price, then stable canonical product ID. In specific mode collapse merchant clones; anchor uses its lowest verified exact-pack price.

**GREEN**

Export:

```ts
export function orderDistinctProductsForDisplay(products: Product[]): Product[];
export function computeBestChoice(products: Product[]): string | null;
export function orderExactMerchantOffers(products: Product[]): Product[];
```

No affiliate URL/status/commission/revenue/sponsorship/image input.

**Verify:** `node --test tests/spUnifiedSearchV2Ranking.test.mjs && bun run typecheck`

**Commit:** `feat(ui): add unified ranking and 70-30 best choice`

---

## Task 8 — Frontend contract and approved result presentation

**Files**
- Modify `src/lib/searchContract.ts`
- Modify `src/components/SearchResults.tsx`
- Modify `src/components/ProductCard.tsx`
- Modify `src/lib/searchResilience.ts`
- Create `tests/spUnifiedSearchV2FrontendContract.test.mjs`

**RED**

Require `SP-US2/1.0` fields, exact-offer clones sharing one canonical safety result, no numeric score in safety-undetermined state, no image requirement, two labeled specific sections, one generic grid, exactly one Best Choice product, and clear safety-unavailable copy.

**GREEN**

Specific UI:
- **Same product — compare prices** (max five exact offers, ascending price)
- **Other products in this category** (max five alternatives)

Generic UI: one 6–10 product grid; no separate pending section that breaks ordering.

ProductCard: neutral image placeholder; `Highest Safety Score` only with numeric score; `Lowest Price` where applicable; restrained animated `Best Choice` tag with `motion-reduce:animate-none`; when score absent show **Safety Score could not be determined due to insufficient ingredient evidence.** Buy Now uses normal source URL now, affiliate link optionally later.

Resilience must honor the same grouping/pack rules and never reintroduce image gating.

**Verify:**

```bash
node --test tests/spUnifiedSearchV2FrontendContract.test.mjs tests/spUnifiedSearchV2Ranking.test.mjs
bun run typecheck
bun run build
```

**Commit:** `feat(ui): present unified 5+5 and category search results`

---

## Task 9 — Terminal Human Review recovery workstation

**Files**
- Modify `src/routes/admin.ingredient-recovery.tsx`
- Modify `src/lib/m1bHumanReview.ts`
- Modify `tests/spM1BHumanReviewAdmin.test.mjs`
- Modify `tests/spM1BHumanRecoveryV2.test.mjs`

**RED**

Require every open `INGREDIENT_RECOVERY` item to expose admin-only fields for exact identity confirmation, source URL/kind, ingredient declaration, parsed ingredient list, reviewer note, and submission to `sp_m1b_submit_human_recovery_v2`. Result must show `score_available`, backend Safety Score when available, and backend reason when unavailable. Tests must forbid browser secrets, benchmark writes, and any manual Safety Score field.

**GREEN**

Wire the already-installed RPC. Reviewer can inspect/edit parsed ingredients before submit. On success refresh queue and display backend-generated result. Human reviewer never sets score.

**Verify:**

```bash
node --test tests/spM1BHumanReviewAdmin.test.mjs tests/spM1BHumanRecoveryV2.test.mjs
bun run typecheck
```

**Commit:** `feat(admin): complete terminal ingredient recovery workstation`

---

## Task 10 — Economy/usage telemetry and escalation guards

**Files**
- Modify `supabase/functions/sp-m1b-path-a-v1/index.ts`
- Modify `supabase/functions/sp-m1br-recovery-worker-v1/index.ts`
- Modify `supabase/functions/sp-us2-commerce-v1/index.ts`
- Modify `supabase/migrations/20260921143000_sp_unified_search_safety_commerce_v2.sql`
- Create `tests/spUnifiedSearchV2Economy.test.mjs`

**RED**

Require per-stage telemetry for cache hit/miss, official early-stop, paid web/model calls, OCR calls, VLM calls, commerce discovery calls, and provider usage tokens when returned. `cost_usd` may be null/unknown but cannot be silently zero after a paid call. Require no recovery after qualification, no VLM before lower-cost stages, and no paid image-only call.

**GREEN**

Persist metrics through existing attempt/report surfaces. Represent unknown monetary cost as null while preserving usage counts/tokens. Do not synthesize provider prices. Add a versioned pricing table later only when provider pricing is intentionally maintained.

**Verify:**

```bash
node --test tests/spUnifiedSearchV2Economy.test.mjs
node --test tests/spM1B*.test.mjs
```

**Commit:** `fix(search): record real usage and bounded escalation telemetry`

---

## Task 11 — Full CI, canonical qualification, controlled deployment, smoke tests

**Files**
- Modify `.github/workflows/m1b-m1br-ci.yml`
- Create `docs/superpowers/certifications/2026-09-21-safeproducts-unified-search-safety-commerce-v2-qualification.md`

**Pre-deployment verification**

```bash
node --test tests/spM1B*.test.mjs tests/spUnifiedSearchV2*.test.mjs
python tools/m1a/test_benchmark.py
(cd tools/m1b && pytest test_runner.py test_report.py test_dev_recovery_batch.py test_dev_recovery_batch2.py test_dev_recovery_batch3.py test_dev_reviewer_export.py test_dev_human_adjudication.py test_gold_staging.py test_generate_gold_staging_payload.py test_gold_benchmark_execution.py -q)
(cd services/m1br-ocr && pytest test_app.py -q)
bun run check:backend
bun run typecheck
bun run build
bun run lint:m1b
```

Require GREEN GitHub Actions on the exact head commit before canonical migration/deployment.

**Canonical pre-state snapshot:** record counts for products, ingredient evidence, product ingredients, safety assessments, commerce offers, product images, review queue, normal M1-B runs, and benchmark M1-B runs.

**Controlled deployment order**
1. Apply migration `sp_unified_search_safety_commerce_v2` to `wmxbdirvlwuagouraobr`.
2. Deploy versioned `sp-m1b-path-a-v1`.
3. Deploy internal `sp-us2-commerce-v1`.
4. Deploy versioned `sp-m1b-search-v1`.
5. Keep public site unpublished and unrelated rollout flags unchanged.

**Smoke tests with minimum paid calls**
1. Specific exact product + explicit pack: exact pack honored, merchant offers share one score, wrong pack excluded.
2. Specific product without pack: official default selected; deterministic trusted-merchant modal fallback fixture when no official default exists.
3. Generic category: 6–10 distinct brands when fixture/source set supports them.
4. Official complete one-ingredient fixture: qualifies; no Evidence Recovery.
5. Hero-only fixture: no score; recovery queued.
6. Material conflict fixture: no score; recovery/review state.
7. No-image fixture: result still displays/qualifies with placeholder.
8. Best Choice fixture: 70/30 winner independent of affiliate fields.
9. Human recovery fixture: admin submission reruns backend scorer.

Do not run a new paid 26-product benchmark until deterministic/synthetic qualification passes.

**Post-state verification:** no benchmark/HOLDOUT mutation; no cross-project writes; no new anon/auth mutation exposure; price/image changes do not invalidate safety; merchant offers do not create duplicate safety assessments; provider-call counts bounded; telemetry non-fabricated.

Write exact commit SHA, CI run, migration version, Edge versions, smoke results, and limitations into the certification file. Do not claim production certification unless all gates pass.

**Commit:** `docs(safeproducts): qualify unified search safety commerce v2`

---

## Completion Definition

Implementation is complete only when verified on the exact head:

- one public SafeProducts search path serves both intent modes;
- specific search gives up to 5 same-product exact-pack merchant offers + up to 5 same-category alternatives;
- category search gives 6–10 distinct genuine products where available;
- explicit pack is never silently substituted;
- no-size query uses official default first, trusted-merchant modal pack second;
- normalized pack metadata exists on canonical products and offers;
- one formula Safety Score is reused across merchant offers;
- sufficient official ingredient evidence short-circuits deeper evidence work;
- Evidence Recovery runs only when normal evidence is insufficient/conflicting;
- Human Review is terminal evidence recovery and backend calculates the score;
- good image extraction is attempted from already-consulted official/merchant sources;
- missing image never blocks display or safety;
- highest-safety/lowest-price/ascending-price ordering is deterministic;
- Best Choice is 70% Safety / 30% comparable price across distinct products;
- affiliate fields have no ranking/scoring influence;
- unresolved evidence produces no numeric Safety Score;
- telemetry never falsely reports paid work as zero;
- full CI/build/typecheck/lint passes;
- canonical smoke tests pass without unintended live/catalog/benchmark side effects;
- website publication remains a separate explicit decision.
