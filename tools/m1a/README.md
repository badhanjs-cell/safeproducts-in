# SafeProducts M1-A — Standalone Ingredient Extraction Benchmark Foundation

Status: **standalone / shadow-only / no production writes**.

Hard bindings: homepage freeze `2a5e7a30f2a670d0d1b3337bf27203cf37dd1c79`; Supabase `SafeProducts_ValuLenz` / `wmxbdirvlwuagouraobr`. This package has no database client and changes no frontend/runtime code.

## Frozen benchmark

150 slots: 25 each for cosmetics, personal care, baby products, supplements, nutraceuticals and special dietary products. Each category has 5 DEV + 20 HOLDOUT slots, for 30 DEV and 120 HOLDOUT. Identities start unassigned: products must be curated, never invented. `production_candidate_export.sql` is read-only and may seed existing SafeProducts products.

Preferred evidence order: manufacturer/brand official → official Shopify/structured site → trusted pharmacy/structured source → open product database → marketplace/merchant → image OCR → VLM fallback → user-supplied label. Search/image search discovers evidence but is not ingredient truth. Copied merchant text must not count as independent consensus.

Engine outcome is exactly one of `QUALIFIED`, `INSUFFICIENT_EVIDENCE`, `CONFLICT_REQUIRES_REVIEW`. Only `QUALIFIED` may proceed to safety scoring. Every emitted ingredient needs resolvable `source_refs`; the harness fails closed otherwise.

Generate/validate the manifest:
```bash
python tools/m1a/benchmark.py init-manifest --output .safeproducts-benchmark/m1a/manifest.json
python tools/m1a/benchmark.py validate-manifest --manifest .safeproducts-benchmark/m1a/manifest.json
```

Gold records and predictions are JSONL keyed by `slot_id`. Qualified gold must be manually adjudicated from stored evidence, not copied from an existing safety score. Predictions may add `latency_ms`, `cost_usd`, `vlm_calls`, and `downstream_qualified`.

Score old and candidate engines, then compare:
```bash
python tools/m1a/benchmark.py score --manifest .safeproducts-benchmark/m1a/manifest.json --gold gold.jsonl --predictions existing.jsonl --split HOLDOUT --output baseline.json
python tools/m1a/benchmark.py score --manifest .safeproducts-benchmark/m1a/manifest.json --gold gold.jsonl --predictions candidate.jsonl --split HOLDOUT --output candidate.json
python tools/m1a/benchmark.py compare --baseline baseline.json --candidate candidate.json --output acceptance.json
```

Acceptance is strict: 100% provenance, zero unsupported ingredients on HOLDOUT, precision not below baseline, recall improved, and no regression in abstention/conflict/downstream qualification. Cost/latency are measured but never override source fidelity.

Tests: `python tools/m1a/test_benchmark.py`.

M1-A does not replace the current engine, modify production tables, publish safety scores, call VLMs automatically, touch the homepage, or create canonical ingredient identities.
