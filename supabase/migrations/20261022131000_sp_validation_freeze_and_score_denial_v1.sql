-- Lock independent benchmark snapshots against post-review prediction edits.
BEGIN;
CREATE OR REPLACE FUNCTION public.sp_safety_validation_guard_case_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $fn$
DECLARE v_status text;
BEGIN
 SELECT status INTO v_status FROM public.sp_safety_validation_study_v1 WHERE id=NEW.study_id;
 IF TG_OP<>'INSERT' OR v_status IS DISTINCT FROM 'DRAFT'
 THEN RAISE EXCEPTION 'BENCHMARK_CASES_IMMUTABLE_AFTER_FREEZE' USING errcode='42501'; END IF;
 IF NEW.is_external_holdout IS NOT TRUE
 THEN RAISE EXCEPTION 'INDEPENDENT_HOLDOUT_PROVENANCE_REQUIRED' USING errcode='22023'; END IF;
 IF NEW.external_evidence_url=NEW.applicable_law_url
 THEN RAISE EXCEPTION 'CLINICAL_AND_REGULATORY_SOURCES_MUST_BE_DISTINCT' USING errcode='22023'; END IF;
 IF NEW.scope<>(SELECT scope FROM public.sp_safety_validation_study_v1 WHERE id=NEW.study_id)
 THEN RAISE EXCEPTION 'SCOPE_MISMATCH' USING errcode='22023'; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER sp_safety_case_insert_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.sp_safety_validation_case_v1
FOR EACH ROW EXECUTE FUNCTION public.sp_safety_validation_guard_case_v1();
CREATE OR REPLACE FUNCTION public.sp_safety_validation_guard_prediction_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $fn$
DECLARE v_status text;v_sha text;
BEGIN
 IF TG_OP<>'INSERT' THEN
  RAISE EXCEPTION 'FROZEN_PREDICTIONS_ARE_IMMUTABLE' USING errcode='42501';
 END IF;
 SELECT s.status,s.policy_sha256 INTO v_status,v_sha
 FROM public.sp_safety_validation_case_v1 c
 JOIN public.sp_safety_validation_study_v1 s ON s.id=c.study_id
 WHERE c.id=NEW.case_id;
 IF v_status IS DISTINCT FROM 'FROZEN' OR v_sha IS DISTINCT FROM NEW.model_policy_sha256
 THEN RAISE EXCEPTION 'MATCHING_FROZEN_POLICY_REQUIRED' USING errcode='42501'; END IF;
 IF EXISTS (SELECT 1 FROM public.sp_safety_validation_judgement_v1 j
  JOIN public.sp_safety_validation_case_v1 c ON c.id=j.case_id
  WHERE c.study_id=(SELECT study_id FROM public.sp_safety_validation_case_v1 WHERE id=NEW.case_id))
 THEN RAISE EXCEPTION 'NO_PREDICTIONS_AFTER_REVIEW_START' USING errcode='42501'; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER sp_safety_prediction_frozen_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.sp_safety_validation_prediction_v1
FOR EACH ROW EXECUTE FUNCTION public.sp_safety_validation_guard_prediction_v1();
CREATE OR REPLACE FUNCTION public.sp_safety_validation_guard_immutable_review_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $fn$
BEGIN
 IF TG_OP<>'INSERT' THEN
  RAISE EXCEPTION 'REVIEW_OR_ATTESTATION_IS_IMMUTABLE' USING errcode='42501';
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER sp_safety_review_immutable
BEFORE UPDATE OR DELETE ON public.sp_safety_validation_judgement_v1
FOR EACH ROW EXECUTE FUNCTION public.sp_safety_validation_guard_immutable_review_v1();
CREATE TRIGGER sp_safety_attestation_immutable
BEFORE UPDATE OR DELETE ON public.sp_safety_validation_attestation_v1
FOR EACH ROW EXECUTE FUNCTION public.sp_safety_validation_guard_immutable_review_v1();
CREATE OR REPLACE FUNCTION public.sp_safety_validation_freeze_v1(p_study uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
DECLARE n integer;v_status text;v_digest text;
BEGIN
 IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role'
 THEN RAISE EXCEPTION 'SERVICE_COORDINATOR_ONLY' USING errcode='42501'; END IF;
 SELECT status INTO v_status FROM public.sp_safety_validation_study_v1 WHERE id=p_study FOR UPDATE;
 IF v_status IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'ONLY_DRAFT_CAN_FREEZE' USING errcode='22023'; END IF;
 SELECT count(*),
  encode(digest(COALESCE(string_agg(
   c.case_key || '|' || c.case_group || '|' || c.profile || '|' || c.scope || '|' ||
   c.label_facts::text || '|' || c.external_evidence_url || '|' || c.applicable_law_url,
   E'\n' ORDER BY c.case_key),''),'sha256'),'hex')
 INTO n,v_digest
 FROM public.sp_safety_validation_case_v1 c WHERE c.study_id=p_study AND c.is_external_holdout;
 IF n<100 THEN RAISE EXCEPTION 'MINIMUM_100_EXTERNAL_HOLDOUT_CASES' USING errcode='22023'; END IF;
 UPDATE public.sp_safety_validation_study_v1 SET status='FROZEN',
  frozen_at=now(),dataset_sha256=v_digest WHERE id=p_study;
 INSERT INTO public.sp_safety_validation_release_event_v1(study_id,event,detail)
 VALUES(p_study,'FREEZE','Frozen external benchmark count='||n||' sha256='||v_digest);
 RETURN jsonb_build_object('status','FROZEN','cases',n,'dataset_sha256',v_digest);
END $fn$;
REVOKE ALL ON FUNCTION public.sp_safety_validation_freeze_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sp_safety_validation_freeze_v1(uuid) TO service_role;

-- Consumer-facing active score is HARD DISABLED for the new uncalibrated lane.
-- This function remains a single canonical control point; a versioned,
-- approved successor is required before any multi-source numeric score can ship.
CREATE OR REPLACE FUNCTION public.sp_safety_multisource_numeric_score_v1(
 p_product_id uuid,p_profile text)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
 SELECT NULL::numeric WHERE p_product_id IS NOT NULL AND p_profile IN ('ALL','Children','Pregnant Women','Seniors')
$fn$;
REVOKE ALL ON FUNCTION public.sp_safety_multisource_numeric_score_v1(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sp_safety_multisource_numeric_score_v1(uuid,text) TO service_role;
COMMENT ON FUNCTION public.sp_safety_multisource_numeric_score_v1(uuid,text) IS
'Fail closed: no consumer numeric result until independent benchmark, calibration, auditor and explicit versioned release. Do not replace with CI-tested heuristic.';
COMMIT;
