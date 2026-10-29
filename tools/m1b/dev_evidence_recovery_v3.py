#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

BASE = Path(__file__).parent
RETRIEVED_AT = "2026-09-20T00:03:00+05:30"
RECONCILED_BINDING = "RECONCILED_EXACT_IDENTITY_PLUS_PRODUCT_FORMULA"

LAKME_IDENTITY_URL = "https://pharmeasy.in/health-care/products/lakme-sun-expert-spf-50-ultra-matte-lotion---50-ml-500080"
LAKME_FORMULA_URL = "https://cureskin.com/indianskincaredecoder/p/nykaa-lakme-sun-expert-spf-50-pa-ultra-matte-lotion-sunscreen"
LAKME_FORMULA = (
    "Water, Cyclopentasiloxane, Glycerin, Ethylhexyl Methoxycinnamate, Zinc Oxide, Phenylbenzimidazole Sulfonic Acid, "
    "Dimethicone Crosspolymer, Potassium Chloride, PEG-10 Dimethicone, Caprylic/Capric Triglyceride, Niacinamide, "
    "Fragrance, Benzyl Alcohol, Sodium Hydroxide, Magnesium Sulfate, Titanium Dioxide, Disteardimonium Hectorite, "
    "Sucrose Distearate, Allantoin, Tocopheryl Acetate, Benzoic Acid, Disodium EDTA, PEG-4 Laurate, PEG-4 Dilaurate, "
    "Sorbic Acid, PEG-4, Iodopropynyl Butylcarbamate, BHT, Aluminum Hydroxide, Dimethicone, Cucumis Sativus Juice, "
    "Cymbopogon Citratus Extract, Propylene Glycol, Gluconolactone, Sodium Benzoate, Potassium Sorbate, Phenethyl Alcohol, "
    "Caprylyl Glycol, Calcium Gluconate, Alpha-Isomethyl Ionone, Benzyl Benzoate, Benzyl Salicylate, Citronellol, "
    "Geraniol, Hexyl Cinnamal, Limonene, Linalool"
)


def _load_v2():
    path = BASE / "dev_evidence_recovery_v2.py"
    spec = importlib.util.spec_from_file_location("m1b_dev_evidence_recovery_v2", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _append_unique(urls: list[str], value: str) -> list[str]:
    result = [url for url in urls if url]
    if value and value not in result:
        result.append(value)
    return result


def build_dev_evidence_manifest(candidate_pool: dict) -> dict:
    manifest = _load_v2().build_dev_evidence_manifest(candidate_pool)
    by_id = {row["candidate_id"]: row for row in manifest["candidates"]}

    # Lakme: retain the exact India 50 ml identity, and bind it to a current
    # India product-level full ingredient dataset for the same named SPF 50 PA+++
    # formulation. This is intentionally reviewer-only reconciliation, not gold.
    lakme = by_id["catalog-23"]
    assert lakme["identity"].get("identity_status") == "VERIFIED"
    assert lakme["identity"].get("pack_size") == "50 ml"
    lakme["identity"]["identity_source_urls"] = _append_unique(
        list(lakme["identity"].get("identity_source_urls") or []), LAKME_IDENTITY_URL
    )
    lakme["evidence"].append({
        "source_kind": "TRUSTED_STRUCTURED_SOURCE",
        "source_url": LAKME_FORMULA_URL,
        "market_country_code": "IN",
        "exact_pack_match": False,
        "evidence_scope": "FULL_DECLARATION",
        "ingredient_declaration_text": LAKME_FORMULA,
        "retrieved_at": RETRIEVED_AT,
        "pack_binding_kind": RECONCILED_BINDING,
        "pack_binding_verified": True,
        "pack_binding_source_urls": [LAKME_IDENTITY_URL, LAKME_FORMULA_URL],
        "provenance_note": (
            "PharmEasy pins the exact India 50 ml product. CureSkin identifies the same Lakme Sun Expert SPF 50 PA+++ "
            "product as an India/Nykaa listing and provides a 47-ingredient full breakdown. Human same-formula and "
            "current-pack judgment remains mandatory."
        ),
    })
    lakme["evidence_gap_reason"] = ""

    # Do not recover Himalaya Extra Moisturizing Baby Lotion here. The exact
    # India 400 ml identity is verified as SKU 7004789 / barcode 8901138849191,
    # but the complete 400 ml back-label/formula recovered during this pass was
    # a different non-India market SKU/GTIN. Preserve fail-closed status.
    himalaya = by_id["catalog-41"]
    assert himalaya["identity"].get("sku") == "7004789"
    himalaya["evidence_gap_reason"] = (
        "Exact India 400 ml SKU 7004789 / barcode 8901138849191 verified; official India page exposes only key botanicals. "
        "A complete 400 ml formula found in another market was not accepted because market/GTIN equivalence is unproven."
    )

    manifest["schema_version"] = "1.4.0"
    manifest["generated_at"] = RETRIEVED_AT
    manifest["methodology"] += (
        " Recovery batch v1.4 adds Lakme 50 ml as reconciled India product-formula evidence for human review only. "
        "Himalaya India 400 ml remains blocked because the available full declaration was cross-market and not proven equivalent."
    )
    return manifest


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Generate DEV evidence ledger with bounded recovery batch v1.4")
    parser.add_argument("--candidate-pool", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args(argv)
    pool = json.loads(Path(args.candidate_pool).read_text(encoding="utf-8"))
    manifest = build_dev_evidence_manifest(pool)
    Path(args.output).write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"candidate_count": manifest["candidate_count"], "gold_status": manifest["gold_status"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
