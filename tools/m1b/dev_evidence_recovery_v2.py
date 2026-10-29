#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

BASE = Path(__file__).parent
RETRIEVED_AT = "2026-09-19T23:58:00+05:30"
RECONCILED_BINDING = "RECONCILED_EXACT_IDENTITY_PLUS_PRODUCT_FORMULA"

WILD_NYKAA_URL = "https://www.nykaaman.com/wild-stone-ultra-sensual-after-shave-lotion/p/138370"
WILD_OFFICIAL_FORMULA_URL = "https://www.wildstone.in/products/wild-stone-ultra-sensual-after-shave-lotion-for-men-pack-of-2-100ml-each"
WILD_FORMULA = (
    "Ethyl Alcohol (95% v/v); Content: 65% w/w with 1% w/w Diethyl Phthalate, Aqua, Perfume, "
    "PEG-40 Hydrogenated Castor Oil, Propylene Glycol, Menthol"
)

ENSURE_400_URL = "https://sastasundar.com/order-otc/ensure-diabetes-care-vanilla-delight-powder-jar-400-g"
ENSURE_400_FORMULA = (
    "Maltodextrin, Calcium Caseinate, Edible Vegetable Oil (High Oleic Sunflower Oil, Soy Oil), "
    "Fructose, Minerals, Fructo-oligosaccharides (4.12%), Soy Polysaccharide, Flavoring Substances, "
    "Myo-Inositol, Vitamins, Antioxidants (Soy Lecithin, Mixed Tocopherols), Taurine, L-Carnitine, Sucralose"
)

BOTNIK_200_URL = "https://www.desertcart.in/products/81107579-botnik-essentials-5-in-1-after-shave-lotion-for-men-200-ml"


def _load_v1():
    path = BASE / "dev_evidence_recovery.py"
    spec = importlib.util.spec_from_file_location("m1b_dev_evidence_recovery_v1", path)
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
    manifest = _load_v1().build_dev_evidence_manifest(candidate_pool)
    by_id = {row["candidate_id"]: row for row in manifest["candidates"]}

    # Wild Stone: the original Google Shopping candidate repeatedly resolves to the
    # 100 ml Nykaa item. The official manufacturer publishes the same 100 ml unit's
    # formula as a 2 x 100 ml bundle, so bind exact single-pack identity + official
    # same-unit formula as review-only reconciled evidence.
    wild = by_id["discovery-99"]
    prior_wild_urls = list((wild.get("identity") or {}).get("identity_source_urls") or [])
    wild["identity"] = {
        "identity_status": "VERIFIED",
        "market_country_code": "IN",
        "brand_name": "Wild Stone",
        "product_name": "Ultra Sensual After Shave Lotion",
        "variant_name": "Ultra Sensual",
        "pack_size": "100 ml",
        "identity_source_urls": _append_unique(prior_wild_urls, WILD_NYKAA_URL),
    }
    wild["evidence"].append({
        "source_kind": "OFFICIAL_BRAND",
        "source_url": WILD_OFFICIAL_FORMULA_URL,
        "market_country_code": "IN",
        "exact_pack_match": False,
        "evidence_scope": "FULL_DECLARATION",
        "ingredient_declaration_text": WILD_FORMULA,
        "retrieved_at": RETRIEVED_AT,
        "pack_binding_kind": RECONCILED_BINDING,
        "pack_binding_verified": True,
        "pack_binding_source_urls": [WILD_NYKAA_URL, WILD_OFFICIAL_FORMULA_URL],
        "provenance_note": (
            "Exact 100 ml candidate identity is bound to the candidate-linked Nykaa SKU; the official Wild Stone page "
            "publishes the formulation for the same 100 ml unit in a 2 x 100 ml bundle. Human same-formula judgment remains mandatory."
        ),
    })
    wild["evidence_gap_reason"] = ""

    # Ensure Diabetes Care: preserve the already-verified Vanilla 400 g identity and
    # add an exact-pack structured declaration. This is reviewer evidence only and
    # cannot become benchmark gold without human approval.
    ensure = by_id["seed-32bbcd5d-41e1-4b71-8a55-57b5d38a6f0a"]
    assert ensure["identity"].get("identity_status") == "VERIFIED"
    assert ensure["identity"].get("pack_size") == "400 g"
    ensure["identity"]["identity_source_urls"] = _append_unique(
        list(ensure["identity"].get("identity_source_urls") or []), ENSURE_400_URL
    )
    ensure["evidence"].append({
        "source_kind": "TRUSTED_STRUCTURED_SOURCE",
        "source_url": ENSURE_400_URL,
        "market_country_code": "IN",
        "exact_pack_match": True,
        "evidence_scope": "FULL_DECLARATION",
        "ingredient_declaration_text": ENSURE_400_FORMULA,
        "retrieved_at": RETRIEVED_AT,
        "provenance_note": (
            "Exact Vanilla 400 g structured declaration. It remains subject to human completeness and legacy-formula confirmation."
        ),
    })
    ensure["evidence_gap_reason"] = ""

    # Botnik: exact 200 ml market identity can be pinned, but only hero ingredients
    # are presently available. Do not manufacture a full declaration and do not make
    # the packet reviewer-ready yet.
    botnik = by_id["discovery-101"]
    prior_botnik_urls = list((botnik.get("identity") or {}).get("identity_source_urls") or [])
    botnik["identity"] = {
        "identity_status": "VERIFIED",
        "market_country_code": "IN",
        "brand_name": "Botnik Essentials",
        "product_name": "5 in 1 After Shave Lotion",
        "variant_name": "5 in 1",
        "pack_size": "200 ml",
        "identity_source_urls": _append_unique(prior_botnik_urls, BOTNIK_200_URL),
    }
    botnik["evidence_gap_reason"] = (
        "Exact 200 ml India-market identity verified; review-eligible FULL_DECLARATION remains unresolved. "
        "Available aloe vera/neem/tea tree/witch hazel/menthol references are key-ingredient summaries only."
    )

    manifest["schema_version"] = "1.3.0"
    manifest["generated_at"] = RETRIEVED_AT
    manifest["methodology"] += (
        " Recovery batch v1.3 verifies Wild Stone 100 ml and Botnik 200 ml identities, binds Wild Stone's exact unit "
        "to the official same-unit formula for human review, and adds exact 400 g Ensure structured evidence. "
        "No gold is assigned and Botnik remains blocked without a full declaration."
    )
    return manifest


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Generate DEV evidence ledger with bounded recovery batch v1.3")
    parser.add_argument("--candidate-pool", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args(argv)
    pool = json.loads(Path(args.candidate_pool).read_text(encoding="utf-8"))
    manifest = build_dev_evidence_manifest(pool)
    Path(args.output).write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({
        "candidate_count": manifest["candidate_count"],
        "gold_status": manifest["gold_status"],
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
