import {test,expect} from "bun:test";
import {buildMultiSourceReview,EVIDENCE_SOURCES,EVIDENCE_RECORDS} from "../supabase/functions/sp-m1b-label-analyze-v2/multi-source-evidence-v1";

test("multi-ingredient vitamin/mineral formulation uses three independent official sources",()=>{
 const r=buildMultiSourceReview(["Vitamin D3 1000 IU","Calcium citrate 300 mg","Elemental iron 18 mg"],"SUPPLEMENT_ORAL","ALL");
 expect(r?.evidence.length).toBe(3);
 expect(r?.source_count).toBe(3);
 expect(r?.matched_ingredient_count).toBe(3);
 expect(r?.ingredient_evidence_coverage).toBe(100);
 expect(r?.numeric_product_safety_score).toBeNull();
 expect(r?.qualification).toBe("CURATED_PILOT_NOT_INDEPENDENTLY_VALIDATED");
});
test("mixed food caffeine and niacin evidence is scoped to food, not a medical product approval",()=>{
 const r=buildMultiSourceReview(["Caffeine 150 mg","Niacin 30 mg","Natural flavours"],"FOOD_BEVERAGE","ALL");
 expect(r?.source_count).toBe(2);
 expect(r?.unresolved_ingredients).toEqual(["Natural flavours"]);
 expect(r?.ingredient_evidence_coverage).toBe(67);
 expect(r?.evidence.every(x=>x.requires_exposure)).toBe(true);
});
test("cosmetic fragrance and salicylic acid have FDA source links and child precaution",()=>{
 const r=buildMultiSourceReview(["Water","Fragrance","Salicylic Acid 2%"],"COSMETIC_TOPICAL","Children");
 expect(r?.source_count).toBe(2);
 expect(r?.evidence.some(x=>x.id==="BHA_CHILDREN"&&x.severity==="PROFILE_CAUTION")).toBe(true);
 expect(r?.evidence.some(x=>x.id==="FRAGRANCE_SENSITIZATION")).toBe(true);
 expect(r?.unresolved_ingredients).toEqual(["Water"]);
 expect(r?.numeric_product_safety_score).toBeNull();
});
test("source records do not leak across use routes and alias matching preserves word boundaries",()=>{
 expect(buildMultiSourceReview(["Salicylic Acid 2%"],"SUPPLEMENT_ORAL","ALL")?.evidence).toHaveLength(0);
 expect(buildMultiSourceReview(["Caffeine 2%"],"COSMETIC_TOPICAL","ALL")?.evidence).toHaveLength(0);
 expect(buildMultiSourceReview(["Ironic blue extract"],"FOOD_BEVERAGE","ALL")?.evidence).toHaveLength(0);
 expect(buildMultiSourceReview(["Fragrance"],"HOUSEHOLD_OTHER","ALL")?.evidence).toHaveLength(0);
 expect(buildMultiSourceReview(["Fragrance"],"UNKNOWN","ALL")).toBeNull();
});
test("excipients disclosure gap is separated from named ingredients; cannot become safe by missing reference",()=>{
 const r=buildMultiSourceReview(["Excipients — q.s.","Ashwagandha KSM-66 root extract 600 mg","Unknown extract"],"SUPPLEMENT_ORAL","ALL");
 expect(r?.assessable_ingredient_count).toBe(2);
 expect(r?.disclosure_gaps).toHaveLength(1);
 expect(r?.source_count).toBe(1);
 expect(r?.ingredient_evidence_coverage).toBe(50);
 expect(r?.unresolved_ingredients).toEqual(["Unknown extract"]);
 expect(r?.numeric_product_safety_score).toBeNull();
});
test("source registry identifiers are unique, HTTPS, and evidence links resolve to known records",()=>{
 const sources=new Map(EVIDENCE_SOURCES.map(x=>[x.id,x]));
 expect(sources.size).toBe(EVIDENCE_SOURCES.length);
 expect(EVIDENCE_RECORDS.length).toBeGreaterThanOrEqual(10);
 expect(EVIDENCE_RECORDS.every(x=>sources.has(x.source_id))).toBe(true);
 expect(EVIDENCE_SOURCES.every(x=>x.url.startsWith("https://"))).toBe(true);
});
