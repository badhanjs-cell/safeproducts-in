# SafeProducts — Make Ingredient Acquisition / Backend Safety and Cache v1

## Approved boundary
Make is an **on-demand evidence acquisition orchestrator**. It does not score products, decide regulatory approval, synthesize missing ingredients, alter consumer results or own the product cache. Supabase Edge Path A performs source qualification and collects already-seen display images. Existing Supabase M1-B RPCs produce qualified scores and persist canonical evidence. OCR and image reading are delegated to the existing M1-BR recovery path; unresolved cases remain unscored and require human review.

## Registered Make scenario
- Team 1869334, folder 383025.
- Dedicated QA scenario 8111904: `SP_M1B_MAKE_INGREDIENT_ACQUISITION_V1_QA`.
- It is deliberately separate from the previously active commerce discovery scenario 7613424; do not modify or disable the existing scenario.
- On-demand StartSubscenario -> authenticated HTTP POST to `sp-us2-ingredient-acquire-v1` -> ReturnData, with inputs product_id, profile and mode (PREFLIGHT or ACQUIRE).
- Credential: reuse existing SafeProducts Make API keychain by reference; do not add its secret to GitHub or tool output. Signed header must be `x-sp-us2-make-key`.
- Initial activation for preflight only; paid `ACQUIRE` requires a separate bounded acceptance test and a spend/throughput gate before automatic invocation. Do not put anonymous/public webhook endpoints in front of this scenario.
- The Make scenario does not run automatically for every search until its trigger contract, idempotency, rate limits, and complete backend scoring/caching acceptance have passed. An on-demand scenario is a **qualification fixture**, not production search wiring.

## Early-stop ordering
1. Exact canonical product cache: a *qualified* cached product returns `CACHED_QUALIFIED`, cost zero.
2. Path A source qualification: verified official brand/official Shopify exact identity + pack + complete declaration -> `SUFFICIENT_OFFICIAL_EVIDENCE` -> skip merchant and OCR; otherwise trusted retailer evidence -> `SUFFICIENT_TRUSTED_EVIDENCE`.
3. When qualified ingredients exist, only backend `sp_m1b_score_qualified_product_v1` may return a score; if regulatory qualifications fail, `REGULATORY_REVIEW_PENDING`.
4. If official and trusted evidence fail, the existing `sp_m1b_enqueue_recovery_v1` routes the case to OCR then VLM/image-reader recovery; if recovery cannot be queued, `HUMAN_REVIEW_REQUIRED`.
5. Images collected from pages already consulted remain non-eligibility data; no extra image-only paid search.

## Result composition (unchanged until separate acceptance)
Exact product: 5 verified merchants, **same canonical product + formula + pack**, lowest like-for-like INR offer first, same canonical profile Safety Score across all; 5 alternative brands of same category, formula and pack with independently qualified scores when available. Generic category: 6-10 distinct brands, one standard pack (official India primary/default first; otherwise trusted merchant modal pack), with no mismatched pack substituted. Show fewer genuine results rather than mix packs. After display, asynchronous enrichment may update qualified canonical cache; cache must be keyed by identity/formula/pack/profile/policy version, merchant offers must be separate entities.

## Blocking acceptance requirements
- Verify the new Make scenario returns non-null fields using a real `PREFLIGHT` invocation (no paid calls).
- Confirm authenticated keychain matches Edge secret; anon direct POST rejected.
- Test 1 real consented catalog product: official complete early stop, trusted fallback when official absent, OCR recovery when both absent, human-review terminal. Do not claim these branches passed before observed in production.
- Confirm canonical cache reuses score, same-pack merchant dedup, 5+5 composition, image independence, correct regulatory qualification, and replay/idempotency.
- Verify Make credit consumption, bounded provider costs, duplicate execution lease, Cloud Run frontend mapping, and rollback. Existing live discovery remains unchanged until gates pass.

## Status
Engineering foundation created on `feat/sp-us2-make-ingredient-acquisition-2026-10-22`. The dedicated Make scenario was activated for manual tests on 2026-10-22; this is an on-demand QA fixture, not automatic production search wiring. This document does **not** certify the entire approved 5+5 search model or the OCR provider availability.

## Actual live Make QA execution — 2026-10-22 (Asia/Kolkata)

The Make test scenario 8111904 was successfully activated after both previously live scenarios
7613424 and 7390841 were found **inactive**. Do not assume those old scenarios were intentionally
disabled, and do not automatically enable them without an operations review.

- Signed real-product PREFLIGHT (Tata 1mg Tejasya 60 Capsules) PASS, `PREFLIGHT_READY`, zero paid provider calls.
- Qualified cached product (NIVEA MEN Deep Comfort After Shave) PASS, `CACHED_QUALIFIED`, zero paid provider calls.
- Nonexistent UUID was rejected by the backend; Make initially marked its 404 an error. QA HTTP module was changed to `stopOnHttpError=false`; repeat returned an ordinary `REJECTED` result, PASS.
- One real Tejasya `ACQUIRE` produced `PATH_A_FOREGROUND_TIMEOUT`, one paid provider search, and an actual M1-BR queued job. It did **not** qualify ingredients or a Safety Score.
- On the revised edge v3, repeating the same Tejasya `ACQUIRE` returned `RECOVERY_ALREADY_QUEUED`, zero new paid provider calls.
- One real Himalaya Liv.52 200 ml `ACQUIRE` reached `TRUSTED_SOURCE_INSUFFICIENT` with one paid model call; image saved and recovery queued; no fabricated score.
- M1-BR cron job `sp_m1br_recovery_dispatch_v1` is currently `active=false`. Recovery queue contained 60 PENDING, 39 FAILED and 64 ADMIN_REVIEW before the second live acquisition, with a separate new PENDING for Liv.52. DO NOT mass-enable the scheduler without capped worker acceptance; existing worker claims up to 2 oldest eligible items per invocation.
- Make QA HTTP timeout 60 seconds; Edge v3 official Path A budget 28.5 seconds with 36.5-second invocation ceiling.
- Provider monetary cost not observed (`cost_usd=null`); budget must be qualified prior to automatic production routing.

### LIVE ACCEPTANCE STATUS
Signed Make connection, preflight, cache reuse, reject handling, paid single-product acquisition attempts,
recovery enqueue, display image opportunism and zero-cost duplicate prevention: **demonstrated**.

Official complete declaration -> finished qualified Safety Score -> canonical cache write;
trusted exact formula/pack fully qualified; OCR/VLM fallback completed;
human-review final resolution; real 5+5 frontend filtering and exact-pack price comparison:
**NOT yet demonstrated**. Keep automatic search wiring and recovery cron disabled until separately certified.
