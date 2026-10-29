#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

RETRIEVED_AT = "2026-09-19T22:35:00+05:30"
GOVERNMENT_DIABETES_TEST = "https://consumeraffairs.nic.in/sites/default/files/file-uploads/ctocpas/Diabetes_Care_Nutritional_Food.pdf"
RECONCILED_BINDING = "RECONCILED_EXACT_IDENTITY_PLUS_PRODUCT_FORMULA"
HEALTH_OK_FORMULA_URL = "https://www.apollopharmacy.in/otc/health-ok-vitamins-minerals-tablet-10-s-mankind-s"
HEALTH_OK_FORMULA = (
    "Taurine, Soya Protein Hydrolysate, Polyvinylpyrrolidone (INS 1201 & 1202), "
    "Microcrystalline Cellulose [INS 460(i)], Ascorbic Acid, Ginseng Extract, Ferrous Fumarate, "
    "Croscarmellose Sodium (INS 468), Sodium Starch Glycolate, Stearic Acid (INS 570), "
    "Hydroxypropyl Methylcellulose (INS 464), Vitamin E Acetate, Zinc Sulphate, Niacin, "
    "Light Magnesium Oxide, Colloidal Silicon Dioxide (INS 551), Vitamin A Acetate, "
    "Manganese Sulphate, Ergocalciferol, Vitamin B6, Cupric Sulphate, Vitamin B2, Vitamin B1, "
    "Calcium D-Pantothenate, Chromium Picolinate, Potassium Iodide, Folic Acid, Biotin, "
    "Sodium Selenate, Cyanocobalamin, Talc [INS 553(iii)], Sodium Carboxymethyl Cellulose (INS 466), "
    "Maltodextrin, Dextrose Monohydrate, Lecithin [INS 322(i)]"
)

VERIFIED_IDENTITIES = {
    "catalog-28": {"pack_size":"120 ml","product_name":"Sun Shield Sandalwood 50+ SPF Sunscreen Lotion","variant_name":"SPF 50+","source_url":"https://www.biotique.com/"},
    "catalog-23": {"pack_size":"50 ml","product_name":"Sun Expert SPF 50 Ultra Matte Lotion","variant_name":"SPF 50","source_url":"https://pharmeasy.in/health-care/products/lakme-sun-expert-spf-50-ultra-matte-lotion---50-ml-500080"},
    "catalog-15": {"pack_size":"50 g","product_name":"Marula Oil 5% Face Moisturizer","variant_name":"5% Marula Oil","source_url":"https://beminimalist.co/collections/skin/products/marula-05-moisturizer"},
    "catalog-13": {"pack_size":"50 ml","product_name":"Soft Daily UV SPF-15 Light Moisturising Cream","variant_name":"SPF 15","source_url":"https://www.1mg.com/otc/nivea-soft-daily-uv-light-moisturizing-cream-spf-15-otc1084985"},
    "catalog-29": {"pack_size":"50 ml","brand_name":"Foxtale","product_name":"Glow Sunscreen SPF 50 PA++++","variant_name":"FXN-ESDS50","source_url":"https://foxtale.in/products/glow-sunscreen?variant=FXN-ESDS50"},
    "catalog-32": {"pack_size":"100 ml","product_name":"Men Sensitive After Shave Lotion","variant_name":"Sensitive","source_url":"https://www.nivea.in/articles/engage/nivea-new-gst-price"},
    "catalog-30": {"pack_size":"50 ml","product_name":"Signature Denim After Shave Lotion","variant_name":"Denim","source_url":"https://www.apollopharmacy.in/hi/otc/axe-signature-denim-after-shave-lotion-50-ml"},
    "catalog-12": {"pack_size":"250 ml","brand_name":"Pears","product_name":"Pure & Gentle Shower Gel","variant_name":"Pure & Gentle","source_url":"https://www.zepto.com/buy-body-wash"},
    "catalog-41": {"pack_size":"400 ml","product_name":"Extra Moisturizing Baby Lotion","source_url":"https://himalayawellness.in/collections/baby-care-essentials/products/extra-moisturizing-baby-lotion","barcode":"8901138849191","sku":"7004789"},
    "catalog-40": {"pack_size":"400 ml","product_name":"Milky Soft Baby Lotion","source_url":"https://mothersparsh.com/products/daily-moisturizing-milky-soft-baby-lotion"},
    "catalog-39": {"pack_size":"200 ml","product_name":"Baby Milk & Rice Lotion","variant_name":"Milk + Rice","source_url":"https://www.amazon.in/Johnsons-Baby-Milk-Lotion-200ml/dp/B07F3KP7PT"},
    "discovery-182": {"pack_size":"100 ml","brand_name":"Aveeno Baby","product_name":"Baby Daily Moisturising Wash & Shampoo","variant_name":"Daily Moisturising","source_url":"https://www.1mg.com/otc/aveeno-baby-baby-daily-moisturising-wash-shampoo-otc1125029"},
    "discovery-179": {"pack_size":"100 ml","brand_name":"SBL","product_name":"BabyCare Shampoo","source_url":"https://sblglobal.com/product/sbl-babycare-shampoo-2812"},
    "3aac9a122c5577494825371ff997b015": {"pack_size":"60 tablets","brand_name":"Tata 1mg","product_name":"ZMA+ Vitamin B6 (Zinc + Magnesium) Tablet","source_url":"https://www.1mg.com/otc/zma-vitamin-b6-zinc-magnesium-tablet-muscle-relaxant-sleep-strength-supplement-by-tata-1mg-otc1078353"},
    "d3df314aa18a21a708da594ccb394f82": {"pack_size":"10 soft gelatin capsules","brand_name":"Akumentis Healthcare","product_name":"Pmsfine Soft Gelatin Capsule","source_url":"https://www.1mg.com/otc/pmsfine-soft-gelatin-capsule-otc343441"},
    "c09e18c29a26e0ddfd7b8beb2bcf758a": {"pack_size":"2 x 30 tablets","brand_name":"HealthOK","product_name":"Multi Vitamina & Minerals Tablets for Overall Health","source_url":"https://www.flipkart.com/mankind-multi-vitamina-minerals-tablets-overall-health-30-x-2/p/itmad235aca68874"},
    "aa300b5af1a059a78ce8f8d09b66bf07": {
        "pack_size":"60 soft gelatin capsules","brand_name":"Becadexamin","product_name":"Multivitamin & Multimineral Capsule",
        "source_urls":["https://www.1mg.com/otc/becadexamin-multivitamin-multimineral-capsule-otc1007499","https://india-pharma.gsk.com/media/2bcmvg5n/becadexamin.pdf"]
    },
    "f776b7f20887fbad00c27c33176a3b01": {"pack_size":"30 capsules","brand_name":"Maxirich","product_name":"Daily Multivitamin for Energy, Immunity & Performance","variant_name":"Bottle Pack","source_url":"https://www.1mg.com/otc/maxirich-daily-multivitamin-for-energy-immunity-performance-capsule-otc589553"},
    "discovery-484": {"pack_size":"180 veg tablets","brand_name":"Vlado's Himalayan Organics","product_name":"Immunity Multivitamin Tablet with Probiotics","source_url":"https://www.thehimalayanorganics.in/products/himalayan-organics-immunity-multivitamin-with-probiotics-180-veg-tablets-with-vitamin-c-d-k2-zinc-ginseng-giloy-biotin-for-men-women","barcode":"8906113262521","sku":"HO_Immunity_MultivitaminProbiotics"},
    "discovery-437": {"pack_size":"60 tablets","brand_name":"HK Vitals","product_name":"Multivitamin with Probiotics","variant_name":"Unflavoured","source_url":"https://www.hkvitals.com/products/multivitamin-probiotics"},
    "0053b1e8cd07a123b713f465cd5f7ea7": {"pack_size":"4 x 10 tablets","brand_name":"HealthOK","product_name":"Daily Multivitamin With Natural Ginseng for Energy & Overall Health","source_url":"https://www.flipkart.com/health-ok-daily-multivitamin-natural-ginseng-energy-overall-health-10-tabs-x-4/p/itm64e4594f1c373"},
    "79076ae2578ddc18043ad2ce296e0b5f": {
        "pack_size":"30 tablets","brand_name":"Revital","product_name":"Woman Complete Multivitamin with Natural Ginseng","variant_name":"Revital H Women",
        "source_url":"https://pharmeasy.in/health-care/products/revital-women-complete-multivitamin-with-natural-ginseng-30-tablets-25749"
    },
    "seed-1e675224-5b08-4786-9a31-a46a1d41d9e9": {
        "pack_size":"500 g","brand_name":"D-Protin","product_name":"Diabetes Care","variant_name":"Vanilla",
        "source_urls":[GOVERNMENT_DIABETES_TEST,"https://www.1mg.com/otc/d-protin-nutritional-supplement-for-diabetics-flavour-powder-vanilla-otc268052"]
    },
    "seed-32bbcd5d-41e1-4b71-8a55-57b5d38a6f0a": {
        "pack_size":"400 g","brand_name":"Abbott Ensure","product_name":"Ensure Diabetes Care","variant_name":"Vanilla",
        "source_urls":[GOVERNMENT_DIABETES_TEST,"https://www.apollopharmacy.in/otc/ensure-diabetes-care-vanilla-400gm"]
    },
    "seed-370e30a3-7eba-4ce6-8d99-59f7edcde926": {
        "pack_size":"400 g","brand_name":"PentaSure","product_name":"PentaSure DM Diabetes Care","variant_name":"Vanilla & Cinnamon",
        "source_urls":[GOVERNMENT_DIABETES_TEST,"https://www.apollopharmacy.in/otc/pentasure-dm-powder-400g"]
    },
    "seed-bf2fd651-ef6b-4263-b87f-8b7f47168299": {
        "pack_size":"400 g","brand_name":"Prohance","product_name":"Prohance-D Nutritional Supplement for Diabetes Care","variant_name":"Vanilla",
        "source_urls":[GOVERNMENT_DIABETES_TEST,"https://www.1mg.com/otc/prohance-d-nutritional-supplement-for-diabetes-care-flavour-vanilla-otc356838"]
    },
}

PENDING_SOURCE_OVERRIDES = {
    "discovery-99":"https://www.wildstone.in/products/wild-stone-ultra-sensual-after-shave-lotion-for-men-pack-of-2-50ml-each",
    "seed-c88260bb-e33e-44d2-aab7-e7923cb1fd7f":"https://himalayawellness.in/products/quista-dn",
}

FULL_EVIDENCE = {
    "catalog-15": (
        "OFFICIAL_BRAND",
        "https://beminimalist.co/collections/skin/products/marula-05-moisturizer",
        "Water/ Aqua, Glycerin, Sclerocarya Birrea (Marula) Seed Oil, Methypropanediol, Dicaprylyl Carbonate, Caprylic/Capric Triglyceride, Butylene Glycol, Cetostearyl Alcohol, Glyceryl Stearate, PEG-100 Stearate, Trehalose, Dimethicone, Saccharide Isomerate, Pentylene Glycol, Coco-Caprylate/Caprate, Triheptanoin, C9-12 Alkane, Sodium Hyaluronate, Allantoin, Linoleic Acid, Linolenic Acid, Carbomer, Cetyl Alcohol, Phenoxyethanol, Tocopheryl Acetate, Sodium Hydroxide, Nylon 12, Petrolatum, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Ethylhexylglycerin, Butyrospermum Parkii (Shea) Butter, Polyurethane-100, Trisodium Ethylenediamine Disuccinate, Citric Acid, Sodium Citrate",
    ),
    "catalog-29": (
        "OFFICIAL_BRAND",
        "https://foxtale.in/products/glow-sunscreen?variant=FXN-ESDS50",
        "Aqua, C12-15 Alkyl benzoate, Propylene glycol, Methylene Bis-Benzotriazolyl Tetramethylbutylphenol, Decyl Glucoside, Xanthan Gum, Diethylamino Hydroxybenzoyl Hexyl Benzoate, Cetearyl Olivate, Sorbitan Olivate, Ethylhexyl Triazone, Dimethicone, Niacinamide, Glyceryl monostearate, Phenoxyethanol, Ethylhexylglycerin, Octenidine HCl, Ethyl ascorbic acid, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Tocopherol, Aminomethyl propanol, Disodium EDTA, Simethicone, Allergen free fragrance",
    ),
    "catalog-40": (
        "OFFICIAL_BRAND",
        "https://mothersparsh.com/products/daily-moisturizing-milky-soft-baby-lotion",
        "Purified Water, Olive Oil, Glycerin, Shea Butter, Jojoba Oil, Cetomacrogol 1000, Beeswax, Glyceryl Monostearate, Sodium Gluconate, & Sodium Lactate, Sodium Benzoate, Carbomer, Potassium sorbate, Xanthan Gum, Perfume, Wheatgerm Oil, Disodium EDTA, Coconut Oil, Almond Oil, Vitamin E (Tocopherol acetate), Sodium Hydroxide, Milk Protein",
    ),
    "discovery-179": (
        "OFFICIAL_BRAND",
        "https://sblglobal.com/product/sbl-babycare-shampoo-2812",
        "Shikakai (Acacia Concinna) Liquid Extract, Tulsi (Ocimum Sanctum) Liquid Extract, Aqua, Surfactant Base, Sugandhit Dravya, Tween 20, Glucamate DOE-120, Glydant plus liquid, Polyquaternium-10-Q.S",
    ),
    "3aac9a122c5577494825371ff997b015": (
        "OFFICIAL_FIRST_PARTY_RETAIL",
        "https://www.1mg.com/otc/zma-vitamin-b6-zinc-magnesium-tablet-muscle-relaxant-sleep-strength-supplement-by-tata-1mg-otc1078353",
        "Magnesium (Magnesium oxide, Magnesium aspartate) 440 mg, Zinc [Zinc citrate] 17 mg, Vitamin B6 [Pyridoxine hydrochloride] 2.4 mg, Disintegrant [INS 468], Diluent [Maize starch & INS 460 (i)], Disintegrant [Sodium starch glycolate], Anti-Sticking agent [INS 470 (iii)], Natural colour [INS 171], Artificial colour [INS 102 & INS 132], Coating agent [INS 464 & INS 462], Glidant [INS 553 (iii)], Stabilizer [INS 1202], Anti-Caking agent [INS 551]",
    ),
    "d3df314aa18a21a708da594ccb394f82": (
        "TRUSTED_STRUCTURED_SOURCE",
        "https://www.1mg.com/otc/pmsfine-soft-gelatin-capsule-otc343441",
        "Borage Oil 500 mg, Magnesium Oxide Equivalent to Elemental Magnesium 100 mg, Pyridoxal-5-Phosphate 10 mg, Gelatin (INS 428) - Animal origin (Capsule shell), Glycerin (INS 422), Sorbitol (INS 420 (i)), Edible Oil (INS 479), Beeswax (INS 901), Antioxidants (INS 320 & INS 321), Preservatives (INS 217 & INS 219), Permitted Synthetic Food Colours (INS 150 A, INS 124, INS 110, INS 133), Ethyl Vanillin (Added Flavour)",
    ),
    "discovery-182": (
        "TRUSTED_STRUCTURED_SOURCE",
        "https://www.1mg.com/otc/aveeno-baby-baby-daily-moisturising-wash-shampoo-otc1125029",
        "Water, Cocamidopropyl Betaine, Sodium Lauroamphoacetate, Glycerin, Coco-Glucoside, Citric Acid, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Sodium Benzoate, Glyceryl Oleate, Fragrance, Sodium Hydroxide, Polyquaternium-10, Guar Hydroxypropyltrimonium Chloride, Avena Sativa (Oat) Kernel Extract",
    ),
    "catalog-32": (
        "TRUSTED_STRUCTURED_SOURCE",
        "https://www.myntra.com/after-shave-lotion-and-balm/nivea/nivea-men-sensitive-after-shave-lotion/125286/buy",
        "Aqua, Dipropylene Glycol, Glycerin, PEG-40 Hydrogenated Castor Oil, Panthenol, Tocopheryl Acetate, Chamomilla Recutita Flower Extract, Hamamelis Virginiana Bark/Leaf Extract, Maltodextrin, Caprylic/Capric Triglyceride, Benzophenone-4, Phenoxyethanol, 1,2-Hexanediol, Trisodium EDTA, Geraniol, Linalool, Limonene, Parfum",
    ),
    "catalog-30": (
        "TRUSTED_STRUCTURED_SOURCE",
        "https://www.apollopharmacy.in/otc/axe-signature-denim-after-shave-lotion-50-ml",
        "Ethyl Alcohol, Water, Perfume, Glycerin, Ethyl Hexyl Methoxycinnamate, Butyl Methoxydibenzoylmethane, Ethyl Hexyl Salicylate, Polyoxyethylene (40) Hydrogenated Castor Oil, CI 15510, CI 47005, Denatonium Benzoate",
    ),
    "catalog-39": (
        "TRUSTED_STRUCTURED_SOURCE",
        "https://www.apollopharmacy.in/otc/johnson-s-baby-milk-lotion-200ml",
        "Water, Mineral Oil, Glycerin, C12-15 Alkyl Benzoate, Cetyl Alcohol, Dimethicone, Glyceryl Stearate, PEG-100 Stearate, Potassium Cetyl Phosphate, Phenoxyethanol, Ethylhexyl Glycerine, Stearoxytrimethylsilane, Stearyl Alcohol, Fragrance, Acrylates/C10-30 Alkyl Acrylate Cross Polymer, Sodium Hydroxide, Carbomer, Milk Protein, Disodium EDTA, Panthenol, Sodium Ascorbyl Phosphate, Tocopheryl Acetate, Hydrolyzed Rice Bran Protein, Copper Gluconate, Magnesium Aspartate, Zinc Gluconate",
    ),
    "catalog-12": (
        "TRUSTED_STRUCTURED_SOURCE",
        "https://www.truemeds.in/otc/pears-pure-gentle-body-wash-250-ml-tm-bow1-000132",
        "Aqua, Sodium Laureth Sulfate, Sodium Chloride, Cocamide MEA, Parfum, Sodium Benzoate, Citric Acid, Glycerin, Benzophenone-4, Tetrasodium EDTA, PPG-9, Citrus Medica Limonum Extract, Propylene Glycol, Sorbitol, Ethoxydiglycol, Hamamelis Virginiana Water, PEG-35 Castor Oil, Chamomilla Recutita Flower Extract, Sambucus Nigra Flower Extract, Thymus Vulgaris Flower/Leaf Extract, Valeriana Officinalis Rhizome/Root Extract, Humulus Lupulus Extract, Glucose, Sodium Sulfate, Lactic Acid, Potassium Sorbate, Aesculus Hippocastanum Seed Extract, Lavandula Angustifolia Oil, Rosmarinus Officinalis Leaf Extract, Salvia Officinalis Leaf Extract, Foeniculum Vulgare Oil, Alcohol Denat., Caramel, Geraniol, Hexyl Cinnamal, Limonene, Linalool, CI 19140, CI 42090",
    ),
    "discovery-437": (
        "TRUSTED_STRUCTURED_SOURCE",
        "https://www.1mg.com/otc/hk-vitals-multivitamin-with-probiotics-for-energy-immunity-gut-health-tablet-otc659880",
        "Vitamin A, Vitamin B1, Vitamin B2, Vitamin B3, Vitamin B5, Vitamin B6, Biotin, Vitamin B9, Vitamin B12, Vitamin C, Vitamin D2, Vitamin E, Vitamin K1, Zinc, Calcium, Magnesium, Iron, Manganese, Copper, Iodine, Chromium, Molybdenum, Selenium, Boron, Panax Ginseng Root Extract, Ginkgo Biloba Leaf Extract, Grape Seed Extract, Hadjod Extract, Lactobacillus Rhamnosus, Fructo-oligosaccharides, Alfalfa Extract, Lutein, Lycopene, Maize Starch, Sodium Starch Glycolate, INS 553(iii), INS 468, INS 464, INS 462, INS 460(i), INS 1201, INS 470(iii), Methyl Paraben Sodium, INS 172(ii), Propyl Paraben Sodium",
    ),
    "79076ae2578ddc18043ad2ce296e0b5f": (
        "TRUSTED_STRUCTURED_SOURCE",
        "https://www.1mg.com/otc/revital-women-tablet-with-multivitamins-calcium-zinc-natural-ginseng-for-daily-immunity-strong-bones-energy-otc325631",
        "Panax Ginseng Root Extract, Calcium, Phosphorus, Magnesium, Vitamin C, Iron, Zinc, Vitamin B3, Vitamin E, Manganese, Copper, Vitamin B6, Vitamin B2, Vitamin B1, Iodine, Folic Acid, Vitamin A, Vitamin D2, Selenium, Chromium, Vitamin K1, Biotin, Vitamin B12, INS 460(i), INS 466, INS 1203, INS 1201, INS 470(iii), INS 553(iii), INS 171, INS 124, INS 1521, INS 433, INS 322(i), INS 415",
    ),
    "seed-370e30a3-7eba-4ce6-8d99-59f7edcde926": (
        "TRUSTED_STRUCTURED_SOURCE",
        "https://sastasundar.com/order-otc/pentasure-dm-diabetes-care-creamy-vanilla-cinnamon-flavour-powder-400-g-2yt8c5",
        "Skimmed Milk Powder, Encapsulated Groundnut Oil, Encapsulated High Oleic Sunflower Oil, Soy Protein Isolate, Whey Protein Concentrate, Fructooligosaccharide, Inulin, Oat Fiber, Gum Acacia, Isomalt, Isomaltulose, Calcium Caseinate, Polydextrose, Maize Starch, Minerals, Creamy Vanilla Flavour, Resistant Maltodextrin, Inositol, Vitamins, L-Carnitine, L-Taurine, Alpha Lipoic Acid, INS 415, Sucralose",
    ),
    "seed-1e675224-5b08-4786-9a31-a46a1d41d9e9": (
        "TRUSTED_STRUCTURED_SOURCE",
        "https://www.1mg.com/otc/d-protin-nutritional-supplement-for-diabetics-flavour-powder-vanilla-otc268052",
        "L-Lysine, L-Arginine, L-Glutamine, Vitamin A, Vitamin C, Vitamin B1, Vitamin B2, Vitamin B6, Vitamin B12, Niacinamide, Biotin, Calcium D-Pantothenate, Vitamin E, Vitamin D, Vitamin K, Folic Acid, Choline, Calcium, Magnesium, Copper, Iron, Zinc, Manganese, Potassium, Phosphorus, Sodium, Chromium, Iodine, Selenium, Molybdenum, Chloride, Skimmed Milk Powder, Maltodextrin, Soy Protein Isolate, Inulin, Oleic Sunflower Oil Powder, Nature Identical Vanilla Flavour, Evening Primrose Oil Powder, Minerals, DHA Rich Algal Oil Powder, Vitamins, Sucralose",
    ),
    "f776b7f20887fbad00c27c33176a3b01": (
        "TRUSTED_STRUCTURED_SOURCE",
        "https://www.1mg.com/otc/maxirich-daily-multivitamin-softgel-for-energy-immunity-performance-otc592631",
        "Vitamin C, Nicotinamide, Vitamin E, Vitamin B1, Vitamin B2, Pantothenic Acid, Vitamin B6, Vitamin A, Folic Acid, Vitamin D3, Vitamin B12, Calcium, Phosphorous, Magnesium, Potassium, Manganese, Zinc, Copper, Iodine, Molybdenum, Lecithin, Soya Oil, Gelatin, INS 422, INS 901, INS 150d, INS 218, Purified Water",
    ),
}

RECONCILED_EVIDENCE = {
    "catalog-13": {
        "source_kind":"OFFICIAL_BRAND",
        "source_url":"https://www.nivea.in/products/nivea-soft-daily-uv-spf-15-light-moisturising-cream-424672500213.html",
        "ingredient_declaration_text":"Aqua, Ethylhexyl Salicylate, Glycerin, Cetearyl Alcohol, C12-15 Alkyl Benzoate, Glyceryl Stearate, Glyceryl Stearate Citrate, Butyl Methoxydibenzoylmethane, Caprylic/Capric Triglyceride, Isopropyl Palmitate, Phenylbenzimidazole Sulfonic Acid, Butyrospermum Parkii Butter, Simmondsia Chinensis Seed Oil, Tocopheryl Acetate, Hydrogenated Coco-Glycerides, Isopropyl Myristate, Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine, Hydroxypropyl Starch Phosphate, Sodium Hydroxide, Ethylhexylglycerin, Hydroxyacetophenone, Phenoxyethanol, Trisodium EDTA, Perfume",
        "binding_urls":["https://www.1mg.com/otc/nivea-soft-daily-uv-light-moisturizing-cream-spf-15-otc1084985","https://www.nivea.in/products/nivea-soft-daily-uv-spf-15-light-moisturising-cream-424672500213.html"],
    },
    "aa300b5af1a059a78ce8f8d09b66bf07": {
        "source_kind":"OFFICIAL_MARKETER",
        "source_url":"https://india-pharma.gsk.com/media/2bcmvg5n/becadexamin.pdf",
        "ingredient_declaration_text":"Vitamin A (as Vitamin A Concentrate Oil IP) 5000 IU, Vitamin D3 (Cholecalciferol IP) 400 IU, Vitamin E (Tocopheryl Acetate IP) 15 mg, Vitamin B1 IP 5 mg, Vitamin B2 IP 5 mg, Nicotinamide IP 45 mg, D-Panthenol IP 5 mg, Vitamin B6 IP 2 mg, Vitamin C IP 75 mg, Folic Acid IP 1000 mcg, Vitamin B12 IP 5 mcg, Dibasic Calcium Phosphate IP 70 mg, Copper Sulphate Pentahydrate IP 0.1 mg, Manganese Sulfate Monohydrate BP 0.01 mg, Zinc Sulphate Monohydrate IP 28.7 mg (equivalent to 10.4 mg elemental Zinc), Potassium Iodide IP 0.025 mg, Light Magnesium Oxide IP 0.15 mg, Lecithin Soyabean, Partially Hydrogenated Vegetable Oil, Yellow Beeswax, Arachis oil, Gelatin, Glycerin, Purified water, Ethyl Vanillin, Methyl Hydroxybenzoate, Ethyl Hydroxybenzoate, Propyl Hydroxybenzoate, Sunset Yellow FCF, Brilliant Blue FCF, Erythrosine, Ponceau 4R, Titanium Dioxide",
        "binding_urls":["https://www.1mg.com/otc/becadexamin-multivitamin-multimineral-capsule-otc1007499","https://india-pharma.gsk.com/media/2bcmvg5n/becadexamin.pdf"],
    },
    "c09e18c29a26e0ddfd7b8beb2bcf758a": {
        "source_kind":"TRUSTED_STRUCTURED_SOURCE",
        "source_url":HEALTH_OK_FORMULA_URL,
        "ingredient_declaration_text":HEALTH_OK_FORMULA,
        "binding_urls":["https://www.flipkart.com/mankind-multi-vitamina-minerals-tablets-overall-health-30-x-2/p/itmad235aca68874",HEALTH_OK_FORMULA_URL],
    },
    "0053b1e8cd07a123b713f465cd5f7ea7": {
        "source_kind":"TRUSTED_STRUCTURED_SOURCE",
        "source_url":HEALTH_OK_FORMULA_URL,
        "ingredient_declaration_text":HEALTH_OK_FORMULA,
        "binding_urls":["https://www.flipkart.com/health-ok-daily-multivitamin-natural-ginseng-energy-overall-health-10-tabs-x-4/p/itm64e4594f1c373",HEALTH_OK_FORMULA_URL],
    },
}

REJECTED_EVIDENCE = {
    "seed-bf2fd651-ef6b-4263-b87f-8b7f47168299": [{
        "source_kind":"TRUSTED_STRUCTURED_SOURCE",
        "source_url":"https://sastasundar.com/order-otc/prohance-d-vanilla-flavour-sugar-free-powder-400-g-ykkvs9",
        "market_country_code":"IN",
        "exact_pack_match":True,
        "evidence_scope":"FULL_DECLARATION",
        "retrieved_at":RETRIEVED_AT,
        "conflict_code":"FLAVOUR_FORMULA_CONFLICT",
        "conflict_detail":"Source is labeled Vanilla 400 g but its declaration includes Cocoa Powder (3.0%) and sucralose, which conflicts with current Vanilla formulation evidence. The declaration is quarantined and is not review-eligible.",
    }]
}

EVIDENCE_GAP_OVERRIDES = {
    "seed-bf2fd651-ef6b-4263-b87f-8b7f47168299": "Exact Vanilla 400 g identity verified, but a purported full declaration is quarantined for a flavour/formula conflict; conflict-free exact-pack FULL_DECLARATION still missing."
}


def _source_url(candidate: dict) -> str:
    return str(candidate.get("discovery_source_url") or candidate.get("discovery_query_url") or "").strip()


def build_dev_evidence_manifest(candidate_pool: dict) -> dict:
    rows = []
    candidates = candidate_pool.get("candidates") or []
    for candidate in candidates:
        cid = candidate.get("candidate_id")
        override = VERIFIED_IDENTITIES.get(cid)
        if override:
            source_urls = override.get("source_urls") or [override.get("source_url") or _source_url(candidate)]
            identity = {
                "identity_status":"VERIFIED",
                "market_country_code":"IN",
                "brand_name":override.get("brand_name") or candidate.get("brand_name"),
                "product_name":override.get("product_name") or candidate.get("product_name"),
                "pack_size":override["pack_size"],
                "identity_source_urls":[url for url in source_urls if url],
            }
            for key in ("variant_name","barcode","sku"):
                if override.get(key):
                    identity[key] = override[key]
        else:
            identity = {
                "identity_status":"PENDING",
                "market_country_code":"IN",
                "brand_name":candidate.get("brand_name"),
                "product_name":candidate.get("product_name"),
                "identity_source_urls":[PENDING_SOURCE_OVERRIDES.get(cid) or _source_url(candidate)],
            }

        evidence = []
        if cid in FULL_EVIDENCE:
            kind, url, declaration = FULL_EVIDENCE[cid]
            evidence.append({
                "source_kind":kind,
                "source_url":url,
                "market_country_code":"IN",
                "exact_pack_match":True,
                "evidence_scope":"FULL_DECLARATION",
                "ingredient_declaration_text":declaration,
                "retrieved_at":RETRIEVED_AT,
            })
        if cid in RECONCILED_EVIDENCE:
            item = RECONCILED_EVIDENCE[cid]
            evidence.append({
                "source_kind":item["source_kind"],
                "source_url":item["source_url"],
                "market_country_code":"IN",
                "exact_pack_match":False,
                "evidence_scope":"FULL_DECLARATION",
                "ingredient_declaration_text":item["ingredient_declaration_text"],
                "retrieved_at":RETRIEVED_AT,
                "pack_binding_kind":RECONCILED_BINDING,
                "pack_binding_verified":True,
                "pack_binding_source_urls":item["binding_urls"],
            })

        rejected_evidence = list(REJECTED_EVIDENCE.get(cid, []))
        if cid in EVIDENCE_GAP_OVERRIDES:
            evidence_gap_reason = EVIDENCE_GAP_OVERRIDES[cid]
        elif evidence:
            evidence_gap_reason = ""
        elif override:
            evidence_gap_reason = "Exact identity verified; review-eligible exact-pack FULL_DECLARATION still missing."
        else:
            evidence_gap_reason = "Exact pack/variant and review-eligible exact-pack FULL_DECLARATION unresolved."

        rows.append({
            "candidate_id":cid,
            "gold_status":"UNASSIGNED",
            "review_decision":None,
            "identity":identity,
            "evidence":evidence,
            "rejected_evidence":rejected_evidence,
            "evidence_gap_reason":evidence_gap_reason,
        })

    return {
        "schema_version":"1.1.0",
        "split":"DEV",
        "market_country_code":"IN",
        "candidate_count":len(rows),
        "gold_status":"UNASSIGNED",
        "human_adjudication_required":True,
        "generated_at":RETRIEVED_AT,
        "methodology":"Discovery is never gold. VERIFIED identity requires exact product/pack/IN market. Reviewer-ready requires a complete declaration with either exact-pack evidence or a verified reconciled binding between exact pack identity and the same product formula. Trusted structured and reconciled evidence are review support only and require explicit human judgment. Conflicting declarations remain quarantined. Human approval remains mandatory.",
        "candidates":rows,
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Generate the frozen 30-product DEV adjudication evidence ledger")
    parser.add_argument("--candidate-pool", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args(argv)
    candidate_pool = json.loads(Path(args.candidate_pool).read_text(encoding="utf-8"))
    manifest = build_dev_evidence_manifest(candidate_pool)
    Path(args.output).write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({
        "candidate_count":manifest["candidate_count"],
        "verified_identity_count":sum(r["identity"]["identity_status"] == "VERIFIED" for r in manifest["candidates"]),
        "full_declaration_count":sum(bool(r["evidence"]) for r in manifest["candidates"]),
        "rejected_evidence_count":sum(len(r["rejected_evidence"]) for r in manifest["candidates"]),
        "gold_status":manifest["gold_status"],
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
