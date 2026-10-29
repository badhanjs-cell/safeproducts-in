import json
from pathlib import Path

from generate_gold_staging_payload import generate_payload

ROOT = Path(__file__).resolve().parents[2]


def test_final_attestation_generates_exact_26_item_non_promoting_payload():
    payload = generate_payload(ROOT)

    assert payload["schema_version"] == "1.0.0"
    assert payload["split"] == "DEV"
    assert payload["item_count"] == 26
    assert len(payload["items"]) == 26
    assert len(payload["blocked_candidate_ids"]) == 4
    assert payload["stage_status"] == "STAGED_NOT_PROMOTED"
    assert payload["gold_status"] == "UNASSIGNED"
    assert payload["promotion_allowed"] is False
    assert payload["human_adjudication_complete"] is True
    assert len(payload["reviewer_id_sha256"]) == 64
    assert "reviewer_id" not in payload
    assert payload["payload_metadata"] == {
        "approval_scope": "ALL_REVIEWABLE_PACKETS_IN_FROZEN_DEV_SNAPSHOT",
        "approved_count": 26,
        "blocked_count": 4,
        "final_approval_confirmed": True,
        "source_evidence_revision": "6bd74d51902a2040bc6db97266ce6a12798efead",
    }
    assert all(item["identity_decision"] == "APPROVE" for item in payload["items"])
    assert all(item["ingredient_declaration_decision"] == "APPROVE" for item in payload["items"])
    assert all(item["decision_status"] == "HUMAN_APPROVED_FOR_GOLD_STAGING" for item in payload["items"])

    blocked = set(payload["blocked_candidate_ids"])
    staged = {item["candidate_id"] for item in payload["items"]}
    assert blocked.isdisjoint(staged)
    assert "seed-bf2fd651-ef6b-4263-b87f-8b7f47168299" in staged
    prohance = next(item for item in payload["items"] if item["candidate_id"] == "seed-bf2fd651-ef6b-4263-b87f-8b7f47168299")
    assert any(e.get("conflict_code") == "FLAVOUR_FORMULA_CONFLICT" for e in prohance["rejected_evidence"])


def test_payload_is_deterministic_and_serializable():
    first = generate_payload(ROOT)
    second = generate_payload(ROOT)
    assert first["batch_sha256"] == second["batch_sha256"]
    assert json.loads(json.dumps(first)) == first
