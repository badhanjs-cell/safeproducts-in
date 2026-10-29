-- SafeProducts independent multi-source evidence lane (curated pilot).
-- Shared GRIL ingredient and regulatory masters are not written or altered.
BEGIN;
CREATE TABLE IF NOT EXISTS public.sp_web_label_multi_source_evidence_v1(
  run_id uuid PRIMARY KEY REFERENCES public.sp_m1b_run_v1(id) ON DELETE CASCADE,
  scan_id uuid NOT NULL UNIQUE REFERENCES public.sp_web_label_pack_scan_v1(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  evidence_version text NOT NULL CHECK(evidence_version='SP_MULTI_SOURCE_EVIDENCE_V1'),
  qualification text NOT NULL CHECK(qualification='CURATED_PILOT_NOT_INDEPENDENTLY_VALIDATED'),
  report jsonb NOT NULL CHECK(jsonb_typeof(report)='object' AND octet_length(report::text)<=42000),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sp_web_label_multi_source_evidence_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sp_web_label_multi_source_evidence_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.sp_web_label_multi_source_evidence_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.sp_web_label_multi_source_evidence_v1 TO service_role;
CREATE OR REPLACE FUNCTION public.sp_web_label_save_multi_source_v1(p_run_id uuid,p_owner_id uuid,p_report jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
DECLARE v_scan_id uuid;
BEGIN
 IF p_run_id IS NULL OR p_owner_id IS NULL OR p_report IS NULL
 OR jsonb_typeof(p_report)<>'object'
 OR p_report->>'version'<>'SP_MULTI_SOURCE_EVIDENCE_V1'
 OR p_report->>'qualification'<>'CURATED_PILOT_NOT_INDEPENDENTLY_VALIDATED'
 OR p_report->>'numeric_product_safety_score' IS NOT NULL
 OR jsonb_typeof(p_report->'evidence')<>'array'
 OR jsonb_array_length(p_report->'evidence')>45
 OR jsonb_typeof(p_report->'warnings')<>'array'
 OR jsonb_typeof(p_report->'unresolved_ingredients')<>'array'
 OR (p_report->>'ingredient_evidence_coverage')::numeric NOT BETWEEN 0 AND 100
 OR (p_report->>'source_count')::integer NOT BETWEEN 0 AND 20
 OR octet_length(p_report::text)>42000
 THEN RAISE EXCEPTION 'INVALID_MULTI_SOURCE_REVIEW' USING errcode='22023'; END IF;
 IF EXISTS(
  SELECT 1 FROM jsonb_array_elements(p_report->'evidence') v
  WHERE v->'source'->>'url' NOT IN (
   'https://www.nccih.nih.gov/health/ashwagandha',
   'https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/',
   'https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/',
   'https://ods.od.nih.gov/factsheets/calcium-HealthProfessional/',
   'https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/',
   'https://ods.od.nih.gov/factsheets/Niacin-HealthProfessional/',
   'https://www.fda.gov/consumers/consumer-updates/spilling-beans-how-much-caffeine-too-much',
   'https://www.fda.gov/cosmetics/cosmetic-ingredients/allergens-cosmetics',
   'https://www.fda.gov/cosmetics/cosmetic-ingredients/beta-hydroxy-acids'
  )
 ) THEN RAISE EXCEPTION 'UNTRUSTED_SOURCE_URL' USING errcode='22023'; END IF;
 SELECT id INTO v_scan_id FROM public.sp_web_label_pack_scan_v1
   WHERE run_id=p_run_id AND owner_id=p_owner_id;
 IF v_scan_id IS NULL THEN RAISE EXCEPTION 'OWNER_SCAN_MISMATCH' USING errcode='42501'; END IF;
 INSERT INTO public.sp_web_label_multi_source_evidence_v1(
  run_id,scan_id,owner_id,evidence_version,qualification,report
 ) VALUES(
  p_run_id,v_scan_id,p_owner_id,'SP_MULTI_SOURCE_EVIDENCE_V1',
  'CURATED_PILOT_NOT_INDEPENDENTLY_VALIDATED',p_report
 ) ON CONFLICT(run_id) DO NOTHING;
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION public.sp_web_label_save_multi_source_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sp_web_label_save_multi_source_v1(uuid,uuid,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.sp_web_label_exact_pack_multi_source_v1(p_query text,p_profile text DEFAULT 'ALL')
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
 SELECT m.report
 FROM public.sp_catalog_product_v1 p
 JOIN public.sp_web_label_pack_scan_v1 s ON s.product_id=p.id
 JOIN public.sp_web_label_front_asset_v1 a ON a.scan_id=s.id AND a.front_sha256=s.front_sha256
 JOIN public.sp_web_label_multi_source_evidence_v1 m ON m.scan_id=s.id
 WHERE p.is_active=true AND nullif(btrim(p.pack_size_text),'') IS NOT NULL
  AND length(btrim(p_query)) BETWEEN 5 AND 200
  AND p_profile IN ('ALL','Children','Pregnant Women','Seniors')
  AND s.profile_used=p_profile
  AND regexp_replace(lower(p_query),'[^a-z0-9]+','','g')=
      regexp_replace(lower(concat_ws(' ',p.brand_name,p.product_name,p.variant_name,p.pack_size_text)),'[^a-z0-9]+','','g')
 ORDER BY s.created_at DESC LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION public.sp_web_label_exact_pack_multi_source_v1(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sp_web_label_exact_pack_multi_source_v1(text,text) TO anon,authenticated,service_role;
COMMENT ON TABLE public.sp_web_label_multi_source_evidence_v1 IS
'Curated, source-linked cross-category ingredient safety reference; independently validated product scoring not yet certified. Never grants regulatory authorization.';
COMMIT;