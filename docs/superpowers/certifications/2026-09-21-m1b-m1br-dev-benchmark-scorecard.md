# SafeProducts M1-B / M1-BR DEV Benchmark Scorecard

**Date:** 2026-09-21  
**Execution batch:** `a903f302-e140-453c-85f3-7f996ee3090e`  
**Split:** DEV  
**Frozen benchmark gold records:** 26  
**Evidence-incomplete blocked records excluded:** 4  
**Execution state:** COMPLETED  
**DEV decision:** **FAIL_DEV_USEFULNESS_GATE**  
**Production rollout authorized:** **NO**

## Outcome

The 26 frozen benchmark-gold products were executed through the controlled M1-B → M1-BR benchmark path. M1-B qualified 0/26 products. M1-BR recovered 1/26 M1-B failures. Combined qualification was therefore 1/26 (3.85%), an absolute lift of 3.85 percentage points.

The approved DEV usefulness gate requires M1-BR to recover at least 20% of M1-B failures **or** add at least 5 percentage points of absolute combined qualification while preserving zero fabricated ingredients. This run does not meet that criterion.

## Engine metrics

| Metric | Result |
| --- | ---: |
| M1-B attempted | 26 |
| M1-B qualified | 0 |
| M1-B success rate | 0.00% |
| M1-BR invoked | 26 |
| M1-BR qualified | 1 |
| M1-BR recovery rate | 3.85% |
| Combined qualified | 1 |
| Combined qualification rate | 3.85% |
| Absolute M1-BR lift | 3.85 percentage points |
| Final insufficient evidence | 13 |
| Final conflict/review | 12 |
| Unresolved requiring human fallback | 25 |

## Category outcomes

| Category | Products | Combined qualified | Conflicts | Insufficient |
| --- | ---: | ---: | ---: | ---: |
| Baby products | 4 | 0 | 3 | 1 |
| Cosmetics | 5 | 0 | 3 | 2 |
| Nutraceuticals | 4 | 0 | 1 | 3 |
| Personal care | 4 | 0 | 1 | 3 |
| Special dietary | 4 | 0 | 2 | 2 |
| Supplements | 5 | 1 | 2 | 2 |

## Sole qualified recovery

`SUPPLEMENTS-DEV-002` recovered three actives from an official Akumentis Healthcare source: Borage oil, P5P, and Magnesium oxide. These are supported semantic equivalents of the first three actives in the frozen gold declaration, but the complete 12-entry declaration was **not** recovered. The engine must therefore not be credited with full-declaration recovery for this product.

## Fidelity measurement limitation discovered

This execution exposed a benchmark-infrastructure defect that must be corrected before HOLDOUT. The persisted benchmark-gold row contains the full declaration string and `ingredient_count`, but does **not** persist a canonical ingredient array. The current Python scorer performs case/punctuation normalization only; it does not safely canonicalize dosage text such as `Borage Oil 500 mg` to `Borage oil`, nor generic synonyms such as `P5P` to `Pyridoxal-5-Phosphate`.

Accordingly, machine-certified ingredient precision/recall/F1 are deliberately left **unassigned** for this run rather than reporting misleading values. Manual inspection of the sole qualified output found no unsupported ingredient among its three predictions, but manual semantic inspection is not a substitute for reproducible benchmark scoring.

Before HOLDOUT, benchmark gold must persist a frozen canonical ingredient array and the normalizer/alias policy must be frozen independently of HOLDOUT results.

## Performance and economy observations

| Metric | Result |
| --- | ---: |
| p50 end-to-end benchmark item latency | 53,547 ms |
| p95 end-to-end benchmark item latency | 120,112.25 ms |
| Recorded search calls | 65 |
| Recorded OCR calls | 1 |
| Recorded VLM calls | 1 |
| Recorded `cost_usd` | 0 |

The `cost_usd=0` value is **not valid cost evidence** because paid provider calls occurred. Cost telemetry therefore requires correction before cost-per-product or cost-per-recovery can be certified. The low OCR/VLM counts confirm the existing recovery path already avoids those escalations unless structured evidence is insufficient; the dominant paid-work driver in this run was web/model search.

## External provider event

During execution, OpenAI API credit exhaustion caused 429 responses. The benchmark was fail-closed with retry attempts preserved, and a backend-only `BLOCKED_EXTERNAL` pause/resume control was installed. After API credits were restored, the same execution batch completed; no batch reset or human-review replay occurred.

## Non-interference verification

Post-benchmark live counts remained unchanged at:

- catalog products: 4
- product ingredients: 50
- ingredient evidence rows: 4
- safety assessments: 4
- catalog review queue: 66
- non-benchmark M1-B runs created during this benchmark: 0

No benchmark result was promoted into live catalog/search/scoring, and production rollout remains disabled.

## Required remediation before HOLDOUT

1. Persist canonical frozen gold ingredient arrays for reproducible scoring.
2. Fix paid-provider cost telemetry so cost is not silently recorded as zero.
3. Improve M1-B Path A recall without weakening identity, completeness, provenance or conflict gates.
4. Improve M1-BR recovery recall without increasing false qualification or unsupported ingredients.
5. Re-run DEV, freeze the final acceptance criterion, and only then expose the untouched 120-product HOLDOUT.

The 120-product HOLDOUT remains the final certification gate and must not be used for tuning.
