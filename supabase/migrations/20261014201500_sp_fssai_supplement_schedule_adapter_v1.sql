-- SafeProducts-specific read-only FSSAI botanical schedule adapter.
-- GRIL regulatory_standards is queried but never modified.
BEGIN;
CREATE OR REPLACE FUNCTION public.sp_web_fssai_supplement_schedule_v1(p_ingredient text,p_scope text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
 SELECT jsonb_build_object(
  'reference_status','SCHEDULE_REFERENCE_ONLY',
  'agency','FSSAI','standard_id',s.standard_id,
  'botanical','Withania somnifera','part','Root extract',
  'form',s.limits->>'form',
  'usage_min_g_per_day',(s.limits->>'adult_limit_min')::numeric,
  'usage_max_g_per_day',(s.limits->>'adult_limit_max')::numeric,
  'source_url','https://www.fssai.gov.in/upload/advisories/2022/04/624ac1be799dbDirection_Nutra_30_03_2022.pdf',
  'note','Reference range only. Check applicable food category, actual daily use, root-extract form, quality and subsequent directions before asserting finished-product compliance.'
 )
 FROM public.regulatory_standards s
 WHERE p_scope='SUPPLEMENT_ORAL'
   AND length(coalesce(p_ingredient,'')) BETWEEN 5 AND 480
   AND (p_ingredient~*'withania[[:space:]]+somnifera' OR p_ingredient~*'ashwagandha')
   AND s.standard_id='FSSAI-NUTRA-2022-SCH-II'
   AND s.agency='FSSAI' AND s.category='Health Supplement'
   AND s.restriction_status='allowed'
   AND s.ingredient_canonical_name ILIKE '%Withania somnifera%'
   AND s.limits->>'form'='extract'
   AND s.limits->>'unit'='g'
   AND (s.limits->>'adult_limit_min')::numeric>0
   AND (s.limits->>'adult_limit_max')::numeric>=(s.limits->>'adult_limit_min')::numeric
 ORDER BY s.id LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION public.sp_web_fssai_supplement_schedule_v1(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sp_web_fssai_supplement_schedule_v1(text,text) TO service_role;
COMMENT ON FUNCTION public.sp_web_fssai_supplement_schedule_v1(text,text) IS
'SafeProducts-only, read-only lookup of matched FSSAI 2022 schedule from existing verified regulatory standards. Not product approval.';
COMMIT;