#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from pathlib import Path
from typing import Any

AUTHORITATIVE_SOURCE_KINDS = {
    "OFFICIAL_MANUFACTURER",
    "OFFICIAL_BRAND",
    "OFFICIAL_REGULATORY_LABEL",
    "OFFICIAL_MARKETER",
    "OFFICIAL_FIRST_PARTY_RETAIL",
}
TRUSTED_STRUCTURED_SOURCE_KINDS = {"TRUSTED_STRUCTURED_SOURCE"}
FULL_DECLARATION_SCOPE = "FULL_DECLARATION"
RECONCILED_PACK_FORMULA_BINDING = "RECONCILED_EXACT_IDENTITY_PLUS_PRODUCT_FORMULA"


def _norm(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value or ""))
    text = re.sub(r"\s+", " ", text).strip().casefold()
    return text


def _sha256_text(value: str) -> str:
    canonical = unicodedata.normalize("NFKC", value or "").replace("\r\n", "\n").strip()
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _distinct_urls(values: Any) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values if isinstance(values, list) else []:
        url = str(value or "").strip()
        if url and url not in seen:
            seen.add(url)
            result.append(url)
    return result


def build_product_fingerprint(identity: dict) -> str:
    if identity.get("identity_status") != "VERIFIED":
        raise ValueError("identity must be VERIFIED before fingerprint assignment")
    required = ("brand_name", "product_name", "pack_size", "market_country_code")
    missing = [key for key in required if not _norm(identity.get(key))]
    if missing:
        raise ValueError(f"missing exact identity fields: {', '.join(missing)}")
    parts = [
        "brand=" + _norm(identity.get("brand_name")),
        "product=" + _norm(identity.get("product_name")),
        "variant=" + _norm(identity.get("variant_name")),
        "pack=" + _norm(identity.get("pack_size")),
        "market=" + _norm(identity.get("market_country_code")).upper(),
    ]
    digest = hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()
    return f"spfp:v1:{digest}"


def _split_ingredients(text: str) -> list[str]:
    value = unicodedata.normalize("NFKC", text or "").strip()
    if not value:
        return []
    result: list[str] = []
    token: list[str] = []
    depth = 0
    for ch in value:
        if ch in "([{" :
            depth += 1
        elif ch in ")]}" and depth:
            depth -= 1
        if ch in ",;" and depth == 0:
            item = "".join(token).strip(" .")
            if item:
                result.append(item)
            token = []
        else:
            token.append(ch)
    item = "".join(token).strip(" .")
    if item:
        result.append(item)
    return result


def _prepare_evidence(evidence: list[dict], market_country_code: str) -> tuple[list[dict], bool]:
    prepared: list[dict] = []
    binding_eligible_full = False
    target_market = _norm(market_country_code).upper()
    for raw in evidence or []:
        declaration = str(raw.get("ingredient_declaration_text") or "").strip()
        source_kind = str(raw.get("source_kind") or "").strip().upper()
        source_market = _norm(raw.get("market_country_code")).upper()
        evidence_scope = str(raw.get("evidence_scope") or "").strip().upper()
        exact_pack = raw.get("exact_pack_match") is True
        has_url = bool(str(raw.get("source_url") or "").strip())
        is_authoritative = source_kind in AUTHORITATIVE_SOURCE_KINDS
        is_trusted_structured = source_kind in TRUSTED_STRUCTURED_SOURCE_KINDS
        source_review_eligible = is_authoritative or is_trusted_structured
        market_match = source_market == target_market
        is_full_declaration = evidence_scope == FULL_DECLARATION_SCOPE

        binding_kind = str(raw.get("pack_binding_kind") or "").strip().upper()
        binding_urls = _distinct_urls(raw.get("pack_binding_source_urls"))
        reconciled_binding = (
            binding_kind == RECONCILED_PACK_FORMULA_BINDING
            and raw.get("pack_binding_verified") is True
            and len(binding_urls) >= 2
        )
        pack_binding_satisfied = exact_pack or reconciled_binding
        evidence_binding_eligible = bool(
            source_review_eligible
            and pack_binding_satisfied
            and market_match
            and has_url
            and declaration
            and is_full_declaration
        )

        record = dict(raw)
        record["source_kind"] = source_kind
        record["evidence_scope"] = evidence_scope
        record["authoritative"] = is_authoritative
        record["trusted_structured"] = is_trusted_structured
        record["review_eligible"] = source_review_eligible
        record["requires_human_authority_judgment"] = is_trusted_structured and not is_authoritative
        record["market_match"] = market_match
        record["full_declaration"] = is_full_declaration
        record["pack_binding_kind"] = binding_kind or None
        record["pack_binding_source_urls"] = binding_urls
        record["reconciled_pack_formula"] = reconciled_binding
        record["pack_binding_satisfied"] = pack_binding_satisfied
        record["evidence_binding_eligible"] = evidence_binding_eligible
        record["evidence_text_sha256"] = _sha256_text(declaration) if declaration else None
        record["image_sha256"] = raw.get("image_sha256") or None
        prepared.append(record)
        if evidence_binding_eligible:
            binding_eligible_full = True
    return prepared, binding_eligible_full


def prepare_reviewer_packet(candidate: dict, identity: dict | None, evidence: list[dict] | None) -> dict:
    identity = dict(identity or {})
    prepared_evidence, evidence_ready = _prepare_evidence(
        list(evidence or []), candidate.get("market_country_code") or identity.get("market_country_code") or ""
    )
    identity_ready = identity.get("identity_status") == "VERIFIED"
    fingerprint = None
    if identity_ready:
        try:
            fingerprint = build_product_fingerprint(identity)
        except ValueError:
            identity_ready = False

    ready = bool(identity_ready and evidence_ready and fingerprint)
    declarations = [
        str(item.get("ingredient_declaration_text") or "").strip()
        for item in prepared_evidence
        if item.get("evidence_binding_eligible")
        and str(item.get("ingredient_declaration_text") or "").strip()
    ]
    auto_ingredients = _split_ingredients(declarations[0]) if declarations else []
    trusted_review_used = any(
        item.get("trusted_structured") and item.get("evidence_binding_eligible")
        for item in prepared_evidence
    )
    reconciled_review_used = any(
        item.get("reconciled_pack_formula") and item.get("evidence_binding_eligible")
        for item in prepared_evidence
    )

    return {
        "candidate_id": candidate.get("candidate_id"),
        "split": "DEV",
        "benchmark_category": candidate.get("benchmark_category"),
        "candidate_product_name": candidate.get("product_name"),
        "candidate_brand_name": candidate.get("brand_name"),
        "market_country_code": candidate.get("market_country_code"),
        "identity": identity,
        "product_fingerprint": fingerprint,
        "curation_status": "READY_FOR_HUMAN_ADJUDICATION" if ready else "EVIDENCE_INCOMPLETE",
        "gold_status": "UNASSIGNED",
        "gold_ingredients": None,
        "review_decision": None,
        "human_adjudication_required": True,
        "trusted_structured_evidence_requires_human_authority_judgment": trusted_review_used,
        "reconciled_pack_formula_requires_human_judgment": reconciled_review_used,
        "auto_extracted_ingredients": auto_ingredients,
        "evidence": prepared_evidence,
        "rejected_evidence": [],
        "evidence_gap_reason": "",
        "discovery_source_is_gold": False,
        "review_instructions": (
            "Verify exact product/variant/pack/India-market identity and compare the complete ingredient declaration "
            "against preserved evidence. Official evidence is authoritative-source evidence; trusted structured evidence "
            "is review support only and requires explicit human judgment before gold approval. Reconciled pack/formula "
            "evidence separately proves exact pack identity and product formula and also requires explicit human judgment. "
            "Rejected or conflicting evidence is context only and must never be used to assign gold. Approve, correct, "
            "or reject the declaration. Do not infer missing ingredients."
        ),
    }


def prepare_manifest(candidate_pool: dict, evidence_input: dict) -> dict:
    candidates = candidate_pool.get("candidates") or []
    supplied = {
        item.get("candidate_id"): item
        for item in (evidence_input.get("candidates") or [])
        if item.get("candidate_id")
    }
    packets = []
    for candidate in candidates:
        item = supplied.get(candidate.get("candidate_id"), {})
        packet = prepare_reviewer_packet(candidate, item.get("identity"), item.get("evidence"))
        packet["evidence_gap_reason"] = str(item.get("evidence_gap_reason") or "")
        packet["rejected_evidence"] = list(item.get("rejected_evidence") or [])
        packets.append(packet)
    ready = sum(1 for p in packets if p["curation_status"] == "READY_FOR_HUMAN_ADJUDICATION")
    return {
        "schema_version": "1.0.0",
        "split": "DEV",
        "candidate_count": len(candidates),
        "packet_count": len(packets),
        "ready_for_human_adjudication_count": ready,
        "evidence_incomplete_count": len(packets) - ready,
        "rejected_evidence_count": sum(len(p.get("rejected_evidence") or []) for p in packets),
        "gold_status": "UNASSIGNED",
        "human_adjudication_required": True,
        "packets": packets,
    }


def load_json(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Prepare fail-closed M1-B DEV human-adjudication packets")
    parser.add_argument("--candidate-pool", required=True)
    parser.add_argument("--evidence", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args(argv)
    manifest = prepare_manifest(load_json(args.candidate_pool), load_json(args.evidence))
    Path(args.output).write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({
        "packet_count": manifest["packet_count"],
        "ready_for_human_adjudication_count": manifest["ready_for_human_adjudication_count"],
        "evidence_incomplete_count": manifest["evidence_incomplete_count"],
        "rejected_evidence_count": manifest["rejected_evidence_count"],
        "gold_status": manifest["gold_status"],
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
