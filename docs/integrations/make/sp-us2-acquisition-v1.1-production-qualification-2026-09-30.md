# SP-US2 Make Acquisition v1.1 — Production Qualification

Date: 2026-09-30

Canonical systems:

- GitHub: `badhanjs-cell/safeproducts`
- Qualified implementation branch: `feat/sp-us2-launch-acquisition-v1-1-2026-09-29`
- Canonical Supabase: `wmxbdirvlwuagouraobr`
- Make scenario: `7613424` (`SP_US2_MAKE_ACQUISITION_V1`)

## Deterministic qualification

Before production mutation, exact-head `60c6476685be0ed344bbf87fd1ee2b384c566d6f` passed Unified Search Fix CI, M1-B/M1-BR CI, and Two Image Label Flow CI. The additive v1.1 migration was then applied and service-only enqueue/claim privileges were verified: anon/authenticated cannot execute the successor acquisition RPCs; service role can.

Production Edge Functions deployed for the launch path retain their existing auth posture:

- `sp-m1b-search-v1` — JWT protected
- `sp-us2-search-v2` — JWT protected
- `sp-us2-make-dispatch-v1` — custom internal authentication
- `sp-us2-make-callback-v1` — custom callback authentication

Routine search-triggered Make acquisition was not enabled. Controlled qualification used isolated v1.1 queue rows and direct controlled webhook delivery only while the Make scenario was temporarily active.

## Protected pre-qualification invariants

- VERIFIED products: 4
- CANDIDATE products: 14
- safety assessments: 4
- product-ingredient links: 52
- Benchmark Gold items: 26
- verified exact-pack leaks: 0

Make was inactive with zero incomplete executions and zero queued webhook deliveries.

## SPECIFIC_PRODUCT controlled qualification

Anchor: NIVEA MEN Deep Comfort After Shave Lotion, explicit `100:ml` pack.

At qualification time the canonical exact-offer surface already contained four verified 100 ml merchants, so the residual v1.1 target was correctly limited to **one exact offer** and zero alternatives.

Controlled execution result:

- Make execution: success
- duration: 6.54 s
- operations / credits: 10 / 10
- provider path: one exact Shopping call, zero exact Stores calls, one alternatives Shopping call
- callback: COMPLETED
- products staged: 0
- offers staged: 0
- requested/resolved pack: `100:ml`

This is a valid truthful-fewer result: no new observation met the protected callback's strict product/variant/pack/provenance boundary, so no slot was fabricated.

## CATEGORY first controlled qualification — defect discovered

Query: `after shave lotion 100 ml`, explicit `100:ml`.

The first category run exposed a Make runtime topology defect. Although modules 18/24 were represented as disabled in the saved scenario summary, the executable run still traversed them for six Shopping candidates and issued six Immersive/custom-search provider calls.

Observed cost before correction:

- duration: 34.8 s
- operations / credits: 19 / 19
- category Shopping calls: 1
- category Immersive/custom-search calls: 6
- protected callback: COMPLETED with 0 staged products/offers

The backend safety/identity boundary held, but the provider-call budget did not.

## Structural correction

A new RED topology test was committed first. Exact-head CI showed 188/190 Unified Search tests passing; the only failures were the two new assertions requiring structural fan-out removal.

The live Make scenario was then patched while inactive under `lastEdit` concurrency protection. Modules 12, 23, 18, and 24 were physically removed from the executable graph rather than merely disabled.

Final executable paths:

- specific alternatives: `11 -> 13`
- category candidates: `17 -> 19`
- category provider modules: Shopping module 16 only
- specific exact path retains the single bounded exact Stores module 7

The sanitized architecture snapshot was updated to require this structure. Exact head `239b509e2c5e4e96f47a5407232cc677f36c9767` then passed Unified Search Fix CI, M1-B/M1-BR CI, and Two Image Label Flow CI before the paid category re-qualification.

## CATEGORY controlled re-qualification

Equivalent explicit-pack query: `after shave lotion 100ml`, requested pack `100:ml`.

Controlled execution result after structural correction:

- Make execution: success
- duration: 2.50 s
- operations / credits: 7 / 7
- module trace: `1 -> 4 -> 16 -> 17 -> 19 -> 20 -> 21`
- provider calls: **one Google Shopping call, zero Immersive/custom-search calls**
- callback: COMPLETED
- products staged: 0
- offers staged: 0
- requested/resolved pack: `100:ml`

The callback returned fewer rather than accepting incomplete or wrong-pack marketplace observations. No further paid category run is required.

## Final protected audit

Protected counts remained unchanged from the pre-qualification snapshot:

- VERIFIED products: 4
- CANDIDATE products: 14
- safety assessments: 4
- product-ingredient links: 52
- Benchmark Gold items: 26
- verified exact-pack leaks: 0

Acquisition queue after qualification:

- COMPLETED: 10
- FAILED: 2
- PENDING: 2 (historical/routine queue state; routine dispatch remains off)

NIVEA MEN Deep Comfort After Shave Lotion 100 ml currently has four verified same-pack exact merchant offers, ordered by price:

1. Flipkart — INR 598
2. Shopsy By Flipkart — INR 813
3. Ubuy — INR 2241
4. Desertcart — INR 2862

All four are verified, `exact_pack_match=true`, and `pack_normalized_key=100:ml`.

Final Make state:

- scenario inactive
- incomplete executions: 0
- queued webhook deliveries: 0
- per-candidate alternative/category Immersive fan-out absent from executable graph

## Qualification conclusion

The v1.1 acquisition boundary is production-qualified for the launch objectives exercised here:

- explicit requested packs remain immutable;
- Make performs bounded residual commerce/product discovery only;
- specific acquisition remains capped at the documented provider budget;
- category acquisition is structurally capped at one Shopping provider call;
- protected callback revalidation returns fewer instead of fabricating supply;
- Make did not mutate Safety Scores, ingredient truth, VERIFIED identity, Benchmark Gold/HOLDOUT state, or human-review authority;
- routine Make acquisition remains disabled pending an explicit rollout decision.
