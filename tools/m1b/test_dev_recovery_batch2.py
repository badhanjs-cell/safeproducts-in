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


def test_second_recovery_batch_adds_two_ready_packets_and_one_verified_identity():
    pool = json.loads((BASE / "dev_candidate_pool.json").read_text(encoding="utf-8"))
    evidence = _load(BASE / "dev_evidence_recovery_v2.py", "dev_evidence_batch2").build_dev_evidence_manifest(pool)
    prepared = _load(BASE / "adjudication.py", "adjudication_batch2").prepare_manifest(pool, evidence)

    assert prepared["ready_for_human_adjudication_count"] == 25
    assert prepared["evidence_incomplete_count"] == 5
    assert prepared["gold_status"] == "UNASSIGNED"

    by_id = {packet["candidate_id"]: packet for packet in prepared["packets"]}
    wild = by_id["discovery-99"]
    assert wild["identity"]["identity_status"] == "VERIFIED"
    assert wild["identity"]["pack_size"] == "100 ml"
    assert wild["curation_status"] == "READY_FOR_HUMAN_ADJUDICATION"
    assert any(item.get("evidence_binding_eligible") for item in wild["evidence"])

    ensure = by_id["seed-32bbcd5d-41e1-4b71-8a55-57b5d38a6f0a"]
    assert ensure["identity"]["identity_status"] == "VERIFIED"
    assert ensure["identity"]["pack_size"] == "400 g"
    assert ensure["curation_status"] == "READY_FOR_HUMAN_ADJUDICATION"

    botnik = by_id["discovery-101"]
    assert botnik["identity"]["identity_status"] == "VERIFIED"
    assert botnik["identity"]["pack_size"] == "200 ml"
    assert botnik["curation_status"] == "EVIDENCE_INCOMPLETE"
    assert botnik["gold_status"] == "UNASSIGNED"

    assert sum(p["identity"].get("identity_status") == "VERIFIED" for p in prepared["packets"]) == 28
