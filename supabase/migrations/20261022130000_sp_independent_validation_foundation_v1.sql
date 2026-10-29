-- SafeProducts v1: blinded independent clinical and regulatory benchmark.
-- DOES NOT enable or modify existing product Safety Scores or regulatory masters.
BEGIN;
CREATE TABLE public.sp_safety_validation_reviewer_v1(
 reviewer_id uuid PRIMARY KEY REFERENCES auth.users(id),
 role text NOT NULL CHECK(role IN ('CLINICAL','REGULATORY','AUDITOR','RELEASE')),
 organization text NOT NULL CHECK(length(trim(organization)) BETWEEN 3 AND 160),
 credential_reference text NOT NULL CHECK(length(trim(credential_reference)) BETWEEN 10 AND 400),
 independently_verified_at timestamptz NOT NULL,
 is_product_builder boolean NOT NULL DEFAULT false CHECK(is_product_builder=false),
 active boolean NOT NULL DEFAULT true,
 enrolled_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.sp_safety_validation_study_v1(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 code text NOT NULL UNIQUE CHECK(code ~ '^SPV1-[A-Z0-9_-]{6,60}$'),
 policy_sha256 text NOT NULL CHECK(policy_sha256 ~ '^[a-f0-9]{64}$'),
 code_commit_sha text NOT NULL CHECK(code_commit_sha ~ '^[a-f0-9]{40}$'),
 dataset_sha256 text NOT NULL CHECK(dataset_sha256 ~ '^[a-f0-9]{64}$'),
 scope text NOT NULL CHECK(scope IN ('SUPPLEMENT_ORAL','FOOD_BEVERAGE','COSMETIC_TOPICAL')),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','FROZEN','SHADOW_PASSED','ACTIVE','ROLLED_BACK')),
 frozen_at timestamptz,
 shadow_passed_at timestamptz,
 active_at timestamptz,
 revoked_at timestamptz,
 expiry_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status='DRAFT' OR frozen_at IS NOT NULL)
);
CREATE TABLE public.sp_safety_validation_case_v1(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 study_id uuid NOT NULL REFERENCES public.sp_safety_validation_study_v1(id),
 case_key text NOT NULL CHECK(length(case_key) BETWEEN 8 AND 128),
 case_group text NOT NULL CHECK(length(case_group) BETWEEN 6 AND 128),
 profile text NOT NULL CHECK(profile IN ('ALL','Children','Pregnant Women','Seniors')),
 scope text NOT NULL CHECK(scope IN ('SUPPLEMENT_ORAL','FOOD_BEVERAGE','COSMETIC_TOPICAL')),
 label_facts jsonb NOT NULL CHECK(jsonb_typeof(label_facts)='object' AND octet_length(label_facts::text)<=10000),
 external_evidence_url text NOT NULL CHECK(external_evidence_url ~ '^https://'),
 applicable_law_url text NOT NULL CHECK(applicable_law_url ~ '^https://'),
 country_code text NOT NULL DEFAULT 'IN' CHECK(country_code='IN'),
 is_external_holdout boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(study_id,case_key)
);
CREATE TABLE public.sp_safety_validation_prediction_v1(
 case_id uuid PRIMARY KEY REFERENCES public.sp_safety_validation_case_v1(id),
 model_policy_sha256 text NOT NULL CHECK(model_policy_sha256 ~ '^[a-f0-9]{64}$'),
 clinical_label text NOT NULL CHECK(clinical_label IN ('LOW_CONCERN','CAUTION','HIGH_CONCERN','ABSTAIN')),
 regulatory_label text NOT NULL CHECK(regulatory_label IN ('PERMITTED','RESTRICTED','PROHIBITED','NOT_APPLICABLE','UNDETERMINED')),
 proposed_score numeric CHECK(proposed_score BETWEEN 0 AND 100),
 predicted_at timestamptz NOT NULL DEFAULT now(),
 CHECK(proposed_score IS NULL OR (clinical_label <> 'ABSTAIN' AND regulatory_label NOT IN ('UNDETERMINED','PROHIBITED')))
);
CREATE TABLE public.sp_safety_validation_judgement_v1(
 case_id uuid NOT NULL REFERENCES public.sp_safety_validation_case_v1(id),
 reviewer_id uuid NOT NULL REFERENCES public.sp_safety_validation_reviewer_v1(reviewer_id),
 dimension text NOT NULL CHECK(dimension IN ('CLINICAL','REGULATORY')),
 label text NOT NULL CHECK(
  (dimension='CLINICAL' AND label IN ('LOW_CONCERN','CAUTION','HIGH_CONCERN')) OR
  (dimension='REGULATORY' AND label IN ('PERMITTED','RESTRICTED','PROHIBITED','NOT_APPLICABLE'))
 ),
 evidence_url text NOT NULL CHECK(evidence_url ~ '^https://'),
 rationale text NOT NULL CHECK(length(trim(rationale)) BETWEEN 30 AND 2500),
 reviewed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(case_id,reviewer_id,dimension)
);
CREATE TABLE public.sp_safety_validation_attestation_v1(
 study_id uuid NOT NULL REFERENCES public.sp_safety_validation_study_v1(id),
 reviewer_id uuid NOT NULL REFERENCES public.sp_safety_validation_reviewer_v1(reviewer_id),
 role text NOT NULL CHECK(role IN ('AUDITOR','RELEASE')),
 decision text NOT NULL CHECK(decision IN ('APPROVE','REJECT')),
 evidence_url text NOT NULL CHECK(evidence_url ~ '^https://'),
 rationale text NOT NULL CHECK(length(trim(rationale)) BETWEEN 40 AND 2500),
 signed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(study_id,role)
);
CREATE TABLE public.sp_safety_validation_metric_v1(
 study_id uuid PRIMARY KEY REFERENCES public.sp_safety_validation_study_v1(id),
 total integer NOT NULL,
 gold_agreement_cases integer NOT NULL,
 high_concern_cases integer NOT NULL,
 high_concern_recall numeric NOT NULL,
 false_safe_count integer NOT NULL,
 false_regulatory_permission_count integer NOT NULL,
 prediction_coverage numeric NOT NULL,
 benchmark_status text NOT NULL CHECK(benchmark_status IN ('PASS','BLOCKED')),
 assessed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.sp_safety_validation_release_event_v1(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 study_id uuid NOT NULL REFERENCES public.sp_safety_validation_study_v1(id),
 event text NOT NULL CHECK(event IN ('FREEZE','SHADOW_PASS','PROMOTE','ROLLBACK')),
 actor_id uuid,
 detail text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
DO $p$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY[
 'sp_safety_validation_reviewer_v1','sp_safety_validation_study_v1',
 'sp_safety_validation_case_v1','sp_safety_validation_prediction_v1',
 'sp_safety_validation_judgement_v1','sp_safety_validation_attestation_v1',
 'sp_safety_validation_metric_v1','sp_safety_validation_release_event_v1']
 LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 END LOOP;
END $p$;
GRANT SELECT,INSERT ON public.sp_safety_validation_reviewer_v1 TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.sp_safety_validation_study_v1 TO service_role;
GRANT SELECT,INSERT ON public.sp_safety_validation_case_v1 TO service_role;
GRANT SELECT,INSERT ON public.sp_safety_validation_prediction_v1 TO service_role;
GRANT SELECT,INSERT ON public.sp_safety_validation_judgement_v1 TO service_role;
GRANT SELECT,INSERT ON public.sp_safety_validation_attestation_v1 TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.sp_safety_validation_metric_v1 TO service_role;
GRANT SELECT,INSERT ON public.sp_safety_validation_release_event_v1 TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.sp_safety_validation_release_event_v1_id_seq TO service_role;

-- Reviewer sees case facts but never candidate predictions or peers' votes.
CREATE OR REPLACE FUNCTION public.sp_safety_validation_blinded_case_v1(p_case uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
DECLARE v_actor uuid:=auth.uid(); v jsonb;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.sp_safety_validation_reviewer_v1
   WHERE reviewer_id=v_actor AND active AND role IN ('CLINICAL','REGULATORY') AND NOT is_product_builder)
 THEN RAISE EXCEPTION 'INDEPENDENT_REVIEWER_REQUIRED' USING errcode='42501'; END IF;
 SELECT jsonb_build_object('case_id',c.id,'case_key',c.case_key,'profile',c.profile,
  'scope',c.scope,'label_facts',c.label_facts,'external_evidence_url',c.external_evidence_url,
  'applicable_law_url',c.applicable_law_url,'country_code',c.country_code)
 INTO v FROM public.sp_safety_validation_case_v1 c
 JOIN public.sp_safety_validation_study_v1 s ON s.id=c.study_id
 WHERE c.id=p_case AND s.status IN ('FROZEN','SHADOW_PASSED');
 RETURN v;
END $fn$;
CREATE OR REPLACE FUNCTION public.sp_safety_validation_submit_review_v1(
 p_case uuid,p_label text,p_evidence_url text,p_rationale text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
DECLARE v_actor uuid:=auth.uid();v_role text;
BEGIN
 SELECT role INTO v_role FROM public.sp_safety_validation_reviewer_v1
 WHERE reviewer_id=v_actor AND active AND NOT is_product_builder
 AND independently_verified_at IS NOT NULL AND role IN ('CLINICAL','REGULATORY');
 IF v_role IS NULL THEN RAISE EXCEPTION 'CREDENTIALED_REVIEWER_REQUIRED' USING errcode='42501'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.sp_safety_validation_case_v1 c
 JOIN public.sp_safety_validation_study_v1 s ON s.id=c.study_id
 JOIN public.sp_safety_validation_prediction_v1 p ON p.case_id=c.id
 WHERE c.id=p_case AND s.status='FROZEN' AND s.policy_sha256=p.model_policy_sha256
 AND c.is_external_holdout)
 THEN RAISE EXCEPTION 'FROZEN_EXTERNAL_CASE_WITH_PREDICTION_REQUIRED' USING errcode='42501'; END IF;
 INSERT INTO public.sp_safety_validation_judgement_v1
 (case_id,reviewer_id,dimension,label,evidence_url,rationale)
 VALUES(p_case,v_actor,v_role,p_label,p_evidence_url,p_rationale);
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION public.sp_safety_validation_blinded_case_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sp_safety_validation_submit_review_v1(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sp_safety_validation_blinded_case_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_safety_validation_submit_review_v1(uuid,text,text,text) TO authenticated;

-- The evaluator refuses pseudo-independent self-evaluations and false-safe cases.
CREATE OR REPLACE FUNCTION public.sp_safety_validation_evaluate_v1(p_study uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
DECLARE st public.sp_safety_validation_study_v1%ROWTYPE;
  n integer;gold integer;high integer;captured integer;detected integer;
  false_safe integer;false_permitted integer;missing integer;org_conflicts integer;
  sensitivity numeric;coverage numeric;status text;
BEGIN
 IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role'
 THEN RAISE EXCEPTION 'SERVICE_EVALUATOR_ONLY' USING errcode='42501'; END IF;
 SELECT * INTO st FROM public.sp_safety_validation_study_v1 WHERE id=p_study FOR UPDATE;
 IF st.status<>'FROZEN' THEN RAISE EXCEPTION 'STUDY_NOT_FROZEN' USING errcode='22023'; END IF;
 -- Every case must be unique external holdout with its frozen prediction;
 -- each clinical/regulatory gold label requires two agreeing reviewers from
 -- distinct organizations, no model-builder participation.
 WITH checks AS (
  SELECT c.id,c.case_group,c.is_external_holdout,p.clinical_label,p.regulatory_label,
   p.proposed_score,
   count(*) FILTER(WHERE j.dimension='CLINICAL') c_n,
   count(*) FILTER(WHERE j.dimension='REGULATORY') r_n,
   count(DISTINCT v.organization) FILTER(WHERE j.dimension='CLINICAL') c_org,
   count(DISTINCT v.organization) FILTER(WHERE j.dimension='REGULATORY') r_org,
   min(j.label) FILTER(WHERE j.dimension='CLINICAL') c_min,
   max(j.label) FILTER(WHERE j.dimension='CLINICAL') c_max,
   min(j.label) FILTER(WHERE j.dimension='REGULATORY') r_min,
   max(j.label) FILTER(WHERE j.dimension='REGULATORY') r_max
  FROM public.sp_safety_validation_case_v1 c
  LEFT JOIN public.sp_safety_validation_prediction_v1 p ON p.case_id=c.id
  LEFT JOIN public.sp_safety_validation_judgement_v1 j ON j.case_id=c.id
  LEFT JOIN public.sp_safety_validation_reviewer_v1 v ON v.reviewer_id=j.reviewer_id
  WHERE c.study_id=p_study
  GROUP BY c.id,p.clinical_label,p.regulatory_label,p.proposed_score
 ), g AS(
  SELECT *,
   (c_n=2 AND r_n=2 AND c_org=2 AND r_org=2 AND c_min=c_max AND r_min=r_max AND
    is_external_holdout AND clinical_label IS NOT NULL AND regulatory_label IS NOT NULL) ok
  FROM checks
 )
 SELECT count(*),count(*) FILTER(WHERE ok),count(*) FILTER(WHERE ok AND c_min='HIGH_CONCERN'),
 count(*) FILTER(WHERE ok AND clinical_label<>'ABSTAIN' AND regulatory_label<>'UNDETERMINED'),
 count(*) FILTER(WHERE ok AND c_min='HIGH_CONCERN' AND clinical_label='HIGH_CONCERN'),
 count(*) FILTER(WHERE ok AND c_min='HIGH_CONCERN' AND clinical_label='LOW_CONCERN'),
 count(*) FILTER(WHERE ok AND r_min IN ('RESTRICTED','PROHIBITED') AND regulatory_label='PERMITTED'),
 count(*) FILTER(WHERE NOT ok)
 INTO n,gold,high,captured,detected,false_safe,false_permitted,missing
 FROM g;
 sensitivity:=CASE WHEN high=0 THEN 0 ELSE round(detected::numeric/high,4) END;
 coverage:=CASE WHEN n=0 THEN 0 ELSE round(captured::numeric/n,4) END;
 -- conservative initial gate; reviewer and auditor may set higher thresholds
 status:=CASE WHEN n>=100 AND gold=n AND high>=20
   AND false_safe=0 AND false_permitted=0
   AND sensitivity>=0.98 AND coverage>=0.90 THEN 'PASS' ELSE 'BLOCKED' END;
 INSERT INTO public.sp_safety_validation_metric_v1(study_id,total,gold_agreement_cases,
  high_concern_cases,high_concern_recall,false_safe_count,false_regulatory_permission_count,
  prediction_coverage,benchmark_status)
 VALUES(p_study,n,gold,high,sensitivity,false_safe,false_permitted,coverage,status)
 ON CONFLICT(study_id) DO UPDATE SET
  total=excluded.total,gold_agreement_cases=excluded.gold_agreement_cases,
  high_concern_cases=excluded.high_concern_cases,
  high_concern_recall=excluded.high_concern_recall,false_safe_count=excluded.false_safe_count,
  false_regulatory_permission_count=excluded.false_regulatory_permission_count,
  prediction_coverage=excluded.prediction_coverage,benchmark_status=excluded.benchmark_status,
  assessed_at=now();
 IF status='PASS' THEN
  UPDATE public.sp_safety_validation_study_v1 SET status='SHADOW_PASSED',shadow_passed_at=now()
  WHERE id=p_study;
  INSERT INTO public.sp_safety_validation_release_event_v1(study_id,event,detail)
  VALUES(p_study,'SHADOW_PASS','Independent benchmark metrics passed; NOT released');
 END IF;
 RETURN jsonb_build_object('gate',status,'total',n,'gold_agreement_cases',gold,
  'high_concern_cases',high,'high_concern_recall',sensitivity,
  'false_safe_count',false_safe,'false_regulatory_permission_count',false_permitted,
  'prediction_coverage',coverage,'study_status',
  CASE WHEN status='PASS' THEN 'SHADOW_PASSED' ELSE 'FROZEN' END);
END $fn$;
REVOKE ALL ON FUNCTION public.sp_safety_validation_evaluate_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sp_safety_validation_evaluate_v1(uuid) TO service_role;

-- Governance: auditor and release officer attest separately. No self-approval.
CREATE OR REPLACE FUNCTION public.sp_safety_validation_attest_v1(
 p_study uuid,p_decision text,p_evidence_url text,p_rationale text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
DECLARE actor uuid:=auth.uid();v_role text;v_study text;
BEGIN
 SELECT role INTO v_role FROM public.sp_safety_validation_reviewer_v1
 WHERE reviewer_id=actor AND active AND NOT is_product_builder
 AND role IN ('AUDITOR','RELEASE') AND independently_verified_at IS NOT NULL;
 IF v_role IS NULL THEN RAISE EXCEPTION 'INDEPENDENT_OFFICER_REQUIRED' USING errcode='42501'; END IF;
 SELECT status INTO v_study FROM public.sp_safety_validation_study_v1 WHERE id=p_study;
 IF v_study<>'SHADOW_PASSED' THEN RAISE EXCEPTION 'BENCHMARK_NOT_PASSED' USING errcode='42501'; END IF;
 IF v_role='RELEASE' AND NOT EXISTS(
  SELECT 1 FROM public.sp_safety_validation_attestation_v1 WHERE study_id=p_study AND role='AUDITOR' AND decision='APPROVE')
 THEN RAISE EXCEPTION 'AUDITOR_FIRST' USING errcode='42501'; END IF;
 IF EXISTS (SELECT 1 FROM public.sp_safety_validation_judgement_v1 j
  JOIN public.sp_safety_validation_case_v1 c ON c.id=j.case_id
  WHERE c.study_id=p_study AND j.reviewer_id=actor)
 THEN RAISE EXCEPTION 'REVIEWER_CANNOT_CERTIFY_OWN_CASES' USING errcode='42501'; END IF;
 INSERT INTO public.sp_safety_validation_attestation_v1(study_id,reviewer_id,role,decision,evidence_url,rationale)
 VALUES(p_study,actor,v_role,p_decision,p_evidence_url,p_rationale);
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION public.sp_safety_validation_attest_v1(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sp_safety_validation_attest_v1(uuid,text,text,text) TO authenticated;

-- Promotion remains disallowed until an independently validated calibration
-- adapter is installed and explicitly approved in a versioned successor.
CREATE OR REPLACE FUNCTION public.sp_safety_validation_release_readiness_v1(p_study uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
 SELECT jsonb_build_object('study',s.code,'study_status',s.status,
  'benchmark_metrics',coalesce(to_jsonb(m),'{}'::jsonb),
  'auditor_approved',EXISTS(SELECT 1 FROM public.sp_safety_validation_attestation_v1 a
   WHERE a.study_id=s.id AND a.role='AUDITOR' AND a.decision='APPROVE'),
  'release_approved',EXISTS(SELECT 1 FROM public.sp_safety_validation_attestation_v1 a
   WHERE a.study_id=s.id AND a.role='RELEASE' AND a.decision='APPROVE'),
  'score_calibration_certified',false,'main_safety_score_promotion_enabled',false,
  'required_next_action','INDEPENDENT_BENCHMARK_THEN_SEPARATE_CALIBRATION_AND_VERSIONED_PROMOTION')
 FROM public.sp_safety_validation_study_v1 s
 LEFT JOIN public.sp_safety_validation_metric_v1 m ON m.study_id=s.id
 WHERE s.id=p_study
$fn$;
REVOKE ALL ON FUNCTION public.sp_safety_validation_release_readiness_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sp_safety_validation_release_readiness_v1(uuid) TO service_role;
COMMENT ON FUNCTION public.sp_safety_validation_release_readiness_v1(uuid)
 IS 'Fail-closed promotion readiness. Active main Safety Score is never modified by this benchmark layer.';
COMMIT;
