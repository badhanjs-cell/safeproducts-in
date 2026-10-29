from pathlib import Path
import importlib.util
import json

BASE = Path(__file__).parent


def _load(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_recovery_batch_adds_three_review_ready_packets_without_erasing_conflict_history():
    pool = json.loads((BASE / "dev_candidate_pool.json").read_text(encoding="utf-8"))
    evidence = _load(BASE / "dev_evidence_recovery.py", "dev_evidence_batch").build_dev_evidence_manifest(pool)
    prepared = _load(BASE / "adjudication.py", "adjudication_batch").prepare_manifest(pool, evidence)

    assert prepared["ready_for_human_adjudication_count"] == 23
    assert prepared["evidence_incomplete_count"] == 7
    assert prepared["gold_status"] == "UNASSIGNED"

    by_id = {packet["candidate_id"]: packet for packet in prepared["packets"]}
    for candidate_id in (
        "catalog-28",
        "discovery-484",
        "seed-bf2fd651-ef6b-4263-b87f-8b7f47168299",
    ):
        packet = by_id[candidate_id]
        assert packet["curation_status"] == "READY_FOR_HUMAN_ADJUDICATION"
        assert packet["gold_status"] == "UNASSIGNED"
        assert packet["review_decision"] is None
        assert any(item.get("evidence_binding_eligible") for item in packet["evidence"])

    prohance = by_id["seed-bf2fd651-ef6b-4263-b87f-8b7f47168299"]
    assert prohance["identity"]["variant_name"] == "Vanilla"
    assert prohance["rejected_evidence"]
    assert prohance["rejected_evidence"][0]["conflict_code"] == "FLAVOUR_FORMULA_CONFLICT"
    assert "cocoa" in prohance["rejected_evidence"][0]["conflict_detail"].lower()
    assert prohance["evidence_gap_reason"] == ""
