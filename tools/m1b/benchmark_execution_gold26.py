#!/usr/bin/env python3
from __future__ import annotations
import hashlib
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any

EXPECTED_GOLD_COUNT = 26
EXPECTED_BLOCKED_COUNT = 4
SPLIT = "DEV"
PUBLICATION_ALLOWED = False
RUNTIME_PROMOTION_ALLOWED = False


def norm(value: str) -> str:
    value = unicodedata.normalize("NFKC", value or "").strip().lower()
    value = value.replace("–", "-").replace("—", "-")
    value = re.sub(r"\s+", " ", value)
    value = re.sub(r"\s*([(),:/+])\s*", r"\1", value)
    return value


def score_ingredients(gold: list[str], predicted: list[str]) -> dict[str, Any]:
    g = Counter(norm(x) for x in gold if norm(x))
    p = Counter(norm(x) for x in predicted if norm(x))
    overlap = g & p
    tp = sum(overlap.values())
    fp = sum((p - g).values())
    fn = sum((g - p).values())
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {
        "true_positive": tp,
        "unsupported_count": fp,
        "missed_count": fn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }


def engine_input_from_gold_row(row: dict[str, Any], run_id: str, session_key: str) -> dict[str, Any]:
    identity = dict(row.get("identity") or {})
    allowed_identity = {
        "brand_name": identity.get("brand_name"),
        "product_name": identity.get("product_name"),
        "variant": identity.get("variant"),
        "pack_size_text": identity.get("pack_size_text"),
        "market_country_code": identity.get("market_country_code") or "IN",
        "gtin": identity.get("gtin"),
    }
    return {
        "run_id": run_id,
        "identity": allowed_identity,
        "query": " ".join(str(x) for x in [allowed_identity.get("brand_name"), allowed_identity.get("product_name"), allowed_identity.get("variant"), allowed_identity.get("pack_size_text")] if x),
        "foreground_budget_ms": 30000,
        "benchmark_mode": True,
        "benchmark_slot_id": row.get("slot_id"),
        "benchmark_session_key": session_key,
    }


def acceptance_decision(metrics: dict[str, Any]) -> dict[str, Any]:
    checks = {
        "product_count_is_26": metrics.get("product_count") == EXPECTED_GOLD_COUNT,
        "provenance_coverage_is_100_percent": float(metrics.get("provenance_coverage") or 0) >= 1.0,
        "unsupported_ingredient_count_is_zero": int(metrics.get("unsupported_ingredient_count") or 0) == 0,
        "identity_accuracy_is_100_percent": float(metrics.get("identity_accuracy") or 0) >= 1.0,
        "publication_disabled": PUBLICATION_ALLOWED is False,
        "runtime_promotion_disabled": RUNTIME_PROMOTION_ALLOWED is False,
    }
    return {"decision": "PASS" if all(checks.values()) else "FAIL", "checks": checks}


def aggregate(rows: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(rows)
    tp = fp = fn = prov_num = prov_den = identity_ok = 0
    m1b_q = m1br_q = combined_q = human = conflicts = 0
    latency = []
    cost = 0.0
    for row in rows:
        s = row.get("ingredient_score") or {}
        tp += int(s.get("true_positive") or 0)
        fp += int(s.get("unsupported_count") or 0)
        fn += int(s.get("missed_count") or 0)
        prov_num += int(row.get("supported_prediction_ingredient_count") or 0)
        prov_den += int(row.get("prediction_ingredient_count") or 0)
        identity_ok += bool(row.get("identity_match"))
        m1b_q += row.get("m1b_status") == "QUALIFIED"
        m1br_q += row.get("m1b_status") != "QUALIFIED" and row.get("m1br_status") == "QUALIFIED"
        combined_q += row.get("final_state") == "QUALIFIED"
        human += bool(row.get("human_review_required"))
        conflicts += row.get("final_state") == "CONFLICT_REQUIRES_REVIEW"
        if isinstance(row.get("latency_ms"), (int, float)) and row.get("latency_ms") >= 0:
            latency.append(float(row["latency_ms"]))
        if isinstance(row.get("cost_usd"), (int, float)) and row.get("cost_usd") >= 0:
            cost += float(row["cost_usd"])
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {
        "product_count": total,
        "identity_accuracy": identity_ok / total if total else 0.0,
        "ingredient_true_positive": tp,
        "unsupported_ingredient_count": fp,
        "missed_ingredient_count": fn,
        "ingredient_precision": precision,
        "ingredient_recall": recall,
        "ingredient_f1": f1,
        "provenance_coverage": prov_num / prov_den if prov_den else 1.0,
        "m1b_qualified_count": m1b_q,
        "m1br_qualified_count": m1br_q,
        "combined_qualified_count": combined_q,
        "m1b_success_rate": m1b_q / total if total else 0.0,
        "m1br_recovery_rate": m1br_q / (total - m1b_q) if total - m1b_q else 0.0,
        "combined_qualification_rate": combined_q / total if total else 0.0,
        "human_review_rate": human / total if total else 0.0,
        "conflict_count": conflicts,
        "latency_ms_mean": sum(latency) / len(latency) if latency else None,
        "cost_usd_total": round(cost, 6),
        "publication_allowed": PUBLICATION_ALLOWED,
        "runtime_promotion_allowed": RUNTIME_PROMOTION_ALLOWED,
    }


def checksum_json(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    return hashlib.sha256(payload).hexdigest()


def write_scorecard(path: str | Path, rows: list[dict[str, Any]], metadata: dict[str, Any]) -> dict[str, Any]:
    metrics = aggregate(rows)
    out = {
        "schema_version": "1.0.0",
        "split": SPLIT,
        "gold_count": EXPECTED_GOLD_COUNT,
        "blocked_count": EXPECTED_BLOCKED_COUNT,
        "metrics": metrics,
        "acceptance": acceptance_decision(metrics),
        "metadata": metadata,
        "result_sha256": checksum_json(rows),
    }
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(out, indent=2, sort_keys=True) + "\n")
    return out


if __name__ == "__main__":
    raise SystemExit("This module is invoked by the controlled benchmark orchestrator; it has no standalone network runner.")
