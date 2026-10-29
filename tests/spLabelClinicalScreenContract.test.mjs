import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const clinical=read("supabase/functions/sp-m1b-label-analyze-v2/clinical-safety-screen-v1.ts");
const analyzer=read("supabase/functions/sp-m1b-label-analyze-v2/index.ts");
const review=read("supabase/functions/sp-m1b-label-analyze-v2/supplement-regulatory-review-v1.ts");
const migration=read("supabase/migrations/20261014214000_sp_clinical_screen_isolated_v1.sql");
const pending=read("src/components/LabelPendingResult.tsx");
const component=read("src/components/ClinicalSafetyScreen.tsx");
const search=read("src/lib/productSearch.functions.ts");
test("medicine declaration routes to AYUSH rule 161 rather than FSSAI food licensing",()=>{
 assert.match(review,/AYURVEDIC_PROPRIETARY_MEDICINE/);
 assert.match(review,/declaredAyush/);
 assert.match(review,/AYUSH_DRUG_RULE161/);
 assert.match(review,/FSSAI food-supplement rules do not govern approval/);
 assert.match(review,/ayush_manufacturing_license/);
 assert.match(analyzer,/ayush_manufacturing_license/);
});
test("clinical report uses a real clinical evidence source independent of FSSAI",()=>{
 assert.match(clinical,/https:\/\/www.nccih.nih.gov\/health\/ashwagandha/);
 assert.match(clinical,/LIVER_INJURY/);
 assert.match(clinical,/MEDICATION_INTERACTIONS/);
 assert.match(clinical,/LONG_TERM_UNCERTAINTY/);
 assert.match(clinical,/PROVISIONAL_CLINICAL_SCREEN/);
 assert.match(clinical,/not validated estimates of clinical risk/);
 assert.match(clinical,/regulatory_evidence_coverage_separate:true/);
 assert.doesNotMatch(clinical,/safety_score:/);
});
test("clinical numerical screen has explicit declaration, root, dose, medicine and profile guards",()=>{
 assert.match(clinical,/scope!=="SUPPLEMENT_ORAL"\|\|named.length!==1/);
 assert.match(clinical,/!\/\\broot\\b\//);
 assert.match(clinical,/declaredAyush/);
 assert.match(clinical,/oneDaily&&strength&&declaredAyush/);
 assert.match(clinical,/avoidPregnancy/);
 assert.match(clinical,/vulnerableWithoutDetails/);
 assert.match(clinical,/AVOID_FOR_PROFILE/);
 assert.match(clinical,/score!==null\?"PROVISIONAL_CLINICAL_SCREEN"/);
});
test("scan-owned clinical result persists separately and never overwrites qualified Safety Score",()=>{
 assert.match(migration,/sp_web_label_clinical_screen_v1/);
 assert.match(migration,/FORCE ROW LEVEL SECURITY/);
 assert.match(migration,/REVOKE ALL ON public.sp_web_label_clinical_screen_v1 FROM PUBLIC,anon,authenticated/);
 assert.match(migration,/owner_id=p_owner_id/);
 assert.match(migration,/regulatory_evidence_coverage_separate/);
 assert.match(migration,/sp_web_label_front_asset_v1 f ON f.scan_id=s.id/);
 assert.doesNotMatch(migration,/UPDATE public.sp_web_label_pack_scan_v1/);
 assert.match(analyzer,/sp_web_label_save_clinical_screen_v1/);
 assert.match(analyzer,/clinical_screen:clinicalScreen/);
});
test("pending report clearly labels non-qualified screen and shows scientific evidence",()=>{
 assert.match(pending,/ClinicalSafetyScreen screen={r.clinical_screen}/);
 assert.match(pending,/No Safety Score is shown for this pending result/);
 assert.match(component,/Provisional clinical screen/);
 assert.match(component,/not a qualified finished-product Safety Score/i);
 assert.match(component,/methodology/);
 assert.match(search,/sp_web_label_exact_pack_clinical_screen_v1/);
});

test("AYUSH category cannot inherit food-supplement permitted status",()=>{
 assert.match(analyzer,/declaredAyush=supplementReview\?\.regulatory_category==="AYURVEDIC_PROPRIETARY_MEDICINE"/);
 assert.match(analyzer,/regulatorySupported=declaredAyush\?0:/);
 assert.match(analyzer,/status:declaredAyush\?"identified"/);
 assert.match(analyzer,/Assess the declared medicine under AYUSH\/Drugs Rules/);
});
