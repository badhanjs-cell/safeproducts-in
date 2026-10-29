-- SafeProducts-only signed evidence report for oral supplement scans.
BEGIN;
CREATE TABLE IF NOT EXISTS public.sp_web_supplement_regulatory_review_v1(
 run_id uuid PRIMARY KEY REFERENCES public.sp_m1b_run_v1(id) ON DELETE CASCADE,
 owner_id uuid NOT NULL,
 review_version text NOT NULL CHECK(review_version='SP_SUPPLEMENT_REVIEW_V1'),
 report jsonb NOT NULL CHECK(jsonb_typeof(report)='object' AND octet_length(report::text)<=40000),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sp_web_supplement_regulatory_review_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sp_web_supplement_regulatory_review_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.sp_web_supplement_regulatory_review_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.sp_web_supplement_regulatory_review_v1 TO service_role;
CREATE OR REPLACE FUNCTION public.sp_web_label_record_supplement_review_v1(p_run_id uuid,p_owner_id uuid,p_report jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
BEGIN
 IF p_run_id IS NULL OR p_owner_id IS NULL OR p_report IS NULL
  OR jsonb_typeof(p_report)<>'object'
  OR p_report->>'review_version'<>'SP_SUPPLEMENT_REVIEW_V1'
  OR jsonb_typeof(p_report->'checks')<>'array'
  OR jsonb_typeof(p_report->'references')<>'array'
  OR jsonb_array_length(p_report->'checks')>32
  OR jsonb_array_length(p_report->'references')>12
  OR octet_length(p_report::text)>40000
  THEN RAISE EXCEPTION 'INVALID_SUPPLEMENT_REVIEW' USING errcode='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sp_web_label_pack_scan_v1 s
   WHERE s.run_id=p_run_id AND s.owner_id=p_owner_id)
  THEN RAISE EXCEPTION 'LABEL_SCAN_OWNER_NOT_VERIFIED' USING errcode='42501'; END IF;
 INSERT INTO public.sp_web_supplement_regulatory_review_v1(run_id,owner_id,review_version,report)
 VALUES(p_run_id,p_owner_id,'SP_SUPPLEMENT_REVIEW_V1',p_report)
 ON CONFLICT(run_id) DO NOTHING;
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION public.sp_web_label_record_supplement_review_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sp_web_label_record_supplement_review_v1(uuid,uuid,jsonb) TO service_role;
COMMENT ON TABLE public.sp_web_supplement_regulatory_review_v1 IS 'Source-anchored FSSAI/NIN-ICMR supplementary review; does not confer product approval or validated compliance. Private user scan ownership.';
COMMIT;