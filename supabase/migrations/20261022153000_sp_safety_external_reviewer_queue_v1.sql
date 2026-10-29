-- Eligible external reviewers can find assigned frozen cases; answers remain blinded.
-- No candidate predictions, other reviewer votes, or certification status exposed.
BEGIN;
CREATE OR REPLACE FUNCTION public.sp_safety_validation_review_queue_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
DECLARE v_actor uuid:=auth.uid();v_role text;v_cases jsonb;
BEGIN
 SELECT role INTO v_role FROM public.sp_safety_validation_reviewer_v1
 WHERE reviewer_id=v_actor AND independently_verified_at IS NOT NULL
 AND active AND NOT is_product_builder AND role IN ('CLINICAL','REGULATORY');
 IF v_role IS NULL THEN
  RAISE EXCEPTION 'INDEPENDENT_CREDENTIALED_REVIEWER_REQUIRED' USING errcode='42501';
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',v.id,'case_key',v.case_key,'profile',v.profile,'scope',v.scope,
  'label_facts',v.label_facts,'external_evidence_url',v.external_evidence_url,
  'applicable_law_url',v.applicable_law_url,'country_code',v.country_code)
  ORDER BY v.case_key),'[]'::jsonb)
 INTO v_cases FROM(
  SELECT c.* FROM public.sp_safety_validation_case_v1 c
  JOIN public.sp_safety_validation_study_v1 s ON s.id=c.study_id
  JOIN public.sp_safety_validation_prediction_v1 p ON p.case_id=c.id
   AND p.model_policy_sha256=s.policy_sha256
  WHERE s.status='FROZEN' AND c.is_external_holdout
    AND NOT EXISTS(
     SELECT 1 FROM public.sp_safety_validation_judgement_v1 j
     WHERE j.case_id=c.id AND j.reviewer_id=v_actor)
  ORDER BY c.case_key LIMIT 50
 ) v;
 RETURN jsonb_build_object('role',v_role,'cases',v_cases,
  'blinded_to_candidate_predictions',true,
  'reviewer_organization_credentialed',true,
  'case_count',jsonb_array_length(v_cases));
END $fn$;
REVOKE ALL ON FUNCTION public.sp_safety_validation_review_queue_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sp_safety_validation_review_queue_v1() TO authenticated;
COMMIT;