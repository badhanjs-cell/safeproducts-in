from pathlib import Path
import importlib.util
import json

BASE = Path(__file__).parent
BLOCKED_IDS = {
    "catalog-41",
    "discovery-101",
    "e04b21f9600b52f3949182978c754db9",
    "seed-c88260bb-e33e-44d2-aab7-e7923cb1fd7f",
}


def _load(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _pool():
    return json.loads((BASE / "dev_candidate_pool.json").read_text(encoding="utf-8"))


def test_human_adjudication_template_exposes_only_ready_packets_and_never_assigns_gold():
    module_path = BASE / "dev_human_adjudication.py"
    assert module_path.exists(), "DEV human adjudication intake module is not implemented yet"
    module = _load(module_path, "dev_human_adjudication_template")

    template = module.build_decision_template(_pool())

    assert template["packet_count"] == 30
    assert template["reviewable_count"] == 26
    assert template["blocked_count"] == 4
    assert template["gold_status"] == "UNASSIGNED"
    assert template["promotion_allowed"] is False
    assert template["human_adjudication_required"] is True
    assert {row["candidate_id"] for row in template["blocked_packets"]} == BLOCKED_IDS
    assert len(template["decisions"]) == 26

    for row in template["decisions"]:
        assert row["identity_decision"] is None
        assert row["ingredient_declaration_decision"] is None
        assert row["correction_note"] == ""
        assert row["gold_status"] == "UNASSIGNED"
        assert "safety_score" not in row
        assert "child_score" not in row
        assert "pregnancy_score" not in row
        assert "senior_score" not in row


def test_explicit_double_approval_is_only_staged_and_does_not_create_gold():
    module_path = BASE / "dev_human_adjudication.py"
    assert module_path.exists(), "DEV human adjudication intake module is not implemented yet"
    module = _load(module_path, "dev_human_adjudication_staging")
    pool = _pool()
    template = module.build_decision_template(pool)
    candidate_id = template["decisions"][0]["candidate_id"]

    submission = {
        "reviewer_id": "HUMAN-DEV-REVIEWER",
        "reviewed_at": "2026-09-20T00:30:00+05:30",
        "decisions": [
            {
                "candidate_id": candidate_id,
                "identity_decision": "APPROVE",
                "ingredient_declaration_decision": "APPROVE",
                "correction_note": "",
            }
        ],
    }
    result = module.validate_decision_submission(pool, submission)

    assert result["valid"] is True
    assert result["accepted_decision_count"] == 1
    assert result["approved_for_gold_staging_count"] == 1
    assert result["pending_human_decision_count"] == 25
    assert result["gold_status"] == "UNASSIGNED"
    assert result["promotion_allowed"] is False
    assert result["decisions"][0]["decision_status"] == "HUMAN_APPROVED_FOR_GOLD_STAGING"
    assert result["decisions"][0]["gold_status"] == "UNASSIGNED"
    assert "gold_ingredients" not in result["decisions"][0]
    assert "safety_score" not in result["decisions"][0]


def test_blocked_candidate_decision_and_correction_without_note_fail_closed():
    module_path = BASE / "dev_human_adjudication.py"
    assert module_path.exists(), "DEV human adjudication intake module is not implemented yet"
    module = _load(module_path, "dev_human_adjudication_rejections")
    pool = _pool()

    blocked = module.validate_decision_submission(
        pool,
        {
            "reviewer_id": "HUMAN-DEV-REVIEWER",
            "reviewed_at": "2026-09-20T00:30:00+05:30",
            "decisions": [
                {
                    "candidate_id": "catalog-41",
                    "identity_decision": "APPROVE",
                    "ingredient_declaration_decision": "APPROVE",
                    "correction_note": "",
                }
            ],
        },
    )
    assert blocked["valid"] is False
    assert "BLOCKED_CANDIDATE_DECISION" in {error["code"] for error in blocked["errors"]}
    assert blocked["gold_status"] == "UNASSIGNED"
    assert blocked["promotion_allowed"] is False

    ready_id = module.build_decision_template(pool)["decisions"][0]["candidate_id"]
    missing_note = module.validate_decision_submission(
        pool,
        {
            "reviewer_id": "HUMAN-DEV-REVIEWER",
            "reviewed_at": "2026-09-20T00:30:00+05:30",
            "decisions": [
                {
                    "candidate_id": ready_id,
                    "identity_decision": "CORRECT",
                    "ingredient_declaration_decision": "APPROVE",
                    "correction_note": "",
                }
            ],
        },
    )
    assert missing_note["valid"] is False
    assert "CORRECTION_NOTE_REQUIRED" in {error["code"] for error in missing_note["errors"]}
    assert missing_note["gold_status"] == "UNASSIGNED"
    assert missing_note["promotion_allowed"] is False


def test_cli_writes_blank_human_adjudication_template(tmp_path):
    module = _load(BASE / "dev_human_adjudication.py", "dev_human_adjudication_cli")
    output = tmp_path / "dev_human_adjudication_template.json"

    result = module.main(
        [
            "--candidate-pool",
            str(BASE / "dev_candidate_pool.json"),
            "--template-output",
            str(output),
        ]
    )

    assert result == 0
    assert output.exists()
    generated = json.loads(output.read_text(encoding="utf-8"))
    assert generated["reviewable_count"] == 26
    assert generated["blocked_count"] == 4
    assert generated["gold_status"] == "UNASSIGNED"
    assert generated["promotion_allowed"] is False
    assert len(generated["decisions"]) == 26
    assert all(row["identity_decision"] is None for row in generated["decisions"])
    assert all(row["ingredient_declaration_decision"] is None for row in generated["decisions"])
