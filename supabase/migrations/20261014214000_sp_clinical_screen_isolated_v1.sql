-- SafeProducts isolated clinical safety screening lane, independent of FSSAI or verified Safety Score.
BEGIN;
CREATE TABLE IF NOT EXISTS public.sp_web_label_clinical_screen_v1(
 run_id uuid PRIMARY KEY REFERENCES public.sp_m1b_run_v1(id) ON DELETE CASCADE,
 scan_id uuid NOT NULL UNIQUE REFERENCES public.sp_web_label_pack_scan_v1(id) ON DELETE CASCADE,
 owner_id uuid NOT NULL,
 version text NOT NULL CHECK(version='SP_CLINICAL_SCREEN_V1'),
 status text NOT NULL CHECK(status IN ('PROVISIONAL_CLINICAL_SCREEN','AVOID_FOR_PROFILE','NOT_ASSESSABLE')),
 score numeric CHECK(score BETWEEN 0 AND 100),
 details jsonb NOT NULL CHECK(jsonb_typeof(details)='object' AND octet_length(details::text)<=16000),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((status='PROVISIONAL_CLINICAL_SCREEN' AND score IS NOT NULL) OR
        (status<>'PROVISIONAL_CLINICAL_SCREEN' AND score IS NULL))
);
CREATE INDEX IF NOT EXISTS sp_label_clinical_created_idx ON public.sp_web_label_clinical_screen_v1(created_at DESC);
ALTER TABLE public.sp_web_label_clinical_screen_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sp_web_label_clinical_screen_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.sp_web_label_clinical_screen_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.sp_web_label_clinical_screen_v1 TO service_role;
CREATE OR REPLACE FUNCTION public.sp_web_label_save_clinical_screen_v1(p_run_id uuid,p_owner_id uuid,p_screen jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
DECLARE v_scan_id uuid;v_status text;v_score numeric;
BEGIN
 IF p_run_id IS NULL OR p_owner_id IS NULL OR p_screen IS NULL OR
    p_screen->>'version'<>'SP_CLINICAL_SCREEN_V1' OR
    p_screen->>'regulatory_evidence_coverage_separate'<>'true' OR
    jsonb_typeof(p_screen->'signals')<>'array' OR
    jsonb_array_length(p_screen->'signals')<1 OR
    jsonb_array_length(p_screen->'signals')>12 OR
    jsonb_typeof(p_screen->'unknowns')<>'array' OR
    octet_length(p_screen::text)>16000
 THEN RAISE EXCEPTION 'INVALID_CLINICAL_SCREEN' USING errcode='22023'; END IF;
 v_status:=p_screen->>'status';
 IF v_status NOT IN ('PROVISIONAL_CLINICAL_SCREEN','AVOID_FOR_PROFILE','NOT_ASSESSABLE')
 THEN RAISE EXCEPTION 'INVALID_CLINICAL_STATUS' USING errcode='22023'; END IF;
 IF p_screen->'score' IS NOT NULL AND p_screen->>'score'<>'null' THEN
  v_score:=(p_screen->>'score')::numeric;
 END IF;
 IF (v_status='PROVISIONAL_CLINICAL_SCREEN' AND (v_score IS NULL OR v_score<0 OR v_score>100))
  OR (v_status<>'PROVISIONAL_CLINICAL_SCREEN' AND v_score IS NOT NULL)
 THEN RAISE EXCEPTION 'INVALID_CLINICAL_SCORE' USING errcode='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_screen->'signals') s
   WHERE s->>'source_url'<>'https://www.nccih.nih.gov/health/ashwagandha'
     OR (s->>'points')::numeric<0 OR (s->>'points')::numeric>25)
 THEN RAISE EXCEPTION 'CLINICAL_SOURCE_NOT_ALLOWLISTED' USING errcode='22023'; END IF;
 SELECT id INTO v_scan_id FROM public.sp_web_label_pack_scan_v1
  WHERE run_id=p_run_id AND owner_id=p_owner_id;
 IF v_scan_id IS NULL THEN RAISE EXCEPTION 'SCAN_OWNERSHIP_MISMATCH' USING errcode='42501'; END IF;
 INSERT INTO public.sp_web_label_clinical_screen_v1(run_id,scan_id,owner_id,version,status,score,details)
 VALUES(p_run_id,v_scan_id,p_owner_id,'SP_CLINICAL_SCREEN_V1',v_status,v_score,p_screen)
 ON CONFLICT(run_id) DO NOTHING;
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION public.sp_web_label_save_clinical_screen_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sp_web_label_save_clinical_screen_v1(uuid,uuid,jsonb) TO service_role;
-- Only return an exact-pack screen after the private front photo was actually saved.
-- No user image, owner id or source hash is ever exposed to search.
CREATE OR REPLACE FUNCTION public.sp_web_label_exact_pack_clinical_screen_v1(p_query text,p_profile text DEFAULT 'ALL')
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
 SELECT c.details
 FROM public.sp_catalog_product_v1 p
 JOIN public.sp_web_label_pack_scan_v1 s ON s.product_id=p.id
 JOIN public.sp_web_label_front_asset_v1 f ON f.scan_id=s.id AND f.front_sha256=s.front_sha256
 JOIN public.sp_web_label_clinical_screen_v1 c ON c.scan_id=s.id
 WHERE p.is_active=true
 AND length(btrim(p_query)) BETWEEN 5 AND 200
 AND p_profile IN ('ALL','Children','Pregnant Women','Seniors')
 AND s.profile_used=p_profile
 AND nullif(btrim(p.pack_size_text),'') IS NOT NULL
 AND regexp_replace(lower(p_query),'[^a-z0-9]+','','g')=
     regexp_replace(lower(concat_ws(' ',p.brand_name,p.product_name,p.variant_name,p.pack_size_text)),'[^a-z0-9]+','','g')
 ORDER BY s.created_at DESC LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION public.sp_web_label_exact_pack_clinical_screen_v1(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sp_web_label_exact_pack_clinical_screen_v1(text,text) TO anon,authenticated,service_role;
COMMENT ON TABLE public.sp_web_label_clinical_screen_v1 IS
'Provisional source-linked clinical screening index separate from regulatory coverage and verified product Safety Score; does not imply product approval or clinical validation.';
COMMIT;