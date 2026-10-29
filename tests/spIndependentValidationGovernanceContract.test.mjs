import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const base=read("supabase/migrations/20261022130000_sp_independent_validation_foundation_v1.sql");
const guard=read("supabase/migrations/20261022131000_sp_validation_freeze_and_score_denial_v1.sql");
const docs=read("docs/safety-independent-validation-v1.md");
const normal=read("supabase/functions/sp-m1b-label-analyze-v2/index.ts");
const candidate=read("src/lib/safetyValidationBenchmark.ts");
test("reviewers are real authenticated external identities blinded to prediction and peer votes",()=>{
 assert.match(base,/reviewer_id uuid PRIMARY KEY REFERENCES auth\.users\(id\)/);
 assert.match(base,/is_product_builder boolean NOT NULL DEFAULT false CHECK\(is_product_builder=false\)/);
 assert.match(base,/v_actor uuid:=auth\.uid\(\)/);
 assert.match(base,/sp_safety_validation_blinded_case_v1/);
 assert.doesNotMatch(base.slice(base.indexOf("CREATE OR REPLACE FUNCTION public.sp_safety_validation_blinded_case_v1("),base.indexOf("CREATE OR REPLACE FUNCTION public.sp_safety_validation_submit_review_v1(")),/model_policy_sha256|clinical_label|regulatory_label|proposed_score/);
 assert.match(base,/FROZEN_EXTERNAL_CASE_WITH_PREDICTION_REQUIRED/);
});
test("independent clinical and regulatory labels, organizations and critical false-safes are checked",()=>{
 assert.match(base,/c_n=2 AND r_n=2 AND c_org=2 AND r_org=2/);
 assert.match(base,/c_min=c_max AND r_min=r_max/);
 assert.match(base,/false_safe=0 AND false_permitted=0/);
 assert.match(base,/sensitivity>=0\.98 AND coverage>=0\.90/);
 assert.match(candidate,/INCOMPLETE_INDEPENDENT_GOLD/);
 assert.match(candidate,/CRITICAL_FALSE_REASSURANCE/);
 assert.match(candidate,/FALSE_REGULATORY_CLEARANCE/);
});
test("study, predictions, reviews and attestations are frozen, RLS-protected and immutable",()=>{
 assert.match(base,/FORCE ROW LEVEL SECURITY/);
 assert.match(base,/sp_safety_validation_attestation_v1/);
 assert.match(guard,/BENCHMARK_CASES_IMMUTABLE_AFTER_FREEZE/);
 assert.match(guard,/FROZEN_PREDICTIONS_ARE_IMMUTABLE/);
 assert.match(guard,/NO_PREDICTIONS_AFTER_REVIEW_START/);
 assert.match(guard,/REVIEW_OR_ATTESTATION_IS_IMMUTABLE/);
 assert.match(guard,/sp_safety_validation_freeze_v1/);
 assert.match(guard,/SERVICE_COORDINATOR_ONLY/);
});
test("service cannot self-certify independent review or quietly publish numeric Safety Scores",()=>{
 assert.match(base,/sp_safety_validation_attest_v1/);
 assert.match(base,/AUDITOR_FIRST/);
 assert.match(base,/INDEPENDENT_OFFICER_REQUIRED/);
 assert.match(base,/score_calibration_certified',false/);
 assert.match(base,/main_safety_score_promotion_enabled',false/);
 assert.match(guard,/SELECT NULL::numeric/);
 assert.match(guard,/sp_safety_multisource_numeric_score_v1/);
 assert.doesNotMatch(normal,/sp_safety_multisource_numeric_score_v1/);
 assert.match(docs,/No automatic promotion or automatic human approval/i);
});

test("clinical calibration and controlled policy promotion require three separate independent approvals",()=>{
 const cal=read("supabase/migrations/20261022134000_sp_validation_calibration_promotion_rollback_v1.sql");
 assert.match(cal,/sp_safety_validation_calibrate_v1/);
 assert.match(cal,/independent_numeric_reference=true/);
 assert.match(cal,/INDEPENDENT_CALIBRATOR_REQUIRED/);
 assert.match(cal,/SEPARATE_CALIBRATION_AUDIT_RELEASE_APPROVAL_REQUIRED/);
 assert.match(cal,/count\(DISTINCT organization\)/);
 assert.match(cal,/NO_INDEPENDENT_BENCHMARK_PASS/);
 assert.match(cal,/SCORE_PROMOTION_METRICS_BLOCK/);
 assert.match(cal,/now\(\)\+interval '7 days'/);
 assert.match(cal,/sp_safety_validation_rollback_v1/);
 assert.match(cal,/existing canonical Safety Score unchanged/i);
 assert.match(cal,/main_score_automatically_replaced',false/);
});
test("Supabase default grants are explicitly removed from anon and service-only controls",()=>{
 const sec=read("supabase/migrations/20261022132500_sp_validation_rpc_execute_grants_hotfix_v1.sql");
 assert.match(sec,/blinded_case_v1\(uuid\) FROM PUBLIC,anon,authenticated/);
 assert.match(sec,/submit_review_v1\(uuid,text,text,text\) FROM PUBLIC,anon,authenticated/);
 assert.match(sec,/attest_v1\(uuid,text,text,text\) FROM PUBLIC,anon,authenticated/);
 assert.match(sec,/evaluate_v1\(uuid\) FROM PUBLIC,anon,authenticated/);
 assert.match(sec,/GRANT EXECUTE ON FUNCTION public.sp_safety_validation_submit_review_v1\(uuid,text,text,text\) TO authenticated/);
});

test("readiness reports real human calibration and approvals while public score stays disabled",()=>{
 const m=read("supabase/migrations/20261022135500_sp_validation_readiness_transparency_v1.sql");
 assert.match(m,/calibration_certified',EXISTS/);
 assert.match(m,/auditor_approved',EXISTS/);
 assert.match(m,/release_approved',EXISTS/);
 assert.match(m,/policy_gate_active'/);
 assert.match(m,/main_numeric_score_promotion_enabled',false/);
 assert.match(m,/canonical_score_preserved',true/);
});
