import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p)=>readFileSync(p,"utf8");
const sql=read("supabase/migrations/20261015213000_sp_label_exact_pair_transcription_v1.sql");
const edge=read("supabase/functions/sp-m1b-label-analyze-v2/index.ts");
test("exact-pair transcript is scoped to owner, front and ingredient hashes, profile and policy",()=>{
 assert.match(sql,/s\.owner_id=p_owner_id/);
 assert.match(sql,/s\.front_sha256=p_front_sha256/);
 assert.match(sql,/s\.ingredient_sha256=p_ingredient_sha256/);
 assert.match(sql,/s\.profile_used=p_profile/);
 assert.match(sql,/r\.owner_id=s\.owner_id/);
 assert.match(sql,/s\.engine_version='M1B_LABEL_SAFETY_V2'/);
 assert.match(sql,/r\.review_version='SP_SUPPLEMENT_REVIEW_V1'/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.sp_web_label_exact_pair_transcription_v1/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.sp_web_label_exact_pair_transcription_v1\(uuid,text,text,text\) TO service_role/);
});
test("selected transcript maximizes previously visible category, strength and directions",()=>{
 assert.match(sql,/completeness>=7/);
 assert.match(sql,/AYURVEDIC PROPRIETARY MEDICINE/);
 assert.match(sql,/s\.detected_ingredients::text/);
 assert.match(sql,/x->>'status'='VISIBLE'/);
 assert.match(sql,/ORDER BY completeness DESC,s\.created_at ASC/);
});
test("transcript never includes a previously calculated score or image bytes",()=>{
 const returned=sql.slice(sql.indexOf("SELECT jsonb_build_object("),sql.indexOf("FROM best b"));
 assert.doesNotMatch(returned,/screening_score|safety_score|owner_id|imageDataUrl|image_bytes|storage_path/);
 assert.match(returned,/detected_ingredients/);
 assert.match(returned,/supplement_label/);
 assert.match(returned,/EXACT_PAIR_TRANSCRIPTION_V1/);
});
test("backend prefers private exact pair before OCR, but always recalculates regulatory and clinical safety",()=>{
 assert.match(edge,/sp_web_label_exact_pair_transcription_v1/);
 assert.match(edge,/p_owner_id:userInfo\.id/);
 assert.match(edge,/exact\.data\?\.provenance/);
 assert.match(edge,/if\(!cachedExtraction\)/);
 assert.match(edge,/sp_web_resolve_label_ingredient_v2/);
 assert.match(edge,/sp_web_label_save_clinical_screen_v1/);
 assert.match(edge,/sp_web_label_record_supplement_review_v1/);
 assert.match(edge,/exact_pair_cache_hit:Boolean\(exactTranscription\)/);
});
