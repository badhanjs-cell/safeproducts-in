#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "m1b"))

from benchmark_execution import build_execution_plan, score_execution_rows  # noqa: E402

EXTERNAL_BLOCK_MIGRATION = ROOT / "supabase" / "migrations" / "20260921002500_sp_m1b_benchmark_external_block_v1.sql"


def sample_gold_item(slot_id: str, candidate_id: str, category: str, ingredients: list[str]) -> dict:
    return {
        "slot_id": slot_id,
        "candidate_id": candidate_id,
        "category": category,
        "product_fingerprint": f"fp-{candidate_id}",
        "identity": {
            "brand_name": "Brand",
            "product_name": f"Product {candidate_id}",
            "variant": "Vanilla",
            "pack_size_text": "100 ml",
            "market_country_code": "IN",
        },
        "gold_ingredients": ingredients,
        "gold_status": "BENCHMARK_GOLD",
        "evidence_sha256": f"sha-{candidate_id}",
    }


def test_build_execution_plan_is_gold_only_and_non_promotable() -> None:
    items = [
        sample_gold_item("COSMETICS-DEV-001", "a", "cosmetics", ["Water", "Glycerin"]),
        sample_gold_item("SUPPLEMENTS-DEV-001", "b", "supplements", ["Vitamin C"]),
    ]
    plan = build_execution_plan(items, benchmark_gold_batch_id="gold-batch-1")
    assert plan["benchmark_gold_batch_id"] == "gold-batch-1"
    assert plan["product_count"] == 2
    assert plan["split"] == "DEV"
    assert plan["production_write_allowed"] is False
    assert plan["runtime_promotion_allowed"] is False
    assert plan["publication_allowed"] is False
    assert all(x["benchmark_mode"] is True for x in plan["items"])
    assert all("gold_ingredients" not in x for x in plan["items"])
    assert all(x["identity"]["market_country_code"] == "IN" for x in plan["items"])


def test_score_execution_rows_counts_precision_recall_recovery_and_provenance() -> None:
    gold = [
        sample_gold_item("COSMETICS-DEV-001", "a", "cosmetics", ["Water", "Glycerin"]),
        sample_gold_item("SUPPLEMENTS-DEV-001", "b", "supplements", ["Vitamin C", "Zinc"]),
    ]
    rows = [
        {
            "slot_id": "COSMETICS-DEV-001",
            "candidate_id": "a",
            "m1b_status": "QUALIFIED",
            "m1br_status": "NOT_RUN",
            "final_state": "QUALIFIED",
            "predicted_ingredients": ["Water", "Glycerin"],
            "source_refs": ["https://brand.example/a"],
            "unsupported_ingredient_count": 0,
            "latency_ms": 100,
            "cost_usd": 0.01,
            "human_review_required": False,
        },
        {
            "slot_id": "SUPPLEMENTS-DEV-001",
            "candidate_id": "b",
            "m1b_status": "INSUFFICIENT_EVIDENCE",
            "m1br_status": "QUALIFIED",
            "final_state": "QUALIFIED",
            "predicted_ingredients": ["Vitamin C", "Zinc"],
            "source_refs": ["https://pharmacy.example/b"],
            "unsupported_ingredient_count": 0,
            "latency_ms": 250,
            "cost_usd": 0.03,
            "human_review_required": False,
        },
    ]
    result = score_execution_rows(gold, rows)
    assert result["product_count"] == 2
    assert result["m1b_qualified_count"] == 1
    assert result["m1br_qualified_count"] == 1
    assert result["combined_qualified_count"] == 2
    assert result["ingredient_precision"] == 1.0
    assert result["ingredient_recall"] == 1.0
    assert result["unsupported_ingredient_count"] == 0
    assert result["provenance_coverage"] == 1.0
    assert result["m1br_absolute_lift"] == 0.5
    assert result["decision"] == "PASS"


def test_score_fails_closed_on_unsupported_ingredient() -> None:
    gold = [sample_gold_item("COSMETICS-DEV-001", "a", "cosmetics", ["Water"])]
    rows = [{
        "slot_id": "COSMETICS-DEV-001",
        "candidate_id": "a",
        "m1b_status": "QUALIFIED",
        "m1br_status": "NOT_RUN",
        "final_state": "QUALIFIED",
        "predicted_ingredients": ["Water", "Invented Ingredient"],
        "source_refs": ["https://brand.example/a"],
        "unsupported_ingredient_count": 1,
        "latency_ms": 100,
        "cost_usd": 0.01,
        "human_review_required": False,
    }]
    result = score_execution_rows(gold, rows)
    assert result["unsupported_ingredient_count"] == 1
    assert result["ingredient_precision"] < 1.0
    assert result["decision"] == "FAIL"


def test_external_dependency_pause_resume_contract() -> None:
    assert EXTERNAL_BLOCK_MIGRATION.exists(), "external dependency block migration must exist"
    sql = EXTERNAL_BLOCK_MIGRATION.read_text(encoding="utf-8")
    required = [
        "BLOCKED_EXTERNAL",
        "sp_m1b_pause_benchmark_external_v1",
        "sp_m1b_resume_benchmark_external_v1",
        "M1BR_PROVIDER_CREDIT_EXHAUSTED",
        "'infinity'::timestamptz",
        "publication_allowed=false",
        "runtime_promotion_allowed=false",
        "revoke all on function public.sp_m1b_pause_benchmark_external_v1",
        "revoke all on function public.sp_m1b_resume_benchmark_external_v1",
        "grant execute on function public.sp_m1b_pause_benchmark_external_v1",
        "grant execute on function public.sp_m1b_resume_benchmark_external_v1",
    ]
    for needle in required:
        assert needle in sql, f"missing external block contract marker: {needle}"
    assert "attempt_count=0" not in sql.replace(" ", ""), "pause/resume must preserve retry attempts"
    forbidden_live_writes = [
        "update public.sp_catalog_product_v1",
        "insert into public.sp_catalog_product_v1",
        "update public.sp_catalog_product_ingredient_v1",
        "insert into public.sp_catalog_product_ingredient_v1",
        "update public.sp_product_safety_assessment_v1",
        "insert into public.sp_product_safety_assessment_v1",
    ]
    lowered = sql.lower()
    for marker in forbidden_live_writes:
        assert marker not in lowered, f"external block migration must not touch live data: {marker}"


def main() -> int:
    tests = [
        test_build_execution_plan_is_gold_only_and_non_promotable,
        test_score_execution_rows_counts_precision_recall_recovery_and_provenance,
        test_score_fails_closed_on_unsupported_ingredient,
        test_external_dependency_pause_resume_contract,
    ]
    for test in tests:
        test()
    print(f"PASS {len(tests)}/{len(tests)} gold benchmark execution tests")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
