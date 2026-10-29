# SafeProducts SP-US2 Make Acquisition Contract 1.1

Contract: `SP-US2-MAKE-ACQUISITION/1.1`

This is the additive launch successor to the frozen 1.0 acquisition contract. Historical 1.0 queue rows and RPCs remain valid. New launch acquisition is commerce/product discovery only; Make is never an ingredient, safety, regulatory, identity-verification, ranking, or recommendation authority.

## Operating boundary

The acquisition request is created by the SafeProducts backend only after cache/canonical evidence and the Google product-cluster path have been exhausted. Routine Make acquisition remains rollout-gated. One claimed queue row may cause at most one Make webhook delivery.

Every job is locked to India (`IN`) and INR. The backend owns the request UUID, search mode, canonical anchor identity, requested/comparison pack semantics, and bounded residual targets. Credentials are configured separately in the platform and are never job data.

## Strict pack rule

An **explicit pack is immutable: no substitution is allowed**. If the user asks for 200 ml, only 200 ml evidence may qualify for that result set. The system returns fewer results rather than silently using 100 ml, 400 ml, another unit, or a multipack.

For a no-pack request, the backend may send a `comparison_pack_key` chosen before Make runs. For a specific product this is the anchor manufacturer's defensible official India default when available, otherwise a trusted-market modal pack. For a category query it is the defensible modal official-default pack across relevant brands, otherwise the trusted-market modal pack. Make must not choose a different comparison pack.

Therefore:

- explicit request: `requested_pack_key` is populated and `comparison_pack_key` is null;
- no-pack request with a resolved standard: `requested_pack_key` is null and `comparison_pack_key` is populated;
- unresolved no-pack comparison: both may be null, and Make must not invent a pack merely to fill slots.

## SPECIFIC_PRODUCT objective

For `SPECIFIC_PRODUCT` the job may request residual work only, never fabricated fill:

1. Resolve the exact canonical anchor product/formula/variant.
2. Discover direct India merchant/store product pages for the locked pack.
3. Reject search pages, redirects, merchant homepages, wrong products, wrong variants/formulas, wrong packs, multipacks represented as a single pack, non-HTTPS pages, non-INR prices, and non-India evidence.
4. De-duplicate by merchant/domain/page identity.
5. Sort accepted exact offers by comparable INR price.
6. Return **up to 5 exact** merchant offers total; fewer is correct when evidence is scarce.
7. Discover same-category alternatives only after the exact-anchor path.
8. Exclude the anchor identity and anchor brand from alternatives.
9. Enforce the same locked requested/comparison pack.
10. De-duplicate alternatives by canonical identity and normalized brand.
11. Return **up to 5 distinct-brand alternatives** where genuine supply exists.

Safety belongs to the canonical product/formula and is never created by Make. Exact merchant clones reuse the backend's canonical safety result only after backend qualification. Every alternative is independently qualified by M1-B from its own evidence.

## CATEGORY objective

For `CATEGORY`, acquisition targets up to **10 genuine products**, normally one canonical product per brand and all bound to the backend-selected comparable pack. It does not manufacture a sixth product to satisfy a minimum floor and never mixes packs to improve result count.

When the user supplied a pack, that requested pack is the only eligible pack. When no pack was supplied, Make follows the backend-provided `comparison_pack_key`; it does not select another size independently.

## Request fields

The 1.1 queue/dispatcher contract carries only acquisition information:

- `contract_version`
- `request_id`
- `query`
- `search_mode`: `SPECIFIC_PRODUCT` or `CATEGORY`
- `anchor_product_id` and canonical anchor descriptors when applicable
- `requested_pack_key`
- `comparison_pack_key`
- `category`
- `target_exact_offers` in 0..5
- `target_alternatives` in 0..5
- `target_category_products` in 0..10
- `market_country_code`: `IN`
- `currency`: `INR`
- callback URL

The payload never carries service-role keys, callback authentication secrets, Supabase server secrets, or any safety/ingredient authority field.

## Protected callback

Make posts commerce observations to the protected SafeProducts callback using the separately configured callback authentication channel. The callback independently validates request UUID/correlation, contract version, India/INR, direct HTTPS provenance, product/formula/variant relevance, pack identity, merchant/brand de-duplication, bounded targets, and forbidden-authority fields before canonical staging.

The callback can persist only commerce observations and CANDIDATE identity material through canonical RPCs. A Make observation cannot by itself create or change Safety Scores, ingredients, VERIFIED identity, regulatory status, Benchmark Gold/HOLDOUT truth, Best Choice, or recommendations.

## Evidence and human-review continuation

Any newly staged product then follows the canonical backend evidence pipeline, not Make:

`official/brand source -> trusted structured merchant/pharmacy source -> ingredient/back-label image -> OCR -> secondary OCR/VLM when necessary -> human review if unresolved`

A complete qualified official declaration short-circuits later recovery stages. Images already encountered may be persisted opportunistically, but SafeProducts does not make an additional paid search solely to obtain an image. Image availability never determines safety eligibility.

## Cost controls

- cache/canonical reuse first;
- Google product-cluster path before Make;
- Make only for residual shortfall;
- one queue claim -> at most one Make webhook POST;
- target bounds 5 exact / 5 alternatives / 10 category products;
- existing global hourly/day caps and query cooldown remain active;
- no repeated paid probe solely to reach a prettier count;
- routine Make acquisition remains disabled until controlled launch qualification is complete.

### Structural provider-call boundary

Per-candidate alternative/category Immersive fan-out modules are not merely disabled; they are absent from the executable scenario graph. Specific alternatives flow directly from the bounded Shopping feeder to its aggregator (`11 -> 13`), and category candidates flow directly from Shopping feeder to aggregator (`17 -> 19`). The only remaining Immersive/Stores lookup is the single bounded exact-anchor lookup in the specific-product path. Consequently, `SPECIFIC_PRODUCT` is structurally capped at one exact Shopping call + at most one exact Stores call + one alternatives Shopping call, while `CATEGORY` is structurally capped at one Shopping provider call and zero Stores fan-out calls.
