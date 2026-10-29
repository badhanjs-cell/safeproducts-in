-- Accurate, read-only governance readiness status; never a numeric-score permission.
BEGIN;
CREATE OR REPLACE FUNCTION public.sp_safety_validation_release_readiness_v1(p_study uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
 SELECT jsonb_build_object(
  'study',s.code,'scope',s.scope,
  'policy_sha256',s.policy_sha256,
  'study_status',s.status,
  'benchmark_case_count',(SELECT count(*) FROM public.sp_safety_validation_case_v1 c WHERE c.study_id=s.id),
  'reviewed_reference_count',(SELECT count(DISTINCT j.case_id) FROM public.sp_safety_validation_judgement_v1 j
   JOIN public.sp_safety_validation_case_v1 c ON c.id=j.case_id WHERE c.study_id=s.id),
  'benchmark_metrics',coalesce(to_jsonb(m),'{}'::jsonb),
  'calibration_certified',EXISTS(
    SELECT 1 FROM public.sp_safety_calibration_certificate_v1 v
    WHERE v.study_id=s.id AND v.policy_sha256=s.policy_sha256),
  'auditor_approved',EXISTS(SELECT 1 FROM public.sp_safety_validation_attestation_v1 a
   WHERE a.study_id=s.id AND a.role='AUDITOR' AND a.decision='APPROVE'),
  'release_approved',EXISTS(SELECT 1 FROM public.sp_safety_validation_attestation_v1 a
   WHERE a.study_id=s.id AND a.role='RELEASE' AND a.decision='APPROVE'),
  'policy_gate_active',s.status='ACTIVE' AND s.expiry_at>now() AND s.revoked_at IS NULL,
  'active_expiry',s.expiry_at,'main_numeric_score_promotion_enabled',false,
  'canonical_score_preserved',true,
  'required_next_action',
    CASE WHEN s.status='DRAFT' THEN 'REGISTER_INDEPENDENT_REVIEWERS_AND_EXTERNAL_HOLDOUT'
     WHEN s.status='FROZEN' THEN 'REVIEW_AND_QUALIFY_BLINDED_CLINICAL_REGULATORY_BENCHMARK'
     WHEN s.status='SHADOW_PASSED' THEN 'INDEPENDENT_CALIBRATION_AUDITOR_RELEASE_SIGNOFF'
     WHEN s.status='ACTIVE' THEN 'VERSIONED_CANARY_SCORE_ADAPTER_AND_POST_LAUNCH_MONITORING'
     ELSE 'REVIEW_REVOKED_STUDY'
    END)
 FROM public.sp_safety_validation_study_v1 s
 LEFT JOIN public.sp_safety_validation_metric_v1 m ON m.study_id=s.id
 WHERE s.id=p_study
$fn$;
REVOKE ALL ON FUNCTION public.sp_safety_validation_release_readiness_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sp_safety_validation_release_readiness_v1(uuid) TO service_role;
COMMIT;