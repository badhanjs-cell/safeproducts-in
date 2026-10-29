# SafeProducts Unified Search, Safety & Commerce v2 — Deployment Qualification

Date: 2026-09-21

## Qualification result

**QUALIFIED FOR CONTROLLED UNPUBLISHED OPERATION.** This certificate qualifies the implemented Unified Search, Safety & Commerce v2 architecture and its canonical deployment in the controlled unpublished state. It is **not** a public-launch certificate, production-traffic/load certificate, regulatory approval, safety certification, or authorization to publish SafeProducts.

Production/public rollout remains disabled. The site remains unpublished. The untouched HOLDOUT benchmark set was not used or modified.

## Qualified source and CI evidence

- Repository: `badhanjs-cell/safeproducts`
- Implementation branch: `feat/m1b-m1br-architecture-spec-2026-09-19`
- Qualified implementation head before this certificate commit: `772d5f766a25fcc8073037b4fb5c86936c85248c`
- Exact-head CI run: `35595417182`
- Workflow: `M1-B M1-BR CI`
- Result: `SUCCESS`
- Passed coverage included M1-B contracts, all `spUnifiedSearchV2*.test.mjs` tests, DEV reviewer packet generation, controlled Gold staging payload generation, backend guards, application build, TypeScript checking, frontend secret/rollout guard, and scoped M1-B semantic lint.

## Canonical Supabase target

Project: `wmxbdirvlwuagouraobr` (`SafeProducts_ValuLenz`)

Applied canonical migrations confirmed:

1. `20260921114528 sp_unified_search_safety_commerce_v2`
2. `20260921114553 sp_unified_search_image_capture_v2`
3. `20260921114618 sp_unified_search_commerce_write_v2`
4. `20260921114638 sp_unified_search_category_cards_v2`
5. `20260921114724 sp_m1b_economy_reporting_v1`
6. `20260921114816 sp_unified_search_pack_resolution_v2`

These migrations are additive/versioned. They add normalized pack metadata and provenance, exact-offer/category read contracts, bounded commerce/image persistence, and economy reporting without changing the benchmark Gold truth or enabling publication.

## Canonical Edge Functions

### `sp-m1b-path-a-v1`

- Active version: `3`
- Deployed source marker: `SP-M1B-PATH-A/2.1`
- Qualification policy: `M1B_QUALIFICATION_V2`
- `verify_jwt=false` by design because the body requires the server-only `x-m1b-internal-key` using constant-time comparison.
- Deployed bundle SHA: `95305646e8aedbf8181474c7e9aa859218f9bfdd2eacc664dfe81657f8f1b86b`
- Exact identity, market/pack, declaration completeness, provenance, extraction and unresolved-conflict gates remain fail closed.
- An otherwise exact, complete and provenance-bound official declaration can qualify under the runtime successor policy; freshness remains confidence metadata rather than an independent arbitrary blocker.
- Trusted structured evidence retains its confidence floor.
- Qualified evidence records explicit stop reasons (`SUFFICIENT_OFFICIAL_EVIDENCE` or `SUFFICIENT_TRUSTED_EVIDENCE`) and does not enqueue M1-BR.
- Display-image collection is opportunistic from already consulted sources and is never a safety/display eligibility gate.
- Paid-provider/token telemetry is persisted; monetary cost remains `NULL` when not deterministically known.

### `sp-us2-commerce-v1`

- Active version: `1`
- `verify_jwt=false` by design because the body requires server-only `x-us2-internal-key` using constant-time comparison.
- Deployed bundle SHA: `cad4c0197109fcfd0996ae0df43828f04bb2f67ae95222de497ec0bea1d7da86`
- Cache-first; no ingredient/safety mutation.
- Paid discovery is allowed only when explicitly authorized by an auditable Unified Search run.
- At most one paid discovery call is made per invocation, with provider-usage telemetry and unknown monetary cost preserved as `NULL`.

### `sp-m1b-search-v1`

- Active version: `2`
- Contract marker: `SP-US2/1.0`
- Ranking marker: `SP-US2-RANKING/1.0`
- `verify_jwt=true`
- Deployed bundle SHA: `a5fdf68363fde42fd992c806b3f103e8530433fcfd84df8df1ca8bfaabe6dd4e`
- Reads only the v2 cache contract and does not silently reuse a legacy cache response as v2.
- Pack precedence is explicit user pack → verified official default → modal verified merchant pack; unresolved pack disables price comparison/Best Choice rather than comparing unlike packs.
- Specific-product composition supports up to five exact same-product merchant offers plus five alternatives.
- Category composition supports up to ten products, preferring distinct brands, and price is not an eligibility gate.
- Safety is computed once per canonical product/formula and reused across merchant offers.
- A missing image never suppresses an otherwise eligible product.
- Unqualified ingredient evidence never receives a numeric safety score.
- Best Choice is deterministic and uses safety/price only; affiliate, sponsorship, commission and image metadata are not ranking inputs.

### `sp-m1br-recovery-worker-v1`

- Active version: `3`, unchanged in this deployment step.
- Existing recovery remains fail closed and preserves paid-model/token telemetry with unknown monetary cost as `NULL`.

## Backend security qualification

The new Unified Search internal RPCs were checked on the canonical database:

- `sp_us2_upsert_commerce_offer_v1(uuid,jsonb)`: anon execute **false**, authenticated execute **false**, service role execute **true**.
- `sp_us2_upsert_display_image_v1(uuid,jsonb)`: anon **false**, authenticated **false**, service role **true**.
- `sp_us2_exact_offers_v1(uuid,text,integer)`: anon **false**, authenticated **false**, service role **true**.
- `sp_us2_category_cards_v1(text,uuid,text,integer)`: anon **false**, authenticated **false**, service role **true**.
- `sp_us2_category_candidates_v1(text,uuid,text,integer)`: anon **false**, authenticated **false**, service role **true**.
- All above are `SECURITY DEFINER` with an explicit fixed `search_path`.
- `sp_m1b_get_report_v1` is executable by authenticated users only because it performs an internal `admin` role check; anon execute is false and service role is allowed.
- `sp_m1b_record_attempt_v1` and `sp_m1b_score_qualified_product_v1` are service-role only.
- `sp_m1b_submit_human_recovery_v2` is authenticated/admin-gated, rejects benchmark recovery, requires exact identity confirmation and a nonempty structured ingredient array, and invokes backend `sp_m1b_score_qualified_product_v1`; the reviewer does not submit a safety score.

This is a scoped qualification of the new/related surfaces, not a claim that every historical object in the database has zero advisor warnings.

## Rollback-only canonical database smoke qualification

To avoid provider spend and persistent catalog mutation, representative runtime database checks were executed inside transactions that ended with `ROLLBACK`.

A temporary fixture gave one Denver product an official 100 g canonical pack, another exact 50 g offer, and two additional cosmetics products with 100 ml and 200 ml packs. No fixture data survived the transaction.

Verified results:

- Exact-offer lookup for `100:g` returned exactly the matching 100 g offer and excluded the 50 g offer.
- Exact-offer lookup for `50:g` returned exactly the matching 50 g offer and excluded the 100 g offer.
- Category cards constrained to `100:g` returned only the 100 g product.
- Category cards without a pack constraint returned three distinct brands even when two products had no eligible commerce offer, confirming that price is not a category eligibility gate.
- An initial smoke fixture with an expired `valid_until` produced no exact offer. After setting a fresh rollback-only expiry, the exact offer became eligible. This confirms the canonical read fails closed for expired/out-of-stock/discontinued commerce evidence.

## Non-interference proof

Canonical counts before and after rollback smoke were unchanged:

| Surface | Before | After |
|---|---:|---:|
| Catalog products | 4 | 4 |
| Product ingredients | 50 | 50 |
| Ingredient evidence | 4 | 4 |
| Safety assessments | 4 | 4 |
| Review queue | 66 | 66 |
| Commerce offers | 20 | 20 |
| Product images | 8 | 8 |
| M1-B runs | 26 | 26 |
| Normal-search runs | 0 | 0 |
| Benchmark runs | 26 | 26 |
| Benchmark Gold batches | 1 | 1 |
| Benchmark Gold items | 26 | 26 |
| Benchmark execution batches | 1 | 1 |
| Benchmark execution items | 26 | 26 |

After rollback, persistent official-default-pack rows remain `0` and persistent normalized exact offers remain `0`; no legacy row was silently upgraded from a URL or inferred pack token.

## Economy and evidence-preservation controls

- No 26-product benchmark rerun was performed for this qualification.
- No untouched HOLDOUT item was used for tuning or validation.
- Deployment and smoke qualification introduced no new paid provider call.
- Existing CI/static/unit coverage was reused wherever it could prove deterministic behavior.
- Provider token/call usage is recorded when observed.
- Monetary provider cost is never fabricated as `$0`; unknown paid cost remains `NULL`.
- Exact-pack metadata is not retroactively inferred from historical URLs merely to increase displayed result count.
- Evidence, identity, completeness and conflict gates were not relaxed to save cost.

## Deterministic contract coverage inherited from exact-head CI

The successful exact-head test suite covers, among other v2 contracts:

- explicit-pack precedence and pack normalization;
- verified official-default then trusted-merchant-mode fallback;
- specific 5+5 composition and category result composition;
- canonical safety-score reuse across merchant clones;
- official complete evidence qualifying without unnecessary recovery;
- incomplete/hero-only evidence remaining scoreless;
- conflicts remaining review-required/scoreless;
- no-image products remaining eligible;
- deterministic display ordering and the 70/30 Best Choice formula;
- Best Choice independence from affiliate/sponsorship/image metadata;
- terminal Human Review with backend-only score computation;
- economy telemetry persistence and unknown-cost handling.

## Known limitations / controlled boundaries

1. The canonical persistent catalog currently contains only four verified product records, and its legacy records do not yet carry normalized pack/category metadata sufficient to exercise a genuine live 6–10 product category response. That depth is qualified by deterministic tests and rollback fixtures, not by current live catalog volume.
2. Current legacy offers are intentionally not retroactively marked exact-pack/verified based solely on URL text. They remain fail closed until a verified v2 ingestion/recovery establishes pack provenance.
3. No full external production-traffic/load test was performed in this qualification.
4. No untouched HOLDOUT benchmark acceptance was performed.
5. The Lovable site remains unpublished and no production/publication flag was enabled.
6. This certificate does not override the earlier M1-B/M1-BR DEV usefulness result; that benchmark remains below its DEV usefulness threshold and production model rollout remains disallowed on that basis.

## Decision

Unified Search, Safety & Commerce v2 is **implementation- and deployment-qualified for controlled unpublished operation** on the canonical SafeProducts backend, with fail-closed legacy behavior and economy telemetry preserved.

**Public publication / broad production rollout: NO — remains disabled pending separate launch authorization and any additional acceptance work required at that stage.**
