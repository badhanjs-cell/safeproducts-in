import {test,expect} from "bun:test";
import {clinicalScreenForLabel} from "../supabase/functions/sp-m1b-label-analyze-v2/clinical-safety-screen-v1";
import {buildSupplementReview} from "../supabase/functions/sp-m1b-label-analyze-v2/supplement-regulatory-review-v1";
const ingredients=["Ashwagandha (KSM-66®) (Withania somnifera) root extract (5% withanolides) — 600 mg","Excipients — q.s."];
const observed={category_declaration:"AN AYURVEDIC PROPRIETARY MEDICINE",daily_dose:"1 capsule once a day",directions:"1 capsule once a day"};
const report=()=>buildSupplementReview(ingredients,"SUPPLEMENT_ORAL","ALL",observed,null);
test("live label scenario routes to AYUSH and yields separately labelled provisional clinical screen",()=>{
 const r=report();
 expect(r).not.toBeNull();
 expect(r!.regulatory_category).toBe("AYURVEDIC_PROPRIETARY_MEDICINE");
 expect(r!.checks.find(c=>c.key==="category")?.source_key).toBe("AYUSH_DRUG_RULE161");
 expect(r!.checks.find(c=>c.key==="fssai_schedule_master")?.status).toBe("APPLICABILITY_UNCONFIRMED");
 const screen=clinicalScreenForLabel(ingredients,"SUPPLEMENT_ORAL","ALL",r);
 expect(screen?.status).toBe("PROVISIONAL_CLINICAL_SCREEN");
 expect(screen?.score).toBe(45);
 expect(screen?.signals).toHaveLength(5);
 expect(screen?.regulatory_evidence_coverage_separate).toBe(true);
 expect(screen?.signals.every(s=>s.source_url==="https://www.nccih.nih.gov/health/ashwagandha")).toBe(true);
});
test("pregnancy does not get a misleading reassuring number",()=>{
 const s=clinicalScreenForLabel(ingredients,"SUPPLEMENT_ORAL","Pregnant Women",report());
 expect(s?.status).toBe("AVOID_FOR_PROFILE");
 expect(s?.score).toBeNull();
});
test("children and seniors need personal context; no numeric risk index",()=>{
 for(const p of ["Children","Seniors"]) {
  const s=clinicalScreenForLabel(ingredients,"SUPPLEMENT_ORAL",p,report());
  expect(s?.status).toBe("NOT_ASSESSABLE");
  expect(s?.score).toBeNull();
 }
});
test("unsupported botanical, missing root or unverified medicine category cannot score",()=>{
 expect(clinicalScreenForLabel(["Turmeric root 600 mg"],"SUPPLEMENT_ORAL","ALL",report())).toBeNull();
 expect(clinicalScreenForLabel(["Ashwagandha leaf 600 mg"],"SUPPLEMENT_ORAL","ALL",report())).toBeNull();
 expect(clinicalScreenForLabel(["Ashwagandha root 600 mg","Calcium 50 mg"],"SUPPLEMENT_ORAL","ALL",report())).toBeNull();
 const unconfirmed=buildSupplementReview(ingredients,"SUPPLEMENT_ORAL","ALL",{daily_dose:"1 capsule once a day"},null);
 expect(clinicalScreenForLabel(ingredients,"SUPPLEMENT_ORAL","ALL",unconfirmed)?.score).toBeNull();
 const noDose=buildSupplementReview(ingredients,"SUPPLEMENT_ORAL","ALL",{category_declaration:"AN AYURVEDIC PROPRIETARY MEDICINE"},null);
 expect(clinicalScreenForLabel(ingredients,"SUPPLEMENT_ORAL","ALL",noDose)?.score).toBeNull();
});
