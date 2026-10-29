# SafeProducts Make Commerce/Discovery Qualification — Design Specification

**Date:** 2026-09-23  
**Status:** APPROVED / FROZEN 2026-09-23  
**Repository:** `badhanjs-cell/safeproducts`  
**Branch:** `feat/make-commerce-discovery-qualification-2026-09-23`  
**Canonical backend:** SafeProducts_ValuLenz / `wmxbdirvlwuagouraobr`

## 1. Purpose

Prepare SafeProducts for the planned 30 September public launch by using Make as a controlled product/commerce acquisition worker that supplies real India-market product and merchant data to the already-certified SafeProducts Unified Search v2 backend.

This milestone must make real frontend -> real backend -> real discovery/commerce -> canonical Supabase -> real frontend acceptance testing possible without moving search ranking, product verification, ingredient evidence qualification, or Safety Score authority into Make.

The user-facing engine remains `sp-us2-search-v2`.

## Frozen Search Objective

- specific = up to 5 exact same-product/same-pack merchant offers + up to 5 distinct-brand same-pack alternatives;
- generic/category = 6–10 distinct genuine products using one comparable normalized pack;
- never mix packs, duplicate results, or fabricate records to fill counts.

## 2. Current production problem

The Unified Search v2 architecture is deployed and its 5+5 composition policy is already implemented, but production data coverage is too sparse to exercise it reliably.

Current production evidence at design time shows:

- 7 active canonical products;
- 4 VERIFIED products and 3 CANDIDATE products;
- 0 canonical products with normalized pack metadata;
- 41 commerce-offer rows;
- 4 verified commerce offers;
- 0 verified exact-pack commerce offers;
- 0 current qualified canonical safety assessments;
- 78 open review items.

A live specific-product test correctly entered `SPECIFIC_PRODUCT` mode but returned 0 exact offers and 0 alternatives. Another known product matched only when pack text was removed from the query, exposing a product+pack anchor-recognition gap.

The architecture therefore does not need replacement; the acquisition, normalization, staging, and launch-catalog qualification path needs completion.

## 3. Architectural decision

### 3.1 Selected approach — Make as subordinate acquisition worker

Make will be used for real external product/merchant discovery and launch-catalog acquisition, but it will not be the public search engine and will not sit in the critical foreground response path.

Canonical flow:

1. Frontend calls the existing SafeProducts server function.
2. Server function calls `sp-us2-search-v2`.
3. `sp-us2-search-v2` performs cache/canonical/free discovery as today.
4. If genuine result coverage remains below target, the backend records a bounded acquisition request.
5. An internal dispatcher invokes the Make webhook asynchronously.
6. Make discovers real India-market product identities and/or merchant offers.
7. Make sends a signed callback payload to a SafeProducts internal callback endpoint.
8. SafeProducts validates and stages identities/offers through canonical server-side RPCs.
9. Candidate identities remain CANDIDATE and review-gated.
10. Verified existing canonical identities are never downgraded or overwritten.
11. A subsequent normal frontend search reads the new canonical/cache state and composes the 5+5 result set.

This preserves frontend latency, makes Make failure non-fatal, and permits controlled launch-catalog prewarming before 30 September.

### 3.2 Rejected approach — Make as public search engine

The legacy `MAKE_SEARCH_WEBHOOK_URL` path remains rollback-only/legacy. It must not regain precedence over M1-B/SP-US2 because that would duplicate ranking, pack, evidence, security, and cost-control logic outside the certified backend.

### 3.3 Rejected approach — synchronous Make call inside every search

The historical Make path can take tens of seconds under cold qualification. A foreground Make dependency would violate the current 25-second aggregate search budget and create avoidable launch fragility.

## 4. Scope

This milestone includes:

- a production-safe acquisition request model;
- server-side cooldown/cost controls for Make dispatch;
- a protected Make dispatch contract;
- a protected Make callback contract;
- canonical product discovery staging reuse;
- canonical commerce-offer staging/validation;
- deterministic normalized pack handling;
- product+pack anchor matching correction where needed;
- qualification mode for real end-to-end testing;
- launch-catalog prewarm tooling;
- CI/TDD coverage for security, pack correctness, fail-closed behavior, duplicate handling, and 5+5 integration.

This milestone excludes:

- Safety Score calculation in Make;
- ingredient-evidence creation by Make;
- automatic product verification by Make;
- Benchmark Gold mutation;
- HOLDOUT interaction;
- affiliate-ranking changes;
- frontend redesign;
- replacement of `sp-us2-search-v2`.

## 5. New backend components

### 5.1 `sp_us2_acquisition_request_v1`

A new additive table stores Make acquisition requests.

Minimum fields:

- `id uuid`;
- `normalized_query text`;
- `search_mode text`;
- `anchor_product_id uuid nullable`;
- `requested_pack_key text nullable`;
- `category text nullable`;
- `target_exact_offers integer`;
- `target_alternatives integer`;
- `status text`;
- `attempt_count integer`;
- `next_attempt_at timestamptz`;
- `created_at timestamptz`;
- `updated_at timestamptz`;
- `last_error_code text nullable`;
- `payload jsonb`;
- `result_summary jsonb nullable`.

RLS is enabled. No anon/authenticated direct table access. Service-role/server-only mutation.

### 5.2 `sp_us2_enqueue_acquisition_v1(...)`

`SECURITY DEFINER`, service-role-only RPC.

Responsibilities:

- normalize query and pack key;
- enforce idempotency/cooldown;
- avoid duplicate pending requests;
- cap acquisition frequency globally and per normalized query/anchor;
- record only the minimum context required by Make;
- return `queued`, `existing_request_id`, or a bounded denial reason.

The function must not change products, ingredients, safety assessments, reviews, or Benchmark Gold.

### 5.3 `sp-us2-make-dispatch-v1`

Internal Edge Function, `verify_jwt = false`, protected by the same server/internal-key pattern used for internal SP-US2 workers.

Responsibilities:

- claim one due acquisition request;
- POST a bounded payload to the configured Make webhook;
- attach an internal request identifier and callback token/reference;
- never expose Supabase service credentials to Make;
- update dispatch state/telemetry;
- fail safely when Make is unavailable.

The dispatcher is not called directly by public clients.

### 5.4 `sp-us2-make-callback-v1`

Internal Edge Function, `verify_jwt = false`, protected by a dedicated `x-sp-us2-make-key` secret and constant-time comparison.

Responsibilities:

- validate callback authentication;
- validate payload size and schema;
- validate HTTPS URLs;
- reject unsupported geography/currency;
- reject malformed price/pack data;
- enforce request correlation/idempotency;
- stage product identities through `sp_catalog_stage_search_discovery_v1`;
- stage commerce offers only through a new canonical RPC;
- write callback telemetry/result summary;
- never create ingredients, evidence, safety assessments, VERIFIED product state, or Benchmark Gold.

### 5.5 `sp_us2_stage_commerce_offer_v1(jsonb)`

New `SECURITY DEFINER`, service-role-only RPC.

Responsibilities:

- require an existing canonical product identity;
- require India-market context and INR for comparable price;
- normalize pack text to a canonical key;
- require exact product + exact pack semantics before `exact_pack_match=true`;
- dedupe by product + merchant/source + normalized pack + URL identity;
- preserve existing verified offer state;
- permit a new offer to enter only as unverified/qualified-by-server-validation according to explicit rules;
- never infer safety or formula equivalence from commerce data.

## 6. Make scenario contract

Make receives one acquisition job per invocation.

### 6.1 Input

Expected fields:

- `request_id`;
- `query`;
- `search_mode`;
- `anchor_product` when known;
- `requested_pack_key`;
- `category`;
- `target_exact_offers`;
- `target_alternatives`;
- `market_country_code = IN`;
- `currency = INR`;
- `callback_url`;
- opaque callback/auth reference as designed for the runtime.

### 6.2 Scenario work

For `SPECIFIC_PRODUCT`:

- find up to 5 genuine merchant offers for the exact anchor product and requested/resolved pack;
- find up to 5 same-pack alternatives from distinct brands;
- prefer direct official or trusted merchant product pages;
- return visible INR price only when tied to the exact selected pack;
- return fewer when genuine data is unavailable.

For `CATEGORY`:

- find up to 10 genuine relevant products;
- prefer distinct brands;
- preserve one comparable normalized pack;
- do not force a price comparison when pack equivalence cannot be established.

### 6.3 Make output

Make returns acquisition facts only:

- brand;
- product name;
- variant;
- category;
- pack text/key when observed;
- merchant/platform;
- source URL;
- price/currency;
- image URL when available;
- source/provenance metadata;
- confidence fields limited to identity/pack/commerce extraction.

Make may not return or assign:

- Safety Score;
- ingredient declaration as canonical evidence;
- safety recommendation;
- regulatory approval;
- product verification state;
- Best Choice.

## 7. Product + pack recognition correction

Before launch qualification, candidate matching must be corrected so that a known canonical product is not lost merely because the user includes pack text such as `60 Capsules`, `200 ml`, `75 gm`, or equivalent unit notation.

Required behavior:

1. Parse and remove normalized pack tokens for identity matching.
2. Match the remaining brand/product identity against canonical candidates.
3. Preserve the parsed pack as a comparison constraint.
4. Never weaken brand/product relevance merely to obtain a match.
5. Unit-equivalent pack forms must normalize deterministically.

This fix belongs in the canonical backend/search policy, not in Make.

## 8. Launch-catalog prewarm mode

A qualification/prewarm path is required so launch-critical queries can be acquired before public traffic.

The prewarm runner accepts a controlled list of representative launch queries and:

1. enqueues acquisition;
2. invokes Make through the internal dispatcher;
3. records callback completion;
4. verifies canonical product/offer residue;
5. reruns the normal public v2 search contract;
6. records whether 5+5 or category target coverage was achieved;
7. reports safety-qualified vs unscored counts without fabricating scores.

Prewarm must use the same production contracts as live traffic. No hidden alternate data path is permitted.

## 9. Economy and rate control

Economy-first order remains:

1. canonical/cache;
2. known recent discovery;
3. deterministic/free sources;
4. Make acquisition when genuine coverage remains below target and the job is not inside cooldown;
5. existing paid discovery only under its current independent budget controls when still authorized/needed.

Make-specific controls:

- per normalized query/anchor cooldown;
- global hourly/day caps;
- no duplicate pending jobs;
- one Make invocation per acquisition request;
- retry only transient delivery/callback failures;
- bounded maximum attempts;
- unknown Make/provider cost remains unknown, never `$0`;
- telemetry records Make execution count and result counts.

## 10. Security invariants

- Make never receives Supabase service-role credentials.
- Public clients cannot invoke the Make dispatcher/callback directly.
- Callback uses a dedicated server secret and constant-time validation.
- All Make-originated writes pass through service-role-only RPCs.
- Candidate discovery cannot create `VERIFIED` identities.
- Commerce acquisition cannot create Safety Scores or ingredient evidence.
- Existing verified products/offers are not downgraded.
- Existing formula-conflict guards remain unchanged.
- Benchmark Gold and HOLDOUT are untouched.
- All source URLs must be HTTPS and provenance-aware.

## 11. Qualification tests

TDD/CI must prove at minimum:

1. public users cannot execute acquisition/callback RPCs directly;
2. duplicate acquisition requests collapse under cooldown;
3. callback without valid internal key is denied;
4. malformed/non-HTTPS/non-INR payloads are rejected;
5. new discovered identities remain `CANDIDATE`;
6. Make callback cannot create ingredient evidence or Safety Scores;
7. known verified identity retains existing status/source origin;
8. product+pack queries still resolve the canonical anchor;
9. exact offers cannot cross pack boundaries;
10. one merchant cannot fill multiple exact-offer slots by duplication;
11. alternatives remain distinct-brand and same-pack;
12. no-pack category results use one deterministic comparable pack or suppress comparable pricing;
13. Make failure does not break `sp-us2-search-v2`;
14. legacy `MAKE_SEARCH_WEBHOOK_URL` does not regain search precedence;
15. production adapter still accepts the `SP-US2/1.0` contract;
16. existing Unified Search, M1-B/M1-BR, and label-flow CI remain green.

## 12. Real production acceptance sequence

After CI and non-production qualification:

1. deploy additive DB migration(s);
2. deploy callback/dispatcher internal functions;
3. configure Make webhook URL and Make callback secret in server-side secrets only;
4. configure/update the Make scenario;
5. run one controlled launch-catalog acquisition query;
6. inspect resulting CANDIDATE/offer rows and confirm no safety/evidence mutation;
7. run public v2 search for that query;
8. verify exact offers/alternatives and pack isolation;
9. repeat on a small representative launch set;
10. verify frontend in real browser/mobile;
11. only then enable routine production acquisition dispatch.

## 13. Rollback

Rollback is additive and bounded:

- disable Make acquisition dispatch via server-side rollout flag;
- leave `sp-us2-search-v2` and existing discovery/commerce workers active;
- pending acquisition jobs may be paused;
- no catalog deletion is required;
- candidate/offer rows created through the new path remain reviewable/auditable;
- the legacy v1 search rollback endpoint remains independent.

## 14. Success criteria for this milestone

The milestone is complete only when all of the following are evidenced:

- a real frontend search reaches `sp-us2-search-v2`;
- a genuine shortfall can create a bounded Make acquisition request;
- Make performs real discovery/commerce work and returns through the protected callback;
- new product identities remain CANDIDATE unless already canonical/verified;
- exact pack merchant offers are staged without cross-pack contamination;
- the same public v2 endpoint subsequently returns improved genuine coverage;
- at least one representative specific-product query demonstrates populated exact-offer and alternative sections, with target 5+5 when the market supplies enough genuine data;
- unscored products remain visibly unscored;
- no fabricated Safety Score, ingredient evidence, verification, Benchmark Gold change, or HOLDOUT interaction occurs;
- existing CI remains green;
- Make failure leaves core SafeProducts search functional.

## 15. External-tool note

The SafeProducts repository and Supabase sides of this design can be implemented with the connected GitHub/Supabase tools. Direct editing of the Make.com scenario requires an authenticated Make connector/session. If that connector is not exposed in the active ChatGPT runtime, the repository will still contain the exact versioned Make input/output contract and scenario blueprint so the Make configuration can be applied without redesigning backend code.
