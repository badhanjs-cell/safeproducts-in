#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
from typing import Any

BASE = Path(__file__).parent
_ALLOWED_DECISIONS = {"APPROVE", "CORRECT", "REJECT"}


def _load(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def build_decision_template(candidate_pool: dict) -> dict:
    reviewer_export = _load(BASE / "dev_reviewer_export.py", "m1b_dev_reviewer_export_for_adjudication")
    export = reviewer_export.build_reviewer_export(candidate_pool)

    decisions = [
        {
            "candidate_id": packet["candidate_id"],
            "identity_decision": None,
            "ingredient_declaration_decision": None,
            "correction_note": "",
            "gold_status": "UNASSIGNED",
        }
        for packet in export["ready_packets"]
    ]
    blocked_packets = [
        {
            "candidate_id": packet["candidate_id"],
            "evidence_gap_reason": packet["evidence_gap_reason"],
            "do_not_adjudicate_gold": True,
        }
        for packet in export["blocked_packets"]
    ]

    return {
        "schema_version": "1.0.0",
        "split": "DEV",
        "packet_count": export["packet_count"],
        "reviewable_count": len(decisions),
        "blocked_count": len(blocked_packets),
        "gold_status": "UNASSIGNED",
        "promotion_allowed": False,
        "human_adjudication_required": True,
        "decisions": decisions,
        "blocked_packets": blocked_packets,
    }


def _error(code: str, candidate_id: str | None = None) -> dict:
    result: dict[str, Any] = {"code": code}
    if candidate_id:
        result["candidate_id"] = candidate_id
    return result


def validate_decision_submission(candidate_pool: dict, submission: dict) -> dict:
    template = build_decision_template(candidate_pool)
    reviewable_ids = {row["candidate_id"] for row in template["decisions"]}
    blocked_ids = {row["candidate_id"] for row in template["blocked_packets"]}
    errors: list[dict] = []
    staged: list[dict] = []

    reviewer_id = str(submission.get("reviewer_id") or "").strip()
    reviewed_at = str(submission.get("reviewed_at") or "").strip()
    if not reviewer_id:
        errors.append(_error("REVIEWER_ID_REQUIRED"))
    if not reviewed_at:
        errors.append(_error("REVIEWED_AT_REQUIRED"))

    decisions = submission.get("decisions")
    if not isinstance(decisions, list):
        errors.append(_error("DECISIONS_LIST_REQUIRED"))
        decisions = []

    seen: set[str] = set()
    for raw in decisions:
        if not isinstance(raw, dict):
            errors.append(_error("INVALID_DECISION_RECORD"))
            continue

        candidate_id = str(raw.get("candidate_id") or "").strip()
        if not candidate_id:
            errors.append(_error("CANDIDATE_ID_REQUIRED"))
            continue
        if candidate_id in seen:
            errors.append(_error("DUPLICATE_CANDIDATE_DECISION", candidate_id))
            continue
        seen.add(candidate_id)

        if candidate_id in blocked_ids:
            errors.append(_error("BLOCKED_CANDIDATE_DECISION", candidate_id))
            continue
        if candidate_id not in reviewable_ids:
            errors.append(_error("UNKNOWN_CANDIDATE", candidate_id))
            continue

        identity_decision = str(raw.get("identity_decision") or "").strip().upper()
        ingredient_decision = str(raw.get("ingredient_declaration_decision") or "").strip().upper()
        correction_note = str(raw.get("correction_note") or "").strip()

        if identity_decision not in _ALLOWED_DECISIONS:
            errors.append(_error("INVALID_IDENTITY_DECISION", candidate_id))
            continue
        if ingredient_decision not in _ALLOWED_DECISIONS:
            errors.append(_error("INVALID_INGREDIENT_DECLARATION_DECISION", candidate_id))
            continue
        if "CORRECT" in {identity_decision, ingredient_decision} and not correction_note:
            errors.append(_error("CORRECTION_NOTE_REQUIRED", candidate_id))
            continue

        if "REJECT" in {identity_decision, ingredient_decision}:
            decision_status = "HUMAN_REJECTED"
        elif "CORRECT" in {identity_decision, ingredient_decision}:
            decision_status = "HUMAN_CORRECTION_REQUIRED"
        else:
            decision_status = "HUMAN_APPROVED_FOR_GOLD_STAGING"

        staged.append(
            {
                "candidate_id": candidate_id,
                "identity_decision": identity_decision,
                "ingredient_declaration_decision": ingredient_decision,
                "correction_note": correction_note,
                "decision_status": decision_status,
                "reviewer_id": reviewer_id,
                "reviewed_at": reviewed_at,
                "gold_status": "UNASSIGNED",
            }
        )

    approved_for_gold_staging_count = sum(
        row["decision_status"] == "HUMAN_APPROVED_FOR_GOLD_STAGING" for row in staged
    )

    return {
        "schema_version": "1.0.0",
        "split": "DEV",
        "valid": not errors,
        "errors": errors,
        "accepted_decision_count": len(staged),
        "approved_for_gold_staging_count": approved_for_gold_staging_count,
        "pending_human_decision_count": template["reviewable_count"] - len(staged),
        "gold_status": "UNASSIGNED",
        "promotion_allowed": False,
        "human_adjudication_required": True,
        "decisions": staged,
    }


def write_decision_template(candidate_pool: dict, output_path: Path) -> dict:
    template = build_decision_template(candidate_pool)
    output_path.write_text(json.dumps(template, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return template


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Generate a fail-closed M1-B DEV human adjudication template")
    parser.add_argument("--candidate-pool", required=True)
    parser.add_argument("--template-output", required=True)
    args = parser.parse_args(argv)

    candidate_pool = json.loads(Path(args.candidate_pool).read_text(encoding="utf-8"))
    template = write_decision_template(candidate_pool, Path(args.template_output))
    print(
        json.dumps(
            {
                "packet_count": template["packet_count"],
                "reviewable_count": template["reviewable_count"],
                "blocked_count": template["blocked_count"],
                "gold_status": template["gold_status"],
                "promotion_allowed": template["promotion_allowed"],
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
