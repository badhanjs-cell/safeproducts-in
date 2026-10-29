import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const load=(p)=>readFileSync(p,"utf8");
const canary=load("supabase/migrations/20261022152000_sp_safety_canary_shadow_diagnostic_v1.sql");
const review=load("supabase/migrations/20261022153000_sp_safety_external_reviewer_queue_v1.sql");
const portal=load("src/routes/independent-review.tsx");
const existing=load("src/lib/productSearch.functions.ts");
const scoring=load("supabase/migrations/20261022131000_sp_validation_freeze_and_score_denial_v1.sql");
test("canary diagnostic reads actual production qualified safety assessments without writing new scores",()=>{
 assert.match(canary,/FROM public\.sp_catalog_safety_assessment_v1/);
 assert.match(canary,/sp_safety_multisource_numeric_score_v1\(gen_random_uuid\(\),'ALL'\)/);
 assert.match(canary,/consumer_numeric_score_enabled',false/);
 assert.match(canary,/main_score_engine_modified',false/);
 assert.match(canary,/canary_accepted',false/);
 assert.match(canary,/ACTUAL_DATABASE_DIAGNOSTIC_NOT_USER_TRAFFIC/);
 assert.match(canary,/candidate_numeric_score_exposed/i);
 assert.doesNotMatch(canary,/UPDATE public\.sp_catalog_safety_assessment_v1|INSERT INTO public\.sp_catalog_safety_assessment_v1/);
 assert.match(scoring,/SELECT NULL::numeric/);
});
test("canary shadows cannot be published as consumer scores or bypass identity/privacy protections",()=>{
 assert.match(canary,/CHECK\(candidate_numeric_score_exposed=false\)/);
 assert.match(canary,/CHECK\(main_safety_score_written=false\)/);
 assert.match(canary,/SHADOW_REAL_TRAFFIC/);
 assert.match(canary,/contains_user_photos_or_identity',false/);
 assert.match(canary,/UNQUALIFIED_SHADOW_STUDY_OR_EVENT/);
 assert.match(canary,/REVOKE ALL ON FUNCTION public\.sp_safety_score_canary_record_shadow_v1/);
 assert.match(canary,/GRANT EXECUTE ON FUNCTION public\.sp_safety_score_canary_record_shadow_v1/);
 assert.doesNotMatch(existing,/sp_safety_multisource_numeric_score_v1/);
});
test("certification readiness demands fresh benchmark, calibration, auditor, release signoff and separate canary",()=>{
 assert.match(canary,/false_safe_count<>0/);
 assert.match(canary,/false_regulatory_permission_count<>0/);
 assert.match(canary,/high_concern_recall<0\.98/);
 assert.match(canary,/prediction_coverage<0\.90/);
 assert.match(canary,/calibration_signed_at>now\(\)-interval '90 days'/);
 assert.match(canary,/AUDITOR_OR_RELEASE_SIGNOFF_MISSING/);
 assert.match(canary,/QUALIFIED_SCORE_ADAPTER_AND_CLOUD_RUN_LIVE_CANARY_NOT_ACCEPTED/);
 assert.match(canary,/main_score_engine_modified',false/);
});
test("reviewer queue is blinded, credentialed, authenticated, immutable and not accessible to anonymous users",()=>{
 assert.match(review,/auth\.uid\(\)/);
 assert.match(review,/independently_verified_at IS NOT NULL/);
 assert.match(review,/NOT is_product_builder/);
 assert.match(review,/role IN \('CLINICAL','REGULATORY'\)/);
 assert.match(review,/sp_safety_validation_prediction_v1 p ON p\.case_id=c\.id/);
 assert.doesNotMatch(review,/p\.clinical_label|p\.regulatory_label|p\.proposed_score/);
 assert.match(review,/FROM PUBLIC,anon,authenticated/);
 assert.match(review,/TO authenticated/);
 assert.match(review,/NOT EXISTS/);
});
test("reviewer UI uses Supabase sign-in, scoped RPC and no direct writes to governance records",()=>{
 assert.match(portal,/supabase\.auth\.signInWithPassword/);
 assert.match(portal,/sp_safety_validation_review_queue_v1/);
 assert.match(portal,/sp_safety_validation_submit_review_v1/);
 assert.match(portal,/blinded_to_candidate_predictions/);
 assert.ok(portal.includes('createFileRoute("/independent-review"'));
 assert.doesNotMatch(portal,/\.from\("sp_safety_validation_|\.from\('sp_safety_validation_/);
});
