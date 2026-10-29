# SafeProducts Make Commerce/Discovery Qualification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the already-deployed SafeProducts Unified Search v2 capable of acquiring enough genuine India-market product/pack/merchant data to qualify the frozen search objective in real frontend/backend testing: specific-product searches target up to 5 exact same-product/same-pack merchant offers plus up to 5 distinct-brand same-pack alternatives; generic/category searches target 6–10 distinct genuine products on one comparable normalized pack; never mix packs or fabricate results merely to fill slots.

**Architecture:** Keep `sp-us2-search-v2` as the only active public v2 search path. Add an asynchronous, fail-open-to-core acquisition queue beneath it. A protected internal dispatcher sends one bounded acquisition job to Make only after canonical/cache/free discovery remains insufficient. Make returns product/commerce facts through a protected callback. The callback can stage CANDIDATE product identities through the existing discovery bridge and can stage exact-pack commerce offers through a new server-only validation RPC, but it cannot create Safety Scores, ingredient evidence, VERIFIED product identity, Benchmark Gold, or HOLDOUT mutations. Search never waits for Make; a later normal search reads the enriched canonical state.

**Tech Stack:** PostgreSQL/Supabase migrations + RLS/RPC, Deno/TypeScript Supabase Edge Functions, existing M1-B/SP-US2 policy modules, TanStack Start frontend adapter, Node `node:test`, Bun/Vite/TypeScript, GitHub Actions, Make.com webhook/callback contract.

**Spec:** `docs/superpowers/specs/2026-09-23-safeproducts-make-commerce-discovery-qualification-design.md`

## Global Constraints

- SafeProducts only. Do not touch PEDOS, AI Dual SaaS, ValuLenz/GRIL outside components already explicitly used by SafeProducts, or any other project.
- Canonical Supabase only: `wmxbdirvlwuagouraobr`.
- Work only on `feat/make-commerce-discovery-qualification-2026-09-23` until review/merge.
- Preserve public precedence: `SP_M1B_SEARCH_ENABLED=true` routes to `sp-us2-search-v2`; legacy `MAKE_SEARCH_WEBHOOK_URL` remains fallback-only and must not regain precedence.
- Frozen specific-product objective: maximum 5 exact merchant offers for the same canonical product/formula and selected normalized pack, followed by maximum 5 alternatives from distinct brands on that same normalized pack. Return fewer genuine results when supply is insufficient.
- Frozen generic/category objective: target up to 10 genuine relevant canonical products, acceptable launch floor 6 when fewer than 10 exist, prefer distinct brands, use one deterministic comparable normalized pack, and suppress comparable pricing when pack equivalence cannot be established.
- Explicit user pack always wins. For no-pack search, official/default India pack precedes trusted modal merchant/discovery pack.
- Safety remains product/formula-owned, never merchant-owned. Make cannot calculate, submit, or influence Safety Score, recommendation, Best Choice, or regulatory conclusion.
- New discovery identities enter only as `CANDIDATE`; existing non-candidate identities retain their existing identity status and source origin.
- Make-originated commerce data cannot create ingredient evidence or formula equivalence.
- Benchmark Gold and HOLDOUT are untouched.
- No service-role, OpenAI, Make callback, or internal worker secret may appear in frontend/browser code, repository examples, logs, or callback response bodies.
- All external product/merchant URLs must be HTTPS and provenance-aware. Query-string tracking differences may be tolerated only when origin + normalized path match an observed source page.
- Unknown monetary cost remains `null`; never convert unknown provider/Make cost to zero.
- Economy order remains canonical/cache → recent known discovery → deterministic/free sources → bounded Make acquisition → separately budgeted paid discovery only when still required.
- Every implementation task follows RED → verify meaningful failure → minimal GREEN → targeted verification → commit. No production migration/deployment before exact-head CI is green.

## Review Focus

Every task below must preserve tests for these five highest-risk failure modes:

1. **Pack leakage:** product+pack query loses the anchor or a 200 ml comparison silently includes another size.
2. **Authority leakage:** Make/callback creates a Safety Score, ingredient evidence, VERIFIED identity, or changes Benchmark/HOLDOUT data.
3. **Security leakage:** public/anonymous clients can mutate acquisition state, invoke internal workers, or learn server secrets.
4. **Search critical-path regression:** Make outage or slow webhook causes `sp-us2-search-v2` to fail or exceed its foreground budget.
5. **Synthetic fullness:** duplicate merchants/brands or weak relevance are used merely to manufacture 5+5/10 counts.

---

## Task 1 — Freeze the search objective and repair product+pack anchor matching

**Files**
- Modify `supabase/functions/sp-m1b-search-v1/query-policy.mjs`
- Create `supabase/migrations/20260923010000_sp_us2_pack_aware_candidate_search_v1.sql`
- Create `tests/spUnifiedSearchV2MakePackAnchor.test.mjs`
- Modify `docs/superpowers/specs/2026-09-23-safeproducts-make-commerce-discovery-qualification-design.md`

- [ ] **RED:** Add `identityQuery(text)` expectations before implementation:

```js
assert.equal(identityQuery('TATA 1mg Tejasya Ashwagandha 60 Capsules'), 'tata 1mg tejasya ashwagandha');
assert.equal(identityQuery('Brand X Baby Lotion 0.2 L'), 'brand x baby lotion');
assert.equal(identityQuery('Brand X Baby Soap 75 gm'), 'brand x baby soap');
assert.equal(identityQuery('Vitamin A 5000 IU 30 capsules'), 'vitamin a 5000 iu');
assert.equal(identityQuery('baby hair oil'), 'baby hair oil');
```

Also assert the new SQL search adapter derives a separate `v_identity_query` by removing only recognized pack tokens, ranks/matches product identity against `v_identity_query`, preserves the original query for audit/response context, and continues to return canonical pack metadata.

- [ ] Run:

```bash
node --test tests/spUnifiedSearchV2MakePackAnchor.test.mjs
```

Expected RED: `identityQuery` and the versioned migration do not exist.

- [ ] **GREEN:** Export `identityQuery` from `query-policy.mjs` using the same pack grammar already used by `parsePack`/`isExactAnchorQuery`. It must remove only pack-size/count expressions and normalize whitespace/punctuation; it must not remove strength terms such as `5000 IU` unless they are recognized pack units.

- [ ] In migration `20260923010000_sp_us2_pack_aware_candidate_search_v1.sql`, replace `sp_m1b_search_catalog_candidates_v1` with a version that computes:

```sql
v_query text := lower(btrim(coalesce(p_query,'')));
v_identity_query text := lower(btrim(regexp_replace(v_query, <canonical pack regex>, ' ', 'gi')));
```

Normalize repeated whitespace after removal. Use `v_identity_query` for exact/contains identity ranking and product/brand filtering. Do not weaken category filtering or `VERIFIED`/India/active constraints. Preserve `pack_size_text`, `pack_normalized_*`, `pack_is_official_default`, `pack_source_kind`, offer data, and strict safety snapshot fields in the returned card.

- [ ] Update the approved spec header to `**Status:** APPROVED / FROZEN 2026-09-23` and add a short **Frozen Search Objective** section stating exactly:
  - specific = up to 5 exact same-product/same-pack merchant offers + up to 5 distinct-brand same-pack alternatives;
  - generic/category = 6–10 distinct genuine products using one comparable normalized pack;
  - never mix packs, duplicate results, or fabricate records to fill counts.

- [ ] Verify:

```bash
node --test tests/spUnifiedSearchV2MakePackAnchor.test.mjs tests/spUnifiedSearchV2ProductionAcceptance.test.mjs
```

- [ ] Commit: `fix(search): make canonical candidate lookup pack aware`

---

## Task 2 — Add the service-role-only Make acquisition queue and cooldown controls

**Files**
- Create `supabase/migrations/20260923011000_sp_us2_make_acquisition_queue_v1.sql`
- Create `tests/spUnifiedSearchV2MakeAcquisitionDb.test.mjs`

- [ ] **RED:** Require an additive table `public.sp_us2_acquisition_request_v1` with at least:

```text
id uuid primary key
normalized_query text
search_mode text
anchor_product_id uuid null
dedupe_key text
requested_pack_key text null
category text null
target_exact_offers integer
target_alternatives integer
status text
attempt_count integer
max_attempts integer
next_attempt_at timestamptz
dispatched_at timestamptz null
completed_at timestamptz null
last_error_code text null
payload jsonb
result_summary jsonb null
created_at timestamptz
updated_at timestamptz
```

Require RLS, no `public`/`anon`/`authenticated` table privileges, an active-job unique/deduping index, and service-role-only RPCs:

```sql
sp_us2_enqueue_acquisition_v1(...)
sp_us2_claim_acquisition_v1()
sp_us2_finish_acquisition_v1(...)
```

Require `SECURITY DEFINER`, restricted `search_path`, advisory locking, one normalized query/anchor claim per 6 hours, maximum 60 acquisition claims/hour and 500/day, no duplicate active job, max 3 delivery attempts, and bounded reasons `QUEUED`, `ACTIVE_REQUEST_EXISTS`, `QUERY_COOLDOWN`, `GLOBAL_HOUR_LIMIT`, `GLOBAL_DAY_LIMIT`.

Assert the migration contains no writes to safety, ingredient, Benchmark Gold, or HOLDOUT tables.

- [ ] Run:

```bash
node --test tests/spUnifiedSearchV2MakeAcquisitionDb.test.mjs
```

Expected RED: acquisition migration/RPCs do not exist.

- [ ] **GREEN:** Implement the table and RPCs. Normalize query to NFKC-equivalent lowercase/trimmed whitespace semantics available in SQL; normalize requested pack key to lowercase. Build `dedupe_key` from normalized query + mode + anchor id + requested pack + category. `sp_us2_enqueue_acquisition_v1` returns JSON with `allowed`, `reason`, `request_id`, and target counts. It must never dispatch external HTTP itself.

- [ ] `sp_us2_claim_acquisition_v1()` uses an advisory transaction lock and `FOR UPDATE SKIP LOCKED` to claim only `PENDING`/due `RETRY` rows, updates status to `DISPATCHING`, increments attempt count, and returns one job or `{claimed:false}`.

- [ ] `sp_us2_finish_acquisition_v1(...)` permits only bounded transitions to `DISPATCHED`, `COMPLETED`, `RETRY`, or `FAILED`; transient delivery errors schedule retry, terminal validation errors fail without unbounded loops.

- [ ] Verify:

```bash
node --test tests/spUnifiedSearchV2MakeAcquisitionDb.test.mjs tests/spUnifiedSearchV2DiscoveryBudget.test.mjs
```

- [ ] Commit: `feat(db): add bounded Make acquisition queue`

---

## Task 3 — Add provenance-checked exact-pack commerce staging for Make callbacks

**Files**
- Create `supabase/migrations/20260923012000_sp_us2_make_commerce_stage_v1.sql`
- Create `tests/spUnifiedSearchV2MakeCommerceStage.test.mjs`

- [ ] **RED:** Require `public.sp_us2_stage_commerce_offer_v1(p_payload jsonb)` to reject:
  - nonexistent `product_id`;
  - non-India market or non-INR comparable price;
  - missing/non-HTTPS source URL;
  - source URL whose HTTPS origin + normalized path was not present in `observed_source_urls`;
  - `exact_product_match != true`;
  - `variant_match == false`;
  - requested pack mismatch or `exact_pack_match != true` when a comparable pack is supplied;
  - price `<= 0`;
  - confidence below the existing commerce trust floor (`90`).

Require dedupe by canonical product + merchant/domain identity + normalized pack + source page identity. Require an existing verified offer never be downgraded. Require service-role-only execution and zero safety/ingredient writes.

- [ ] Run:

```bash
node --test tests/spUnifiedSearchV2MakeCommerceStage.test.mjs
```

Expected RED: staging RPC is absent.

- [ ] **GREEN:** Implement the validation RPC. Reuse the canonical commerce persistence path `sp_us2_upsert_commerce_offer_v1` only after the stricter Make callback validation has succeeded. Normalize URL provenance using origin + path and ignore only query-string tracking differences. Normalize pack text/key with the same `ml/g/count` semantics used by Unified Search.

- [ ] Return only safe audit facts:

```json
{
  "success": true,
  "offer_id": "...",
  "product_id": "...",
  "pack_normalized_key": "200:ml",
  "exact_pack_match": true,
  "existing_verified_preserved": true
}
```

Do not echo secrets or arbitrary source payloads.

- [ ] Verify:

```bash
node --test tests/spUnifiedSearchV2MakeCommerceStage.test.mjs tests/spUnifiedSearchV2Commerce.test.mjs tests/spUnifiedSearchV2DiscoveryProvenance.test.mjs
```

- [ ] Commit: `feat(db): validate Make commerce staging provenance`

---

## Task 4 — Implement the protected Make callback and pure validation policy

**Files**
- Create `supabase/functions/sp-us2-make-callback-v1/make-policy.mjs`
- Create `supabase/functions/sp-us2-make-callback-v1/index.ts`
- Create `tests/spUnifiedSearchV2MakeCallback.test.mjs`
- Modify `package.json`

- [ ] **RED:** In `make-policy.mjs`, require pure functions that normalize and validate callback facts without network/database access:

```js
sourcePageKey(url)
normalizeMakeProduct(raw, context)
normalizeMakeOffer(raw, context)
validateMakeCallback(payload)
```

Tests must reject HTTP URLs, unsupported country/currency, wrong pack, wrong exact-product/variant flags, malformed prices, oversized arrays, duplicate merchant slots, and any safety/ingredient/regulatory-authority fields such as `safety_score`, `ingredients`, `ingredient_declaration`, `recommendation`, `best_choice`, `regulatory_approval`, or `identity_status:'VERIFIED'`.

Static tests must require `x-sp-us2-make-key`, `SP_US2_MAKE_CALLBACK_KEY`, constant-time comparison, and must prove the callback source contains no direct insert/update into safety/ingredient/Gold tables.

- [ ] Run:

```bash
node --test tests/spUnifiedSearchV2MakeCallback.test.mjs
```

Expected RED: callback files do not exist.

- [ ] **GREEN:** Implement callback function with `verify_jwt=false` at deployment time but custom server authentication:
  1. accept POST only;
  2. verify `x-sp-us2-make-key` against `SP_US2_MAKE_CALLBACK_KEY` with constant-time bytes comparison;
  3. reject body above 512 KiB using `Content-Length` where present and actual text length after read;
  4. parse and validate `request_id`, acquisition context, products/offers, country `IN`, currency `INR`;
  5. confirm request correlation/status via service-role RPC/read before staging;
  6. stage new identities only through `sp_catalog_stage_search_discovery_v1`;
  7. stage commerce facts only through `sp_us2_stage_commerce_offer_v1`;
  8. finish the acquisition request with counts/reasons;
  9. return counts and request status only.

- [ ] For an already canonical/non-candidate product, use its existing product id/status/source origin and never recreate/downgrade it. For new identities, preserve the existing discovery bridge’s `CANDIDATE` + review/enrichment behavior.

- [ ] Add the callback function to the scoped lint list only if the current ESLint/Deno configuration accepts it; otherwise add a dedicated syntax/static contract test rather than weakening lint rules.

- [ ] Verify:

```bash
node --test tests/spUnifiedSearchV2MakeCallback.test.mjs tests/spUnifiedSearchV2DiscoveryBridge.test.mjs tests/spUnifiedSearchV2DiscoveryStagingStatus.test.mjs
bun run typecheck
```

- [ ] Commit: `feat(search): add protected Make acquisition callback`

---

## Task 5 — Implement the internal Make dispatcher with bounded delivery and no foreground dependency

**Files**
- Create `supabase/functions/sp-us2-make-dispatch-v1/index.ts`
- Create `tests/spUnifiedSearchV2MakeDispatch.test.mjs`
- Modify `package.json`

- [ ] **RED:** Static/runtime-policy tests must require:
  - internal `x-us2-internal-key` authentication using the existing server-key pattern;
  - rollout flag `SP_US2_MAKE_ACQUISITION_ENABLED === 'true'` before claiming work;
  - HTTPS-only `MAKE_ACQUISITION_WEBHOOK_URL` with no username/password;
  - exactly one Make webhook POST per claimed request;
  - an 8-second delivery timeout;
  - no Supabase service key or callback key in the JSON body;
  - callback URL points to `/functions/v1/sp-us2-make-callback-v1`;
  - failed/transient webhook delivery records `RETRY` rather than breaking search;
  - terminal configuration/auth/schema failure records `FAILED`;
  - no safety/ingredient writes.

- [ ] Run:

```bash
node --test tests/spUnifiedSearchV2MakeDispatch.test.mjs
```

Expected RED: dispatcher is absent.

- [ ] **GREEN:** Dispatcher flow:
  1. custom internal auth;
  2. rollout flag check;
  3. validate webhook URL;
  4. claim one request via `sp_us2_claim_acquisition_v1`;
  5. fetch minimal anchor identity context when `anchor_product_id` exists;
  6. POST versioned contract `SP-US2-MAKE-ACQUISITION/1.0` to Make;
  7. expect a fast acknowledgement (`2xx`) rather than waiting for discovery completion;
  8. mark `DISPATCHED` on success or bounded retry/failure on error.

- [ ] Payload contains only request context: request id, query, mode, anchor facts, requested pack, category, exact/alternative targets, `IN`, `INR`, and callback URL. The callback secret is configured separately inside Make and is not sent as job data.

- [ ] Verify:

```bash
node --test tests/spUnifiedSearchV2MakeDispatch.test.mjs tests/spUnifiedSearchV2Economy.test.mjs
bun run typecheck
```

- [ ] Commit: `feat(search): add bounded Make acquisition dispatcher`

---

## Task 6 — Integrate asynchronous acquisition need/queueing into `sp-us2-search-v2`

**Files**
- Modify `supabase/functions/sp-us2-search-v2/orchestration-policy.mjs`
- Modify `supabase/functions/sp-us2-search-v2/index.ts`
- Create `tests/spUnifiedSearchV2MakeOrchestration.test.mjs`
- Verify `src/lib/productSearch.functions.ts` without changing public precedence unless tests expose a defect

- [ ] **RED:** Add pure policy tests for:

```js
acquisitionNeed(specificResponse, 10)
// => { needed:true, targetExactOffers: 5-exactCount, targetAlternatives: 5-altCount }

acquisitionNeed(categoryWithFiveBrands, 10)
// => needed:true; target category coverage remains 10, minimum-useful floor is 6

acquisitionNeed(categoryWithTenBrands, 10)
// => needed:false
```

Specific acquisition is needed when either exact offers are below five or alternatives are below five. Category acquisition is needed while genuine distinct-brand comparable-pack coverage is below requested target, but live foreground dispatch should be economy-gated: enqueue/dispatch urgently below the six-product minimum-useful floor; above six and below ten may be filled by prewarm/background cadence rather than repeated foreground pressure.

Static tests must prove:
- `sp-us2-search-v2` returns the merged response regardless of Make enqueue/dispatch failure;
- Make work is not awaited in the foreground response path beyond a small queue RPC budget;
- the existing free/paid discovery path remains intact;
- `productSearch.functions.ts` still routes to `sp-us2-search-v2` before the legacy Make fallback.

- [ ] Run:

```bash
node --test tests/spUnifiedSearchV2MakeOrchestration.test.mjs
```

Expected RED: acquisition policy/enqueue integration absent.

- [ ] **GREEN:** Add `acquisitionNeed()` and target-count helpers to `orchestration-policy.mjs`. After core + discovery merge is complete, use the service-role key only inside the Edge function to call `sp_us2_enqueue_acquisition_v1` with a maximum ~500 ms queue budget. Never expose this RPC to the client.

- [ ] If enqueue succeeds and rollout flag is enabled, schedule dispatch outside the response critical path using `EdgeRuntime.waitUntil(...)` when available. If the runtime cannot schedule background work, leave the request `PENDING`; prewarm/operations can call the dispatcher explicitly. Do not synchronously wait for Make.

- [ ] Add non-authoritative telemetry under `m1b_meta.make_acquisition`, e.g. `{queued, reason, request_id}`. The frontend adapter may ignore this extra field; it must not affect search eligibility/ranking.

- [ ] Verify:

```bash
node --test tests/spUnifiedSearchV2MakeOrchestration.test.mjs tests/spUnifiedSearchV2DiscoveryBridge.test.mjs tests/spUnifiedSearchV2ProductionAcceptance.test.mjs
bun run typecheck
```

- [ ] Commit: `feat(search): queue Make acquisition on genuine shortfall`

---

## Task 7 — Version the Make scenario contract and add launch-catalog prewarm tooling

**Files**
- Create `docs/integrations/make/sp-us2-acquisition-v1.md`
- Create `tools/sp_us2/make_acquisition_contract_v1.json`
- Create `tools/sp_us2/launch_prewarm_queries.json`
- Create `scripts/sp-us2-prewarm.mjs`
- Create `tests/spUnifiedSearchV2MakeContract.test.mjs`
- Modify `.gitignore` only if local evidence/output files need exclusion

- [ ] **RED:** Require JSON schema/contract examples for one request and one callback, and assert they contain no server secrets or safety fields. Require representative prewarm cases covering at least:
  - specific product + explicit ml pack;
  - specific product + count pack (`60 capsules`);
  - Indian gram alias (`75 gm`);
  - generic/category with no explicit pack;
  - generic/category with explicit pack.

- [ ] Run:

```bash
node --test tests/spUnifiedSearchV2MakeContract.test.mjs
```

Expected RED: contract/tooling files absent.

- [ ] **GREEN:** Document the exact Make module sequence:
  1. Custom webhook receives `SP-US2-MAKE-ACQUISITION/1.0`.
  2. Router by `search_mode`.
  3. Specific route discovers exact anchor merchant pages for required pack and distinct-brand same-pack alternatives.
  4. Category route discovers relevant products, preferring distinct brands and one comparable pack.
  5. Normalize/validate visible source URL, merchant, price, pack, image/provenance.
  6. Aggregate bounded result arrays.
  7. HTTP callback POST to SafeProducts `sp-us2-make-callback-v1` with header `x-sp-us2-make-key` configured as a Make secret/connection value.
  8. Never calculate Safety Score, ingredient evidence, recommendation, regulatory status, or Best Choice.

- [ ] `scripts/sp-us2-prewarm.mjs` must fail closed unless the Supabase URL matches `wmxbdirvlwuagouraobr.supabase.co`. It reads operational credentials from environment only, never prints them, submits controlled acquisition requests, calls the dispatcher, polls bounded status, then invokes the normal public v2 contract for qualification output. It must support dry-run/contract-validation mode without external calls.

- [ ] Do not embed a live Make webhook or callback secret in Git. The active ChatGPT runtime currently has no Make connector; the versioned contract/blueprint is therefore the canonical handoff for applying the Make scenario once authenticated Make access is available.

- [ ] Verify:

```bash
node --test tests/spUnifiedSearchV2MakeContract.test.mjs
node scripts/sp-us2-prewarm.mjs --dry-run
```

- [ ] Commit: `docs+tools(search): version Make acquisition contract and prewarm runner`

---

## Task 8 — Expand CI scope and run full non-production qualification

**Files**
- Modify `.github/workflows/m1b-m1br-ci.yml`
- Modify `.github/workflows/unified-search-fix-ci.yml` only if needed for explicit Make contract evidence
- Modify `package.json` scoped lint list where supported
- Create `docs/superpowers/certifications/2026-09-23-safeproducts-make-commerce-discovery-qualification.md`

- [ ] Add path coverage for:

```text
supabase/functions/sp-us2-*/**
docs/integrations/make/**
tools/sp_us2/**
scripts/sp-us2-prewarm.mjs
tests/spUnifiedSearchV2Make*.test.mjs
```

The Unified Search workflow already runs `tests/spUnifiedSearchV2*.test.mjs`; preserve that broad wildcard.

- [ ] Run fresh local/CI-equivalent verification on the exact head:

```bash
node --test tests/spUnifiedSearchV2*.test.mjs
node --test tests/spM1B*.test.mjs
python tools/m1a/test_benchmark.py
bun run check:backend
bun run build
bun run typecheck
bun run lint:m1b
```

If existing Python M1-B suites are touched indirectly by the change, also run the full Python/pytest sequence already used by `M1-B M1-BR CI`.

- [ ] Create a draft PR to `main`; wait for all required CI workflows. Do not deploy migrations/functions while any required workflow is red.

- [ ] Certification file must record exact head SHA, RED failures observed before each GREEN implementation, final test counts/results, build/typecheck/lint results, and any remaining external Make-connection dependency.

- [ ] Commit: `ci(search): qualify Make acquisition bridge`

---

## Task 9 — Controlled canonical Supabase rollout with acquisition disabled by default

**Files deployed**
- `20260923010000_sp_us2_pack_aware_candidate_search_v1.sql`
- `20260923011000_sp_us2_make_acquisition_queue_v1.sql`
- `20260923012000_sp_us2_make_commerce_stage_v1.sql`
- `sp-us2-make-callback-v1` (`verify_jwt=false`, custom Make key)
- `sp-us2-make-dispatch-v1` (`verify_jwt=false`, custom internal key)
- updated `sp-us2-search-v2` (`verify_jwt=true`)

- [ ] Before mutation, capture production counts for canonical products by identity status/source origin, normalized packs, commerce offers by verified/exact-pack state, safety assessments, ingredient evidence, review queue, enrichment queue, Benchmark Gold, and paid/acquisition budget state.

- [ ] Verify migration/RPC objects do not already exist before applying. Apply migrations in timestamp order using canonical Supabase migration tooling.

- [ ] Deploy exact repository source only; do not manually compact/rewrite functions during transport.

- [ ] Confirm function auth after deployment:
  - `sp-us2-search-v2`: ACTIVE, `verify_jwt=true`;
  - `sp-us2-make-dispatch-v1`: ACTIVE, `verify_jwt=false`;
  - `sp-us2-make-callback-v1`: ACTIVE, `verify_jwt=false`;
  - existing `sp-us2-discovery-v1`, `sp-us2-commerce-v1`, `sp-m1b-search-v1` unchanged except versioned code explicitly required by this plan.

- [ ] Keep `SP_US2_MAKE_ACQUISITION_ENABLED` disabled/unset. Confirm ordinary production v2 search still works and Make absence cannot affect user search.

- [ ] Database invariant check: no new Safety Score/ingredient/Benchmark/HOLDOUT writes from merely installing queue/RPC/functions.

- [ ] Record production object/function versions in the certification file.

---

## Task 10 — Configure Make, run real acquisition roundtrip, and qualify frontend 5+5/generic behavior

**External dependency:** Direct Make scenario editing requires authenticated Make access. Do not claim this task complete until that access exists and the real roundtrip is evidenced.

- [ ] In Make, create/update the acquisition scenario exactly from `docs/integrations/make/sp-us2-acquisition-v1.md` and `tools/sp_us2/make_acquisition_contract_v1.json`.

- [ ] Configure Make-side callback secret and Supabase server-side `MAKE_ACQUISITION_WEBHOOK_URL` / `SP_US2_MAKE_CALLBACK_KEY`; never place them in frontend or repository files.

- [ ] With acquisition still controlled, run one representative **specific-product** prewarm job with a resolved pack. Inspect callback residue before public search:
  - exact offers all map to one canonical anchor product;
  - merchant slots are distinct;
  - all comparable prices use one normalized pack;
  - alternatives are distinct-brand and same-pack;
  - new identities are CANDIDATE unless already canonical/verified;
  - no new safety assessment or ingredient evidence is created by Make.

- [ ] Run the same query through the normal frontend → server function → `sp-us2-search-v2`. Require up to 5 exact + up to 5 alternatives when genuine sources supply them; fewer is valid only with genuine source shortfall. Require unscored products to show the canonical insufficient-evidence wording and never win Best Choice.

- [ ] Run one **generic/category** prewarm/search pair. Require 6–10 genuine distinct products where available, one deterministic comparable normalized pack, and no cross-pack price comparison. If pack cannot be established, products may display but comparable price/Best Choice must be suppressed.

- [ ] Run a controlled Make failure test (disabled scenario or forced benign delivery failure) and prove normal v2 search still returns core/cache/free discovery results.

- [ ] Post-run residue audit: compare against the pre-state snapshot and confirm no verified-product downgrade, Safety Score fabrication, ingredient-evidence creation, Benchmark Gold change, HOLDOUT interaction, or unbounded acquisition claims.

- [ ] Only after these checks pass, enable routine asynchronous acquisition dispatch. Keep the queue flag as the immediate rollback switch.

- [ ] Update certification with exact Make scenario version/evidence, acquisition request ids, function versions, query cases, product/offer counts, frontend results, and any genuine source shortfalls.

---

## Final Verification / Completion Gate

The milestone may be called complete only after fresh evidence on the exact final head and live runtime proves all of the following:

- [ ] `TATA 1mg Tejasya Ashwagandha 60 Capsules`-style queries preserve the canonical anchor while retaining `60:count` as a pack constraint.
- [ ] Specific-product composition remains maximum 5 distinct exact merchant offers + maximum 5 distinct-brand same-pack alternatives.
- [ ] Generic/category composition remains 6–10 genuine distinct products on one comparable pack; no mixed-pack fill.
- [ ] Make acquisition is asynchronous and never required for foreground search success.
- [ ] Duplicate active acquisitions collapse; 6-hour query/anchor cooldown and 60/hour + 500/day caps are enforced server-side.
- [ ] Callback is custom-secret authenticated and public clients cannot mutate acquisition/commerce state.
- [ ] Make-originated identities remain CANDIDATE unless an already canonical non-candidate identity is reused.
- [ ] Exact commerce offer staging is provenance-checked, India/INR, HTTPS, exact-product, exact-pack, and merchant-deduplicated.
- [ ] No Make path writes Safety Scores, ingredients/evidence, Benchmark Gold, or HOLDOUT records.
- [ ] Existing verified product/offer state is never downgraded.
- [ ] `sp-us2-search-v2` remains the public frontend endpoint; legacy Make search does not regain precedence.
- [ ] Unscored products remain visibly unscored and cannot win Best Choice.
- [ ] Frozen 70/30 Best Choice logic remains unchanged and only uses qualified safety + comparable price.
- [ ] Full Unified Search + M1-B/M1-BR + label CI, build, typecheck, backend guards, and scoped lint are green on the exact final head.
- [ ] Real Make roundtrip and real frontend/backend acceptance have passed before routine acquisition is enabled.

## Rollback

Immediate operational rollback is `SP_US2_MAKE_ACQUISITION_ENABLED=false`/unset. This stops new Make dispatch without disabling `sp-us2-search-v2`, `sp-us2-discovery-v1`, `sp-us2-commerce-v1`, or the v1 rollback endpoint. Pending queue rows remain auditable and may be paused; additive candidate/offer records remain reviewable. No catalog deletion is required for rollback.
