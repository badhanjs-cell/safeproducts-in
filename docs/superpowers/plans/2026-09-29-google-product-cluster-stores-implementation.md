# SafeProducts Google Product-Cluster → Stores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cost-bounded Google Shopping product-cluster → clustered stores path for specific-product searches before residual Make acquisition, while preserving the existing search contract and all safety boundaries.

**Architecture:** Add a pure policy module plus internal Edge Function `sp-us2-google-cluster-v1`. `sp-us2-search-v2` invokes it only for specific-product exact-offer shortfalls, then reuses canonical exact-offer reads and existing alternative discovery before calculating any Make shortfall. Existing protected commerce staging remains the only write path for merchant offers; routine Make dispatch remains disabled.

**Tech Stack:** Supabase Edge Functions (Deno/TypeScript), JavaScript policy modules, PostgreSQL RPCs already present in SafeProducts, Node test runner, Bun/Vite/TypeScript CI.

**Spec:** `docs/superpowers/specs/2026-09-29-google-product-cluster-stores-acquisition-design.md`

## Global Constraints

- SafeProducts only; do not touch PEDOS, AI Dual SaaS, unrelated ValuLenz/GRIL components, unrelated Supabase projects or unrelated Make scenarios.
- Cost control is the default decision rule.
- Reuse existing verified offers and cached evidence before provider calls.
- Google-cluster path runs only for `SPECIFIC_PRODUCT` when fewer than five exact offers remain.
- Maximum provider budget per attempt: 1 Google Shopping resolution call + 1 Immersive Product Stores call; no foreground retry/fan-out.
- Preserve provider caching; do not force `no_cache=true` in normal operation.
- Routine Make scenario `7613424` remains inactive and `SP_US2_MAKE_ACQUISITION_ENABLED` remains unchanged/disabled.
- Google cluster evidence is commerce identity evidence only; never create Safety Scores, ingredients, recommendations, regulatory conclusions, VERIFIED identities, Benchmark Gold or HOLDOUT state.
- Proposed credential name: `SP_US2_SERPAPI_API_KEY`; server-side only, never committed/logged/returned to clients.
- Do not request the credential until code, deterministic tests and CI are green and the controlled live probe is ready.
- Missing credential/provider failure must fail open to current SafeProducts search behavior.
- Preserve backward compatibility of the public `sp-us2-search-v2` response.
- No database migration unless implementation proves durable schema changes are strictly necessary; any such migration requires explicit review before production.

## Review Focus

1. **Ambiguous Google cluster:** when two clusters share brand/name but differ by variant/pack, select only the unambiguous matching cluster; otherwise return `NO_QUALIFIED_CLUSTER` without a Stores call. Covered in Task 1.
2. **Merchant title omits pack:** accept a store from a locked exact cluster when the store itself has no contradictory pack evidence, but reject an explicit wrong pack. Covered in Task 1.
3. **Cost budget exhaustion:** provider-call counters can never exceed one Shopping and one Stores request per invocation, including timeout/error paths. Covered in Task 2.
4. **Existing five exact offers:** skip the cluster provider entirely and preserve Make target exact = 0. Covered in Task 3.
5. **Provider succeeds but staging partially rejects:** retain successfully staged offers, report residual shortfall, and continue the existing fallback path without failing the user search. Covered in Tasks 2 and 3.

---

### Task 1: Deterministic Google cluster and store policy

**Files:**
- Create: `supabase/functions/sp-us2-google-cluster-v1/google-cluster-policy.mjs`
- Create: `tests/spUnifiedSearchV2GoogleClusterPolicy.test.mjs`

**Interfaces:**
- Consumes: canonical anchor `{ canonical_product_id, brand_name, product_name, variant_name?, pack_normalized_key? }`, original query, requested pack key, SerpApi Shopping JSON and Stores JSON fixtures.
- Produces: `selectGoogleProductCluster(results, context)`, `normalizeClusterStores(payload, context)`, `clusterAcquisitionNeed(currentExactOffers, target=5)`, and pack/URL helpers used by Task 2.

- [ ] **Step 1: Write RED tests for exact cluster selection.**
  Assert that a NIVEA MEN Deep Comfort After Shave Lotion 100 ml fixture selects the matching cluster/token; explicit wrong variant and explicit wrong pack fixtures are rejected; ambiguous equal-strength clusters yield no selection.

- [ ] **Step 2: Run the policy test and confirm meaningful RED.**
  Run: `node --test tests/spUnifiedSearchV2GoogleClusterPolicy.test.mjs`
  Expected: FAIL because `google-cluster-policy.mjs`/exports do not yet exist.

- [ ] **Step 3: Implement cluster identity qualification.**
  Implement `selectGoogleProductCluster(results, context)` with normalized brand agreement, substantial canonical product-token agreement, variant-conflict rejection, requested-pack conflict rejection, required product/token identifier, deterministic tie handling and no provider calls.

- [ ] **Step 4: Add RED tests for merchant normalization.**
  Assert: missing pack in merchant title is accepted after cluster lock; explicit contradictory pack is rejected; non-HTTPS/credentialed URLs, non-positive prices and non-INR rows are rejected; duplicate merchant/page rows collapse deterministically; output is capped to requested shortfall and never above five.

- [ ] **Step 5: Implement store normalization.**
  Implement `normalizeClusterStores(payload, context)` to return staging-ready commerce candidates with observed source provenance, merchant/platform, INR price, requested pack key, exact product/variant/pack booleans and confidence >= 90 without requiring full product wording in every merchant title.

- [ ] **Step 6: Add and pass cost/edge policy tests.**
  Cover zero-shortfall skip, target clamping, count/unit pack aliases, URL query/fragment normalization, explicit variant contradiction, empty/malformed provider arrays and deterministic output order.

- [ ] **Step 7: Verify Task 1 GREEN.**
  Run: `node --test tests/spUnifiedSearchV2GoogleClusterPolicy.test.mjs`
  Expected: PASS, 0 failures.

- [ ] **Step 8: Commit Task 1.**
  Commit message: `feat(search): add Google cluster store policy`

---

### Task 2: Internal Google cluster acquisition Edge Function

**Files:**
- Create: `supabase/functions/sp-us2-google-cluster-v1/index.ts`
- Modify: `package.json` (`lint:m1b` scope only)
- Create: `tests/spUnifiedSearchV2GoogleClusterContract.test.mjs`

**Interfaces:**
- Consumes: internal header `x-us2-internal-key`, request `{ query, anchor_product, requested_pack_key, target_exact_offers }`, server secret `SP_US2_SERPAPI_API_KEY`, policy helpers from Task 1, existing RPC `sp_us2_stage_commerce_offer_v1(jsonb)` and existing exact-offer RPC `sp_us2_exact_offers_v1(uuid,text,integer)`.
- Produces: `{ success, attempted, reason, products/exact_offers, telemetry }` with bounded counters and no public credential fields.

- [ ] **Step 1: Write RED contract/security tests.**
  Assert source requires POST, constant-time internal-key auth, reads `SP_US2_SERPAPI_API_KEY`, never embeds/logs it, uses `AbortSignal.timeout`, calls SerpApi Shopping at most once and Immersive Stores at most once with `more_stores=true`, and calls existing `sp_us2_stage_commerce_offer_v1` rather than direct commerce-table writes.

- [ ] **Step 2: Run contract test and confirm RED.**
  Run: `node --test tests/spUnifiedSearchV2GoogleClusterContract.test.mjs`
  Expected: FAIL because the Edge Function does not exist.

- [ ] **Step 3: Implement internal request validation/authentication.**
  Follow the existing `sp-us2-discovery-v1` constant-time server-key pattern. Reject invalid method/body/auth locally; return benign `SERPAPI_KEY_UNAVAILABLE` when the provider secret is absent.

- [ ] **Step 4: Implement the bounded provider sequence.**
  Shopping request: India market parameters, original specific query, normal provider caching. Select one qualified cluster through Task 1 policy. Only if selected, issue one Immersive Product Stores request with the provider cluster token and `more_stores=true`. No automatic retries or secondary cluster attempts.

- [ ] **Step 5: Implement staging through the existing protected RPC.**
  For each accepted normalized store candidate up to the shortfall, call `sp_us2_stage_commerce_offer_v1` with canonical anchor product id, India/INR, source URL in `observed_source_urls`, exact product/variant flags, requested pack and confidence >= 90. Continue past individual staging rejection and record `STAGING_REJECTED`/partial counts rather than failing the whole user search.

- [ ] **Step 6: Re-read canonical exact offers and build telemetry.**
  Return verified canonical exact offers plus `{ shopping_calls:0|1, stores_calls:0|1, stores_observed, stores_accepted, stores_staged, exact_before, exact_after, residual_shortfall, latency_ms, reason }`. Never include the SerpApi key, raw auth headers or protected safety data.

- [ ] **Step 7: Pin fail-open behavior in tests.**
  Contract/source tests must cover missing secret, Shopping timeout/error, no qualified cluster, token missing, Stores timeout/error, no stores, partial staging rejection and provider call-budget caps.

- [ ] **Step 8: Add the new Edge Function to scoped lint and verify.**
  Modify `package.json` `lint:m1b` to include `supabase/functions/sp-us2-google-cluster-v1/index.ts`.
  Run: `node --test tests/spUnifiedSearchV2GoogleClusterPolicy.test.mjs tests/spUnifiedSearchV2GoogleClusterContract.test.mjs`
  Expected: PASS.

- [ ] **Step 9: Commit Task 2.**
  Commit message: `feat(search): add bounded Google cluster acquisition function`

---

### Task 3: Search-v2 orchestration before Make fallback

**Files:**
- Modify: `supabase/functions/sp-us2-search-v2/orchestration-policy.mjs`
- Modify: `supabase/functions/sp-us2-search-v2/index.ts`
- Modify: `tests/spUnifiedSearchV2MakeOrchestration.test.mjs`
- Create: `tests/spUnifiedSearchV2GoogleClusterOrchestration.test.mjs`

**Interfaces:**
- Consumes: core specific-product response, `sp-us2-google-cluster-v1` response from Task 2, existing discovery response and existing `acquisitionNeed()`.
- Produces: unchanged public search schema plus backward-compatible nested `m1b_meta.google_cluster_acquisition` telemetry; Make targets reflect only residual exact/alternative shortfall after Google cluster + discovery merge.

- [ ] **Step 1: Write RED orchestration tests.**
  Tests must prove: category search never invokes the cluster function; specific search with five exact offers skips it; specific search with one exact offer targets four; Google-added exact offers are included before `acquisitionNeed()`; five exact offers yield Make exact target 0; three exact offers leave target 2; existing alternatives remain independent.

- [ ] **Step 2: Run orchestration tests and confirm RED.**
  Run: `node --test tests/spUnifiedSearchV2GoogleClusterOrchestration.test.mjs tests/spUnifiedSearchV2MakeOrchestration.test.mjs`
  Expected: new test fails because Google cluster orchestration is absent; existing Make tests remain green.

- [ ] **Step 3: Add pure orchestration helpers.**
  Add helpers in `orchestration-policy.mjs` for exact-offer count/shortfall and cluster eligibility without changing existing `acquisitionNeed()` semantics.

- [ ] **Step 4: Add `invokeGoogleCluster()` to `sp-us2-search-v2/index.ts`.**
  Use existing internal headers/server key. Invoke only after core canonical anchor resolution, only for `SPECIFIC_PRODUCT`, only when exact shortfall > 0 and deadline budget remains. Bound this call so alternative discovery still receives time.

- [ ] **Step 5: Refresh core exact offers after a successful/partial cluster attempt.**
  Prefer the exact offers returned by the internal cluster function or re-read through the existing canonical exact-offer RPC/function contract, then merge them as `EXACT_OFFER` while preserving the canonical anchor and selected pack.

- [ ] **Step 6: Preserve existing alternative discovery.**
  Continue using `specificAlternativeQuery()` and `sp-us2-discovery-v1` for same-pack alternatives. Do not route Google clustered merchant offers into alternative-product discovery.

- [ ] **Step 7: Calculate Make fallback last.**
  Keep `finalizeSearchResponse()`/`acquisitionNeed()` as the final residual calculator. Confirm `scheduleMakeDispatch()` remains guarded by `SP_US2_MAKE_ACQUISITION_ENABLED === "true"`; do not change the flag or scenario state.

- [ ] **Step 8: Add backward-compatibility and failure tests.**
  Ensure missing cluster secret, timeout, malformed response or partial store coverage leaves a valid normal search response; category behavior and market-standard pack fallback remain unchanged; no new required top-level response fields are introduced.

- [ ] **Step 9: Verify Task 3 GREEN.**
  Run: `node --test tests/spUnifiedSearchV2*.test.mjs`
  Expected: all Unified Search contract tests PASS, 0 failures.

- [ ] **Step 10: Commit Task 3.**
  Commit message: `feat(search): acquire clustered merchant offers before Make fallback`

---

### Task 4: Security, cost and regression qualification

**Files:**
- Modify if needed: `.github/workflows/unified-search-fix-ci.yml` only if existing `tests/spUnifiedSearchV2*.test.mjs` glob/lint coverage is insufficient.
- Modify if needed: `tests/spUnifiedSearchV2GoogleClusterContract.test.mjs`
- Existing regression suites unchanged unless an actual contract gap is discovered.

**Interfaces:**
- Consumes: completed branch implementation.
- Produces: CI-qualified branch with evidence that safety invariants, Make gating and cost caps remain intact.

- [ ] **Step 1: Run full Unified Search contract suite.**
  Run: `node --test tests/spUnifiedSearchV2*.test.mjs`
  Expected: PASS, 0 failures.

- [ ] **Step 2: Run backend guards.**
  Run: `bun run check:backend`
  Expected: exit 0.

- [ ] **Step 3: Run scoped lint.**
  Run: `bun run lint:m1b`
  Expected: exit 0.

- [ ] **Step 4: Run typecheck and production build.**
  Run: `bun run typecheck && bun run build`
  Expected: both exit 0.

- [ ] **Step 5: Inspect implementation for forbidden writes/secrets.**
  Verify new files contain no direct insert/update/delete references to safety assessment, ingredient evidence/product-ingredient, Benchmark Gold or HOLDOUT artifacts; no hardcoded SerpApi credential; no `no_cache=true`; no code that activates Make.

- [ ] **Step 6: Verify Make scenario state remains inactive.**
  Inspect Make scenario `7613424`; expected `inactive`, with no activation mutation performed.

- [ ] **Step 7: Open draft PR to `main` and wait for exact-head CI.**
  PR body records cost controls, credential-not-yet-installed status, exact provider-call caps, safety boundary and rollback.

- [ ] **Step 8: Confirm required exact-head workflows are green.**
  Require at least Unified Search Fix CI plus all repository-required companion workflows that trigger on the PR head.

---

### Task 5: Credential insertion and controlled live qualification

**Files:**
- No repository file should contain the credential.
- Supabase production: deploy `sp-us2-google-cluster-v1`; update `sp-us2-search-v2` only after deterministic/CI qualification.

**Interfaces:**
- Consumes: green PR head, canonical Supabase project `wmxbdirvlwuagouraobr`, user-provided SerpApi server credential at the secure insertion stage.
- Produces: controlled live evidence for exact merchant coverage, provider cost telemetry and protected production invariants.

- [ ] **Step 1: At this point only, ask the user to insert/provide the credential.**
  Prefer a native secure Supabase secret-entry flow if available. Do not ask the user to paste the credential into chat when a native secure path exists. Secret name: `SP_US2_SERPAPI_API_KEY` unless a canonical existing server-side name has been established by then.

- [ ] **Step 2: Deploy the new internal Edge Function with custom internal authentication.**
  Deploy `sp-us2-google-cluster-v1` with `verify_jwt=false` only because its body enforces the existing constant-time internal server-key check. Do not expose it as an unauthenticated public API.

- [ ] **Step 3: Controlled direct function probe before wiring live search.**
  Use the known NIVEA MEN Deep Comfort After Shave Lotion 100 ml canonical anchor. Perform one cluster acquisition attempt. Confirm provider counters <= 1 Shopping + 1 Stores, exact cluster identity/pack correctness, and no protected safety-record changes.

- [ ] **Step 4: If probe is valid, deploy the qualified `sp-us2-search-v2` successor version.**
  Preserve `verify_jwt=true`. Keep routine Make acquisition disabled.

- [ ] **Step 5: Run one normal-deadline live end-to-end NIVEA search.**
  Verify: exact merchants are same product/same 100 ml cluster; up to five are shown when provider supplies them; same-pack alternatives remain up to five distinct brands; Make exact target is only residual shortage; Make dispatch remains unscheduled/disabled.

- [ ] **Step 6: Audit protected invariants and cost telemetry.**
  Recheck VERIFIED/CANDIDATE counts, safety assessments, product-ingredient links, Benchmark Gold and unknown-pack verified-price leakage. Only legitimate commerce-offer growth is allowed. Record SerpApi call counts/reason and do not repeat live calls once evidence is sufficient.

- [ ] **Step 7: Update the PR qualification record.**
  Document live evidence, production function versions, cost counters, merchant count, fallback behavior and invariant audit. Do not merge without the user's explicit integration decision.

---

## Self-review result

- Spec coverage: all objective, cost, security, failure, telemetry, rollback, Make fallback and credential-timing requirements map to Tasks 1–5.
- No durable database schema is required by the current plan; existing `sp_us2_stage_commerce_offer_v1` and `sp_us2_exact_offers_v1` are reused.
- Type/interface names are consistent across tasks: `sp-us2-google-cluster-v1`, `google-cluster-policy.mjs`, `m1b_meta.google_cluster_acquisition`, `SP_US2_SERPAPI_API_KEY`.
- The five highest-risk uncovered input classes are explicitly pinned in Review Focus and corresponding task tests.
- Live provider use is deferred until deterministic tests and PR CI are green, limiting cost and preventing credentials from becoming an implementation dependency.
