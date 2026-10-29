#!/usr/bin/env python3
from __future__ import annotations

import math
import re
import unicodedata
from collections import Counter, defaultdict
from typing import Iterable

QUALIFIED = "QUALIFIED"
CATEGORIES = (
    "cosmetics",
    "personal_care",
    "baby_products",
    "supplements",
    "nutraceuticals",
    "special_dietary",
)


def _norm(value: str) -> str:
    text = unicodedata.normalize("NFKC", value or "").strip().lower()
    text = text.replace("–", "-").replace("—", "-")
    text = re.sub(r"\s+", " ", text)
    return re.sub(r"\s*([(),:/+])\s*", r"\1", text)


def _rate(num: int, den: int) -> float:
    return round(num / den, 10) if den else 0.0


def _percentile(values: Iterable[float], q: float):
    vals = sorted(float(v) for v in values if isinstance(v, (int, float)) and math.isfinite(float(v)) and float(v) >= 0)
    if not vals:
        return None
    if len(vals) == 1:
        return vals[0]
    pos = (len(vals) - 1) * q
    lo, hi = math.floor(pos), math.ceil(pos)
    if lo == hi:
        return vals[lo]
    return vals[lo] + (vals[hi] - vals[lo]) * (pos - lo)


def build_execution_plan(gold_items: list[dict], benchmark_gold_batch_id: str) -> dict:
    if not benchmark_gold_batch_id:
        raise ValueError("benchmark_gold_batch_id is required")
    seen_slots: set[str] = set()
    seen_candidates: set[str] = set()
    items: list[dict] = []
    for row in gold_items:
        if row.get("gold_status") != "BENCHMARK_GOLD":
            raise ValueError("all execution items must be BENCHMARK_GOLD")
        slot_id = str(row.get("slot_id") or "")
        candidate_id = str(row.get("candidate_id") or "")
        if not slot_id or slot_id in seen_slots:
            raise ValueError(f"duplicate/missing slot_id {slot_id}")
        if not candidate_id or candidate_id in seen_candidates:
            raise ValueError(f"duplicate/missing candidate_id {candidate_id}")
        identity = dict(row.get("identity") or {})
        if not identity.get("brand_name") or not identity.get("product_name"):
            raise ValueError(f"{slot_id}: exact identity is required")
        if identity.get("market_country_code") != "IN":
            raise ValueError(f"{slot_id}: India market identity required")
        if not row.get("product_fingerprint"):
            raise ValueError(f"{slot_id}: product fingerprint required")
        seen_slots.add(slot_id)
        seen_candidates.add(candidate_id)
        items.append({
            "slot_id": slot_id,
            "candidate_id": candidate_id,
            "category": row.get("category"),
            "product_fingerprint": row.get("product_fingerprint"),
            "identity": identity,
            "benchmark_mode": True,
            "foreground_budget_ms": 25000,
        })
    return {
        "schema_version": "1.0.0",
        "benchmark_gold_batch_id": benchmark_gold_batch_id,
        "split": "DEV",
        "product_count": len(items),
        "production_write_allowed": False,
        "runtime_promotion_allowed": False,
        "publication_allowed": False,
        "items": items,
    }


def score_execution_rows(gold_items: list[dict], rows: list[dict]) -> dict:
    gold_by_slot = {str(x.get("slot_id")): x for x in gold_items}
    pred_by_slot = {str(x.get("slot_id")): x for x in rows}
    if len(gold_by_slot) != len(gold_items):
        raise ValueError("duplicate gold slot_id")
    if len(pred_by_slot) != len(rows):
        raise ValueError("duplicate execution slot_id")
    if set(gold_by_slot) != set(pred_by_slot):
        missing = set(gold_by_slot) - set(pred_by_slot)
        extra = set(pred_by_slot) - set(gold_by_slot)
        raise ValueError(f"execution/gold slot mismatch missing={len(missing)} extra={len(extra)}")

    tp = fp = fn = 0
    m1b_q = m1br_q = combined = 0
    unsupported = 0
    provenance_items = provenance_supported = 0
    human = conflicts = 0
    latencies: list[float] = []
    total_cost = 0.0
    by_category: dict[str, Counter] = defaultdict(Counter)

    for slot_id, gold in gold_by_slot.items():
        row = pred_by_slot[slot_id]
        if str(row.get("candidate_id")) != str(gold.get("candidate_id")):
            raise ValueError(f"{slot_id}: candidate mismatch")
        if gold.get("gold_status") != "BENCHMARK_GOLD":
            raise ValueError(f"{slot_id}: gold status is not BENCHMARK_GOLD")
        cat = str(gold.get("category") or "unknown")
        by_category[cat]["n"] += 1
        if row.get("m1b_status") == QUALIFIED:
            m1b_q += 1
            by_category[cat]["m1b_q"] += 1
        if row.get("m1b_status") != QUALIFIED and row.get("m1br_status") == QUALIFIED:
            m1br_q += 1
            by_category[cat]["m1br_q"] += 1
        if row.get("final_state") == QUALIFIED:
            combined += 1
            by_category[cat]["combined"] += 1
        if bool(row.get("human_review_required")) or row.get("final_state") == "CONFLICT_REQUIRES_REVIEW":
            human += 1
        if row.get("final_state") == "CONFLICT_REQUIRES_REVIEW":
            conflicts += 1

        expected = Counter(_norm(x) for x in (gold.get("gold_ingredients") or []) if _norm(x))
        predicted = Counter(_norm(x) for x in (row.get("predicted_ingredients") or []) if _norm(x)) if row.get("final_state") == QUALIFIED else Counter()
        overlap = expected & predicted
        t = sum(overlap.values())
        f = sum((predicted - expected).values())
        n = sum((expected - predicted).values())
        tp += t
        fp += f
        fn += n
        by_category[cat]["tp"] += t
        by_category[cat]["fp"] += f
        by_category[cat]["fn"] += n

        unsupported += max(int(row.get("unsupported_ingredient_count") or f), 0)
        for _ingredient in predicted.elements():
            provenance_items += 1
            if row.get("source_refs"):
                provenance_supported += 1

        latency = row.get("latency_ms")
        if isinstance(latency, (int, float)) and math.isfinite(float(latency)) and float(latency) >= 0:
            latencies.append(float(latency))
        cost = row.get("cost_usd")
        if isinstance(cost, (int, float)) and math.isfinite(float(cost)) and float(cost) >= 0:
            total_cost += float(cost)

    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    total = len(gold_items)
    provenance = provenance_supported / provenance_items if provenance_items else 1.0
    by = {}
    for cat, z in sorted(by_category.items()):
        cat_precision = z["tp"] / (z["tp"] + z["fp"]) if z["tp"] + z["fp"] else 0.0
        cat_recall = z["tp"] / (z["tp"] + z["fn"]) if z["tp"] + z["fn"] else 0.0
        by[cat] = {
            "product_count": z["n"],
            "m1b_success_rate": _rate(z["m1b_q"], z["n"]),
            "combined_qualification_rate": _rate(z["combined"], z["n"]),
            "ingredient_precision": cat_precision,
            "ingredient_recall": cat_recall,
        }

    checks = {
        "all_gold_records_executed": len(rows) == total,
        "provenance_coverage_is_100_percent": provenance >= 1.0,
        "unsupported_ingredient_count_is_zero": unsupported == 0 and fp == 0,
        "runtime_promotion_count_is_zero": all(r.get("promotion_status") != "PROMOTED" for r in rows),
    }
    return {
        "schema_version": "1.0.0",
        "split": "DEV",
        "product_count": total,
        "m1b_qualified_count": m1b_q,
        "m1br_qualified_count": m1br_q,
        "combined_qualified_count": combined,
        "m1b_success_rate": _rate(m1b_q, total),
        "m1br_recovery_rate": _rate(m1br_q, total - m1b_q),
        "combined_qualification_rate": _rate(combined, total),
        "m1br_absolute_lift": round(_rate(combined, total) - _rate(m1b_q, total), 10),
        "ingredient_true_positive": tp,
        "unsupported_ingredient_count": unsupported,
        "missed_ingredient_count": fn,
        "ingredient_precision": precision,
        "ingredient_recall": recall,
        "ingredient_f1": f1,
        "provenance_coverage": provenance,
        "human_review_rate": _rate(human, total),
        "review_referral_count": human,
        "conflict_count": conflicts,
        "p50_latency_ms": _percentile(latencies, 0.50),
        "p95_latency_ms": _percentile(latencies, 0.95),
        "cost_usd_total": round(total_cost, 6),
        "by_category": by,
        "checks": checks,
        "decision": "PASS" if all(checks.values()) else "FAIL",
        "production_rollout_authorized": False,
        "holdout_certification_required": True,
    }
