-- M1-A READ-ONLY candidate export. Canonical project wmxbdirvlwuagouraobr.
WITH candidate AS (
 SELECT product_fingerprint,product_name,brand_name,NULLIF(BTRIM(category),'') category,ingredient_extracted,extraction_status,extraction_model_version,extraction_source,extraction_confidence,source_confidence,ingredient_confidence,(raw_ingredient_text IS NOT NULL AND BTRIM(raw_ingredient_text)<>'') has_raw_ingredient_text,(parsed_ingredients IS NOT NULL AND jsonb_typeof(parsed_ingredients)='array' AND jsonb_array_length(parsed_ingredients)>0) has_parsed_ingredients,created_at,updated_at FROM public.product_core WHERE COALESCE(is_active,TRUE)
), bucketed AS (
 SELECT *,CASE WHEN lower(coalesce(category,''))~'baby|child|infant' THEN 'baby_products' WHEN lower(coalesce(category,''))~'special.*diet|medical.*food|dietary' THEN 'special_dietary' WHEN lower(coalesce(category,''))~'nutra|probiotic|prebiotic' THEN 'nutraceuticals' WHEN lower(coalesce(category,''))~'supplement|health|nutrition' THEN 'supplements' WHEN lower(coalesce(category,''))~'personal|hygiene|hair|oral|deodorant' THEN 'personal_care' WHEN lower(coalesce(category,''))~'cosmetic|skin|beauty|makeup' THEN 'cosmetics' ELSE 'unmapped' END benchmark_category FROM candidate
)
SELECT * FROM bucketed ORDER BY benchmark_category,product_name,product_fingerprint;
