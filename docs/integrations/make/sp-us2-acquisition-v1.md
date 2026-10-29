# SafeProducts SP-US2 Make Acquisition Contract v1

Status: implementation contract for the controlled SafeProducts launch-acquisition worker.

## Purpose and authority boundary

`SP-US2-MAKE-ACQUISITION/1.0` is an asynchronous acquisition contract beneath the canonical SafeProducts search engine. The public search path remains frontend -> `sp-us2-search-v2` -> canonical M1-B/search/discovery/commerce logic. Make.com is not the public search, ranking, regulatory, or safety authority.

Make may collect observable commerce and product-identity facts. It must not create or infer a Safety Score, ingredient evidence, recommendation, Best Choice, regulatory approval/certification, VERIFIED identity status, Benchmark Gold state, or HOLDOUT state. Official statutory text remains distinct from SafeProducts independent analysis.

## Frozen search objective

### Specific product

For a resolved specific product, acquisition targets **5 exact** merchant offers for the same canonical product/variant and the same normalized pack, followed by **5 distinct-brand alternatives** from the relevant category using that same pack. These are maximum targets, never quotas: if fewer genuine sources exist, return fewer genuine results rather than fabricate or cross-fill slots.

### Generic/category

For a generic/category query, acquisition targets **6–10** genuine relevant products, preferably from distinct brands, using one deterministic comparable normalized pack. If a comparable pack cannot be established, products may still be discovered, but Make must not make cross-pack prices comparable.

The selected/requested pack is a constraint, not part of product identity. Product+pack input such as `TATA 1mg Tejasya Ashwagandha 60 Capsules` must preserve the product anchor while enforcing `60:count` for comparable commerce facts.

## Inbound webhook request

The internal dispatcher sends one HTTPS POST to the configured Make custom webhook after a queue request has been claimed. The payload is versioned and contains only acquisition context:

- `contract_version`: `SP-US2-MAKE-ACQUISITION/1.0`
- `request_id`: queue UUID
- `query`: normalized user/product/category query
- `search_mode`: `SPECIFIC_PRODUCT` or `CATEGORY`
- `anchor_product`: minimal canonical anchor facts when already known; otherwise `null`
- `requested_pack_key`: normalized `value:unit` key such as `200:ml`, `75:g`, or `60:count`
- `category`: canonical/category hint when known
- `target_exact_offers`: 0–5
- `target_alternatives`: 0–10
- `market_country_code`: always `IN`
- `currency`: always `INR`
- `callback_url`: canonical Supabase Edge callback URL

No server credential or callback secret is included in this job body.

## Make module sequence

1. **Custom Webhook** receives `SP-US2-MAKE-ACQUISITION/1.0` and validates request id, mode, India market and INR currency.
2. **Router** branches on `search_mode`.
3. **Specific-product route** uses the known anchor/query to discover direct merchant product pages for the required pack. Collect only exact product/variant pages for exact-offer slots. Then discover relevant distinct-brand same-pack alternatives.
4. **Category route** discovers query-relevant products, preferring distinct brands. If an explicit pack exists, enforce it. If no pack exists, collect trustworthy pack observations so the canonical backend can retain one comparable normalized pack.
5. **Normalize facts**: HTTPS direct source URL, observed source URL set, merchant/platform identity, visible price, INR, India market, product/variant flags, pack text/key, image URL when exact, and confidence.
6. **Array Aggregator** emits at most 10 product facts and at most 10 offer facts. Do not duplicate a merchant slot for the same product.
7. **HTTP callback** POSTs `SP-US2-MAKE-CALLBACK/1.0` to `sp-us2-make-callback-v1`. Configure `x-sp-us2-make-key` as a Make-side secret/connection value; never place it in the webhook job body, browser, Git, or logs.
8. **Stop.** Make does not score, rank, qualify ingredients, certify compliance, or mark identities VERIFIED.

## Source acceptance rules

A product or offer is accepted for callback only when its source is an HTTPS product page without embedded URL credentials. Commerce offers must have a positive visible INR price, India market, confidence at or above the backend trust floor, and the submitted page must be one of the pages actually observed by the acquisition route.

For a requested pack, every comparable offer must use the same normalized pack and set `exact_pack_match=true`. For exact offers, `exact_product_match=true` and `variant_match=true` are required. Do not infer an exact pack merely from a category or nearby product page.

For specific-product results, merchant slots for the anchor should be distinct. Alternative product refs should represent distinct products and should be chosen from different brands wherever genuine sources allow it.

## Callback contract

The callback body uses `SP-US2-MAKE-CALLBACK/1.0` and includes:

- `request_id`
- `market_country_code: IN`
- `currency: INR`
- optional `requested_pack_key`
- `products`: discovered identity facts, excluding the existing anchor unless a separate discovered identity is needed
- `offers`: merchant offer facts keyed by `product_ref`; exact anchor offers use `product_ref: ANCHOR`

The SafeProducts callback independently revalidates every fact. New product identities are staged only through `sp_catalog_stage_search_discovery_v1`, which preserves CANDIDATE/review/enrichment controls. Commerce facts are staged only through `sp_us2_stage_commerce_offer_v1`.

## Failure and idempotency behavior

Make should acknowledge the dispatcher quickly and perform discovery asynchronously. A callback may be retried only with the same `request_id`. The backend treats a completed request idempotently and enforces queue cooldown, attempt limits and global acquisition caps.

Transient Make delivery failure must never fail a user's foreground search. `sp-us2-search-v2` may queue acquisition with a short bounded RPC call and returns its core/cache/free-discovery result regardless of Make availability.

## Production configuration

Server-side only:

- `MAKE_ACQUISITION_WEBHOOK_URL`
- `SP_US2_MAKE_CALLBACK_KEY`
- `SP_US2_MAKE_ACQUISITION_ENABLED`

Keep acquisition disabled/unset during initial Supabase installation. Enable it only after migrations, functions, callback authentication and Make scenario qualification have passed.
