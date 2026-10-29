# SafeProducts Google Product-Cluster → Stores Acquisition Design

**Date:** 2026-09-29  
**Project:** SafeProducts only  
**Repository:** `badhanjs-cell/safeproducts`  
**Branch:** `feat/google-product-cluster-stores-2026-09-29`

## 1. Objective

Improve specific-product merchant coverage by using Google's own product-cluster/store-offer structure before SafeProducts falls back to the existing discovery and Make acquisition path.

For a specific product, SafeProducts should return up to five genuine merchant offers for the same product and same requested pack whenever Google exposes those merchants for that product cluster. The system must not fabricate offers, mix variants, mix pack sizes, weaken safety evidence rules, or activate routine Make acquisition as part of this change.

## 2. Hard constraints

1. **Strict project isolation:** SafeProducts only. Do not touch PEDOS, AI Dual SaaS, ValuLenz/GRIL outside components already explicitly belonging to SafeProducts, or unrelated Make/Supabase projects.
2. **Cost control is the default decision rule.** Prefer existing verified offers, cached evidence and free/reused data before any billable provider call. Use the Google-cluster path only when a specific-product search has fewer than five exact merchant offers.
3. **Bound provider work.** A foreground Google-cluster attempt is capped at one Google Shopping product-resolution request plus one Immersive Product Stores request with `more_stores=true`. No fan-out merchant searches.
4. **Preserve provider caching.** Do not force `no_cache=true` in normal operation. Identical cached SerpApi searches should be reusable when available.
5. **Make remains fallback.** Existing Make acquisition logic and scenario `7613424` remain available but are not activated by this feature. `SP_US2_MAKE_ACQUISITION_ENABLED` remains unchanged/disabled unless separately authorized later.
6. **No safety-policy weakening.** Google cluster evidence may support commerce-offer identity only. It must never create Safety Scores, ingredient evidence, safety recommendations, regulatory conclusions, VERIFIED product identity, Benchmark Gold, HOLDOUT state, or equivalent protected records.
7. **No browser credential exposure.** The SerpApi credential must exist only as a server-side Supabase Edge Function secret, proposed name `SP_US2_SERPAPI_API_KEY`. It must never be committed, logged, returned to the frontend, or stored in Make for this new path.
8. **Credential timing.** The credential is not required for design, coding, or deterministic tests. Request it from the user only after the implementation and mocked/fixture-based tests are complete and a controlled Supabase deployment/probe is ready.
9. **Fail open to existing search behavior.** Missing secret, provider timeout, rate-limit, malformed provider response, ambiguous cluster, insufficient stores or provider outage must not break the foreground search. SafeProducts continues through the existing discovery/Make fallback path.
10. **Public search contract remains stable.** Existing frontend consumers of `sp-us2-search-v2` should not need schema changes to display exact offers and alternatives.

## 3. Current architecture

The current production path is:

`sp-us2-search-v2` → canonical/core search → `sp-us2-discovery-v1` when additional coverage is required → merge results → `acquisitionNeed()` → enqueue Make shortfall → optional Make dispatch only when `SP_US2_MAKE_ACQUISITION_ENABLED=true`.

This architecture already protects foreground search from Make availability and already separates exact offers, alternatives, pack selection, and safety qualification.

The weakness is that exact merchant acquisition currently relies on independent merchant-level evidence. A merchant result can be rejected because its title/snippet omits full variant/pack wording even when Google has already grouped it under the same product entity.

## 4. Target architecture

Add a dedicated internal Edge Function:

`sp-us2-google-cluster-v1`

Updated specific-product flow:

`sp-us2-search-v2`
→ canonical/core exact-product resolution
→ read current verified exact offers
→ if exact-offer count < 5, call `sp-us2-google-cluster-v1`
→ resolve one exact Google Shopping product cluster
→ fetch clustered store offers (`more_stores=true`)
→ validate/dedupe/stage qualifying commerce offers
→ re-read canonical verified exact offers
→ continue existing alternative discovery
→ merge response
→ calculate remaining shortfall
→ existing Make queue/fallback only for any residual shortfall.

Category/generic search continues through the existing discovery path; the new cluster path is specific-product only.

## 5. Component boundaries

### 5.1 `sp-us2-google-cluster-v1`

Responsibilities:

- internal-only authenticated Edge Function;
- accept canonical anchor product data, original query, requested pack key and target exact-offer count;
- stop immediately when target exact-offer shortfall is zero;
- call SerpApi Google Shopping once to identify the best exact product cluster;
- require strong cluster-level agreement on brand, product identity, variant where known and requested pack;
- extract the Google product identifier / immersive-product token supported by the provider response;
- call Immersive Product Stores once with `more_stores=true`;
- normalize store offers into canonical commerce candidates;
- reject invalid/non-HTTPS links, non-positive prices, incompatible currencies/markets, contradictory pack evidence and duplicate merchants;
- stage only qualifying offers through the existing protected commerce staging path;
- re-read canonical verified offers and return a bounded result plus telemetry;
- never create or mutate safety/ingredient/regulatory artifacts.

### 5.2 `sp-us2-google-cluster-policy.mjs`

Pure deterministic policy helpers for:

- product-cluster identity scoring/qualification;
- pack normalization and contradictory-pack detection;
- merchant URL validation and dedupe;
- target shortfall calculations;
- provider response normalization;
- fail-open reason codes;
- cost/call-budget enforcement.

Keeping these rules pure allows RED→GREEN tests without spending provider credits.

### 5.3 `sp-us2-search-v2`

Responsibilities added:

- only invoke Google-cluster acquisition for `SPECIFIC_PRODUCT` searches;
- invoke only when current exact offers are below five;
- preserve the overall foreground deadline;
- merge newly staged exact offers before calculating Make shortfall;
- keep existing alternative discovery behavior unchanged;
- expose provider telemetry only inside existing metadata fields or a backward-compatible nested field.

### 5.4 Existing Make path

No functional weakening or deletion.

Make remains the final asynchronous acquisition fallback for:

- no resolvable Google product cluster;
- fewer than five clustered stores;
- provider unavailability;
- residual exact-offer shortage;
- existing alternative/category acquisition needs.

Routine Make dispatch remains disabled during this implementation and qualification.

## 6. Product-cluster qualification

The provider's cluster must not be accepted merely because its title is similar.

Qualification must use the canonical SafeProducts anchor and requested query evidence:

- normalized brand must match;
- anchor product-name identity tokens must substantially match;
- known variant must not conflict;
- requested normalized pack must match when the Google cluster exposes pack evidence;
- explicit contradictory pack evidence is a hard reject;
- explicit contradictory variant/model evidence is a hard reject;
- cluster must contain the provider token/identifier required to fetch stores.

When multiple clusters qualify, prefer the strongest identity match, then requested-pack evidence, then deterministic provider ordering. Do not issue multiple store calls trying several clusters in normal foreground operation.

## 7. Merchant-offer qualification

Once the exact Google product cluster is locked, individual merchant offers do **not** need to repeat the complete product title or variant text.

A clustered store offer can qualify when:

- it belongs to the locked Google product cluster response;
- merchant identity is present;
- source/product URL is HTTPS and credentials-free;
- price is positive;
- currency is INR, or the provider's India market result supplies a safely normalized INR price;
- pack evidence does not contradict the locked requested/resolved pack;
- merchant is not a duplicate of one already selected;
- the existing protected commerce staging layer accepts the normalized payload.

This deliberately shifts exact-product proof from every merchant snippet to the provider's product cluster while keeping SafeProducts staging protection in place.

## 8. Result selection

For a specific product:

1. preserve already-verified canonical exact offers;
2. add newly verified clustered-store offers;
3. dedupe by merchant and canonical product/pack/page identity;
4. sort using the existing exact-offer policy (price ascending where applicable);
5. cap display at five exact offers;
6. separately retain up to five same-pack distinct-brand alternatives.

The contract remains **up to five**, never exactly five. If Google exposes only three valid stores, SafeProducts returns three and may leave a residual Make shortfall of two.

## 9. Cost-control policy

Order of operations for a specific-product search:

1. existing verified exact offers;
2. existing SafeProducts acquisition/cache evidence;
3. Google product-cluster/store path only when exact offers remain below five;
4. existing free/reused alternative discovery;
5. paid discovery only under existing budget guard;
6. Make asynchronous acquisition only for residual shortfall and only when its operational enablement flag is explicitly on.

Additional cost controls:

- no Google-cluster call for category search;
- no call when five exact offers already exist;
- one Shopping resolution call maximum;
- one Stores call maximum;
- no automatic retry loop in foreground;
- honor provider/cache reuse;
- bounded timeout so provider latency cannot consume the whole search deadline;
- record call counts and reason codes for later cost audit;
- tests use fixtures/mocks, not live provider calls.

## 10. Credential and deployment policy

The server-side secret name will be `SP_US2_SERPAPI_API_KEY` unless existing SafeProducts configuration establishes a safer canonical name before deployment.

The user should be asked to provide/insert the credential **only after**:

- code is complete on the isolated branch;
- deterministic tests are green;
- CI is green;
- the new Edge Function is ready for a controlled production deployment/probe.

If the connected Supabase tool surface supports secure secret mutation at that time, use it. If not, request the minimum manual credential insertion step from the user. Never ask the user to paste the secret into chat if the platform provides a native secret-entry flow.

The absence of the credential must yield a benign telemetry reason such as `SERPAPI_KEY_UNAVAILABLE` and immediately fall back to current behavior.

## 11. Failure handling

The new path must be fail-open with explicit telemetry and zero safety side effects.

Representative non-fatal reasons:

- `NOT_SPECIFIC_PRODUCT`
- `EXACT_COVERAGE_SUFFICIENT`
- `SERPAPI_KEY_UNAVAILABLE`
- `SHOPPING_TIMEOUT`
- `SHOPPING_PROVIDER_ERROR`
- `NO_QUALIFIED_CLUSTER`
- `CLUSTER_TOKEN_MISSING`
- `STORES_TIMEOUT`
- `STORES_PROVIDER_ERROR`
- `NO_QUALIFIED_STORES`
- `PARTIAL_STORE_COVERAGE`
- `STAGING_REJECTED`

None of these should convert a valid SafeProducts search into an HTTP failure merely because Google-cluster acquisition failed.

## 12. Telemetry

Record, without credentials or sensitive payloads:

- cluster path attempted/skipped;
- skip/failure reason;
- Shopping provider calls (0 or 1);
- Stores provider calls (0 or 1);
- cache/provider metadata if safely available;
- candidate stores observed;
- stores accepted;
- stores staged;
- canonical exact offers before/after;
- residual exact-offer shortfall;
- latency.

This telemetry must support cost auditing and prove that Make remains residual fallback rather than the primary exact-offer acquisition source.

## 13. Security and trust boundaries

- Internal function authentication must follow the existing constant-time server-key pattern used by SafeProducts internal Edge Functions.
- Provider credential stays server-side only.
- Provider-returned URLs and text are untrusted input and must be normalized/validated.
- Existing protected staging RPC remains the authority for canonical commerce writes.
- No direct write to protected safety/ingredient tables from the new function.
- No authorization decisions based on user-editable metadata.
- Logs must not contain secrets, auth headers or raw credentials.

## 14. Test strategy

Use RED → verify meaningful failure → GREEN → full verification.

Deterministic tests must cover at least:

1. exact Google cluster selected for matching brand/product/variant/100 ml pack;
2. wrong variant rejected;
3. wrong pack rejected;
4. missing pack on individual merchant title accepted when cluster is locked and no contradictory pack exists;
5. contradictory merchant pack rejected;
6. duplicate merchant offers deduped;
7. maximum five exact offers returned;
8. zero provider calls when five exact offers already exist;
9. zero cluster calls for category searches;
10. provider call budget never exceeds 1 Shopping + 1 Stores call per attempt;
11. missing SerpApi secret fails open;
12. provider timeout fails open;
13. partial cluster coverage leaves residual Make shortfall only;
14. five clustered stores reduce Make exact target to zero;
15. safety/ingredient/Benchmark/HOLDOUT protections remain untouched;
16. routine Make scheduling remains disabled when its existing flag is false;
17. public search response remains backward-compatible;
18. existing PR #42 search/discovery tests remain green.

Live qualification after credential insertion should use a small controlled corpus, beginning with the known NIVEA MEN Deep Comfort After Shave Lotion 100 ml case, and must avoid repeated paid probes when one live call already provides adequate evidence.

## 15. Acceptance criteria

The change is acceptable when all of the following are true:

- a specific-product query with fewer than five exact offers attempts Google product-cluster acquisition before residual Make acquisition;
- a resolvable Google product cluster can yield multiple merchant offers without requiring every merchant title to restate the entire canonical identity;
- exact product, variant and pack contradictions are still rejected;
- up to five genuine merchant offers are shown when available;
- same-pack alternatives continue to work independently;
- no Safety Score or protected safety evidence is fabricated;
- category search behavior is unchanged;
- provider failures do not break foreground search;
- Make remains a fallback and remains operationally disabled during implementation/qualification unless separately authorized;
- cost telemetry demonstrates bounded provider calls;
- all relevant CI suites pass;
- production invariants remain unchanged except for legitimate commerce-offer growth;
- no secret appears in repository history, logs, responses or frontend bundles.

## 16. Rollback

The feature must be independently removable/disableable without reverting PR #42's existing search architecture.

Rollback options should include:

- stop invoking `sp-us2-google-cluster-v1` from `sp-us2-search-v2`;
- leave the new Edge Function undeployed/disabled;
- remove/unset `SP_US2_SERPAPI_API_KEY` so the path fails open;
- preserve the existing discovery and Make fallback path unchanged.

No database migration should be required unless implementation discovers a clear need for durable cluster telemetry or offer provenance that cannot fit existing structures. Any such need requires a versioned migration and an explicit review before production application.
