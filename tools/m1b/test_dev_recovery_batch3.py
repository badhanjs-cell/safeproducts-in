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


def test_third_recovery_batch_adds_lakme_reconciled_review_packet_without_assigning_gold():
    pool = json.loads((BASE / "dev_candidate_pool.json").read_text(encoding="utf-8"))
    evidence = _load(BASE / "dev_evidence_recovery_v3.py", "dev_evidence_batch3").build_dev_evidence_manifest(pool)
    prepared = _load(BASE / "adjudication.py", "adjudication_batch3").prepare_manifest(pool, evidence)

    assert prepared["ready_for_human_adjudication_count"] == 26
    assert prepared["evidence_incomplete_count"] == 4
    assert prepared["gold_status"] == "UNASSIGNED"

    by_id = {packet["candidate_id"]: packet for packet in prepared["packets"]}
    lakme = by_id["catalog-23"]
    assert lakme["identity"]["identity_status"] == "VERIFIED"
    assert lakme["curation_status"] == "READY_FOR_HUMAN_ADJUDICATION"
    assert lakme["gold_status"] == "UNASSIGNED"
    assert lakme["review_decision"] is None
    eligible = [item for item in lakme["evidence"] if item.get("evidence_binding_eligible")]
    assert eligible
    assert any(item.get("pack_binding_kind") == "RECONCILED_EXACT_IDENTITY_PLUS_PRODUCT_FORMULA" for item in eligible)
    assert all(item.get("requires_human_authority_judgment") for item in eligible)

    # The only complete 400 ml back-label/formula recovered for Himalaya was a
    # non-India SKU/GTIN, so the India 7004789 packet must remain fail-closed.
    himalaya = by_id["catalog-41"]
    assert himalaya["identity"]["identity_status"] == "VERIFIED"
    assert himalaya["identity"].get("sku") == "7004789"
    assert himalaya["curation_status"] == "EVIDENCE_INCOMPLETE"
    assert himalaya["gold_status"] == "UNASSIGNED"

    assert by_id["discovery-101"]["curation_status"] == "EVIDENCE_INCOMPLETE"
    assert by_id["e04b21f9600b52f3949182978c754db9"]["identity"]["identity_status"] == "PENDING"
    assert by_id["seed-c88260bb-e33e-44d2-aab7-e7923cb1fd7f"]["identity"]["identity_status"] == "PENDING"
