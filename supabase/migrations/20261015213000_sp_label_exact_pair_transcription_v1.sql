-- SafeProducts: deterministic exact two-photo transcription cache.
-- Reuse only earlier owner-matched label transcription, never previous safety scores.
-- Read-only, private service-role RPC. Ingredient image bytes remain ephemeral.
BEGIN;
CREATE OR REPLACE FUNCTION public.sp_web_label_exact_pair_transcription_v1(
 p_owner_id uuid,p_front_sha256 text,p_ingredient_sha256 text,p_profile text
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
WITH best AS (
 SELECT s.run_id,s.detected_ingredients,s.created_at,r.report,
  (
   CASE WHEN s.detected_ingredients::text ~* '[0-9]+[[:space:]]*mg' THEN 3 ELSE 0 END
   +
   CASE WHEN EXISTS (
     SELECT 1 FROM jsonb_array_elements(COALESCE(r.report->'checks','[]'::jsonb)) x
     WHERE x->>'key'='category_declaration' AND x->>'status'='VISIBLE'
       AND x->>'detail' ILIKE '%AYURVEDIC PROPRIETARY MEDICINE%'
   ) THEN 4 ELSE 0 END
   +
   CASE WHEN EXISTS (
     SELECT 1 FROM jsonb_array_elements(COALESCE(r.report->'checks','[]'::jsonb)) x
     WHERE x->>'key'='daily_dose' AND x->>'status'='VISIBLE'
   ) THEN 2 ELSE 0 END
  ) AS completeness
 FROM public.sp_web_label_pack_scan_v1 s
 JOIN public.sp_web_supplement_regulatory_review_v1 r
   ON r.run_id=s.run_id AND r.owner_id=s.owner_id
 WHERE p_owner_id IS NOT NULL
  AND p_front_sha256 ~ '^[0-9a-f]{64}$'
  AND p_ingredient_sha256 ~ '^[0-9a-f]{64}$'
  AND p_front_sha256<>p_ingredient_sha256
  AND p_profile IN ('ALL','Children','Pregnant Women','Seniors')
  AND s.owner_id=p_owner_id
  AND s.front_sha256=p_front_sha256
  AND s.ingredient_sha256=p_ingredient_sha256
  AND s.profile_used=p_profile
  AND s.engine_version='M1B_LABEL_SAFETY_V2'
  AND r.review_version='SP_SUPPLEMENT_REVIEW_V1'
  AND jsonb_typeof(s.detected_ingredients)='array'
  AND jsonb_array_length(s.detected_ingredients)>=1
  AND jsonb_array_length(s.detected_ingredients)<=150
 ORDER BY completeness DESC,s.created_at ASC
 LIMIT 1
)
SELECT jsonb_build_object(
 'detected_ingredients',b.detected_ingredients,
 'product_scope','SUPPLEMENT_ORAL',
 'declaration_complete',true,
 'uncertain_tokens','[]'::jsonb,
 'supplement_label',coalesce((
    SELECT jsonb_object_agg(x->>'key',
      substring(x->>'detail' FROM length('Visible on photographed ingredient panel: ')+1))
    FROM jsonb_array_elements(coalesce(b.report->'checks','[]'::jsonb)) x
    WHERE x->>'status'='VISIBLE'
      AND x->>'detail' LIKE 'Visible on photographed ingredient panel: %'
      AND x->>'key' IN (
        'category_declaration','directions','daily_dose',
        'ayush_manufacturing_license','fssai_license_number',
        'not_for_medicinal_use','batch_and_expiry','precautions',
        'claims','producer_details','veg_nonveg_mark')
 ),'{}'::jsonb),
 'provenance','SAME_OWNER_EXACT_FRONT_AND_INGREDIENT_HASHES',
 'transcription_revision','EXACT_PAIR_TRANSCRIPTION_V1',
 'source_run_id',b.run_id
)
FROM best b
WHERE b.completeness>=7;
$fn$;
REVOKE ALL ON FUNCTION public.sp_web_label_exact_pair_transcription_v1(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sp_web_label_exact_pair_transcription_v1(uuid,text,text,text) TO service_role;
COMMENT ON FUNCTION public.sp_web_label_exact_pair_transcription_v1(uuid,text,text,text) IS
'Private exact pair+owner+profile OCR transcription reuse. Never returns score, owner, image bytes or file paths. Policy and risk assessments must be recomputed.';
COMMIT;