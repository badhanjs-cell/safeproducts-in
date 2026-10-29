#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
from typing import Any


class GoldStagingError(ValueError):
    pass


CATEGORY_PREFIX = {
    "cosmetics": "COSMETICS",
    "personal_care": "PERSONAL-CARE",
    "baby_products": "BABY-PRODUCTS",
    "supplements": "SUPPLEMENTS",
    "nutraceuticals": "NUTRACEUTICALS",
    "special_dietary": "SPECIAL-DIETARY",
}

_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


def _fail(code: str, detail: str | None = None) -> None:
    raise GoldStagingError(code if not detail else f"{code}: {detail}")


def _canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _candidate_slot_map(candidate_pool: dict[str, Any]) -> dict[str, str]:
    if candidate_pool.get("split") != "DEV" or candidate_pool.get("candidate_count") != 30:
        _fail("INVALID_DEV_CANDIDATE_POOL")
    candidates = candidate_pool.get("candidates")
    if not isinstance(candidates, list) or len(candidates) != 30:
        _fail("INVALID_DEV_CANDIDATE_POOL")

    counters = {category: 0 for category in CATEGORY_PREFIX}
    mapping: dict[str, str] = {}
    for candidate in candidates:
        if not isinstance(candidate, dict):
            _fail("INVALID_DEV_CANDIDATE_POOL")
        candidate_id = str(candidate.get("candidate_id") or "").strip()
        category = str(candidate.get("benchmark_category") or "").strip()
        if not candidate_id or candidate_id in mapping or category not in counters:
            _fail("INVALID_DEV_CANDIDATE_POOL")
        counters[category] += 1
        mapping[candidate_id] = f"{CATEGORY_PREFIX[category]}-DEV-{counters[category]:03d}"

    if any(count != 5 for count in counters.values()):
        _fail("INVALID_DEV_CANDIDATE_POOL")
    return mapping


def _decision_index(review_submission: dict[str, Any]) -> dict[str, dict[str, Any]]:
    if review_submission.get("split") != "DEV":
        _fail("INVALID_REVIEW_SUBMISSION")
    if review_submission.get("pending_human_decision_count") != 0:
        _fail("PENDING_HUMAN_DECISIONS")
    if review_submission.get("promotion_allowed") is not False:
        _fail("PROMOTION_MUST_REMAIN_DISABLED")
    if review_submission.get("gold_status") != "UNASSIGNED":
        _fail("GOLD_STATUS_MUST_REMAIN_UNASSIGNED")

    decisions = review_submission.get("decisions")
    if not isinstance(decisions, list):
        _fail("INVALID_REVIEW_SUBMISSION")
    indexed: dict[str, dict[str, Any]] = {}
    for decision in decisions:
        if not isinstance(decision, dict):
            _fail("INVALID_REVIEW_SUBMISSION")
        candidate_id = str(decision.get("candidate_id") or "").strip()
        if not candidate_id or candidate_id in indexed:
            _fail("DUPLICATE_OR_MISSING_DECISION")
        indexed[candidate_id] = decision
    if review_submission.get("accepted_decision_count") != len(indexed):
        _fail("DECISION_COUNT_MISMATCH")
    return indexed


def _reviewer_hash(review_submission: dict[str, Any]) -> str:
    prehashed = str(review_submission.get("reviewer_id_sha256") or "").strip().lower()
    if prehashed:
        if not _SHA256_RE.fullmatch(prehashed):
            _fail("REVIEWER_AUDIT_REQUIRED")
        return prehashed
    reviewer_id = str(review_submission.get("reviewer_id") or "").strip()
    if not reviewer_id:
        _fail("REVIEWER_AUDIT_REQUIRED")
    return _sha256_text(reviewer_id)


def build_gold_staging_batch(
    candidate_pool: dict[str, Any],
    ready_packets: list[dict[str, Any]],
    blocked_packets: list[dict[str, Any]],
    review_submission: dict[str, Any],
) -> dict[str, Any]:
    slot_map = _candidate_slot_map(candidate_pool)
    decisions = _decision_index(review_submission)

    reviewer_id_sha256 = _reviewer_hash(review_submission)
    reviewed_at = str(review_submission.get("reviewed_at") or "").strip()
    if not reviewed_at:
        _fail("REVIEWER_AUDIT_REQUIRED")
    payload_metadata = review_submission.get("payload_metadata", {})
    if not isinstance(payload_metadata, dict):
        _fail("PAYLOAD_METADATA_INVALID")

    ready_ids = [str(packet.get("candidate_id") or "").strip() for packet in ready_packets]
    blocked_ids = [str(packet.get("candidate_id") or "").strip() for packet in blocked_packets]
    if any(not candidate_id for candidate_id in ready_ids + blocked_ids):
        _fail("MISSING_CANDIDATE_ID")
    if len(set(ready_ids)) != len(ready_ids) or len(set(blocked_ids)) != len(blocked_ids):
        _fail("DUPLICATE_CANDIDATE_ID")
    if set(ready_ids) & set(blocked_ids):
        _fail("READY_BLOCKED_OVERLAP")
    if set(ready_ids) | set(blocked_ids) != set(slot_map):
        _fail("DEV_POOL_COVERAGE_MISMATCH")
    if set(decisions) != set(ready_ids):
        _fail("REVIEW_DECISION_COVERAGE_MISMATCH")

    fingerprints: set[str] = set()
    items: list[dict[str, Any]] = []

    for packet in ready_packets:
        candidate_id = str(packet.get("candidate_id") or "").strip()
        decision = decisions[candidate_id]
        if (
            decision.get("identity_decision") != "APPROVE"
            or decision.get("ingredient_declaration_decision") != "APPROVE"
            or decision.get("decision_status") != "HUMAN_APPROVED_FOR_GOLD_STAGING"
        ):
            _fail("HUMAN_APPROVAL_REQUIRED", candidate_id)
        if decision.get("gold_status") != "UNASSIGNED":
            _fail("GOLD_STATUS_MUST_REMAIN_UNASSIGNED", candidate_id)

        fingerprint = str(packet.get("product_fingerprint") or "").strip()
        identity_summary = str(packet.get("identity_summary") or "").strip()
        ingredient_declaration = str(packet.get("ingredient_declaration") or "").strip()
        evidence_sources = packet.get("evidence_sources")
        ingredient_count = packet.get("ingredient_count")
        if (
            packet.get("curation_status") != "READY_FOR_HUMAN_ADJUDICATION"
            or packet.get("gold_status") != "UNASSIGNED"
            or packet.get("do_not_adjudicate_gold") is True
            or not fingerprint.startswith("spfp:v1:")
            or not identity_summary
            or not ingredient_declaration
            or not isinstance(ingredient_count, int)
            or ingredient_count <= 0
            or not isinstance(evidence_sources, list)
            or not evidence_sources
        ):
            _fail("REVIEW_PACKET_INCOMPLETE", candidate_id)
        if fingerprint in fingerprints:
            _fail("DUPLICATE_PRODUCT_FINGERPRINT", fingerprint)
        fingerprints.add(fingerprint)

        category = str(packet.get("benchmark_category") or "").strip()
        if category not in CATEGORY_PREFIX:
            _fail("INVALID_BENCHMARK_CATEGORY", candidate_id)

        item_core = {
            "candidate_id": candidate_id,
            "benchmark_slot_id": slot_map[candidate_id],
            "benchmark_category": category,
            "candidate_brand_name": packet.get("candidate_brand_name"),
            "candidate_product_name": packet.get("candidate_product_name"),
            "identity_summary": identity_summary,
            "product_fingerprint": fingerprint,
            "ingredient_declaration": ingredient_declaration,
            "ingredient_count": ingredient_count,
            "identity_source_urls": packet.get("identity_source_urls") or [],
            "evidence_sources": evidence_sources,
            "rejected_evidence": packet.get("rejected_evidence") or [],
            "identity_decision": "APPROVE",
            "ingredient_declaration_decision": "APPROVE",
            "decision_status": "HUMAN_APPROVED_FOR_GOLD_STAGING",
            "stage_status": "STAGED_NOT_PROMOTED",
            "gold_status": "UNASSIGNED",
            "promotion_allowed": False,
        }
        item = dict(item_core)
        item["candidate_snapshot_sha256"] = _sha256_text(_canonical_json(item_core))
        items.append(item)

    items.sort(key=lambda item: item["benchmark_slot_id"])
    blocked_candidate_ids = [packet["candidate_id"] for packet in blocked_packets]
    batch_core = {
        "schema_version": "1.0.0",
        "split": "DEV",
        "reviewed_at": reviewed_at,
        "reviewer_id_sha256": reviewer_id_sha256,
        "item_count": len(items),
        "blocked_candidate_ids": blocked_candidate_ids,
        "stage_status": "STAGED_NOT_PROMOTED",
        "gold_status": "UNASSIGNED",
        "promotion_allowed": False,
        "human_adjudication_complete": True,
        "payload_metadata": payload_metadata,
        "items": items,
    }
    batch = dict(batch_core)
    batch["batch_sha256"] = _sha256_text(_canonical_json(batch_core))
    return batch
