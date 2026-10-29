-- Restore the pre-cleanup SafeProducts featured-browse depth contract on the canonical backend.
-- SafeProducts only. Browse/source-grounded rows never create a Safety Score or VERIFIED product identity.
-- Target: 8-10 relevant products per profile/category; ALL preserves 2 Children + 2 Pregnant Women + 2 Seniors + general fill.

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('Baby Cream','Himalaya','baby','Baby Cream','https://himalayawellness.in/products/baby-cream','Official Himalaya India product page reviewed 2026-10-10; product is explicitly formulated for babies.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('Baby Lotion','Himalaya','baby','Baby Lotion','https://himalayawellness.in/products/baby-lotion','Official Himalaya India product page reviewed 2026-10-10; product is explicitly a baby lotion.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('Gentle Baby Lotion','Himalaya','baby','Baby Lotion','https://himalayawellness.in/products/gentle-baby-lotion','Official Himalaya India product page reviewed 2026-10-10; product is explicitly a gentle baby lotion.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('Ashwagandha Advance','Organic India','nutraceuticals','Herbal Supplement','https://organicindia.com/products/ashwagandha-advance-capsules','Official Organic India product page reviewed 2026-10-10; Ashwagandha extract supplement.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('Ashwagandha Capsules','Organic India','nutraceuticals','Herbal Supplement','https://organicindia.com/products/ashwagandha-capsules','Official Organic India product page reviewed 2026-10-10; herbal Ashwagandha supplement.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('Brahmi Capsules','Organic India','nutraceuticals','Herbal Supplement','https://organicindia.com/products/brahmi-capsules','Official Organic India product page reviewed 2026-10-10; herbal Brahmi supplement.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('Gokshura + Ashwagandha Capsules Combo','Organic India','nutraceuticals','Herbal Supplement','https://organicindia.com/collections/ashwagandha-brahmi-for-mental-health','Official Organic India collection reviewed 2026-10-10; product is explicitly listed.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('HK Vitals Fish Oil 1000mg with EPA and DHA','HealthKart','nutraceuticals','Fish Oil / Omega-3 Supplement','https://www.healthkart.com/sv/healthkart-hk-vitals-fish-oil-1000mg-with-180mg-epa-and-120mg-dha/SP-43252','HealthKart product page reviewed 2026-10-10; fish-oil omega-3 supplement.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('HK Vitals Omega 3 1000mg with EPA and DHA','HealthKart','nutraceuticals','Omega-3 Supplement','https://www.healthkart.com/sv/healthkart-hk-vitals-omega-3-1000mg-with-180mg-epa-and-120mg-dha/SP-40596','HealthKart product page reviewed 2026-10-10; omega-3 supplement.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('HK Vitals Vegetarian Omega 3 1000mg','HealthKart','nutraceuticals','Omega-3 Supplement','https://www.healthkart.com/sv/healthkart-hk-vitals-vegetarian-omega-3-1000mg/SP-139715','HealthKart product page reviewed 2026-10-10; vegetarian omega-3 supplement.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('Shatavari & Ashwagandha Capsules Combo','Organic India','nutraceuticals','Herbal Supplement','https://organicindia.com/collections/ashwagandha-brahmi-for-mental-health','Official Organic India collection reviewed 2026-10-10; product is explicitly listed.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('1% Hyaluronic Sunscreen Aqua Gel SPF 50 PA++++ - 80g','The Derma Co','skincare','Sunscreen','https://thedermaco.com/collections/sunscreen','Official The Derma Co sunscreen collection reviewed 2026-10-10; product is explicitly listed.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('10% Niacinamide Face Serum with 2% Zinc PCA - 30ml','The Derma Co','skincare','Face Serum','https://thedermaco.com/collections/moisturizers-and-bestsellers','Official The Derma Co collection reviewed 2026-10-10; product is explicitly listed.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('10% Vitamin C Face Serum with 5% Niacinamide & Hyaluronic Acid - 30ml','The Derma Co','skincare','Face Serum','https://thedermaco.com/collections/moisturizers-and-bestsellers','Official The Derma Co collection reviewed 2026-10-10; product is explicitly listed.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('2% Kojic Acid Face Serum with 1% Alpha Arbutin & Niacinamide - 30ml','The Derma Co','skincare','Face Serum','https://thedermaco.com/collections/moisturizers-and-bestsellers','Official The Derma Co collection reviewed 2026-10-10; product is explicitly listed.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('2% Salicylic Acid Face Serum for Active Acne - 30ml','The Derma Co','skincare','Face Serum','https://thedermaco.com/collections/moisturizers-and-bestsellers','Official The Derma Co collection reviewed 2026-10-10; product is explicitly listed.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('5% Nia-Ceramide Mattifying Moisturizer - 100g','The Derma Co','skincare','Face Moisturizer','https://thedermaco.com/collections/all','Official The Derma Co all-products collection reviewed 2026-10-10; product is explicitly listed.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('Light Fluid SPF 50 Sunscreen','Minimalist','skincare','Sunscreen','https://beminimalist.co/products/light-fluid-spf-50-sunscreen','Official Minimalist India product page reviewed 2026-10-10.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('Vitamin B5 10% Moisturizer - 50g','Minimalist','skincare','Face Moisturizer','https://beminimalist.co/products/vitamin-b5-10-moisturizer','Official Minimalist India product page reviewed 2026-10-10.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('Ensure Strength Pro','Abbott Ensure','special_dietary','Adult Nutrition / Healthy Ageing','https://www.abbott.in/media-center/press-releases/abbott-launches-ensure-strength-pro-in-india-to-support-healthy-ageing.html','Official Abbott India launch source reviewed 2026-10-10; product is designed to support healthy ageing.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('HK Vitals Calcium - 90 tablets','HealthKart','supplements','Calcium Mineral Supplement','https://www.healthkart.com/sv/healthkart-hk-vitals-calcium/SP-86351','HealthKart product page reviewed 2026-10-10; calcium supplement.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('HK Vitals Calcium with Mag Zinc & Vit D3','HealthKart','supplements','Calcium Mineral Supplement','https://www.healthkart.com/sv/healthkart-hk-vitals-calcium-with-mag-zinc-n-vit-d3/SP-41552','HealthKart product page reviewed 2026-10-10; calcium, magnesium, zinc and vitamin D3 supplement.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('HK Vitals Multivitamin Adults 50+','HealthKart','supplements','Multivitamin Supplement','https://www.healthkart.com/sv/healthkart-hk-vitals-multivitamin-adults-50plus/SP-134725','HealthKart product page reviewed 2026-10-10; explicitly labelled Adults 50+ and Senior/Elderly.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('HK Vitals Multivitamin with Minerals & Ginseng Extract','HealthKart','supplements','Multivitamin Supplement','https://www.healthkart.com/sv/healthkart-hk-vitals-multivitamin-with-zinc-n-vitamin-c/SP-39873','HealthKart product page reviewed 2026-10-10; multivitamin/mineral supplement.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('HK Vitals Multivitamin Women with Ginseng','HealthKart','supplements','Multivitamin Supplement','https://www.healthkart.com/sv/healthkart-hk-vitals-multivitamin-women-with-ginseng/SP-40933','HealthKart product page reviewed 2026-10-10; women multivitamin supplement.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('HK Vitals Multivitamin+ Women','HealthKart','supplements','Multivitamin Supplement','https://www.healthkart.com/sv/healthkart-hk-vitals-multivitaminplus-women/SP-120463','HealthKart product page reviewed 2026-10-10; women multivitamin supplement.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('NUTRILITE Daily','NUTRILITE','supplements','Multivitamin & Multimineral Supplement','https://www.amway.in/nutrilite-daily/p/313504ID','Official Amway India product page reviewed 2026-10-10; multivitamin and multimineral supplement.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_browse_seed_catalog_v1
(product_name,brand_name,browse_bucket,category_label,source_url,evidence_note,image_url,active,verified_at)
values ('NUTRILITE Daily Plus','NUTRILITE','supplements','Multivitamin & Multimineral Supplement','https://www.amway.in/search?text=DAILY','Official Amway India product search reviewed 2026-10-10; Daily Plus is explicitly listed.',null,true,now())
on conflict (browse_bucket,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 evidence_note=excluded.evidence_note, image_url=coalesce(excluded.image_url,public.sp_web_browse_seed_catalog_v1.image_url),
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_profile_seed_catalog_v1
(profile_code,product_name,brand_name,category_label,source_url,image_url,display_order,active,verified_at)
values ('PREGNANT WOMEN','Horlicks Mother''s Plus Kesar Flavour','Horlicks','Pregnancy & Lactation Nutrition','https://www.horlicks.in/products/horlicks-mothers-plus-kesar-flavour',null,80,true,now())
on conflict (profile_code,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 image_url=coalesce(excluded.image_url,public.sp_web_profile_seed_catalog_v1.image_url), display_order=excluded.display_order,
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_profile_seed_catalog_v1
(profile_code,product_name,brand_name,category_label,source_url,image_url,display_order,active,verified_at)
values ('SENIORS','Ensure Strength Pro','Abbott Ensure','Adult Nutrition / Healthy Ageing','https://www.abbott.in/media-center/press-releases/abbott-launches-ensure-strength-pro-in-india-to-support-healthy-ageing.html',null,20,true,now())
on conflict (profile_code,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 image_url=coalesce(excluded.image_url,public.sp_web_profile_seed_catalog_v1.image_url), display_order=excluded.display_order,
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_profile_seed_catalog_v1
(profile_code,product_name,brand_name,category_label,source_url,image_url,display_order,active,verified_at)
values ('SENIORS','HK Vitals Fish Oil 1000mg with EPA and DHA','HealthKart','Fish Oil / Omega-3 Supplement','https://www.healthkart.com/sv/healthkart-hk-vitals-fish-oil-1000mg-with-180mg-epa-and-120mg-dha/SP-43252',null,40,true,now())
on conflict (profile_code,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 image_url=coalesce(excluded.image_url,public.sp_web_profile_seed_catalog_v1.image_url), display_order=excluded.display_order,
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_profile_seed_catalog_v1
(profile_code,product_name,brand_name,category_label,source_url,image_url,display_order,active,verified_at)
values ('SENIORS','HK Vitals Multivitamin Adults 50+','HealthKart','Senior Multivitamin Supplement','https://www.healthkart.com/sv/healthkart-hk-vitals-multivitamin-adults-50plus/SP-134725',null,10,true,now())
on conflict (profile_code,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 image_url=coalesce(excluded.image_url,public.sp_web_profile_seed_catalog_v1.image_url), display_order=excluded.display_order,
 active=true, verified_at=excluded.verified_at;

insert into public.sp_web_profile_seed_catalog_v1
(profile_code,product_name,brand_name,category_label,source_url,image_url,display_order,active,verified_at)
values ('SENIORS','NUTRILITE Daily','NUTRILITE','Multivitamin & Multimineral Supplement','https://www.amway.in/nutrilite-daily/p/313504ID',null,30,true,now())
on conflict (profile_code,product_name) do update set
 brand_name=excluded.brand_name, category_label=excluded.category_label, source_url=excluded.source_url,
 image_url=coalesce(excluded.image_url,public.sp_web_profile_seed_catalog_v1.image_url), display_order=excluded.display_order,
 active=true, verified_at=excluded.verified_at;

CREATE OR REPLACE FUNCTION public._sp_web_featured_products_core_v1_2(p_profile text DEFAULT 'ALL'::text, p_category text DEFAULT 'all'::text, p_limit integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  v_profile text := upper(coalesce(nullif(btrim(p_profile),''),'ALL'));
  v_category text := lower(coalesce(nullif(btrim(p_category),''),'all'));
  v_limit integer := least(greatest(coalesce(p_limit,10),1),10);
  v_results jsonb := '[]'::jsonb;
  v_count integer := 0;
begin
  if v_profile not in ('ALL','CHILDREN','PREGNANT WOMEN','SENIORS','CHILD','PREGNANT','SENIOR') then
    raise exception using errcode='22023', message='INVALID_FEATURED_PROFILE';
  end if;
  if v_category not in ('all','skincare','personalcare','baby','supplements','nutraceuticals','special_dietary') then
    raise exception using errcode='22023', message='INVALID_FEATURED_CATEGORY';
  end if;

  with canonical_raw as (
    select
      'catalog-'||p.id::text as id,
      p.product_name as name,
      nullif(btrim(p.brand_name),'') as brand,
      nullif(btrim(p.category),'') as category,
      p.updated_at as freshness,
      coalesce(nullif(img.image_url,''),nullif(o.image_url,'')) as image_url,
      case
        when o.price is not null and o.price>0
         and (o.valid_until is null or o.valid_until>now())
        then o.price else null
      end as price,
      coalesce(nullif(o.currency,''),'INR') as currency,
      coalesce(nullif(o.merchant_name,''),nullif(o.platform_name,'')) as platform,
      nullif(o.affiliate_url,'') as affiliate_url,
      nullif(o.source_url,'') as source_url,
      s.overall_score as general_score,
      case v_profile
        when 'CHILDREN' then s.child_score
        when 'CHILD' then s.child_score
        when 'PREGNANT WOMEN' then s.pregnancy_score
        when 'PREGNANT' then s.pregnancy_score
        when 'SENIORS' then s.senior_score
        when 'SENIOR' then s.senior_score
        else s.overall_score
      end as profile_score,
      s.determination_confidence as confidence,
      (s.id is not null) as safety_claim_available,
      lower(coalesce(p.product_name,'')||' '||coalesce(p.category,'')||' '||coalesce(p.brand_name,'')) as hay
    from public.sp_catalog_product_v1 p
    left join lateral (
      select o.*
      from public.sp_catalog_commerce_offer_v1 o
      where o.product_id=p.id
        and o.verified=true
        and o.market_country_code='IN'
        and o.source_url ~ '^https://'
        and coalesce(o.availability_status,'') not in ('OUT_OF_STOCK','DISCONTINUED')
      order by
        case when o.price is not null and o.price>0 and (o.valid_until is null or o.valid_until>now()) then 0 else 1 end,
        o.offer_confidence desc nulls last,
        o.retrieved_at desc,
        o.id
      limit 1
    ) o on true
    left join lateral (
      select i.image_url
      from public.sp_catalog_product_image_v1 i
      where i.product_id=p.id
        and i.verified=true
        and i.exact_product_match=true
        and i.image_url ~ '^https://'
      order by i.is_primary_display desc,
        case upper(coalesce(i.source_kind,'')) when 'OFFICIAL_BRAND' then 0 when 'OFFICIAL_SHOPIFY' then 1 when 'TRUSTED_RETAILER' then 2 else 3 end,
        coalesce(i.width_px,0)*coalesce(i.height_px,0) desc,
        i.retrieved_at desc nulls last,
        i.id
      limit 1
    ) img on true
    left join lateral (
      select sa.*
      from public.sp_catalog_safety_assessment_v1 sa
      where sa.product_id=p.id
        and sa.assessment_status='QUALIFIED'
        and sa.is_current=true
        and (sa.expires_at is null or sa.expires_at>now())
      order by sa.determined_at desc,sa.created_at desc,sa.id
      limit 1
    ) s on true
    where p.is_active=true
      and p.market_country_code='IN'
      and btrim(coalesce(p.product_name,''))<>''
  ),
  canonical as (
    select
      c.*,
      case
        when hay ~ '(baby|child|children|infant|toddler|kids|kid|junior)' then 'baby'
        when hay ~ '(special dietary|food for special|medical nutrition|fsdu|fsmp|meal replacement|diabet|glucerna|ensure|pediasure|resource diabetic|oral nutrition|adult nutrition|maternal nutrition|pregnancy nutrition)' then 'special_dietary'
        when hay ~ '(after[ -]?shave|body wash|bodywash|shampoo|soap|deodorant|toothpaste|tooth paste|mouthwash|hand wash|hair oil|hair care|face wash|facewash)' then 'personalcare'
        when hay ~ '(mosquito|repellent)' then 'other'
        when hay ~ '(sunscreen|spf[ -]?[0-9]|moisturi[sz]|face cream|face lotion|face serum|skin care|skincare|sun expert|uv fluid|uv cream|toner|serum)' then 'skincare'
        when hay ~ '(probiotic|prebiotic|synbiotic|lactobacillus|bifido|gut health|nutraceutical|ginseng|ashwagandha|brahmi|herbal extract|fish oil|omega[ -]?3|curcumin|coq10)' then 'nutraceuticals'
        when hay ~ '(health supplement|supplement|multivitamin|vitamin|multimineral|mineral|calcium|zinc|iron|protein|capsule|tablet|syrup)' then 'supplements'
        else 'other'
      end as bucket,
      false as is_profile_seed,
      null::integer as profile_seed_order,
      case when c.safety_claim_available then 0 else 1 end as source_rank
    from canonical_raw c
  ),
  browse_seed as (
    select
      'browse-seed-'||s.id::text as id,
      s.product_name as name,
      nullif(btrim(s.brand_name),'') as brand,
      nullif(btrim(s.category_label),'') as category,
      s.verified_at as freshness,
      nullif(s.image_url,'') as image_url,
      null::numeric as price,
      'INR'::text as currency,
      'Source-grounded catalogue'::text as platform,
      null::text as affiliate_url,
      s.source_url,
      null::numeric as general_score,
      null::numeric as profile_score,
      null::numeric as confidence,
      false as safety_claim_available,
      lower(coalesce(s.product_name,'')||' '||coalesce(s.category_label,'')||' '||coalesce(s.brand_name,'')) as hay,
      s.browse_bucket as bucket,
      false as is_profile_seed,
      null::integer as profile_seed_order,
      2 as source_rank
    from public.sp_web_browse_seed_catalog_v1 s
    where s.active=true
      and s.source_url ~ '^https://'
  ),
  profile_seed as (
    select
      'profile-seed-'||s.id::text as id,
      s.product_name as name,
      nullif(btrim(s.brand_name),'') as brand,
      nullif(btrim(s.category_label),'') as category,
      s.verified_at as freshness,
      nullif(s.image_url,'') as image_url,
      null::numeric as price,
      'INR'::text as currency,
      'Source-grounded profile catalogue'::text as platform,
      null::text as affiliate_url,
      s.source_url,
      null::numeric as general_score,
      null::numeric as profile_score,
      null::numeric as confidence,
      false as safety_claim_available,
      lower(coalesce(s.product_name,'')||' '||coalesce(s.category_label,'')||' '||coalesce(s.brand_name,'')) as hay,
      case
        when upper(s.profile_code)='CHILDREN' then 'baby'
        when upper(s.profile_code)='PREGNANT WOMEN' then 'special_dietary'
        when upper(s.profile_code)='SENIORS' and lower(coalesce(s.category_label,'')||' '||s.product_name) ~ '(omega|fish oil|ashwagandha|brahmi|herbal)' then 'nutraceuticals'
        when upper(s.profile_code)='SENIORS' and lower(coalesce(s.category_label,'')||' '||s.product_name) ~ '(multivitamin|vitamin|mineral|calcium|supplement)' then 'supplements'
        else 'special_dietary'
      end as bucket,
      true as is_profile_seed,
      s.display_order as profile_seed_order,
      0 as source_rank
    from public.sp_web_profile_seed_catalog_v1 s
    where s.active=true
      and s.source_url ~ '^https://'
      and (
        (v_profile in ('CHILDREN','CHILD') and upper(s.profile_code)='CHILDREN')
        or (v_profile in ('PREGNANT WOMEN','PREGNANT') and upper(s.profile_code)='PREGNANT WOMEN')
        or (v_profile in ('SENIORS','SENIOR') and upper(s.profile_code)='SENIORS')
      )
  ),
  unioned as (
    select * from canonical
    union all
    select * from browse_seed
    union all
    select * from profile_seed
  ),
  scored as (
    select
      u.*,
      lower(regexp_replace(coalesce(brand,'')||' '||coalesce(name,''),'[^a-z0-9]+','','g')) as dedupe_key,
      case
        when hay ~ 'after[ -]?shave' then 'after_shave'
        when hay ~ '(body wash|bodywash)' then 'body_wash'
        when hay ~ 'shampoo' then 'shampoo'
        when hay ~ '(face wash|facewash)' then 'face_wash'
        when hay ~ 'tooth' then 'toothcare'
        when hay ~ 'deodorant' then 'deodorant'
        when hay ~ 'soap' then 'soap'
        when hay ~ 'sunscreen|spf' then 'sunscreen'
        when hay ~ 'moisturi[sz]|lotion' then 'moisturizer'
        when hay ~ 'serum' then 'serum'
        when hay ~ 'toner' then 'toner'
        when hay ~ '(baby|child|infant|toddler)' and hay ~ 'cream' then 'baby_cream'
        when hay ~ '(baby|child|infant|toddler)' and hay ~ 'lotion' then 'baby_lotion'
        when hay ~ '(baby|child|infant|toddler)' then 'baby_other'
        when hay ~ '(multivitamin|multimineral)' then 'multivitamin'
        when hay ~ 'calcium' then 'calcium'
        when hay ~ '(omega|fish oil)' then 'omega'
        when hay ~ '(ashwagandha|brahmi|herbal|gokshura|shatavari)' then 'herbal'
        when hay ~ '(probiotic|prebiotic|synbiotic)' then 'probiotic'
        when bucket='special_dietary' then 'special_dietary'
        else bucket
      end as family_key,
      case
        when is_profile_seed then 10
        when v_profile in ('CHILDREN','CHILD') and bucket='baby' then 6
        when v_profile in ('PREGNANT WOMEN','PREGNANT') then 0
        when v_profile in ('SENIORS','SENIOR') and hay ~ '(senior|elderly|geriatric|adults? 50\+|50\+|60\+|70\+|healthy ageing|healthy aging)' then 8
        when v_profile in ('SENIORS','SENIOR') and bucket='special_dietary' then 5
        when v_profile in ('SENIORS','SENIOR') and hay ~ '(calcium|omega[ -]?3|fish oil)' then 4
        when v_profile in ('SENIORS','SENIOR') and bucket in ('supplements','nutraceuticals') then 3
        else 0
      end as profile_relevance,
      case when v_category='all' then true else bucket=v_category end as category_match
    from unioned u
  ),
  filtered as (
    select *
    from scored
    where dedupe_key<>''
      and (v_category='all' or bucket=v_category)
      and (
        v_profile='ALL'
        or (v_profile in ('CHILDREN','CHILD') and (is_profile_seed or bucket='baby'))
        or (v_profile in ('PREGNANT WOMEN','PREGNANT') and is_profile_seed)
        or (v_profile in ('SENIORS','SENIOR') and (
          is_profile_seed
          or (
            bucket in ('supplements','nutraceuticals','special_dietary')
            and hay !~ '(baby|child|children|infant|toddler|kids|kid|junior)'
          )
        ))
      )
  ),
  deduped as (
    select f.*,
      row_number() over(
        partition by dedupe_key
        order by is_profile_seed desc,
                 safety_claim_available desc,
                 source_rank,
                 profile_relevance desc,
                 profile_score desc nulls last,
                 freshness desc nulls last
      ) as dedupe_rank
    from filtered f
  ),
  diversified as (
    select d.*,
      row_number() over(
        partition by family_key
        order by profile_relevance desc,
                 is_profile_seed desc,
                 safety_claim_available desc,
                 source_rank,
                 profile_score desc nulls last,
                 freshness desc nulls last
      ) as family_rank,
      row_number() over(
        partition by lower(coalesce(nullif(brand,''),name))
        order by profile_relevance desc,
                 is_profile_seed desc,
                 safety_claim_available desc,
                 source_rank,
                 freshness desc nulls last
      ) as brand_rank,
      row_number() over(
        partition by bucket
        order by profile_relevance desc,
                 is_profile_seed desc,
                 safety_claim_available desc,
                 source_rank,
                 freshness desc nulls last
      ) as bucket_rank
    from deduped d
    where dedupe_rank=1
  ),
  ranked as (
    select *
    from diversified
    order by
      case when v_profile<>'ALL' then profile_relevance else 0 end desc,
      case when v_profile<>'ALL' and is_profile_seed then coalesce(profile_seed_order,9999) else 9999 end,
      case when v_category<>'all' then family_rank else 1 end,
      case when v_category='all' and v_profile='ALL' then bucket_rank else 1 end,
      brand_rank,
      safety_claim_available desc,
      source_rank,
      profile_score desc nulls last,
      freshness desc nulls last,
      name
    limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,
    'name',r.name,
    'brand',r.brand,
    'category',r.category,
    'image_url',r.image_url,
    'price',r.price,
    'currency',r.currency,
    'platform',r.platform,
    'affiliate_url',r.affiliate_url,
    'source_url',r.source_url,
    'profile_score',case when r.safety_claim_available then r.profile_score else null end,
    'general_score',case when r.safety_claim_available then r.general_score else null end,
    'confidence',case when r.safety_claim_available then r.confidence else null end,
    'source_kind',case when r.safety_claim_available then 'QUALIFIED_CACHE' else 'BACKEND_CATALOG' end,
    'safety_claim_available',r.safety_claim_available,
    'category_match',r.category_match,
    'display_note',case
      when r.safety_claim_available then 'Current qualified SafeProducts assessment from canonical evidence.'
      when r.is_profile_seed then 'Source-grounded profile catalogue preview. Run SafePrice for a current qualified safety assessment.'
      when r.id like 'browse-seed-%' then 'Source-grounded category catalogue preview. Run SafePrice for a current qualified safety assessment.'
      else 'Canonical SafeProducts catalogue product. Safety Score is shown only after evidence qualification.'
    end,
    'assessment_disclaimer',case
      when r.safety_claim_available then 'Safety belongs to the canonical product/formula, not the merchant offer.'
      else 'No Safety Score is inferred from browse or commerce evidence.'
    end
  ) order by
      case when v_profile<>'ALL' then r.profile_relevance else 0 end desc,
      case when v_profile<>'ALL' and r.is_profile_seed then coalesce(r.profile_seed_order,9999) else 9999 end,
      case when v_category<>'all' then r.family_rank else 1 end,
      case when v_category='all' and v_profile='ALL' then r.bucket_rank else 1 end,
      r.brand_rank,
      r.safety_claim_available desc,
      r.source_rank,
      r.profile_score desc nulls last,
      r.freshness desc nulls last,
      r.name
  ),'[]'::jsonb), count(*)::integer
  into v_results,v_count
  from ranked r;

  return jsonb_build_object(
    'status',case when v_count>=8 then 'READY' when v_count>0 then 'INSUFFICIENT_CATALOG_COVERAGE' else 'INSUFFICIENT_CATALOG_COVERAGE' end,
    'contract_version','SP_WEB_FEATURED_PRODUCTS_V1_2',
    'profile',v_profile,
    'category',v_category,
    'requested_limit',v_limit,
    'result_count',v_count,
    'exact_category_count',v_count,
    'results',v_results
  );
end;
$function$;

revoke all on function public._sp_web_featured_products_core_v1_2(text,text,integer) from public, anon, authenticated;
grant execute on function public._sp_web_featured_products_core_v1_2(text,text,integer) to service_role;

CREATE OR REPLACE FUNCTION public.sp_web_featured_products_v1_2(p_profile text DEFAULT 'ALL'::text, p_category text DEFAULT 'all'::text, p_limit integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  v_profile text := upper(coalesce(nullif(btrim(p_profile),''),'ALL'));
  v_category text := lower(coalesce(nullif(btrim(p_category),''),'all'));
  v_limit integer := least(greatest(coalesce(p_limit,10),1),10);
  v_result jsonb;
begin
  if v_profile not in ('ALL','CHILDREN','PREGNANT WOMEN','SENIORS','CHILD','PREGNANT','SENIOR') then
    raise exception using errcode='22023', message='INVALID_FEATURED_PROFILE';
  end if;
  if v_category not in ('all','skincare','personalcare','baby','supplements','nutraceuticals','special_dietary') then
    raise exception using errcode='22023', message='INVALID_FEATURED_CATEGORY';
  end if;

  if v_profile='ALL' and v_category='all' then
    with
    child_payload as (
      select public._sp_web_featured_products_core_v1_2('Children','all',10) as j
    ),
    pregnancy_payload as (
      select public._sp_web_featured_products_core_v1_2('Pregnant Women','all',10) as j
    ),
    senior_payload as (
      select public._sp_web_featured_products_core_v1_2('Seniors','all',10) as j
    ),
    general_payload as (
      select public._sp_web_featured_products_core_v1_2('ALL','all',10) as j
    ),
    child_items as (
      select value as item,row_number() over() as rn
      from child_payload,jsonb_array_elements(coalesce(j->'results','[]'::jsonb))
      limit 2
    ),
    pregnancy_items as (
      select value as item,row_number() over() as rn
      from pregnancy_payload,jsonb_array_elements(coalesce(j->'results','[]'::jsonb))
      limit 2
    ),
    senior_items as (
      select value as item,row_number() over() as rn
      from senior_payload,jsonb_array_elements(coalesce(j->'results','[]'::jsonb))
      limit 2
    ),
    reserved as (
      select item,1 as grp,rn from child_items
      union all
      select item,2 as grp,rn from pregnancy_items
      union all
      select item,3 as grp,rn from senior_items
    ),
    reserved_keys as (
      select lower(regexp_replace(coalesce(item->>'brand','')||' '||coalesce(item->>'name',''),'[^a-z0-9]+','','g')) as k
      from reserved
    ),
    general_items as (
      select value as item,row_number() over() as rn
      from general_payload,jsonb_array_elements(coalesce(j->'results','[]'::jsonb))
      where lower(regexp_replace(coalesce(value->>'brand','')||' '||coalesce(value->>'name',''),'[^a-z0-9]+','','g'))
        not in (select k from reserved_keys)
      limit greatest(v_limit-6,0)
    ),
    combined as (
      select item,grp,rn from reserved
      union all
      select item,4 as grp,rn from general_items
    )
    select jsonb_build_object(
      'status',case when count(*)>=8 then 'READY' else 'INSUFFICIENT_CATALOG_COVERAGE' end,
      'contract_version','SP_WEB_FEATURED_PRODUCTS_V1_2',
      'profile','ALL',
      'category','all',
      'requested_limit',v_limit,
      'result_count',count(*),
      'exact_category_count',count(*),
      'profile_mix',jsonb_build_object(
        'children',(select count(*) from child_items),
        'pregnant_women',(select count(*) from pregnancy_items),
        'seniors',(select count(*) from senior_items),
        'general',(select count(*) from general_items)
      ),
      'results',coalesce(jsonb_agg(item order by grp,rn),'[]'::jsonb)
    )
    into v_result
    from combined;

    return v_result;
  end if;

  return public._sp_web_featured_products_core_v1_2(p_profile,p_category,p_limit);
end;
$function$;

revoke all on function public.sp_web_featured_products_v1_2(text,text,integer) from public;
grant execute on function public.sp_web_featured_products_v1_2(text,text,integer) to anon, authenticated, service_role;
