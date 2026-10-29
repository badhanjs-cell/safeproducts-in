#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from gold_staging import GoldStagingError, build_gold_staging_batch

ATTESTATION_FILE = "tools/m1b/dev_human_review_final_approved_20260920.json"
CANDIDATE_POOL_FILE = "tools/m1b/dev_candidate_pool.json"
READY_FILES = [f"src/data/m1b-dev-review-ready-{n}.json" for n in range(1, 7)]
BLOCKED_FILE = "src/data/m1b-dev-review-blocked.json"


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _fail(code: str) -> None:
    raise GoldStagingError(code)


def generate_payload(root: Path) -> dict[str, Any]:
    root = root.resolve()
    attestation = _read_json(root / ATTESTATION_FILE)
    candidate_pool = _read_json(root / CANDIDATE_POOL_FILE)

    ready: list[dict[str, Any]] = []
    for relative_path in READY_FILES:
        chunk = _read_json(root / relative_path)
        if not isinstance(chunk, list):
            _fail("READY_PACKET_FILE_INVALID")
        ready.extend(chunk)

    blocked = _read_json(root / BLOCKED_FILE)
    if not isinstance(blocked, list):
        _fail("BLOCKED_PACKET_FILE_INVALID")

    if (
        attestation.get("schema_version") != "1.0.0"
        or attestation.get("split") != "DEV"
        or attestation.get("approval_scope") != "ALL_REVIEWABLE_PACKETS_IN_FROZEN_DEV_SNAPSHOT"
        or attestation.get("approved_count") != 26
        or attestation.get("blocked_count") != 4
        or attestation.get("final_approval_confirmed") is not True
        or attestation.get("gold_status") != "UNASSIGNED"
        or attestation.get("promotion_allowed") is not False
        or attestation.get("human_adjudication_required") is not True
        or attestation.get("stage_status") != "STAGING_AUTHORIZED_NOT_PROMOTED"
    ):
        _fail("FINAL_HUMAN_REVIEW_ATTESTATION_INVALID")

    if len(ready) != attestation["approved_count"] or len(blocked) != attestation["blocked_count"]:
        _fail("FINAL_HUMAN_REVIEW_COUNT_MISMATCH")

    reviewer_hash = str(attestation.get("reviewer_id_sha256") or "").strip().lower()
    reviewed_at = str(attestation.get("human_review_exported_at") or "").strip()
    source_revision = str(attestation.get("source_evidence_revision") or "").strip()
    if len(reviewer_hash) != 64 or not reviewed_at or len(source_revision) != 40:
        _fail("FINAL_HUMAN_REVIEW_AUDIT_INVALID")

    decisions = [
        {
            "candidate_id": packet["candidate_id"],
            "identity_decision": "APPROVE",
            "ingredient_declaration_decision": "APPROVE",
            "correction_note": "",
            "decision_status": "HUMAN_APPROVED_FOR_GOLD_STAGING",
            "gold_status": "UNASSIGNED",
        }
        for packet in ready
    ]

    metadata = {
        "approval_scope": attestation["approval_scope"],
        "approved_count": attestation["approved_count"],
        "blocked_count": attestation["blocked_count"],
        "final_approval_confirmed": True,
        "source_evidence_revision": source_revision,
    }
    review_submission = {
        "schema_version": "1.0.0",
        "split": "DEV",
        "reviewer_id_sha256": reviewer_hash,
        "reviewed_at": reviewed_at,
        "accepted_decision_count": len(decisions),
        "pending_human_decision_count": 0,
        "gold_status": "UNASSIGNED",
        "promotion_allowed": False,
        "human_adjudication_required": True,
        "payload_metadata": metadata,
        "decisions": decisions,
    }

    return build_gold_staging_batch(candidate_pool, ready, blocked, review_submission)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate fail-closed M1-B DEV controlled gold staging payload")
    parser.add_argument("--root", default=str(Path(__file__).resolve().parents[2]))
    parser.add_argument("--output", required=True)
    args = parser.parse_args(argv)

    payload = generate_payload(Path(args.root))
    Path(args.output).write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
