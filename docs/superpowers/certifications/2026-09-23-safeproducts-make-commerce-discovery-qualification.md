# SafeProducts Make Commerce / Discovery Qualification — 2026-09-23

## Scope

This certification covers the SafeProducts-only milestone that adds a bounded asynchronous Make.com acquisition worker beneath the canonical `sp-us2-search-v2` search engine while preserving the frozen search objective:

- specific product: up to 5 exact same-product/same-pack merchant offers + up to 5 distinct-brand same-pack alternatives;
- generic/category: 6–10 genuine distinct products using one comparable normalized pack;
- never fabricate missing slots or mix packs merely to fill the result count;
- Make remains acquisition-only and cannot create Safety Scores, ingredient evidence, recommendations, regulatory status/certification, VERIFIED product identity, Benchmark Gold, or HOLDOUT state.

Canonical Supabase project: `wmxbdirvlwuagouraobr`.

Feature branch: `feat/make-commerce-discovery-qualification-2026-09-23`.

Qualified implementation head before this certification-only commit: `614ff4c9ae326b0531a5da9a8a0638d0fb4b3638`.

## Implemented foundation

The qualified head contains:

- pack-aware candidate identity matching that removes only recognized pack tokens for identity matching while preserving the original query and pack constraint;
- service-role-only Make acquisition queue with RLS, six-hour query cooldown, global hourly/daily limits and bounded attempts;
- service-role-only commerce-offer staging with exact product/variant/pack, India/INR, HTTPS observed-source provenance, trust-floor and deduplication guards;
- protected `sp-us2-make-callback-v1` with dedicated constant-time callback authentication and 512 KiB body limit;
- protected `sp-us2-make-dispatch-v1` with internal authentication, HTTPS-only webhook validation, 8-second delivery timeout, one Make POST per claimed request and bounded RETRY/FAILED transitions;
- asynchronous acquisition shortfall detection in `sp-us2-search-v2`, with a maximum approximately 500 ms queue-RPC budget and no foreground dependency on Make;
- versioned Make acquisition contract and callback contract;
- launch prewarm corpus and canonical-project-locked prewarm runner with dry-run mode;
- expanded CI path coverage for SP-US2 functions, Make integration docs, prewarm tooling and Make contract tests.

## TDD RED evidence

### Async search orchestration

RED commit: `d3c904542baa9e84bc0db8be943da64bb08d6b10`.

M1-B/M1-BR CI run `35778526699` failed only the three newly introduced Make-orchestration assertions while the existing M1-B suite stayed green. The failures proved that `acquisitionNeed()` and bounded Make queue/dispatch integration were genuinely absent before implementation.

GREEN commit: `9486e5790d88b72597ea4f5e8dece7391a26411d`.

CI run `35779058252` completed successfully after the minimal asynchronous integration was added.

### Make contract and prewarm tooling

RED commit: `bc0ec4aa4b4684760d691dc3a3e7235c7579d886`.

CI run `35810734610` failed only the four newly introduced Task 7 assertions because the planned Make contract document, machine contract, prewarm corpus and prewarm runner did not yet exist. Existing search tests remained green.

GREEN commit: `4d2e782bde16b9730f6ace11387711e2e4384158`.

CI run `35811029777` completed successfully after those four versioned artifacts were added.

## Fresh non-production qualification evidence

Qualification head: `614ff4c9ae326b0531a5da9a8a0638d0fb4b3638`.

M1-B/M1-BR CI run: `35811158816` — **SUCCESS**.

Results from the exact qualified head:

- M1-B Node contract suite: **56 passed, 0 failed**.
- Unified Search V2 suite: **94 passed, 0 failed**.
- Make contract/prewarm assertions are included inside the 94/94 Unified Search V2 result.
- `node scripts/sp-us2-prewarm.mjs --dry-run`: **PASS** and emitted all five launch cases against the canonical SafeProducts Supabase origin.
- Python M1-A benchmark suite: **3 passed**.
- M1-B Python/pytest suites: all invoked groups passed (10 + 1 + 1 + 1 + 2 + 4 + 6 + 2 + 4 tests).
- M1-BR OCR suite: **4 passed**; two dependency deprecation warnings only.
- canonical backend guard: **PASS**.
- disclaimer contract: **PASS**.
- PWA install contract: **PASS**.
- M1-B contract guard: **PASS**.
- production build: **PASS**.
- TypeScript typecheck: **PASS**.
- frontend secret/rollout guard: **PASS**.
- scoped M1-B semantic lint: **PASS with 0 errors**. One pre-existing React Hook dependency warning remains in `src/routes/check-my-label.tsx`; it is not introduced by this milestone and is not a CI failure.

The production build also reported existing chunk-size/dynamic-import warnings; build completion remained successful and those warnings are outside this acquisition milestone.

## Security and compliance invariants

The qualified implementation preserves the following controls:

- public frontend remains routed to `sp-us2-search-v2`; the legacy Make search fallback is not promoted to the canonical search engine;
- Make webhook and callback credentials are server-side only and are not embedded in Git or browser payloads;
- acquisition queue and commerce staging are inaccessible to anon/authenticated database roles;
- callback facts are revalidated by SafeProducts before persistence;
- new product identities flow only through the canonical discovery staging path and remain CANDIDATE unless an existing canonical identity is reused;
- Make does not write safety assessment, ingredient evidence, Benchmark Gold or HOLDOUT truth;
- exact-pack price comparison and same-pack 5+5/category composition remain backend-controlled;
- unknown/insufficient ingredient evidence never produces a fabricated Safety Score;
- Best Choice remains backend-controlled and limited to safety-qualified, comparable-price products under the frozen 70/30 policy.

## Production gate status

**Non-production implementation qualification: PASS.**

Production deployment is intentionally not certified by this document. Before production mutation, PR-triggered required CI must be green on the final branch head. The controlled rollout must then:

1. capture live production invariants and counts;
2. confirm target migration/RPC objects do not already exist;
3. apply the three migrations in timestamp order to canonical Supabase only;
4. deploy exact repository source for callback, dispatcher and updated search v2;
5. keep `SP_US2_MAKE_ACQUISITION_ENABLED` disabled/unset;
6. confirm ordinary production v2 search still functions without Make;
7. prove installation created no Safety Score, ingredient-evidence, Benchmark Gold or HOLDOUT mutations.

## Remaining external dependency

Direct Make.com scenario creation/update is not available through the currently exposed authenticated tools. The canonical scenario handoff is therefore:

- `docs/integrations/make/sp-us2-acquisition-v1.md`
- `tools/sp_us2/make_acquisition_contract_v1.json`
- `tools/sp_us2/launch_prewarm_queries.json`

A real Make -> SafeProducts callback -> Supabase -> `sp-us2-search-v2` -> frontend 5+5/generic roundtrip remains a separate Task 10 acceptance gate and must not be claimed complete until authenticated Make access and real runtime evidence exist.
