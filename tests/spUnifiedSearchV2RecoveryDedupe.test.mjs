import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const frontend=readFileSync("src/components/SearchResults.tsx","utf8");
const worker=readFileSync("supabase/functions/sp-us2-safety-enrich-v1/index.ts","utf8");

test("consumer search is a single invocation for each explicit search action",()=>{
 assert.match(frontend,/searchProductsClient\(\{ query: q \|\| "", profile, limit: 10 \}\)/);
 assert.doesNotMatch(frontend,/SAFETY_REFRESH_DELAYS_MS|safetyRefreshTimers/);
 assert.doesNotMatch(frontend,/setTimeout\(async/);
 assert.match(frontend,/one search request per user action/i);
});
test("backend worker checks pending recovery before new enrichment lease claims",()=>{
 const guard=worker.indexOf("try{recovery=await pendingRecovery(base,key,id)}");
 const newClaim=worker.indexOf('sp_us2_claim_live_safety_enrichment_v2');
 assert.ok(guard>0&&newClaim>guard,"must inspect recovery state before claiming fresh enrichment");
 assert.match(worker,/RECOVERY_ALREADY_PENDING/);
 assert.match(worker,/RECOVERY_STATE_UNAVAILABLE/);
 assert.match(worker,/sp_m1br_recovery_queue_v1/);
 assert.match(worker,/status","in\.\(PENDING,RETRY,IN_PROGRESS,ADMIN_REVIEW\)"/);
 assert.match(worker,/product_id","eq\."\+id/);
});
test("the worker preserves existing provider lease, bounded processing and signed internal auth",()=>{
 assert.match(worker,/MAX_ENRICH_PER_RUN=1/);
 assert.match(worker,/GLOBAL_LEASE_SECONDS=90/);
 assert.match(worker,/x-us2-internal-key/);
 assert.match(worker,/sp_us2_claim_safety_provider_lease_v1/);
 assert.match(worker,/sp_us2_release_safety_provider_lease_v1/);
 assert.match(worker,/sp_m1b_score_qualified_product_v2/);
 assert.match(worker,/sp_m1b_score_catalog_reuse_v2/);
 assert.match(worker,/sp_m1b_begin_run_v1/);
});
test("pending-recovery exclusion does not tamper with existing outcomes or invent scores",()=>{
 assert.doesNotMatch(worker,/UPDATE\s+sp_catalog_safety_assessment_v1|INSERT\s+INTO\s+sp_catalog_safety_assessment_v1/i);
 assert.match(worker,/recovery_status:recovery.status/);
 assert.match(worker,/if\(recovery\)\{skipped.push/);
});
