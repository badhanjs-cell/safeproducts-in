# SafeProducts SP-US2 Launch Acquisition v1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved launch-grade SafeProducts acquisition pipeline: strict 5+5 specific-product commerce, 6–10 comparable category results, explicit-pack immutability, bounded Make/SerpApi cost, protected callback staging, and the existing backend evidence chain `Official → trusted → OCR/VLM → human review`.

**Architecture:** Reconcile the already-qualified Google product-cluster branch with current `main`, make strict pack selection authoritative in the SP-US2 core, introduce versioned Make acquisition/callback contracts `1.1` without rewriting frozen `1.0`, reduce Make provider fan-out to the approved budget, keep Make as commerce/product discovery only, and preserve M1-B/Supabase as the sole identity/evidence/safety authority.

**Tech Stack:** GitHub, Supabase PostgreSQL/RPC + Edge Functions (Deno/TypeScript), JavaScript policy modules, Node test runner, Bun/Vite/TypeScript CI, Make.com scenario 7613424, SerpApi Google Shopping/Immersive Product Stores.

**Spec:** `docs/superpowers/specs/2026-09-29-sp-us2-launch-acquisition-v1-1-design.md`

## Global Constraints

- SafeProducts only. Do not touch PEDOS, AI Dual SaaS, unrelated ValuLenz/GRIL components, unrelated Supabase projects, or unrelated Make scenarios.
- Canonical repository: `badhanjs-cell/safeproducts`; canonical Supabase project: `wmxbdirvlwuagouraobr`; canonical Make scenario: `7613424`.
- Cost control is a launch requirement. Prefer cache/current canonical evidence, then the existing Google product-cluster path, then free/cached discovery, and Make only for residual shortfall.
- Routine Make acquisition stays disabled throughout implementation and after qualification unless the user separately authorizes routine activation.
- Do not weaken identity, variant, formula, pack, provenance, ingredient, safety, or human-review gates to increase result count.
- Explicit user pack is immutable in launch behavior. `200 ml` means `200:ml` only; return fewer results rather than substitute another size.
- Frozen Make `1.0` semantics remain available for historical compatibility. New launch jobs use versioned `1.1`; do not silently reinterpret a historical `1.0` callback as `1.1`.
- Make never creates Safety Scores, ingredient evidence, VERIFIED identity, regulatory conclusions, Best Choice, Benchmark Gold, HOLDOUT state, or human-review decisions.
- New identities from acquisition remain `CANDIDATE` unless existing canonical review/enrichment later promotes them.
- Product images are opportunistic presentation assets only. Never make a paid provider call solely for an image and never use image presence as safety/eligibility evidence.
- Never commit, log, return, or place in browser payloads the Supabase server key, Make callback key, SerpApi key, worker token, or other privileged secret.
- Use RED → verify meaningful failure → GREEN → full verification for each behavior change.
- Do not merge the final PR without the user's audit/explicit merge decision.

## Review Focus

1. **Explicit-pack scarcity:** if a requested pack has zero or three valid results, return zero or three; never substitute a market-standard pack. Covered in Tasks 2, 4, and 7.
2. **Wrong formula/variant/multipack:** similar titles, wrong variants, `Pack of N`, `N × size`, `size × N`, combo/set/value packs must not enter single-pack exact/alternative slots. Covered in Tasks 4 and 5.
3. **Duplicate evidence inflating decisions:** one merchant, domain, or brand cannot create multiple merchant/brand slots or dominate modal pack selection. Tie behavior must be deterministic and may resolve to no comparable pack. Covered in Tasks 2 and 5.
4. **Provider fields missing:** missing token/link/brand/price/pack evidence causes the observation to be skipped, not extra fan-out or fabricated evidence. Covered in Task 5.
5. **Backward compatibility:** `1.0` queue/callback behavior remains frozen while new jobs are explicitly `1.1`. Covered in Tasks 3 and 4.
6. **Authority separation:** no Make or commerce callback path may write safety/ingredient/VERIFIED truth. Covered in Tasks 4 and 6.
7. **Cost ceilings:** SPECIFIC_PRODUCT Make path uses at most one exact Shopping call + one exact Stores call + one alternative Shopping call; CATEGORY uses at most one Shopping call. Covered in Task 5 and live qualification.

---

### Task 1: Reconcile the qualified Google-cluster implementation with latest main

**Files / refs:**
- Source implementation: branch `feat/google-product-cluster-stores-2026-09-29`, qualified head `30df984974ce9d0213643542b48a562f7aaaa1ee`.
- Current main: `295395053afae4150695f413e8646e1241a94285` or its then-current descendant.
- Create implementation branch: `feat/sp-us2-launch-acquisition-v1-1-2026-09-29`.
- Preserve: `.env`, `.env.example`, `src/lib/productSearch.functions.ts`, Google-cluster files/tests, `package.json` lint scope.

**Interfaces:** Preserve production `sp-us2-search-v2` cluster-before-Make behavior and Lovable rollout flags while creating one branch on which v1.1 work can be qualified.

- [ ] Create the implementation branch from the qualified Google-cluster head, then reconcile latest `main` into it without force-moving either source branch.
- [ ] Resolve only genuine conflicts. Preserve `SP_M1B_SEARCH_ENABLED="true"` and `SP_PROD1_SEARCH_ENABLED="false"`; preserve `sp-us2-google-cluster-v1` product-family and multipack guards.
- [ ] Run baseline `node --test tests/spUnifiedSearchV2*.test.mjs` before v1.1 behavior changes. Expected: green after reconciliation.
- [ ] Run `bun run check:backend`, `bun run typecheck`, `bun run build`, and `bun run lint:m1b`. Expected: exit 0.
- [ ] Verify Make scenario 7613424 is inactive before any mutation. Record last-edit token/blueprint snapshot for safe later editing.
- [ ] Commit reconciliation if it produces changes. Suggested message: `chore(search): reconcile launch acquisition foundations`.

---

### Task 2: Freeze strict launch pack policy and deterministic no-pack selection

**Files:**
- Modify: `supabase/functions/sp-m1b-search-v1/query-policy.mjs`
- Modify: `supabase/functions/sp-m1b-search-v1/index.ts`
- Modify: `tests/spUnifiedSearchV2QueryPolicy.test.mjs`
- Modify: `tests/spUnifiedSearchV2MakeOrchestration.test.mjs`
- Create: `tests/spUnifiedSearchV2LaunchPackStrictness.test.mjs`

**Interfaces:**
- Add launch helper(s), e.g. `chooseLaunchStandardPack()` / `selectDefensibleModalPack()`.
- Inputs distinguish search mode, explicit user pack, anchor official default, category official-default observations, and trusted current-market observations with brand/domain lineage.
- Output is one pack or `null`; an explicit user pack is never replaced.

- [ ] Write RED tests proving an explicit `250:ml` request remains `250:ml` even when only `100:ml` merchant evidence exists; no `MARKET_STANDARD_FALLBACK` may be produced for an explicit pack.
- [ ] Replace the old active-search test that expected explicit-pack fallback with the new launch behavior. Do not modify the frozen Make callback `1.0` fallback compatibility test in this task.
- [ ] Add RED cases for specific/no-pack precedence: anchor manufacturer's verified official India default first, else trusted exact-product modal pack.
- [ ] Add RED cases for category/no-pack selection: unique modal official-default pack across relevant brands first; otherwise trusted-market modal pack. Count at most one observation per normalized brand/source lineage.
- [ ] Add tie tests: broader distinct-brand support, then distinct-domain support; if still tied, return `null` and disable cross-product price comparison rather than pick arbitrarily.
- [ ] Implement the pure pack policy helpers without provider/network access.
- [ ] Update `sp-m1b-search-v1/index.ts` to use the launch policy and remove `allowExplicitFallback: true` from the active launch path.
- [ ] Ensure `selected_pack` preserves `requested_text` / `requested_normalized_key`, reports `source: USER` for an explicit request, and does not set `fallback_applied=true` merely because no results exist.
- [ ] Verify result composition filters all exact/alternative/category cards to the resolved/requested pack and clears price comparison when no defensible no-pack standard exists.
- [ ] Run `node --test tests/spUnifiedSearchV2QueryPolicy.test.mjs tests/spUnifiedSearchV2LaunchPackStrictness.test.mjs tests/spUnifiedSearchV2MakeOrchestration.test.mjs tests/spUnifiedSearchV2Composition.test.mjs` and confirm GREEN.
- [ ] Commit. Suggested message: `fix(search): make launch pack comparison strict`.

---

### Task 3: Version the acquisition queue and dispatcher to 1.1

**Files:**
- Create: `supabase/migrations/20260929180000_sp_us2_make_acquisition_contract_v1_1.sql`
- Modify: `supabase/functions/sp-us2-search-v2/index.ts`
- Modify: `supabase/functions/sp-us2-make-dispatch-v1/index.ts`
- Modify: `tests/spUnifiedSearchV2MakeDispatch.test.mjs`
- Create: `tests/spUnifiedSearchV2MakeContractV11.test.mjs`
- Create: `docs/integrations/make/sp-us2-acquisition-v1.1.md`
- Create: `tools/sp_us2/make_acquisition_contract_v1_1.json`
- Modify if needed: `scripts/sp-us2-prewarm.mjs` so dry-run/live qualification can explicitly use the successor RPC without altering frozen v1 tooling semantics.

**Database interfaces:**
- Add `contract_version` to `sp_us2_acquisition_request_v1`, default/backfill historical rows as `SP-US2-MAKE-ACQUISITION/1.0`.
- Add service-role-only successor RPCs `sp_us2_enqueue_acquisition_v1_1(...)` and `sp_us2_claim_acquisition_v1_1()`; preserve existing v1 RPCs.
- Specific v1.1 alternative target max 5; category target may reach 10.

- [ ] Write RED contract tests requiring versioned `1.1` documentation/machine contract and proving no credential/safety-authority fields occur in request/callback examples.
- [ ] Write RED migration/source tests proving old RPCs remain present while new v1.1 enqueue/claim RPCs are service-role-only and tag new rows `1.1`.
- [ ] Implement additive migration. Do not rewrite terminal historical rows or delete queue history.
- [ ] Make dedupe/cooldown include the contract version so a historical 1.0 request cannot silently satisfy a new 1.1 semantic request.
- [ ] Update `sp-us2-search-v2` to enqueue residual work through `sp_us2_enqueue_acquisition_v1_1`. Include the explicit `requested_pack_key`; include a separate `comparison_pack_key` in payload only for no-explicit-pack searches after the backend has resolved one.
- [ ] Keep `scheduleMakeDispatch()` behind `SP_US2_MAKE_ACQUISITION_ENABLED === "true"`; no code/config change may enable the flag.
- [ ] Update dispatcher to claim only v1.1 due work and emit `SP-US2-MAKE-ACQUISITION/1.1` with residual targets, canonical anchor, requested/comparison pack, IN/INR, and canonical callback URL. Keep one webhook POST maximum and no callback/server credential in the job body.
- [ ] Preserve safe handling of any historical 1.0 row; the v1.1 claim RPC must not accidentally take it.
- [ ] Verify RED→GREEN with `node --test tests/spUnifiedSearchV2MakeContract*.test.mjs tests/spUnifiedSearchV2MakeDispatch.test.mjs tests/spUnifiedSearchV2MakeOrchestration.test.mjs`.
- [ ] Commit. Suggested message: `feat(search): version Make acquisition contract to 1.1`.

---

### Task 4: Add protected callback v1.1 validation and opportunistic image persistence

**Files:**
- Modify: `supabase/functions/sp-us2-make-callback-v1/make-policy.mjs`
- Modify: `supabase/functions/sp-us2-make-callback-v1/index.ts`
- Preserve: `tests/spUnifiedSearchV2MakeCallback.test.mjs` as frozen 1.0 compatibility coverage.
- Create: `tests/spUnifiedSearchV2MakeCallbackV11.test.mjs`

**Interfaces:**
- Keep `validateMakeCallback()` for 1.0 behavior.
- Add explicit v1.1 validation path, e.g. `validateMakeCallbackV11(raw, context)` or a contract-version router that never applies 1.1 rules to 1.0 payloads.
- Callback reads canonical queue + anchor context before persistence.

- [ ] Write RED v1.1 tests: explicit requested pack rejects `MARKET_STANDARD_FALLBACK`; wrong pack, product family, formula/title, variant, category, or incompatible multipack rejects.
- [ ] Add RED tests for exact merchant dedupe and alternative/category normalized-brand dedupe; enforce target bounds from the queue row rather than trusting Make's array size.
- [ ] Add RED tests that specific alternatives exclude normalized anchor brand and use the requested/comparison pack only.
- [ ] Add RED tests for forbidden authority injection (`safety_score`, ingredients, VERIFIED identity, regulatory status, recommendation/Best Choice, review resolution, Gold/HOLDOUT markers).
- [ ] Implement v1.1 pure validation while leaving v1.0 behavior and tests intact.
- [ ] In the Edge callback, route by both queue contract and callback contract: a v1.1 queue accepts only `SP-US2-MAKE-CALLBACK/1.1`; mismatched versions fail closed.
- [ ] Stage identities only through `sp_catalog_stage_search_discovery_v1`; stage commerce only through `sp_us2_stage_commerce_offer_v1`; never issue direct table DML from the callback.
- [ ] After a product id is resolved, if Make already observed an exact HTTPS image, call `sp_us2_upsert_display_image_v1(product_id, image)` with presentation source/provenance. Make this non-blocking to candidate/commerce success and never fetch another image.
- [ ] Ensure observed-source membership is required for submitted offer/product image provenance and URLs with credentials/non-HTTPS/search redirects/homepages are rejected.
- [ ] Run `node --test tests/spUnifiedSearchV2MakeCallback.test.mjs tests/spUnifiedSearchV2MakeCallbackV11.test.mjs tests/spUnifiedSearchV2MakeCommerceStage.test.mjs tests/spUnifiedSearchV2ImagePolicy.test.mjs` and confirm GREEN.
- [ ] Commit. Suggested message: `feat(search): enforce protected Make callback v1.1`.

---

### Task 5: Patch Make scenario 7613424 to the bounded 1.1 topology

**Live system:** Make scenario `7613424`, `SP_US2_MAKE_ACQUISITION_V1`.

**Repository evidence:**
- Create/update sanitized contract doc: `docs/integrations/make/sp-us2-acquisition-v1.1.md`
- If the connector provides a stable export suitable for source control, create a sanitized blueprint snapshot under `docs/integrations/make/` with no connection ids/secrets.
- Create: `tests/spUnifiedSearchV2MakeBlueprintV11.test.mjs` validating the sanitized topology/provider budget.

- [ ] Re-fetch the live scenario and relevant module configs immediately before mutation; record `lastEdit`. Abort/reconcile rather than overwrite if it changed since planning.
- [ ] Keep the scenario inactive while editing.
- [ ] Update valid route filters (current modules 3/4) to accept only acquisition `1.1`, canonical callback URL, valid UUID, correct mode, IN/INR, bounded residual targets, and supported pack grammar before any SerpApi module can execute. Invalid route rejects without provider calls.
- [ ] **Specific exact:** keep one Shopping exact-anchor call (current module 6). Restrict the feeder/gate so at most one strictly compatible anchor cluster can reach the Stores call; at most one Immersive Stores call (module 7). If that single bounded candidate is ambiguous/wrong, return fewer rather than trying additional clusters.
- [ ] Exact store normalization must reject wrong product family/formula/variant, explicit wrong pack, and single-unit multipacks; de-duplicate merchant/domain, sort accepted offers by numeric INR price ascending, and cap to residual exact target/5.
- [ ] **Specific alternatives:** keep one alternatives Shopping call (current module 10). Remove/bypass per-alternative Immersive Stores fan-out (current modules 12/23). Build alternative candidates directly from trustworthy Shopping observations that provide a direct HTTPS source/merchant price; skip incomplete observations rather than issuing another provider request. Enforce same pack, exclude anchor brand, dedupe brand, cap residual target/5.
- [ ] **Category:** keep one Shopping call (current module 16). Remove/bypass per-product Immersive Stores fan-out (current modules 18/24). For explicit-pack queries, accept only that pack. For no-pack queries, preserve pack observations for backend selection; do not let Make choose authoritative standard pack. Prefer one product per brand, cap 10.
- [ ] Update all callback builders (including empty/partial fallback branches) to `SP-US2-MAKE-CALLBACK/1.1` and include only observable fields plus requested/comparison pack metadata. Do not add any safety/ingredient/authority field.
- [ ] Preserve the existing Make-side callback authentication connection; never expose its value in the blueprint/doc/chat.
- [ ] Validate the saved live blueprint while still inactive. Confirm a SPECIFIC_PRODUCT execution can traverse no more than 3 SerpApi calls total (1 exact Shopping + 1 exact Stores + 1 alternatives Shopping) and CATEGORY no more than 1 Shopping call.
- [ ] Add/update sanitized blueprint test and run `node --test tests/spUnifiedSearchV2MakeBlueprintV11.test.mjs tests/spUnifiedSearchV2MakeContractV11.test.mjs`.
- [ ] Commit repository documentation/snapshot. Suggested message: `feat(search): qualify bounded Make acquisition blueprint v1.1`.

---

### Task 6: Lock the M1-B evidence escalation and human-review boundary

**Files:**
- Prefer test-only changes unless a real defect is exposed.
- Existing: `supabase/functions/sp-m1b-path-a-v1/index.ts`, `qualification.mjs`, `image-policy.mjs`, `sp-m1br-recovery-worker-v1/index.ts`.
- Existing tests: `tests/spM1BQualificationPolicyV2.test.mjs`, `tests/spM1BHumanRecoveryV2.test.mjs`, `tests/spUnifiedSearchV2ImagePolicy.test.mjs`.
- Create: `tests/spM1BLaunchEvidenceEscalation.test.mjs` if existing coverage cannot express the end-to-end boundary.

- [ ] Write/extend RED contract tests proving exact complete official evidence qualifies and stops before recovery/OCR/VLM.
- [ ] Prove trusted structured evidence is considered only when official evidence is insufficient and remains subject to existing hard provenance/conflict gates.
- [ ] Prove OCR and VLM live only in M1-BR recovery, are not invoked merely because an image exists, and uncertain/conflicting terminal evidence creates human review.
- [ ] Prove the human reviewer supplies/validates evidence and the backend score RPC computes the Safety Score; neither reviewer input nor Make directly submits a numeric score.
- [ ] Prove missing image does not suppress an otherwise eligible product and that no image-only paid provider lookup is introduced.
- [ ] If all existing behavior already satisfies these tests, make no production-code change. If a test exposes a genuine mismatch, fix only that mismatch with RED→GREEN.
- [ ] Run `node --test tests/spM1B*.test.mjs tests/spUnifiedSearchV2ImagePolicy.test.mjs` and confirm GREEN.
- [ ] Commit only if changes were necessary. Suggested message: `test(search): freeze launch evidence escalation boundary`.

---

### Task 7: Exact-head CI, canonical deployment, controlled live qualification, and audit handoff

**Repository / production surfaces:**
- Canonical Supabase `wmxbdirvlwuagouraobr`.
- Deploy exact qualified branch versions of `sp-m1b-search-v1`, `sp-us2-search-v2`, `sp-us2-make-callback-v1`, `sp-us2-make-dispatch-v1`, and reconciled `sp-us2-google-cluster-v1` only when changed/required.
- Apply only the reviewed additive v1.1 migration.
- Make scenario 7613424 temporarily activated only for controlled qualification, then returned inactive.

- [ ] Run fresh local/repository verification on the exact implementation head: `node --test tests/spUnifiedSearchV2*.test.mjs`, `node --test tests/spM1B*.test.mjs`, `bun run check:backend`, `bun run typecheck`, `bun run build`, `bun run lint:m1b`.
- [ ] Open/update a draft PR to `main`; require exact-head success from Unified Search Fix CI, M1-B/M1-BR CI, and Two Image Label Flow CI where triggered. Do not infer success from an older SHA.
- [ ] Capture pre-deployment production invariants: VERIFIED/CANDIDATE product counts, safety assessments, product-ingredient links, Benchmark Gold count, exact-pack leaks, acquisition status counts, and current Make inactive/incomplete-execution state.
- [ ] Apply the additive v1.1 migration and verify anon/authenticated cannot execute service-only queue/staging RPCs.
- [ ] Deploy exact-head Edge Function versions with existing auth posture: public search functions retain `verify_jwt=true`; custom-auth internal/webhook functions retain `verify_jwt=false` only when their body performs the established dedicated constant-time authentication.
- [ ] Confirm the permanent Google-cluster foreground path remains ahead of Make and routine `SP_US2_MAKE_ACQUISITION_ENABLED` is still false/unset.
- [ ] **Controlled Make qualification only after all deterministic CI is green:** temporarily activate scenario 7613424; dispatch at most one v1.1 SPECIFIC_PRODUCT residual request and one v1.1 CATEGORY request. Do not enable routine search-triggered Make dispatch.
- [ ] For the specific qualification, use a stable explicit-pack case such as NIVEA MEN Deep Comfort After Shave Lotion 100 ml. Verify Make sees only the residual shortfall after current exact/alternative coverage. Confirm provider-operation count stays within the 3-call maximum and the callback completes/idempotently persists only valid facts.
- [ ] For category qualification, use a stable explicit comparable-pack query such as `after shave lotion 100 ml`; verify at most one Shopping provider call, one product per brand preference, exact 100ml filtering, and truthful fewer-than-target behavior when supply is insufficient.
- [ ] Immediately return scenario 7613424 to inactive after controlled runs, regardless of success/failure; verify incomplete executions and queued webhook state.
- [ ] Re-query canonical search results. Specific exact offers must be one canonical formula/variant/pack, distinct merchants, price ascending, cap 5, same canonical safety; alternatives same pack, anchor brand excluded, independent Safety Score or explicit unavailable state. Category results must not mix packs.
- [ ] Re-audit protected invariants. Any changes must be explainable as expected candidate/commerce/image/recovery staging; no Make-driven safety assessment, ingredient truth, VERIFIED identity, Gold, or HOLDOUT mutation is acceptable.
- [ ] Inspect logs/results for cost evidence: provider calls and Make operations must match the documented budget; do not rerun a successful/diagnostic provider call merely to chase a visual count.
- [ ] Remove/neutralize any temporary qualification token/endpoint created for the run. Do not leave diagnostic access surfaces enabled.
- [ ] Add a final certification/evidence document and update the PR body with exact SHA, CI run ids, production function versions, Make final inactive state, live specific/category result counts, provider-call counts, protected invariants, and known truthful shortfalls.
- [ ] Mark PR ready for the user's audit, but do not merge it.
- [ ] Provide the user a Lovable acceptance matrix: explicit-pack specific search, unavailable explicit pack (must not substitute), generic/category search, official-evidence short-circuit, OCR/VLM recovery → human review, image fallback, and repeat search behavior.

## Definition of Done

- New launch jobs and callbacks are explicitly `1.1`; historical `1.0` semantics remain recoverable.
- Explicit user pack is never substituted.
- Specific search renders up to five same-formula/same-variant/same-pack merchants sorted by price, followed by up to five same-pack different-brand alternatives.
- Generic/category acquisition targets up to ten genuine products with deterministic comparable-pack semantics and no fabricated slots.
- Make provider fan-out satisfies the approved budget and residual-only policy.
- Callback independently revalidates and writes only candidate/commerce/presentation facts through protected canonical RPCs.
- M1-B keeps the evidence authority chain `qualified cache → official → trusted → recovery OCR/VLM → human review`, with backend-only scoring.
- Images remain opportunistic and independent of safety/eligibility.
- Exact-head tests/CI/build/typecheck/lint pass.
- Controlled live specific and category callbacks are evidenced without uncontrolled provider spend.
- Safety/identity/Benchmark invariants remain protected.
- Make scenario 7613424 is inactive at handoff.
- PR is ready for user audit and remains unmerged until explicitly requested.