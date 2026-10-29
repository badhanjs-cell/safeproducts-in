-- Conditional promotion gate. No synthetic attestation or automatic calibration.
-- Requires externally credentialed calibrator, independently signed auditor and
-- release officer; scope is bounded, revocable and expires after 7 days.
BEGIN;
ALTER TABLE public.sp_safety_validation_reviewer_v1
 DROP CONSTRAINT sp_safety_validation_reviewer_v1_role_check;
ALTER TABLE public.sp_safety_validation_reviewer_v1
 ADD CONSTRAINT sp_safety_validation_reviewer_v1_role_check
 CHECK(role IN ('CLINICAL','REGULATORY','CALIBRATOR','AUDITOR','RELEASE'));
CREATE TABLE public.sp_safety_calibration_certificate_v1(
 study_id uuid PRIMARY KEY REFERENCES public.sp_safety_validation_study_v1(id),
 calibrator_id uuid NOT NULL REFERENCES public.sp_safety_validation_reviewer_v1(reviewer_id),
 rubric_sha256 text NOT NULL CHECK(rubric_sha256 ~ '^[a-f0-9]{64}$'),
 policy_sha256 text NOT NULL CHECK(policy_sha256 ~ '^[a-f0-9]{64}$'),
 validation_report_url text NOT NULL CHECK(validation_report_url ~ '^https://'),
 clinical_endpoint_description text NOT NULL CHECK(length(trim(clinical_endpoint_description)) BETWEEN 40 AND 1000),
 number_semantics text NOT NULL CHECK(number_semantics='ORDINAL_SCREENING_INDEX_NOT_SAFETY_PROBABILITY'),
 numeric_holdout_count integer NOT NULL CHECK(numeric_holdout_count>=100),
 independent_numeric_reference boolean NOT NULL CHECK(independent_numeric_reference=true),
 bias_and_subgroup_report_url text NOT NULL CHECK(bias_and_subgroup_report_url ~ '^https://'),
 calibration_signed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sp_safety_calibration_certificate_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sp_safety_calibration_certificate_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.sp_safety_calibration_certificate_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.sp_safety_calibration_certificate_v1 TO service_role;
CREATE OR REPLACE FUNCTION public.sp_safety_validation_calibrate_v1(
 p_study uuid,p_rubric_sha256 text,p_report_url text,p_endpoint text,
 p_count integer,p_bias_report_url text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
DECLARE who uuid:=auth.uid();v_study public.sp_safety_validation_study_v1%ROWTYPE;
BEGIN
 IF who IS NULL OR NOT EXISTS(SELECT 1 FROM public.sp_safety_validation_reviewer_v1
 WHERE reviewer_id=who AND role='CALIBRATOR' AND active AND NOT is_product_builder
 AND independently_verified_at IS NOT NULL)
 THEN RAISE EXCEPTION 'INDEPENDENT_CALIBRATOR_REQUIRED' USING errcode='42501'; END IF;
 SELECT * INTO v_study FROM public.sp_safety_validation_study_v1 WHERE id=p_study;
 IF v_study.status<>'SHADOW_PASSED' THEN RAISE EXCEPTION 'BENCHMARK_FIRST' USING errcode='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.sp_safety_validation_judgement_v1 j
 JOIN public.sp_safety_validation_case_v1 c ON c.id=j.case_id
 WHERE c.study_id=p_study AND j.reviewer_id=who)
 THEN RAISE EXCEPTION 'SELF_REVIEW_FORBIDDEN' USING errcode='42501'; END IF;
 IF p_count<(SELECT count(*) FROM public.sp_safety_validation_case_v1 WHERE study_id=p_study)
 THEN RAISE EXCEPTION 'INDEPENDENT_NUMERIC_REFERENCE_TOO_SMALL' USING errcode='22023'; END IF;
 INSERT INTO public.sp_safety_calibration_certificate_v1(
 study_id,calibrator_id,rubric_sha256,policy_sha256,validation_report_url,
 clinical_endpoint_description,number_semantics,numeric_holdout_count,
 independent_numeric_reference,bias_and_subgroup_report_url)
 VALUES(p_study,who,p_rubric_sha256,v_study.policy_sha256,p_report_url,p_endpoint,
  'ORDINAL_SCREENING_INDEX_NOT_SAFETY_PROBABILITY',p_count,true,p_bias_report_url);
 RETURN true;
END $fn$;
CREATE OR REPLACE FUNCTION public.sp_safety_validation_promote_v1(p_study uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
DECLARE who uuid:=auth.uid(); v_study public.sp_safety_validation_study_v1%ROWTYPE;
 v_cal uuid;v_audit uuid;v_release uuid;
BEGIN
 IF who IS NULL OR NOT EXISTS(SELECT 1 FROM public.sp_safety_validation_reviewer_v1
  WHERE reviewer_id=who AND role='RELEASE' AND active AND NOT is_product_builder
  AND independently_verified_at IS NOT NULL)
 THEN RAISE EXCEPTION 'RELEASE_AUTHORITY_REQUIRED' USING errcode='42501'; END IF;
 SELECT * INTO v_study FROM public.sp_safety_validation_study_v1 WHERE id=p_study FOR UPDATE;
 IF v_study.status<>'SHADOW_PASSED' THEN RAISE EXCEPTION 'NO_INDEPENDENT_BENCHMARK_PASS' USING errcode='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sp_safety_validation_metric_v1
  WHERE study_id=p_study AND benchmark_status='PASS' AND total>=100
   AND gold_agreement_cases=total AND false_safe_count=0
   AND false_regulatory_permission_count=0 AND high_concern_recall>=0.98
   AND prediction_coverage>=0.90)
 THEN RAISE EXCEPTION 'SCORE_PROMOTION_METRICS_BLOCK' USING errcode='42501'; END IF;
 SELECT calibrator_id INTO v_cal FROM public.sp_safety_calibration_certificate_v1
  WHERE study_id=p_study AND policy_sha256=v_study.policy_sha256
   AND calibration_signed_at>now()-interval '90 days';
 SELECT reviewer_id INTO v_audit FROM public.sp_safety_validation_attestation_v1
  WHERE study_id=p_study AND role='AUDITOR' AND decision='APPROVE';
 SELECT reviewer_id INTO v_release FROM public.sp_safety_validation_attestation_v1
  WHERE study_id=p_study AND role='RELEASE' AND decision='APPROVE';
 IF v_cal IS NULL OR v_audit IS NULL OR v_release IS NULL OR v_release<>who
  OR v_cal IN (v_audit,v_release) OR v_audit=v_release
 THEN RAISE EXCEPTION 'SEPARATE_CALIBRATION_AUDIT_RELEASE_APPROVAL_REQUIRED' USING errcode='42501'; END IF;
 IF (SELECT count(DISTINCT organization) FROM public.sp_safety_validation_reviewer_v1
  WHERE reviewer_id IN (v_cal,v_audit,v_release) AND active AND NOT is_product_builder)<>3
 THEN RAISE EXCEPTION 'INDEPENDENT_ORGANIZATIONS_REQUIRED' USING errcode='42501'; END IF;
 -- This records qualified model-policy promotion only. Existing public score
 -- engine is not automatically overwritten: a versioned score adapter
 -- still must complete controlled canary qualification before presentation.
 UPDATE public.sp_safety_validation_study_v1 SET status='ACTIVE',
  active_at=now(),expiry_at=now()+interval '7 days' WHERE id=p_study;
 INSERT INTO public.sp_safety_validation_release_event_v1(study_id,event,actor_id,detail)
 VALUES(p_study,'PROMOTE',who,'Bounded independent policy qualification; existing canonical Safety Score unchanged');
 RETURN jsonb_build_object('policy_status','ACTIVE',
  'expires_at',(SELECT expiry_at FROM public.sp_safety_validation_study_v1 WHERE id=p_study),
  'main_score_automatically_replaced',false,
  'required_next_action','CANARY_QUALIFY_SCORE_ADAPTER_BEFORE_CONSUMER_NUMERIC_RELEASE');
END $fn$;
CREATE OR REPLACE FUNCTION public.sp_safety_validation_rollback_v1(p_study uuid,p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
DECLARE who uuid:=auth.uid();
BEGIN
 IF who IS NULL OR NOT EXISTS(SELECT 1 FROM public.sp_safety_validation_reviewer_v1
   WHERE reviewer_id=who AND active AND role IN ('AUDITOR','RELEASE'))
 THEN RAISE EXCEPTION 'ROLLOUT_AUTHORITY_REQUIRED' USING errcode='42501'; END IF;
 IF length(trim(coalesce(p_reason,'')))<20 THEN
  RAISE EXCEPTION 'ROLLBACK_REASON_REQUIRED' USING errcode='22023'; END IF;
 UPDATE public.sp_safety_validation_study_v1 SET status='ROLLED_BACK',revoked_at=now()
 WHERE id=p_study AND status='ACTIVE';
 IF NOT FOUND THEN RAISE EXCEPTION 'NO_ACTIVE_RELEASE' USING errcode='22023'; END IF;
 INSERT INTO public.sp_safety_validation_release_event_v1(study_id,event,actor_id,detail)
 VALUES(p_study,'ROLLBACK',who,left(p_reason,800));
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION public.sp_safety_validation_calibrate_v1(uuid,text,text,text,integer,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sp_safety_validation_promote_v1(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sp_safety_validation_rollback_v1(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sp_safety_validation_calibrate_v1(uuid,text,text,text,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_safety_validation_promote_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_safety_validation_rollback_v1(uuid,text) TO authenticated;
COMMIT;