-- SafeProducts safety-score canary v1: production diagnostics without fabricated validation.
-- No consumer score changes; no image bytes, user identity, or exact product labels stored.
BEGIN;
CREATE TABLE public.sp_safety_score_canary_observation_v1(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id uuid NULL REFERENCES public.sp_safety_validation_study_v1(id),
  stage text NOT NULL CHECK(stage IN ('PRODUCTION_DB_DIAGNOSTIC','SHADOW_REAL_TRAFFIC')),
  evidence_policy_version text NOT NULL CHECK(length(evidence_policy_version) BETWEEN 6 AND 100),
  product_scope text NULL CHECK(product_scope IN ('SUPPLEMENT_ORAL','FOOD_BEVERAGE','COSMETIC_TOPICAL')),
  profile text NULL CHECK(profile IN ('ALL','Children','Pregnant Women','Seniors')),
  result text NOT NULL CHECK(result IN ('GATE_BLOCKED','TECHNICAL_PASS','TECHNICAL_FAIL','EVIDENCE_ABSTAIN','SHADOW_FINDING')),
  main_safety_score_written boolean NOT NULL DEFAULT false CHECK(main_safety_score_written=false),
  candidate_numeric_score_exposed boolean NOT NULL DEFAULT false CHECK(candidate_numeric_score_exposed=false),
  observations jsonb NOT NULL CHECK(jsonb_typeof(observations)='object' AND octet_length(observations::text)<=4000),
  collected_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sp_safety_canary_stage_created_idx
 ON public.sp_safety_score_canary_observation_v1(stage,collected_at DESC);
ALTER TABLE public.sp_safety_score_canary_observation_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sp_safety_score_canary_observation_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.sp_safety_score_canary_observation_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.sp_safety_score_canary_observation_v1 TO service_role;

-- Read-only gate: study-specific human certification plus calibration and expiry
-- are necessary, never sufficient to publish a numeric score.
CREATE OR REPLACE FUNCTION public.sp_safety_score_canary_readiness_v1(p_study uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
DECLARE st public.sp_safety_validation_study_v1%ROWTYPE; v_metrics public.sp_safety_validation_metric_v1%ROWTYPE;
 v_cal boolean; v_aud boolean; v_release boolean; v_live boolean; v_blockers jsonb:='[]'::jsonb;
 v_diag bigint; v_shadow bigint;
BEGIN
 IF p_study IS NOT NULL THEN
  SELECT * INTO st FROM public.sp_safety_validation_study_v1 WHERE id=p_study;
 END IF;
 IF st.id IS NULL THEN
  v_blockers:=v_blockers||'["NO_ACTIVE_INDEPENDENT_STUDY"]'::jsonb;
 ELSE
  SELECT * INTO v_metrics FROM public.sp_safety_validation_metric_v1 WHERE study_id=st.id;
  IF st.status<>'ACTIVE' OR st.expiry_at IS NULL OR st.expiry_at<=now() OR st.revoked_at IS NOT NULL
   THEN v_blockers:=v_blockers||'["NO_UNEXPIRED_RELEASE_APPROVED_POLICY"]'::jsonb; END IF;
  IF v_metrics.benchmark_status IS DISTINCT FROM 'PASS'
   OR v_metrics.total<100 OR v_metrics.gold_agreement_cases<>v_metrics.total
   OR v_metrics.false_safe_count<>0 OR v_metrics.false_regulatory_permission_count<>0
   OR v_metrics.high_concern_recall<0.98 OR v_metrics.prediction_coverage<0.90
   THEN v_blockers:=v_blockers||'["INDEPENDENT_BENCHMARK_NOT_QUALIFIED"]'::jsonb; END IF;
  SELECT EXISTS(SELECT 1 FROM public.sp_safety_calibration_certificate_v1 c
   WHERE c.study_id=st.id AND c.policy_sha256=st.policy_sha256
     AND c.calibration_signed_at>now()-interval '90 days')
   INTO v_cal;
  IF NOT v_cal THEN v_blockers:=v_blockers||'["INDEPENDENT_SCORE_CALIBRATION_NOT_SIGNED"]'::jsonb; END IF;
  SELECT EXISTS(SELECT 1 FROM public.sp_safety_validation_attestation_v1
   WHERE study_id=st.id AND role='AUDITOR' AND decision='APPROVE') INTO v_aud;
  SELECT EXISTS(SELECT 1 FROM public.sp_safety_validation_attestation_v1
   WHERE study_id=st.id AND role='RELEASE' AND decision='APPROVE') INTO v_release;
  IF NOT v_aud OR NOT v_release THEN
   v_blockers:=v_blockers||'["AUDITOR_OR_RELEASE_SIGNOFF_MISSING"]'::jsonb; END IF;
 END IF;
 SELECT count(*) INTO v_diag FROM public.sp_safety_score_canary_observation_v1
 WHERE stage='PRODUCTION_DB_DIAGNOSTIC' AND result='TECHNICAL_PASS';
 SELECT count(*) INTO v_shadow FROM public.sp_safety_score_canary_observation_v1
 WHERE stage='SHADOW_REAL_TRAFFIC' AND result='SHADOW_FINDING'
   AND study_id=st.id;
 -- A real user-facing canary also needs an independently reviewed scoring adapter,
 -- Cloud Run revision verification and live error monitoring; none are built here.
 v_blockers:=v_blockers||'["QUALIFIED_SCORE_ADAPTER_AND_CLOUD_RUN_LIVE_CANARY_NOT_ACCEPTED"]'::jsonb;
 RETURN jsonb_build_object('contract','SP_CANARY_READINESS_V1','study_id',p_study,
  'study_status',coalesce(st.status,'NOT_REGISTERED'),
  'independent_benchmark_passed',coalesce(v_metrics.benchmark_status='PASS',false),
  'calibration_verified',coalesce(v_cal,false),
  'auditor_approved',coalesce(v_aud,false),'release_approved',coalesce(v_release,false),
  'production_db_diagnostic_passes',v_diag,'real_shadow_findings',v_shadow,
  'blockers',v_blockers,'consumer_numeric_score_enabled',false,
  'main_score_engine_modified',false,'canary_accepted',false,
  'next_action','COMPLETE_EXTERNAL_CERTIFICATION_AND_VERSIONED_CANARY_SCORE_ADAPTER');
END $fn$;
REVOKE ALL ON FUNCTION public.sp_safety_score_canary_readiness_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sp_safety_score_canary_readiness_v1(uuid) TO service_role;

-- Diagnostics are real, bounded SQL checks, not invented expert findings.
CREATE OR REPLACE FUNCTION public.sp_safety_score_canary_diagnostic_v1()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
DECLARE v_canonical_count bigint;v_bad_release bigint;v_numeric numeric;v_id uuid;
 v_status text;
BEGIN
 SELECT count(*) INTO v_canonical_count FROM public.sp_catalog_safety_assessment_v1;
 SELECT count(*) INTO v_bad_release FROM public.sp_safety_validation_study_v1
 WHERE status='ACTIVE' AND (expiry_at IS NULL OR expiry_at<=now() OR revoked_at IS NOT NULL);
 SELECT public.sp_safety_multisource_numeric_score_v1(gen_random_uuid(),'ALL') INTO v_numeric;
 v_status:=CASE WHEN v_canonical_count>=1 AND v_bad_release=0 AND v_numeric IS NULL
  THEN 'TECHNICAL_PASS' ELSE 'TECHNICAL_FAIL' END;
 INSERT INTO public.sp_safety_score_canary_observation_v1(
   stage,evidence_policy_version,result,observations
 ) VALUES('PRODUCTION_DB_DIAGNOSTIC','SP_MULTI_SOURCE_EVIDENCE_V1',v_status,
   jsonb_build_object('canonical_assessments_preserved',v_canonical_count,
   'unsafe_expired_active_releases',v_bad_release,'candidate_score_null',v_numeric IS NULL,
   'provenance','ACTUAL_DATABASE_DIAGNOSTIC_NOT_USER_TRAFFIC',
   'regulatory_or_clinical_validation_not_implied',true))
 RETURNING id INTO v_id;
 RETURN jsonb_build_object('diagnostic_id',v_id,'technical_gate',v_status,
    'canonical_assessments_preserved',v_canonical_count,
    'consumer_score_exposure',false,
    'independent_scientific_certification',false,
    'cloud_run_browser_canary',false);
END $fn$;
REVOKE ALL ON FUNCTION public.sp_safety_score_canary_diagnostic_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sp_safety_score_canary_diagnostic_v1() TO service_role;

-- Report-only, no product identifiers or user photos; only service can log
-- genuine shadow events after the real production API handles a request.
CREATE OR REPLACE FUNCTION public.sp_safety_score_canary_record_shadow_v1(
 p_study uuid,p_scope text,p_profile text,p_evidence_version text,
 p_result text,p_source_count int,p_unresolved_count int
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
DECLARE v_id uuid;
BEGIN
 IF p_result NOT IN ('SHADOW_FINDING','EVIDENCE_ABSTAIN','TECHNICAL_FAIL')
  OR p_evidence_version<>'SP_MULTI_SOURCE_EVIDENCE_V1'
  OR p_source_count NOT BETWEEN 0 AND 20
  OR p_unresolved_count NOT BETWEEN 0 AND 150
  OR NOT EXISTS (SELECT 1 FROM public.sp_safety_validation_study_v1
    WHERE id=p_study AND status IN ('FROZEN','SHADOW_PASSED','ACTIVE') AND scope=p_scope)
 THEN RAISE EXCEPTION 'UNQUALIFIED_SHADOW_STUDY_OR_EVENT' USING errcode='42501'; END IF;
 INSERT INTO public.sp_safety_score_canary_observation_v1(
  study_id,stage,evidence_policy_version,product_scope,profile,result,observations
 ) VALUES (p_study,'SHADOW_REAL_TRAFFIC',p_evidence_version,p_scope,p_profile,p_result,
   jsonb_build_object('source_count',p_source_count,'unresolved_count',p_unresolved_count,
     'consumer_numeric_score_exposed',false,
     'contains_user_photos_or_identity',false)) RETURNING id INTO v_id;
 RETURN v_id;
END $fn$;
REVOKE ALL ON FUNCTION public.sp_safety_score_canary_record_shadow_v1(uuid,text,text,text,text,int,int)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sp_safety_score_canary_record_shadow_v1(uuid,text,text,text,text,int,int)
 TO service_role;
COMMIT;