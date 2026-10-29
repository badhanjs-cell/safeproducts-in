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


def test_reviewer_export_is_complete_concise_and_fail_closed():
    pool = json.loads((BASE / "dev_candidate_pool.json").read_text(encoding="utf-8"))
    export = _load(BASE / "dev_reviewer_export.py", "dev_reviewer_export").build_reviewer_export(pool)

    assert export["packet_count"] == 30
    assert export["ready_count"] == 26
    assert export["blocked_count"] == 4
    assert export["gold_status"] == "UNASSIGNED"
    assert export["human_adjudication_required"] is True
    assert len(export["ready_packets"]) == 26
    assert len(export["blocked_packets"]) == 4

    all_packets = export["ready_packets"] + export["blocked_packets"]
    assert len({p["candidate_id"] for p in all_packets}) == 30
    for packet in all_packets:
        assert packet["gold_status"] == "UNASSIGNED"
        assert packet["review_decision"] is None
        assert "safety_score" not in packet
        assert "child_score" not in packet
        assert "pregnancy_score" not in packet
        assert "senior_score" not in packet

    for packet in export["ready_packets"]:
        assert packet["product_fingerprint"].startswith("spfp:v1:")
        assert packet["identity_summary"]
        assert packet["ingredient_declaration"]
        assert packet["ingredient_count"] > 0
        assert packet["evidence_sources"]
        assert all(source["source_url"] for source in packet["evidence_sources"])
        assert all(source["evidence_text_sha256"] for source in packet["evidence_sources"])
        assert packet["review_fields"] == {
            "identity_decision": "APPROVE | CORRECT | REJECT",
            "ingredient_declaration_decision": "APPROVE | CORRECT | REJECT",
            "correction_note": "",
        }

    blocked_ids = {p["candidate_id"] for p in export["blocked_packets"]}
    assert blocked_ids == {
        "catalog-41",
        "discovery-101",
        "e04b21f9600b52f3949182978c754db9",
        "seed-c88260bb-e33e-44d2-aab7-e7923cb1fd7f",
    }
    for packet in export["blocked_packets"]:
        assert packet["evidence_gap_reason"]
        assert packet["review_fields"] is None
        assert packet["do_not_adjudicate_gold"] is True


def test_markdown_export_has_ready_and_blocked_sections_without_safety_scoring():
    pool = json.loads((BASE / "dev_candidate_pool.json").read_text(encoding="utf-8"))
    module = _load(BASE / "dev_reviewer_export.py", "dev_reviewer_export_md")
    export = module.build_reviewer_export(pool)
    markdown = module.render_markdown(export)
    assert "26 Ready for human adjudication" in markdown
    assert "4 Blocked — do not adjudicate gold yet" in markdown
    assert "Safety Score" not in markdown
    assert "APPROVE | CORRECT | REJECT" in markdown
    assert "UNASSIGNED" in markdown
