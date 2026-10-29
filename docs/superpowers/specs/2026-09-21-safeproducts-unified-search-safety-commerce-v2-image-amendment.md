# SafeProducts Unified Search, Safety & Commerce v2 — Image Extraction Amendment

**Date:** 2026-09-21  
**Status:** USER APPROVED AMENDMENT  
**Amends:** `docs/superpowers/specs/2026-09-21-safeproducts-unified-search-safety-commerce-v2-design.md`

## Purpose

The main v2 design correctly makes product image availability optional for search eligibility and Safety Score determination. This amendment adds a stronger extraction requirement: whenever SafeProducts is already reading an official product page or a verified merchant page for identity, ingredients, pack, or price, it should opportunistically capture the best usable product image exposed by that source.

## Required behavior

1. **Attempt image extraction during work already being performed.** Official manufacturer/brand sources are preferred. If no suitable official image is available, a verified exact-product merchant image may be used.
2. **Prefer a genuine product image over logos, banners, thumbnails that are visibly too small, category artwork, placeholders, or unrelated marketing graphics.** When width/height are available, retain them and prefer the larger suitable exact-product image. Do not infer dimensions that were not observed.
3. **Persist provenance.** Store the image URL, page/source URL, source kind, product identity, market where known, retrieval time, verification state, and dimensions when known in the existing `sp_catalog_product_image_v1` model. Merchant-offer image URLs may also remain on `sp_catalog_commerce_offer_v1`.
4. **Keep image selection independent from ingredient qualification and safety.** Image presence, image quality, dimensions, or `is_primary_display` must never be a hard requirement for `SAFETY_QUALIFIED`, display eligibility, Safety Score calculation, Best Choice eligibility, or result inclusion.
5. **No `image_available = true` gate.** Remove any remaining active or legacy production-qualification condition that rejects an otherwise valid product only because `image_url` is null.
6. **No unnecessary paid image-only research.** If the official/merchant pages already consulted expose an image, capture it. If no image is available, return the product with the existing neutral placeholder rather than triggering an additional paid model/web/VLM call solely to obtain display artwork. A separately scheduled/free image-enrichment process may improve it later.
7. **Do not delay useful results for image enrichment.** Safety and commerce data that are otherwise ready should be returned even when image extraction fails or times out.
8. **Cache image assets separately.** New images or image refreshes do not invalidate formula evidence or Safety Assessments.

## Source priority for display image

Use the first sufficiently usable candidate in this preference order, while retaining provenance for all persisted candidates:

1. exact-product official manufacturer/brand image;
2. exact-product official first-party store image;
3. exact-product verified merchant/pharmacy image;
4. existing verified cached image;
5. no image — render placeholder.

The source priority does not create a safety claim and does not affect the Safety Score.

## Acceptance criteria

- An exact product with qualified ingredient evidence and no image remains display eligible.
- An exact product with a valid merchant offer and no image remains display eligible in a safety-undetermined state when appropriate.
- Path A/output extraction can carry a display-image candidate independently from ingredient and offer evidence.
- Suitable official/merchant image metadata is persisted when available without requiring an additional image-only paid search.
- Frontend renders a placeholder when image is absent.
- Tests explicitly prevent reintroduction of image-presence qualification gates.
