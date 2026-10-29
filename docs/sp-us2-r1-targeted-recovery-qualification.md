# SP-US2-R1 — Single-product ingredient recovery qualification

**Isolation:** SafeProducts only; project wmxbdirvlwuagouraobr. The existing global M1-BR recovery worker, Make scenarios, Cloud Run UI and disabled scheduler are not modified.

## Exact live recovery flow
1. A server operator selects an existing `PENDING` / `RETRY` recovery task, its matching canonical product and originating NORMAL_SEARCH M1-B run, each by UUID.
2. `sp_internal.dispatch_m1br_targeted_v1(task,product,run,'PREFLIGHT')` sends the triple with existing private worker credential to the separate `sp-m1br-targeted-recovery-v1` Edge Function. No provider search, no queue mutation.
3. Edge preflight confirms exact-target eligibility, configured OpenAI model and reachable primary OCR / configured Google Vision fallback. Missing configuration blocks execution.
4. `sp_internal.dispatch_m1br_targeted_v1(task,product,run,'EXECUTE')` can dispatch one authorized target after successful preflight. Public SQL cannot invoke this dispatcher. The Edge Function atomically calls `sp_m1br_claim_targeted_v1`; one specific job only, exactly one attempt, zero bulk claim. It does not bypass an ADMIN_REVIEW or previously attempted task.
5. Reuse existing source-linked official/trusted discovery before OCR/VLM. Limit one web-model request, at most one image and one VLM request, at most one primary and one secondary OCR; fixed response token limits; no Railway default.
6. Accept only visibly supported, fully identified complete ingredients, with source and independent-source checks. Save normalized ingredient records/evidence via existing canonical M1-BR RPC and require its `ingredient_saved=true`.
7. Complete the selected recovery queue item as QUALIFIED only after real persistence. Only then invoke `sp_m1b_score_qualified_product_v2`. Return numerical score only if the backend explicitly confirms `score_available=true`. A qualified ingredient list is *not* itself a certified numeric score.
8. For unresolved evidence, record an administrative review and close the targeted job. No fabricated score, automatic retries or other queue changes.

## Cost and safety
- No bulk cron changes or Make production activation.
- Preflight is zero paid-model calls and does not claim the job.
- Hard caps: one target, one attempt, one discovery model call, one VLM model call, one image, bounded output tokens. Google Vision fallback may be billable if invoked.
- Provider pricing is not embedded; `cost_usd` remains unverified if telemetry does not return a trustworthy monetary amount. This is a provider-*call* ceiling, not a guaranteed currency-spend ceiling.
- Server-only manual dispatcher obtains the worker credential from `sp_internal.worker_secret_v1`, never from client input. No consumer-user authorization to claim jobs.
- `sp_m1br_claim_targeted_v1` locks the specific UUID, verifies linked product+run, rejects second attempt and concurrent product work.
- Failed/OCR-ambiguous evidence must remain unscored. Score caching requires a backend QUALIFIED assessment.

## Acceptance
- Main/pr CI passes including `tests/spM1BTargetedRecoveryR1.test.mjs`.
- Production DB grants: anon/authenticated cannot execute claim/readiness/manual dispatch.
- Rollback-only SQL qualification claims one exact record with zero residue and checks wrong UUID rejects.
- Edge PRE­FLIGHT verifies real credentials and actual OCR/provider state without paid work.
- Execute only after preflight passes and cost/health is acceptable; otherwise report precise blocker.
- Verify exact target state, source evidence ID, normalized ingredients, score availability, cache reread, and absence of changes to other queued jobs.
- Do not call the qualification complete solely because code deploys or preflight succeeds.

## Known earlier targets
Tejasya 60 capsules task `7e9bd2ca-e48f-466a-b15e-c42464889ecb` / run `3dd371d2-609f-40aa-835f-382d3a8c478e` / product `0a75ea5e-a88d-4b63-90ea-793d0fc2f5cb`; no assertion of credentials, OCR health, original market or ingredient evidence before actual preflight.

## Verified production qualification — 26 October 2026

- PR #77 squash-merged to main `f48aed3acab568e33d9a90d77872530d85c5526f`; three CI suites successful.
- Supabase migration `sp_us2_r1_targeted_single_recovery_v1_20261026` successfully applied.
- Production Edge `sp-m1br-targeted-recovery-v1` ACTIVE v1 and exact source parity with main. JWT gateway verification disabled intentionally because the endpoint enforces existing private M1-BR worker-token validation on every request. Unsigned production request returned HTTP **401**.
- Exact Tejasya target: task `7e9bd2ca-e48f-466a-b15e-c42464889ecb`, product `0a75ea5e-a88d-4b63-90ea-793d0fc2f5cb`, run `3dd371d2-609f-40aa-835f-382d3a8c478e`. `sp_m1br_targeted_status_v1` reported ELIGIBLE. Wrong run ID rejected.
- Rollback-only SQL claim test passed; unauthorized EXECUTE grants for anon/authenticated and private dispatcher are false; scheduler remained inactive.
- Signed zero-paid-call preflight net request **4257**, HTTP 200: `openai_configured=true`, `web_model_configured=false`, `primary_ocr.configured=false`, `primary_ocr.healthy=false`, `secondary_ocr_configured=false`, `ready_for_one_paid_run=false`.
- Signed guarded execute net request **4258** returned HTTP **409** `TARGET_PREFLIGHT_NOT_QUALIFIED`, with zero paid model calls and zero queue claims.
- Unsigned net request **4259** returned HTTP **401** `WORKER_AUTH_REQUIRED`.
- Final DB readback: selected task `PENDING`, `attempt_count=0`; global `IN_PROGRESS=0`, global pending=76 at that observation; bulk M1-BR recovery cron remains disabled. Existing qualified-catalog count=1 and unchanged.
- **Acceptance result**: exact targeted claim + worker authentication + preflight + fail-closed cost gate PASS. Actual OCR extraction and new ingredient-to-score-to-cache cycle **BLOCKED BY MISSING CONFIGURATION**, not certified.

### Required configuration to unblock one real targeted run

Configure through Supabase Edge Function secrets (do **not** paste secrets into the repository or chat):
1. `SP_M1BR_WEB_MODEL` — explicitly name an accessible OpenAI Responses model that supports the worker's `web_search` source acquisition tool. The existing `OPENAI_API_KEY` is detected, but the model override is absent.
2. One usable OCR channel: preferably `M1BR_OCR_URL` pointing to the deployed OCR service's verified HTTPS base URL with an HTTP-200 `/health`; alternatively `GOOGLE_VISION_API_KEY` securely configured for the fallback. Do not restore the obsolete Railway URL.
3. Repeat `PREFLIGHT` for the exact same task/product/run. Only if `ready_for_one_paid_run=true`, authorize one `EXECUTE` call and examine source provenance, normalized ingredient rows, backend score qualification, new audit evidence, provider usage and second cache lookup.
4. Pricing remains `cost_usd=null` until verified provider billing telemetry exists; the hard limit controls provider/model calls and output tokens, **not a monetary guarantee**.

No bulk recovery or Make production activation is authorized as part of this qualification.
