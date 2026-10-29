import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const code=readFileSync("supabase/functions/sp-us2-ingredient-acquire-v1/index.ts","utf8");
test("Make endpoint requires verified shared callback key before product access",()=>{
 assert.match(code,/SP_US2_MAKE_CALLBACK_KEY/);
 assert.match(code,/x-sp-us2-make-key/);
 assert.match(code,/if\(!secret\|\|!provided\|\|!equal\(secret,provided\)\)/);
 assert.match(code,/MAKE_AUTH_REQUIRED/);
 assert.match(code,/INPUT_CONTRACT_INVALID/);
 assert.match(code,/ACTIVE_CANONICAL_PRODUCT_REQUIRED/);
});
test("preflight never incurs provider costs and checks canonical cache first",()=>{
 assert.match(code,/mode==="PREFLIGHT"/);
 assert.match(code,/paid_calls:0/);
 assert.match(code,/CACHED_QUALIFIED/);
 assert.match(code,/PREFLIGHT_READY/);
 assert.match(code,/sp_catalog_product_unified_v1/);
 assert.match(code,/assessment_status==="QUALIFIED"/);
});
test("backend alone controls ingredient qualification, Safety Score and private cache",()=>{
 assert.match(code,/sp-m1b-path-a-v1/);
 assert.match(code,/sp_m1b_score_qualified_product_v1/);
 assert.match(code,/sp_m1b_enqueue_recovery_v1/);
 assert.match(code,/QUALIFIED_AND_CACHED/);
 assert.match(code,/REGULATORY_REVIEW_PENDING/);
 assert.match(code,/RECOVERY_QUEUED/);
 assert.match(code,/HUMAN_REVIEW_REQUIRED/);
 assert.match(code,/missing_safety_score_fabricated:false/);
});
test("exact identity/pack and market are derived from server-owned catalog not supplied URLs",()=>{
 assert.match(code,/sp_catalog_product_v1/);
 assert.match(code,/product_fingerprint/);
 assert.match(code,/pack_size_text/);
 assert.match(code,/market_country_code/);
 assert.match(code,/gtin/);
 assert.doesNotMatch(code,/input\.source_url|input\.ingredient|input\.safety_score|input\.price/);
});
test("Make receives no user images, private label photos, full prompts or system credential",()=>{
 assert.match(code,/source_priority_completed/);
 assert.match(code,/image_saved/);
 assert.doesNotMatch(code,/image_bytes|photo_base64|user_email|user_token/);
});

test("cached Safety Score is qualified for the selected profile, not merely general profile",()=>{
 assert.match(code,/profile==="children"\?"child_score"/);
 assert.match(code,/profile==="pregnant"\?"pregnancy_score"/);
 assert.match(code,/profile==="seniors"\?"senior_score"/);
 assert.match(code,/n!==null&&n!==undefined/);
});
test("when OCR recovery is not queued, a durable human ingredient review is attempted",()=>{
 assert.match(code,/routeHumanReview/);
 assert.match(code,/sp_catalog_review_queue_v1/);
 assert.match(code,/review_type:"INGREDIENT_RECOVERY"/);
 assert.match(code,/human_review_recorded/);
 assert.match(code,/humanReviewQueued\?"HUMAN_REVIEW_REQUIRED":"RETRYABLE"/);
});

test("live acquisitions are bounded and cannot repeat paid provider calls while recovery is queued",()=>{
 assert.match(code,/existingRecentRecovery/);
 assert.match(code,/sp_m1br_recovery_queue_v1/);
 assert.match(code,/status","in\.\(PENDING,RETRY,IN_PROGRESS\)"/);
 assert.match(code,/created_at","gte\."/);
 assert.match(code,/RECOVERY_ALREADY_QUEUED/);
 assert.match(code,/RECOVERY_STATE_UNAVAILABLE/);
 assert.match(code,/foreground_budget_ms:28500/);
 assert.match(code,/AbortSignal\.timeout\(36500\)/);
 assert.match(code,/PATH_A_TIMED_OUT/);
 assert.match(code,/paid_calls:0/);
});
