import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const sql=readFileSync("supabase/migrations/20261026210000_sp_us2_r1_targeted_single_recovery_v1.sql","utf8");
const worker=readFileSync("supabase/functions/sp-m1br-targeted-recovery-v1/index.ts","utf8");
test("single-task claim is scoped atomically to task, product, run and NORMAL_SEARCH",()=>{
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/q\.id=p_task_id AND q\.product_id=p_product_id AND q\.run_id=p_run_id/);
 assert.match(sql,/r\.context='NORMAL_SEARCH'/);
 assert.match(sql,/q\.attempt_count=0/);
 assert.match(sql,/q\.status IN \('PENDING','RETRY'\)/);
 assert.match(sql,/NOT EXISTS \(SELECT 1 FROM public\.sp_m1br_recovery_queue_v1 o/);
 assert.match(sql,/RETURNS jsonb/);
 assert.doesNotMatch(worker,/sp_m1br_claim_tasks_v1/);
 assert.match(worker,/sp_m1br_claim_targeted_v1/);
});
test("an anonymous user or signed-in unprivileged user cannot claim recovery",()=>{
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.sp_m1br_claim_targeted_v1/);
 assert.match(sql,/FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.sp_m1br_claim_targeted_v1.*TO service_role/s);
 assert.match(sql,/REVOKE ALL ON FUNCTION sp_internal\.dispatch_m1br_targeted_v1.*FROM PUBLIC,anon,authenticated,service_role/s);
 assert.match(worker,/sp_internal_worker_token_valid_v1/);
 assert.match(worker,/x-sp-worker-token/);
 assert.match(worker,/WORKER_AUTH_REQUIRED/);
});
test("preflight makes no provider calls, sends no credentials, and does not claim",()=>{
 assert.match(worker,/if\(mode==="PREFLIGHT"\)return json/);
 assert.match(worker,/paid_model_calls:0/);
 const before=worker.indexOf('if(mode==="PREFLIGHT")return json');
 const claim=worker.indexOf('"sp_m1br_claim_targeted_v1"',before);
 assert.ok(before>0&&claim>before);
 assert.match(worker,/TARGET_PREFLIGHT_NOT_QUALIFIED/);
 assert.match(worker,/M1BR_OCR_URL/);
 assert.match(worker,/GOOGLE_VISION_API_KEY/);
 assert.match(worker,/SP_M1BR_WEB_MODEL/);
 assert.match(worker,/no_railway_fallback:true/);
 assert.doesNotMatch(worker,/m1br-ocr-production\.up\.railway\.app/);
});
test("strict paid budgets: one task, one web source request, one label image and bounded model outputs",()=>{
 assert.match(worker,/claimed:1,other_queue_tasks_claimed:0/);
 assert.match(worker,/images\.slice\(0,1\)/);
 assert.match(worker,/max_output_tokens:7000/);
 assert.match(worker,/max_output_tokens:1700/);
 assert.match(worker,/web_model_calls:1,vision_model_calls:1/);
 assert.match(worker,/p_retry_minutes:0/);
 assert.match(worker,/const WEB_DISCOVERY_TIMEOUT_MS=65000/);
});
test("backend persists qualified ingredient evidence BEFORE scoring, never fabricates a numeric score",()=>{
 assert.match(worker,/sp_m1br_apply_ingredient_result_v1/);
 assert.match(worker,/M1BR_EVIDENCE_PERSISTENCE_FAILED/);
 assert.match(worker,/sp_m1br_complete_task_v1/);
 assert.match(worker,/sp_m1b_score_qualified_product_v2/);
 assert.match(worker,/sp_m1b_score_qualified_product_v2.*?score_available/s);
 assert.match(worker,/numeric_safety_score_qualified:qualifiedScore/);
 assert.match(worker,/safety_score:qualifiedScore\?Number\(scored\.data\.safety_score\):null/);
 assert.match(worker,/sp_m1br_create_review_v1/);
});
test("dispatcher is a fixed target, no scheduled bulk reactivation",()=>{
 assert.match(sql,/sp_internal\.dispatch_m1br_targeted_v1/);
 assert.match(sql,/sp-m1br-targeted-recovery-v1/);
 assert.match(sql,/FROM sp_internal\.worker_secret_v1/);
 assert.doesNotMatch(sql,/cron\.schedule|cron\.alter_job|cron\.unschedule/);
});

test("empty Responses output preserves provider metadata without an automatic paid retry",()=>{
 assert.match(worker,/function missingModelText\(stage:/);
 assert.match(worker,/incomplete_details\?\.reason/);
 assert.match(worker,/usage\?\.output_tokens/);
 assert.match(worker,/missingModelText\("WEB",parsed\)/);
 assert.match(worker,/missingModelText\("VLM",d\)/);
 assert.match(worker,/reasoning:\{effort:"low"\}/);
 assert.doesNotMatch(worker,/M1BR_WEB_EMPTY/);
 assert.match(worker,/p_retry_minutes:0/);
});
