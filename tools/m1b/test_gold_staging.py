from copy import deepcopy
import json
from pathlib import Path

import pytest

from gold_staging import GoldStagingError, build_gold_staging_batch

ROOT = Path(__file__).resolve().parents[2]
READY_FILES = [ROOT / f"src/data/m1b-dev-review-ready-{n}.json" for n in range(1, 7)]
BLOCKED_FILE = ROOT / "src/data/m1b-dev-review-blocked.json"
CANDIDATE_POOL = Path(__file__).with_name("dev_candidate_pool.json")


def load_inputs():
    candidate_pool = json.loads(CANDIDATE_POOL.read_text())
    ready = []
    for path in READY_FILES:
        ready.extend(json.loads(path.read_text()))
    blocked = json.loads(BLOCKED_FILE.read_text())
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
    review = {
        "schema_version": "1.0.0",
        "split": "DEV",
        "reviewer_id": "reviewer@example.test",
        "reviewed_at": "2026-09-20T15:37:06.172Z",
        "accepted_decision_count": len(decisions),
        "pending_human_decision_count": 0,
        "gold_status": "UNASSIGNED",
        "promotion_allowed": False,
        "human_adjudication_required": True,
        "decisions": decisions,
    }
    return candidate_pool, ready, blocked, review


def test_builds_26_item_dev_gold_staging_batch_without_promotion():
    candidate_pool, ready, blocked, review = load_inputs()
    staged = build_gold_staging_batch(candidate_pool, ready, blocked, review)

    assert staged["schema_version"] == "1.0.0"
    assert staged["split"] == "DEV"
    assert staged["stage_status"] == "STAGED_NOT_PROMOTED"
    assert staged["gold_status"] == "UNASSIGNED"
    assert staged["promotion_allowed"] is False
    assert staged["human_adjudication_complete"] is True
    assert staged["item_count"] == 26
    assert len(staged["items"]) == 26
    assert len({item["candidate_id"] for item in staged["items"]}) == 26
    assert len({item["benchmark_slot_id"] for item in staged["items"]}) == 26
    assert len({item["product_fingerprint"] for item in staged["items"]}) == 26
    assert staged["blocked_candidate_ids"] == [packet["candidate_id"] for packet in blocked]
    assert set(staged["blocked_candidate_ids"]).isdisjoint({item["candidate_id"] for item in staged["items"]})
    assert all(item["stage_status"] == "STAGED_NOT_PROMOTED" for item in staged["items"])
    assert all(item["gold_status"] == "UNASSIGNED" for item in staged["items"])
    assert all(item["promotion_allowed"] is False for item in staged["items"])
    assert all(item["identity_decision"] == "APPROVE" for item in staged["items"])
    assert all(item["ingredient_declaration_decision"] == "APPROVE" for item in staged["items"])
    assert all(item["decision_status"] == "HUMAN_APPROVED_FOR_GOLD_STAGING" for item in staged["items"])
    assert all(item["product_fingerprint"].startswith("spfp:v1:") for item in staged["items"])
    assert all(item["ingredient_declaration"] for item in staged["items"])
    assert all(item["evidence_sources"] for item in staged["items"])
    assert len(staged["batch_sha256"]) == 64
    assert len(staged["reviewer_id_sha256"]) == 64

    by_category = {}
    for item in staged["items"]:
        by_category[item["benchmark_category"]] = by_category.get(item["benchmark_category"], 0) + 1
    assert by_category == {
        "cosmetics": 5,
        "personal_care": 4,
        "baby_products": 4,
        "supplements": 5,
        "nutraceuticals": 4,
        "special_dietary": 4,
    }


def test_staging_fails_closed_when_any_human_decision_is_not_double_approve():
    candidate_pool, ready, blocked, review = load_inputs()
    review["decisions"][0]["ingredient_declaration_decision"] = "CORRECT"
    review["decisions"][0]["decision_status"] = "HUMAN_CORRECTION_REQUIRED"
    review["decisions"][0]["correction_note"] = "needs correction"

    with pytest.raises(GoldStagingError, match="HUMAN_APPROVAL_REQUIRED"):
        build_gold_staging_batch(candidate_pool, ready, blocked, review)


def test_staging_fails_closed_on_duplicate_fingerprint():
    candidate_pool, ready, blocked, review = load_inputs()
    altered = deepcopy(ready)
    altered[1]["product_fingerprint"] = altered[0]["product_fingerprint"]

    with pytest.raises(GoldStagingError, match="DUPLICATE_PRODUCT_FINGERPRINT"):
        build_gold_staging_batch(candidate_pool, altered, blocked, review)


def test_staging_fails_closed_when_reviewable_packet_lacks_required_evidence():
    candidate_pool, ready, blocked, review = load_inputs()
    altered = deepcopy(ready)
    altered[0]["evidence_sources"] = []

    with pytest.raises(GoldStagingError, match="REVIEW_PACKET_INCOMPLETE"):
        build_gold_staging_batch(candidate_pool, altered, blocked, review)


def test_staging_batch_checksum_is_deterministic():
    candidate_pool, ready, blocked, review = load_inputs()
    first = build_gold_staging_batch(candidate_pool, ready, blocked, review)
    second = build_gold_staging_batch(candidate_pool, ready, blocked, review)
    assert first["batch_sha256"] == second["batch_sha256"]


def test_staging_accepts_prehashed_reviewer_without_raw_identifier():
    candidate_pool, ready, blocked, review = load_inputs()
    expected_hash = "a" * 64
    review.pop("reviewer_id")
    review["reviewer_id_sha256"] = expected_hash

    staged = build_gold_staging_batch(candidate_pool, ready, blocked, review)

    assert staged["reviewer_id_sha256"] == expected_hash
    assert "reviewer_id" not in staged
