-- SafeProducts hotfix: Supabase schema default EXECUTE grants must be explicitly revoked
-- from anon, not merely PUBLIC. Only credentialed authenticated reviewers may use
-- blinded case/review/attest RPCs. All other APIs are service-only.
BEGIN;
REVOKE ALL ON FUNCTION public.sp_safety_validation_blinded_case_v1(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sp_safety_validation_submit_review_v1(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sp_safety_validation_attest_v1(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sp_safety_validation_blinded_case_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_safety_validation_submit_review_v1(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_safety_validation_attest_v1(uuid,text,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.sp_safety_validation_evaluate_v1(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sp_safety_validation_freeze_v1(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sp_safety_validation_release_readiness_v1(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sp_safety_multisource_numeric_score_v1(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sp_safety_validation_evaluate_v1(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sp_safety_validation_freeze_v1(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sp_safety_validation_release_readiness_v1(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sp_safety_multisource_numeric_score_v1(uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.sp_safety_validation_guard_case_v1() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sp_safety_validation_guard_prediction_v1() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sp_safety_validation_guard_immutable_review_v1() FROM PUBLIC,anon,authenticated;
COMMIT;