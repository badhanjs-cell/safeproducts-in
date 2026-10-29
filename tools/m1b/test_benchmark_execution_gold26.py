#!/usr/bin/env python3
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TARGET = ROOT / "benchmark_execution_gold26.py"

assert TARGET.exists(), "benchmark_execution_gold26.py is required"

spec = importlib.util.spec_from_file_location("benchmark_execution_gold26", TARGET)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def test_contract_constants():
    assert mod.EXPECTED_GOLD_COUNT == 26
    assert mod.EXPECTED_BLOCKED_COUNT == 4
    assert mod.SPLIT == "DEV"
    assert mod.PUBLICATION_ALLOWED is False
    assert mod.RUNTIME_PROMOTION_ALLOWED is False


def test_normalization_and_scoring_fail_closed():
    gold = ["Water", "Glycerin", "Niacinamide"]
    exact = ["water", "Glycerin ", "NIACINAMIDE"]
    wrong = ["Water", "Glycerin", "Fragrance"]
    a = mod.score_ingredients(gold, exact)
    assert a["precision"] == 1.0
    assert a["recall"] == 1.0
    assert a["unsupported_count"] == 0
    b = mod.score_ingredients(gold, wrong)
    assert b["unsupported_count"] == 1
    assert b["missed_count"] == 1


def test_acceptance_requires_zero_unsupported_and_full_provenance():
    good = {
        "product_count": 26,
        "provenance_coverage": 1.0,
        "unsupported_ingredient_count": 0,
        "identity_accuracy": 1.0,
        "ingredient_precision": 1.0,
        "ingredient_recall": 0.90,
        "combined_qualification_rate": 0.80,
    }
    assert mod.acceptance_decision(good)["decision"] == "PASS"
    bad = dict(good, unsupported_ingredient_count=1)
    assert mod.acceptance_decision(bad)["decision"] == "FAIL"
    bad = dict(good, provenance_coverage=0.99)
    assert mod.acceptance_decision(bad)["decision"] == "FAIL"


def test_gold_never_enters_engine_input():
    gold_row = {
        "candidate_id": "x",
        "slot_id": "COSMETICS-DEV-001",
        "category": "cosmetics",
        "product_fingerprint": "fp",
        "identity": {"brand_name": "B", "product_name": "P", "variant": "V", "pack_size_text": "100 ml", "market_country_code": "IN"},
        "gold_ingredients": ["SECRET GOLD INGREDIENT"],
        "evidence": {"sources": [{"source_url": "https://example.com"}]},
    }
    inp = mod.engine_input_from_gold_row(gold_row, "run-id", "session-key")
    serialized = str(inp)
    assert "SECRET GOLD INGREDIENT" not in serialized
    assert inp["benchmark_mode"] is True
    assert inp["identity"]["brand_name"] == "B"


if __name__ == "__main__":
    for name, value in sorted(globals().items()):
        if name.startswith("test_") and callable(value):
            value()
    print("benchmark execution gold26 contract PASS")
