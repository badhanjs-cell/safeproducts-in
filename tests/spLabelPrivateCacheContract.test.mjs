import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const text = (path) => readFileSync(path, "utf8");
const sql = text("supabase/migrations/20261010103000_sp_label_private_image_cache_v1.sql");
const edge = text("supabase/functions/sp-label-front-cache-v2/index.ts");
const m1b = text("supabase/functions/sp-m1b-label-analyze-v2/index.ts");
const ui = text("src/routes/check-my-label.tsx");

test("private bucket, consent metadata and least-privileged access", () => {
  assert.match(sql, /sp-label-evidence-private-v1/);
  assert.match(sql, /public=false/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON public\.sp_web_label_private_images_v1 FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /UNIQUE\(analysis_id,owner_id,image_role\)/);
  assert.doesNotMatch(sql, /CREATE POLICY.*\b(anon|authenticated)\b/i);
});

test("cache returns ingredient extraction, never stored Safety Scores", () => {
  const block = sql.split("CREATE OR REPLACE FUNCTION public.sp_web_label_cached_extraction_v1")[1]
    .split("REVOKE ALL ON FUNCTION")[0];
  assert.match(block, /detected_ingredients/);
  assert.match(block, /a\.evidence_coverage = 100/);
  assert.match(block, /a\.research_pending_count = 0/);
  assert.doesNotMatch(block, /'safety_score',/);
  assert.match(m1b, /sp_web_label_cached_extraction_v1/);
  assert.match(m1b, /sp_web_score_label_safety_v1/);
  assert.match(m1b, /cache_hit:cachedExtraction/);
});

test("front-only image upload verifies real session and exact saved scan", () => {
  assert.match(edge, /\/auth\/v1\/user/);
  assert.match(edge, /body\.role !== "front"/);
  assert.match(edge, /image\.imageHash !== expectedImageHash/);
  assert.match(edge, /sp_web_label_pack_scan_v1/);
  assert.match(edge, /REGISTERED_EXACT_FRONT_SCAN_REQUIRED/);
  assert.match(edge, /sp_web_label_front_asset_v1/);
  assert.doesNotMatch(edge, /INGREDIENT_PHOTO_MUST_BE_SAVED_FIRST|IMAGE_STORAGE_CONSENT_REQUIRED/);
  assert.doesNotMatch(edge, /image_role=eq\.ingredients|role === "ingredients"/);
  assert.doesNotMatch(edge, /body\.safety_score|body\.detected_ingredients/);
});

test("frontend automatically saves product front only and gives privacy notice", () => {
  assert.doesNotMatch(ui, /savePhotos|setSavePhotos|checkbox.*save/);
  assert.match(ui, /role: "front"/);
  assert.match(ui, /imageDataUrl: frontImage\.dataUrl/);
  assert.match(ui, /ingredient photo is analysed but its image bytes are not stored/i);
  assert.match(ui, /out\.scan_id/);
  assert.doesNotMatch(ui, /imageDataUrl: ingredientImage\.dataUrl,\s*imageSha256/);
});

test("M1-B validates Supabase Auth before service-role writes or OpenAI calls", () => {
  assert.match(m1b, /\/auth\/v1\/user/);
  assert.match(m1b, /AUTH_REQUIRED/);
  assert.match(m1b, /AUTH_VERIFICATION_UNAVAILABLE/);
  assert.match(m1b, /if\(!verifiedUser\.ok\)/);
  assert.ok(m1b.indexOf("const userInfo=await verifiedUser.json()") < m1b.indexOf("sp_m1b_label_register_evidence_v1"));
  assert.ok(m1b.indexOf("const userInfo=await verifiedUser.json()") < m1b.indexOf('fetch("https://api.openai.com/v1/responses"'));
});

test("exact-pack cache keeps provisional and qualified scores distinct", () => {
  const next = text("supabase/migrations/20261014113000_sp_web_label_front_pack_screening_v1.sql");
  const search = text("src/lib/productSearch.functions.ts");
  assert.match(next, /sp_web_label_front_asset_v1/);
  assert.match(next, /sp_web_label_pack_scan_v1/);
  assert.match(next, /p\.pack_size_text/);
  assert.match(next, /regexp_replace\(lower\(p_query\)/);
  assert.match(next, /s\.profile_used=p_profile/);
  assert.match(next, /score_status<>'QUALIFIED' or evidence_coverage=100/);
  assert.match(next, /REVOKE ALL ON public\.sp_web_label_pack_scan_v1 FROM PUBLIC,anon,authenticated/);
  assert.doesNotMatch(next, /'storage_path',|'owner_id',|'front_sha256',|'ingredient_sha256',/);
  assert.match(search, /sp_web_label_exact_pack_search_v1/);
  const gated = text("supabase/migrations/20261014115000_sp_label_exact_pack_front_required_v1.sql");
  assert.match(gated, /JOIN public\.sp_web_label_front_asset_v1 f ON f\.scan_id=s\.id AND f\.front_sha256=s\.front_sha256/);
});

test("M1-B provisional index uses deterministic scorer and explicit evidence caps", () => {
  const label = text("src/lib/labels.functions.ts");
  const display = text("src/components/LabelQualifiedResult.tsx");
  assert.doesNotMatch(m1b, /coverage<50\?49|coverage<80\?69/);
  assert.match(m1b, /if\(regulatorySupported>0\)/);
  assert.match(m1b, /if\(coverage>=50\)score=value/);
  assert.match(m1b, /scoreStatus|durableStatus/);
  assert.match(m1b, /PROVISIONAL_SCORE/);
  assert.match(m1b, /not a verified full-product Safety Score/i);
  assert.match(m1b, /sp_web_label_record_pack_scan_v1/);
  assert.match(m1b, /sp_web_score_label_safety_v1/);
  assert.match(label, /PROVISIONAL_SCORE/);
  assert.match(display, /Preliminary score only/);
});

test("Withania somnifera is looked up as a visible botanical identity, not the whole dosage string",()=>{
  assert.match(m1b,/lookupCandidates/);
  assert.match(m1b,/withania\\s\+somnifera/);
  assert.match(m1b,/candidates\.push\("Withania somnifera"\)/);
  assert.match(m1b,/identity_verified===true/);
  assert.match(m1b,/regulatory_applicable===true/);
  assert.match(m1b,/status:"unknown",regulatory_applicable:false/);
});

test("undisclosed excipients are explained rather than falsely matched",()=>{
  assert.match(m1b,/unspecifiedExcipients/);
  assert.match(m1b,/placeholders=normalizedIngredients\.filter\(unspecifiedExcipients\)/);
  assert.match(m1b,/status:"undisclosed"/);
  assert.match(m1b,/excipients q\.s\./);
  assert.match(m1b,/undisclosed ingredients were not individually assessed/i);
});

test("zero-evidence scores are withdrawn and unscored scans can save a front photograph",()=>{
  const fix=text("supabase/migrations/20261014190000_sp_label_zero_evidence_integrity_v2_1.sql");
  assert.match(fix,/score_status='UNDETERMINED',screening_score=NULL/);
  assert.match(fix,/evidence_coverage,0\)=0/);
  assert.match(fix,/s\.evidence_coverage>=50/);
  assert.match(fix,/sp_web_label_front_asset_v1 f/);
  assert.match(edge,/"QUALIFIED", "PROVISIONAL", "UNDETERMINED"/);
  assert.match(ui,/if \(out\.scan_id &&/);
  assert.doesNotMatch(ui,/out\.safety_score !== null && out\.scan_id/);
});

test("front image uploader receives exactly the analysis session and never the ingredient photo",()=>{
  assert.match(ui,/headers: \{Authorization: \`Bearer \$\{accessToken\}\`\}/);
  assert.match(edge,/auth\/v1\/user/);
  assert.match(edge,/body\.role !== "front"/);
  assert.match(edge,/image\.imageHash !== expectedImageHash/);
  assert.doesNotMatch(edge,/imageDataUrl: ingredientImage/);
});
