#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

BASE = Path(__file__).parent


def _load(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _identity_summary(identity: dict) -> str:
    parts = [
        str(identity.get("brand_name") or "").strip(),
        str(identity.get("product_name") or "").strip(),
        str(identity.get("variant_name") or "").strip(),
        str(identity.get("pack_size") or "").strip(),
        str(identity.get("market_country_code") or "").strip(),
    ]
    return " | ".join(part for part in parts if part)


def _eligible_sources(packet: dict) -> list[dict]:
    sources = []
    for item in packet.get("evidence") or []:
        if not item.get("evidence_binding_eligible"):
            continue
        sources.append({
            "source_kind": item.get("source_kind"),
            "source_url": item.get("source_url"),
            "authoritative": bool(item.get("authoritative")),
            "trusted_structured": bool(item.get("trusted_structured")),
            "reconciled_pack_formula": bool(item.get("reconciled_pack_formula")),
            "pack_binding_kind": item.get("pack_binding_kind"),
            "pack_binding_source_urls": list(item.get("pack_binding_source_urls") or []),
            "requires_human_authority_judgment": bool(
                item.get("requires_human_authority_judgment") or item.get("reconciled_pack_formula")
            ),
            "evidence_text_sha256": item.get("evidence_text_sha256"),
            "image_sha256": item.get("image_sha256"),
            "retrieved_at": item.get("retrieved_at"),
            "provenance_note": item.get("provenance_note"),
        })
    return sources


def build_reviewer_export(candidate_pool: dict) -> dict:
    evidence_module = _load(BASE / "dev_evidence_recovery_v3.py", "m1b_reviewer_evidence_v3")
    adjudication = _load(BASE / "adjudication.py", "m1b_reviewer_adjudication")
    evidence_manifest = evidence_module.build_dev_evidence_manifest(candidate_pool)
    prepared = adjudication.prepare_manifest(candidate_pool, evidence_manifest)

    ready_packets = []
    blocked_packets = []
    for packet in prepared["packets"]:
        identity = dict(packet.get("identity") or {})
        common = {
            "candidate_id": packet.get("candidate_id"),
            "benchmark_category": packet.get("benchmark_category"),
            "candidate_brand_name": packet.get("candidate_brand_name"),
            "candidate_product_name": packet.get("candidate_product_name"),
            "identity": identity,
            "identity_summary": _identity_summary(identity),
            "product_fingerprint": packet.get("product_fingerprint"),
            "curation_status": packet.get("curation_status"),
            "gold_status": "UNASSIGNED",
            "review_decision": None,
            "human_adjudication_required": True,
            "identity_source_urls": list(identity.get("identity_source_urls") or []),
            "rejected_evidence": list(packet.get("rejected_evidence") or []),
        }

        if packet.get("curation_status") == "READY_FOR_HUMAN_ADJUDICATION":
            ingredients = list(packet.get("auto_extracted_ingredients") or [])
            eligible_declarations = [
                str(item.get("ingredient_declaration_text") or "").strip()
                for item in packet.get("evidence") or []
                if item.get("evidence_binding_eligible")
                and str(item.get("ingredient_declaration_text") or "").strip()
            ]
            ready_packets.append({
                **common,
                "ingredient_declaration": eligible_declarations[0] if eligible_declarations else "",
                "ingredient_count": len(ingredients),
                "auto_extracted_ingredients": ingredients,
                "evidence_sources": _eligible_sources(packet),
                "review_fields": {
                    "identity_decision": "APPROVE | CORRECT | REJECT",
                    "ingredient_declaration_decision": "APPROVE | CORRECT | REJECT",
                    "correction_note": "",
                },
                "review_note": (
                    "Human reviewer must independently approve or correct exact identity and the complete declaration. "
                    "Trusted/reconciled sources are review support only and require explicit human judgment."
                ),
            })
        else:
            blocked_packets.append({
                **common,
                "evidence_gap_reason": str(packet.get("evidence_gap_reason") or "Evidence incomplete."),
                "review_fields": None,
                "do_not_adjudicate_gold": True,
            })

    return {
        "schema_version": "1.0.0",
        "split": "DEV",
        "packet_count": len(ready_packets) + len(blocked_packets),
        "ready_count": len(ready_packets),
        "blocked_count": len(blocked_packets),
        "gold_status": "UNASSIGNED",
        "human_adjudication_required": True,
        "ready_packets": ready_packets,
        "blocked_packets": blocked_packets,
    }


def _md_escape(value: object) -> str:
    return str(value or "").replace("\n", " ").strip()


def render_markdown(export: dict) -> str:
    lines = [
        "# M1-B DEV Human Adjudication Packets",
        "",
        f"Gold status: **{export['gold_status']}**. No packet in this file is benchmark gold until a human reviewer explicitly approves it.",
        "",
        f"## {export['ready_count']} Ready for human adjudication",
        "",
    ]
    for index, packet in enumerate(export["ready_packets"], start=1):
        lines.extend([
            f"### R{index:02d} — {_md_escape(packet['candidate_id'])}",
            "",
            f"- Category: {_md_escape(packet['benchmark_category'])}",
            f"- Exact identity: {_md_escape(packet['identity_summary'])}",
            f"- Fingerprint: `{_md_escape(packet['product_fingerprint'])}`",
            f"- Ingredient count (auto-parsed, not gold): {packet['ingredient_count']}",
            f"- Complete declaration for review: {_md_escape(packet['ingredient_declaration'])}",
            "- Evidence:",
        ])
        for source in packet["evidence_sources"]:
            qualifiers = []
            if source["authoritative"]:
                qualifiers.append("authoritative-source evidence")
            if source["trusted_structured"]:
                qualifiers.append("trusted structured review support")
            if source["reconciled_pack_formula"]:
                qualifiers.append("reconciled exact-identity/formula binding")
            if source["requires_human_authority_judgment"]:
                qualifiers.append("explicit human source/formula judgment required")
            label = "; ".join(qualifiers) or _md_escape(source["source_kind"])
            lines.append(
                f"  - {label}: {_md_escape(source['source_url'])} — SHA256 `{_md_escape(source['evidence_text_sha256'])}`"
            )
        if packet["rejected_evidence"]:
            lines.append(f"- Rejected/conflicting evidence preserved: {len(packet['rejected_evidence'])} item(s); do not use as gold.")
        lines.extend([
            "- Identity decision: **APPROVE | CORRECT | REJECT**",
            "- Ingredient declaration decision: **APPROVE | CORRECT | REJECT**",
            "- Correction note: ____________________",
            "",
        ])

    lines.extend([
        f"## {export['blocked_count']} Blocked — do not adjudicate gold yet",
        "",
    ])
    for index, packet in enumerate(export["blocked_packets"], start=1):
        lines.extend([
            f"### B{index:02d} — {_md_escape(packet['candidate_id'])}",
            "",
            f"- Candidate: {_md_escape(packet['candidate_brand_name'])} — {_md_escape(packet['candidate_product_name'])}",
            f"- Current identity: {_md_escape(packet['identity_summary']) or 'Not yet verified'}",
            f"- Blocker: {_md_escape(packet['evidence_gap_reason'])}",
            "- Status: **DO NOT ADJUDICATE GOLD YET**",
            "",
        ])
    return "\n".join(lines).rstrip() + "\n"


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Generate fail-closed M1-B DEV human reviewer packets")
    parser.add_argument("--candidate-pool", required=True)
    parser.add_argument("--json-output", required=True)
    parser.add_argument("--markdown-output", required=True)
    args = parser.parse_args(argv)

    pool = json.loads(Path(args.candidate_pool).read_text(encoding="utf-8"))
    export = build_reviewer_export(pool)
    Path(args.json_output).write_text(json.dumps(export, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    Path(args.markdown_output).write_text(render_markdown(export), encoding="utf-8")
    print(json.dumps({
        "packet_count": export["packet_count"],
        "ready_count": export["ready_count"],
        "blocked_count": export["blocked_count"],
        "gold_status": export["gold_status"],
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
