import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const t=(path)=>readFileSync(path,"utf8");
const source=t("supabase/functions/sp-m1b-label-analyze-v2/multi-source-evidence-v1.ts");
const edge=t("supabase/functions/sp-m1b-label-analyze-v2/index.ts");
const db=t("supabase/migrations/20261015224500_sp_multi_source_evidence_pilot_v1.sql");
const ui=t("src/components/MultiSourceEvidenceReview.tsx");
const lbl=t("src/lib/labels.functions.ts");
const search=t("src/lib/productSearch.functions.ts");
test("independent source registry is category-scoped and does not create product safety scores",()=>{
 assert.match(source,/CURATED_PILOT_NOT_INDEPENDENTLY_VALIDATED/);
 assert.match(source,/numeric_product_safety_score:null/);
 assert.match(source,/Math.round\(matched.size\/named.length\*100\)/);
 assert.match(source,/r.scopes.includes\(category\)/);
 assert.match(source,/EVIDENCE_SOURCES/);
 assert.match(source,/EVIDENCE_RECORDS/);
 assert.doesNotMatch(source,/Math.min\(100,100-|100-total|risk_score:/);
});
test("authenticated scan ledger rejects numeric results and unsafe source URLs",()=>{
 assert.match(db,/FORCE ROW LEVEL SECURITY/);
 assert.match(db,/p_report->>'qualification'<>'CURATED_PILOT_NOT_INDEPENDENTLY_VALIDATED'/);
 assert.match(db,/p_report->>'numeric_product_safety_score' IS NOT NULL/);
 assert.match(db,/OWNER_SCAN_MISMATCH/);
 assert.match(db,/a\.scan_id=s\.id AND a\.front_sha256=s\.front_sha256/);
 assert.match(db,/REVOKE ALL ON public.sp_web_label_multi_source_evidence_v1 FROM PUBLIC,anon,authenticated/);
 assert.match(db,/GRANT EXECUTE ON FUNCTION public.sp_web_label_save_multi_source_v1\(uuid,uuid,jsonb\) TO service_role/);
});
test("frontend and exact pack search treat curated evidence separately from qualified score",()=>{
 assert.match(edge,/sp_web_label_save_multi_source_v1/);
 assert.match(edge,/multi_source_review:multiSourceReview/);
 assert.match(ui,/not yet independently validated/);
 assert.match(ui,/not a regulatory/);
 assert.match(lbl,/SP_MULTI_SOURCE_EVIDENCE_V1/);
 assert.match(search,/sp_web_label_exact_pack_multi_source_v1/);
 assert.match(search,/v.numeric_product_safety_score===null/);
});
