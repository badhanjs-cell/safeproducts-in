# SafeProducts Make Commerce / Discovery — Controlled Production Rollout Evidence

Date: 2026-09-23

Canonical project only: `wmxbdirvlwuagouraobr`

Feature branch: `feat/make-commerce-discovery-qualification-2026-09-23`

Qualified hotfix head before this evidence-only commit: `abf85aa514dba01ba7699df8665f70393b2b0cbf`

Draft PR: #42

## Production rollout scope

This rollout installs the approved asynchronous Make acquisition foundation beneath the canonical `sp-us2-search-v2` engine. It does not make Make the public search/ranking/safety authority and does not activate the external Make scenario.

Frozen objective remains:

- specific product: up to 5 exact same-product/same-pack merchant offers + up to 5 distinct-brand same-pack alternatives;
- generic/category: 6–10 genuine distinct products using one comparable normalized pack;
- never fabricate missing slots or mix packs merely to fill result count.

## Pre-rollout production snapshot

Captured before the Task 9 production mutations:

- products: 7 total / 7 active / 4 VERIFIED / 3 CANDIDATE;
- canonical products with normalized pack: 0;
- commerce offers: 41 total / 4 verified / 0 exact-pack / 0 verified exact-pack;
- safety assessments: 4 total / 4 current;
- product ingredient rows: 50;
- open catalog review items: 78;
- enrichment queue: 11 total, all observed as PENDING in the preflight;
- Benchmark Gold: 26;
- paid discovery budget: 6 rows / aggregate claim count 9;
- no table with `holdout` in its table name was present in the public schema;
- acquisition queue/RPCs and Make commerce-stage RPC did not exist before rollout.

## Applied canonical migrations

Applied successfully, in order, to `wmxbdirvlwuagouraobr`:

1. repository `20260923010000_sp_us2_pack_aware_candidate_search_v1.sql` as migration `sp_us2_pack_aware_candidate_search_v1`;
2. repository `20260923011000_sp_us2_make_acquisition_queue_v1.sql` as migration `sp_us2_make_acquisition_queue_v1`;
3. repository `20260923012000_sp_us2_make_commerce_stage_v1.sql` as migration `sp_us2_make_commerce_stage_v1`.

Post-install security verification:

- `sp_us2_acquisition_request_v1` exists with RLS enabled;
- anon/authenticated have zero table privileges on the acquisition table;
- anon/authenticated have zero execute privileges on the acquisition enqueue/claim/finish and Make commerce-stage RPCs;
- service-role access remains the server-side persistence authority.

## Deployed functions

Fresh production function inventory after rollout/hotfix:

- `sp-us2-search-v2` — ACTIVE, version 2, `verify_jwt=true`;
- `sp-us2-make-callback-v1` — ACTIVE, version 1, `verify_jwt=false`, custom callback-key authentication inside the function;
- `sp-us2-make-dispatch-v1` — ACTIVE, version 1, `verify_jwt=false`, custom internal-key authentication inside the function;
- `sp-m1b-search-v1` — ACTIVE, version 6, `verify_jwt=true`;
- `sp-us2-discovery-v1` — remains ACTIVE version 2, `verify_jwt=false`;
- `sp-us2-commerce-v1` — remains ACTIVE version 2, `verify_jwt=false`.

## Pack-aware identity verification

The production candidate RPC now preserves the original query while matching canonical identity on a pack-free identity query.

Verified examples:

- `TATA 1mg Tejasya Ashwagandha 60 Capsules` resolves the existing VERIFIED TATA 1mg anchor while retaining `60:count` as the requested pack;
- `NIVEA MEN Deep Comfort After Shave Lotion 100 ml` resolves the existing VERIFIED NIVEA anchor rather than falling through to generic discovery.

## Production smoke regression and hotfix

The first controlled v2 smoke exposed two real launch defects:

1. display pack text was derived by a generic `number + letters` regex and rendered `1mg` instead of the actual `60 Capsules` pack;
2. the already-known canonical anchor was not exposed by the M1-B core when no exact merchant offer was composed, leaving the Make acquisition request without `anchor_product_id`.

TDD RED commit: `995a9dde002407966ab1bfbd410959e3a0f38590`.

Unified Search Fix CI run `35812207751` produced a clean RED: the existing 94 Unified Search tests remained green and exactly the 3 new pack/anchor regression assertions failed.

GREEN implementation:

- `query-policy.mjs` now exports supported-unit-aware `packDisplayTextFromQuery()`; unsupported brand tokens such as `1mg` are not mistaken for comparable pack units;
- the M1-B search response now exposes `anchor_product` for `SPECIFIC_PRODUCT`, even when the composed exact-offer array is empty;
- selected explicit-pack display now uses the same supported pack vocabulary as canonical pack parsing.

GREEN head: `abf85aa514dba01ba7699df8665f70393b2b0cbf`.

Fresh PR CI on that exact head:

- Unified Search Fix CI run `35812588344` — SUCCESS;
- M1-B/M1-BR CI run `35812588356` — SUCCESS;
- Two Image Label Flow CI run `35812588354` — SUCCESS.

`sp-m1b-search-v1` was then deployed from that exact branch source as production version 6.

## Post-hotfix public v2 smoke

The current opaque Supabase publishable key path used by the server adapter returned HTTP 200 from production `sp-us2-search-v2` for:

`TATA 1mg Tejasya Ashwagandha 60 Capsules`

Observed contract evidence:

- `contract_version`: `SP-US2/1.0`;
- `search_mode`: `SPECIFIC_PRODUCT`;
- selected pack text: `60 Capsules`;
- selected normalized pack: `60:count`;
- selected pack source: `USER`;
- canonical anchor is present, VERIFIED, and identifies `TATA 1mg / Tejasya Ashwagandha / KSM-66`;
- 0 paid discovery calls;
- paid discovery reason: `PAID_DISCOVERY_DISABLED`;
- `cost_usd`: null;
- Make acquisition detected the genuine 5+5 shortfall and queued an anchor-bound acquisition request;
- `dispatch_scheduled`: false, so the external Make scenario did not execute during this qualification;
- no Best Choice was produced in an empty/unqualified result set.

A separate probe using the old legacy anon JWT was rejected by the gateway with `UNAUTHORIZED_LEGACY_JWT`; the actual opaque publishable-key path used by the server adapter returned HTTP 200 and is the supported path evidenced above.

## Controlled test-residue cleanup

Two acquisition rows created only by the controlled TATA smoke were still PENDING, had zero attempts, had never been dispatched or completed, and carried payload source `SP-US2-SEARCH-V2`. They were deleted by exact request id and strict state predicates after evidence capture.

The final acquisition queue state after cleanup is:

- total acquisition rows: 0;
- active acquisition rows: 0.

The successful public smoke also caused normal M1-B recovery behavior (`m1br_queued_count=1`). The newly created pending recovery row for that exact smoke run had zero attempts and had never been locked; it was deleted by exact run/product/request predicates after evidence capture. Older recovery rows that had already progressed to COMPLETED or ADMIN_REVIEW were retained as audit state and were not rewritten.

## Post-rollout safety-critical invariants

Fresh final snapshot after controlled smoke cleanup:

- products: 7 total / 7 active / 4 VERIFIED / 3 CANDIDATE — identity counts unchanged;
- canonical products with normalized pack: 0;
- safety assessments: 4 total / 4 current — unchanged;
- Benchmark Gold: 26 — unchanged;
- verified exact-pack offers: 0;
- acquisition rows: 0 / active 0.

The catalog's operational commerce/recovery/review counts changed while normal M1-B background recovery/commerce processing was active during qualification. Those are core M1-B operational side effects, not Make callback writes: the external Make scenario was not dispatched. The safety assessment count, canonical identity counts and Benchmark Gold remained unchanged.

A fresh post-rollout snapshot observed 47 commerce offers / 5 verified, 83 open catalog review items, 11 enrichment rows, and aggregate paid-budget counters above the preflight baseline. No claim is made that those changing operational counters were produced by Make; Make was not dispatched in the controlled smoke. The production qualification therefore distinguishes immutable/safety-critical invariants from normal asynchronous M1-B operational activity.

## Current gate

**Task 9 controlled canonical Supabase installation and disabled-Make production smoke: PASS, subject to the final evidence-only commit receiving fresh CI.**

The remaining milestone is Task 10: configure the real Make.com scenario from the versioned contract, then execute the real Make -> callback -> canonical Supabase -> `sp-us2-search-v2` -> frontend specific 5+5 and generic comparable-pack acceptance tests.

Direct Make scenario editing is not available through the currently exposed authenticated tools in this session. Do not mark Task 10 or the complete 5+5 acquisition milestone finished until that real roundtrip is evidenced.
