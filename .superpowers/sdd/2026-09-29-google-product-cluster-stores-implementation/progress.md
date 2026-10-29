# SDD ledger — plan: docs/superpowers/plans/2026-09-29-google-product-cluster-stores-implementation.md

Execution environment: connected GitHub/Supabase/Make tools; no local repository checkout is mounted. The isolated branch `feat/google-product-cluster-stores-2026-09-29` is the workspace. GitHub Actions on the draft PR is the authoritative executable RED/GREEN test runner.

Pre-flight: Task 1 policy helpers feed Task 2 internal Edge Function. Task 2 response is consumed by Task 3 search orchestration. Task 3 output feeds Task 4 regression/CI qualification and Task 5 controlled production probe. Interfaces are consistent with the approved spec.

Ruling: use current official SerpApi response fields `shopping_results[*].immersive_product_page_token` and `product_results.stores[*]`, with `engine=google_shopping` then `engine=google_immersive_product&more_stores=true`. Do not use `no_cache=true`; cached provider results remain eligible. Cost if wrong: provider schema drift could cause fail-open fallback; deterministic normalization and live controlled probe mitigate it.

Ruling: because this connector-only environment has no local command runner, observe RED/GREEN through the existing pull-request CI workflow after each test/implementation commit. Cost if wrong: additional CI compute only; no provider or production runtime cost.

## Task 1 — deterministic Google cluster and store policy
RED: commit `2f385ac3c029cb0d9c6e55586d4a03ca8e6c1f4c`, Unified Search run `36522117267` failed at the contract-test step with 126 existing tests passing and exactly the 10 new policy tests failing on `Google cluster policy module must exist`.
GREEN: commit `92639fb6d2dcb4dc16b163609d6b1ac62bcd8e50`, Unified Search run `36522266955` SUCCESS across tests, backend guards, build, typecheck and lint.
Task 1: complete.

## Task 2 — internal bounded Google cluster acquisition Edge Function
RED: commit `960e9a6c04d90e1bcb3d738b4848618c1ae2d572`, Unified Search run `36522444769` failed with 136 existing/Task-1 tests passing and exactly 8 new Edge Function contract tests failing because the function was absent.
Implementation created `sp-us2-google-cluster-v1/index.ts`; server-only `SP_US2_SERPAPI_API_KEY`; max one Shopping plus one Stores call; caching preserved; protected staging RPC only; canonical exact-offer reread; fail-open telemetry. A temporary package-manifest typo was corrected before qualification; no dependency change remains.
GREEN: commit `4256ed6547c47edee935f45ee62ed329c65728b7`, Unified Search run `36522731727` SUCCESS across tests, guards, build, typecheck and lint.
Task 2: complete.

## Task 3 — search-v2 cluster-before-Make orchestration
RED: commit `67f6a86ce92b274aaeb9b2875c41d66cbc7b0b6d`, Unified Search run `36522940470` failed with 144 passes and exactly 7 new orchestration failures.
First GREEN attempt exposed two narrow constraints: preserve the literal sparse-core guard and do not let a new sixth merchant displace an existing verified exact offer. Both were corrected; existing verified offers are retained and Google fills only residual slots.
GREEN code head `d78b7ea6f6269936ceb1103f0866f755ead69f56`: Unified Search run `36523534778`, M1-B M1-BR run `36523534620`, and Two Image Label Flow run `36523535100` all SUCCESS.
Task 3: complete.

## Task 4 — security/cost/regression qualification
Branch scope is limited to approved spec/plan/ledger, one lint-scope change, new cluster policy/function, narrow search-v2 orchestration and focused tests. No DB migration. No dependency change.
Security/cost contracts prove: server-only key, no hardcoded credential, no `no_cache=true`, no direct commerce-table DML, no safety/ingredient/Benchmark/HOLDOUT authority, max one Shopping plus one Stores call, protected staging RPC only, fail-open reasons and residual Make calculation last.
Make scenario `7613424` is inactive, `isActive=false`, `incompleteExecutions=0`; no activation mutation.
Documentation-only head `302889e7236496c219bd7212f8a4a74fc64fb3bf` was re-qualified: Unified Search run `36523712790`, M1-B M1-BR run `36523712860`, Two Image Label Flow run `36523712787` all SUCCESS.
Task 4: complete.

## Task 5 — production qualification
Current Supabase docs were checked before deployment. Live function contract was verified: `sp_us2_exact_offers_v1(uuid,text,integer)` returns the fields expected by the merge helper, and `sp_us2_stage_commerce_offer_v1(jsonb)` is present.
Pre-probe production invariant snapshot: VERIFIED products 4; CANDIDATE products 14; safety assessments 4; ingredient links 52; Benchmark Gold items 26; unknown-pack verified leaks 0; NIVEA 100:ml verified exact offers 1; pending acquisition requests 1; dispatched/dispatching 0.
Deployed `sp-us2-google-cluster-v1` production v1 with `verify_jwt=false`; function is ACTIVE. It is not wired into live `sp-us2-search-v2` (still production v9), so user traffic cannot invoke this new path yet. No SerpApi credential is installed through the available connector surface; no provider call or provider credit has been consumed by this deployment.
Next blocking action: securely install `SP_US2_SERPAPI_API_KEY` in Supabase Edge Function Secrets, then perform exactly one controlled direct NIVEA probe before wiring live search.
