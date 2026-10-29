#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

BASE = Path(__file__).parent
RETRIEVED_AT = "2026-09-19T23:47:00+05:30"

RECOVERED_EVIDENCE = {
    "catalog-28": {
        "source_kind": "TRUSTED_STRUCTURED_SOURCE",
        "source_url": "https://mosaique.skin/products/biotique-sun-shield-sandalwood-50-spf-sunscreen-lotion-120-ml",
        "ingredient_declaration_text": (
            "Safed Chandan (Santalum album), Ashwagandha (Withania somnifera), Nag kesar (Mesua ferrea), "
            "Ankurit Gehun (Triticum vulgare), Madhu (Honey), Arjun (Terminalia arjuna), "
            "Rakt Chandan (Pterocarpus santalinus), Lodhra (Symplocos racemosa), Mom (Bees wax), "
            "Sunflower oil, Himalayan Water Q.S"
        ),
        "provenance_note": (
            "Exact 120 ml identity is independently confirmed by the official Biotique product page. "
            "The longer declaration is preserved from an exact-pack structured product page and remains subject to human completeness judgment."
        ),
    },
    "discovery-484": {
        "source_kind": "TRUSTED_STRUCTURED_SOURCE",
        "source_url": "https://nutristar.in/products/himalayan-organics-immunity-multivitamin-with-probiotics-40-nutrients-180-veg-tablets",
        "ingredient_declaration_text": (
            "Vigor & Vitality Blend (Ginseng extract, Ginkgo Biloba Extract, Moringa, Amla, Neem, Aloe vera, Giloy, Tribulus Terrestris), "
            "Essential Mineral Blend (Zinc, Iron, Manganese, Copper, iodine, Boron, Chromium, Molybdenum), "
            "Prebiotic & Probiotic Blend (Lactic Acid Bacillus, Fructooligosaccharides), "
            "Skin & Hair Care Blend (Vitamin C, Vitamin E, Biotin), "
            "Bone & Joint Blend (Magnesium, Calcium, Phosphorus, Cissus Quadrangularius, Alfalfa, Vitamin K2, Vitamin D), "
            "Essential Vitamin Blend (Vitamin B1, Vitamin B2, Vitamin B3, Vitamin B5, Vitamin B6, Vitamin B12, Vitamin A, Folic Acid), "
            "Super Antioxidant Blend (Grapeseed extract, Lutein, Lycopene, Selenium)"
        ),
        "provenance_note": (
            "Exact 180-tablet product identity is already bound to the verified SKU/barcode in the DEV ledger. "
            "This structured ingredients declaration is review support only."
        ),
    },
    "seed-bf2fd651-ef6b-4263-b87f-8b7f47168299": {
        "source_kind": "TRUSTED_STRUCTURED_SOURCE",
        "source_url": "https://www.clickoncare.com/products/prohance-d-vanilla-400g",
        "ingredient_declaration_text": (
            "Maltodextrin, Sunflower seed oil (High oleic acid), Calcium caseinate, Whey protein isolate, "
            "Soy protein isolate, Isomaltulose (6.1%), Fructose, Rapeseed oil (low erucic acid), "
            "Fructo-oligosaccharides, Gum arabic, Minerals, Inulin, Sunflower seed oil, "
            "Antioxidants (Soya lecithin, L-Ascorbic acid, TBHQ), Myo-inositol, Choline bitartrate, "
            "Vitamins, L-Carnitine, Taurine, Acidity regulator (Citric acid)"
        ),
        "provenance_note": (
            "Current source explicitly identifies Prohance-D Vanilla 400 g and India manufacture. "
            "The previously quarantined Vanilla-labelled declaration containing cocoa is retained as rejected conflict history."
        ),
    },
}


def _load_base_module():
    path = BASE / "dev_evidence.py"
    spec = importlib.util.spec_from_file_location("m1b_dev_evidence_base", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def build_dev_evidence_manifest(candidate_pool: dict) -> dict:
    manifest = _load_base_module().build_dev_evidence_manifest(candidate_pool)
    by_id = {row["candidate_id"]: row for row in manifest["candidates"]}

    for candidate_id, recovered in RECOVERED_EVIDENCE.items():
        row = by_id[candidate_id]
        assert row["identity"].get("identity_status") == "VERIFIED", candidate_id
        row["evidence"].append({
            "source_kind": recovered["source_kind"],
            "source_url": recovered["source_url"],
            "market_country_code": "IN",
            "exact_pack_match": True,
            "evidence_scope": "FULL_DECLARATION",
            "ingredient_declaration_text": recovered["ingredient_declaration_text"],
            "retrieved_at": RETRIEVED_AT,
            "provenance_note": recovered["provenance_note"],
        })
        row["evidence_gap_reason"] = ""

    manifest["schema_version"] = "1.2.0"
    manifest["generated_at"] = RETRIEVED_AT
    manifest["methodology"] += (
        " Recovery batch v1.2 adds three exact-identity structured declarations for human adjudication only; "
        "it does not assign gold, does not suppress rejected/conflicting evidence, and does not alter scoring or production flags."
    )
    return manifest


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Generate DEV evidence ledger with bounded recovery batch v1.2")
    parser.add_argument("--candidate-pool", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args(argv)
    pool = json.loads(Path(args.candidate_pool).read_text(encoding="utf-8"))
    manifest = build_dev_evidence_manifest(pool)
    Path(args.output).write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({
        "candidate_count": manifest["candidate_count"],
        "recovery_count": len(RECOVERED_EVIDENCE),
        "gold_status": manifest["gold_status"],
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
