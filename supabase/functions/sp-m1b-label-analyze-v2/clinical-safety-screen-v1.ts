// Source-grounded, versioned CLINICAL screening rubric. This is an ordinal
// prioritisation index, NOT an estimated chance of safety or regulatory approval.
// Changes to risk weights require a new version, tests and independent review.
export type ClinicalSignal={key:string;points:number;finding:string;source_url:string};
export type ClinicalScreen={
 version:"SP_CLINICAL_SCREEN_V1";score:number|null;status:"PROVISIONAL_CLINICAL_SCREEN"|"AVOID_FOR_PROFILE"|"NOT_ASSESSABLE";
 regulatory_evidence_coverage_separate:true;summary:string;signals:ClinicalSignal[];
 unknowns:string[];methodology:string;source_count:number;scope:"SINGLE_BOTANICAL_INGREDIENT";
};
const NCCIH="https://www.nccih.nih.gov/health/ashwagandha";
const risk=(key:string,points:number,finding:string):ClinicalSignal=>({key,points,finding,source_url:NCCIH});
export function clinicalScreenForLabel(
 ingredients:string[],scope:string,profile:string,report:unknown
):ClinicalScreen|null{
 const named=ingredients.filter(s=>!/^(?:excipients?|inactive ingredients?|q\.?s\.?)/i.test(s.trim()));
 if(scope!=="SUPPLEMENT_ORAL"||named.length!==1)return null;
 const primary=named[0];
 if(!/\b(?:withania\s+somnifera|ashwagandha)\b/i.test(primary))return null;
 // The ingredient must state ROOT; otherwise it cannot match this reference scenario.
 if(!/\broot\b/i.test(primary)||/\bleaves?\b/i.test(primary))return null;
 const input=report&&typeof report==="object"?report as Record<string,unknown>:{};
 const checks=Array.isArray(input.checks)?input.checks as Array<Record<string,unknown>>:[];
 const category=checks.find(x=>x.key==="category_declaration");
 const declaredAyush=typeof category?.detail==="string"&&/ayurvedic\s+proprietary\s+medicine/i.test(category.detail);
 const servings=checks.find(x=>x.key==="daily_dose");
 const oneDaily=typeof servings?.detail==="string"&&/\b1\s+capsule\s+once\s+a\s+day\b/i.test(servings.detail);
 const strength=/\b600\s*mg\b/i.test(primary);
 // A known evidence source supplies hazards; the points are a published
 // SafeProducts screening policy, not numeric risk estimates from NCCIH.
 const signals=[
   risk("GI_SEDATION",10,"NCCIH reports possible drowsiness and gastrointestinal side effects."),
   risk("LIVER_INJURY",15,"Rare liver injury cases have been reported with Ashwagandha."),
   risk("MEDICATION_INTERACTIONS",15,"Potential interactions include sedatives and thyroid, diabetes, blood-pressure and immunosuppressant medicines."),
   risk("THYROID_AUTOIMMUNE",10,"NCCIH advises against use in people with certain thyroid or autoimmune disorders."),
   risk("LONG_TERM_UNCERTAINTY",5,"Long-term safety beyond short-term use is not established.")
 ];
 const unknowns=[
   "Finished-product testing, authenticity and contaminants have not been verified.",
   "Unspecified excipients cannot be assessed individually.",
   "The user's medicines, conditions and duration of intended use are not known."
 ];
 if(!oneDaily||!strength)unknowns.push("A verified 600 mg-per-capsule and one-capsule-per-day exposure pairing was not established.");
 if(!declaredAyush)unknowns.push("The legal product category is not confirmed as Ayurvedic proprietary medicine.");
 const safeToCalculate=oneDaily&&strength&&declaredAyush;
 const avoidPregnancy=profile==="Pregnant Women";
 const vulnerableWithoutDetails=profile==="Children"||profile==="Seniors";
 if(vulnerableWithoutDetails)unknowns.push("An individualized safety screen cannot be calibrated for this vulnerable profile without age, conditions and medicines.");
 const total=signals.reduce((sum,s)=>sum+s.points,0);
 // A consumer should not receive a reassuring green score based on
 // missing product testing or interactions. We do not score pregnancy.
 const score=!safeToCalculate||avoidPregnancy||vulnerableWithoutDetails?null:Math.max(0,Math.min(100,100-total));
 const status=avoidPregnancy?"AVOID_FOR_PROFILE":score!==null?"PROVISIONAL_CLINICAL_SCREEN":"NOT_ASSESSABLE";
 return {
  version:"SP_CLINICAL_SCREEN_V1",score,status,regulatory_evidence_coverage_separate:true,
  summary:avoidPregnancy?
   "Ashwagandha should be avoided during pregnancy and breastfeeding per NIH-NCCIH. No numeric score is appropriate for this profile.":
   score!==null?
   "Provisional clinical risk-screening index based on published Ashwagandha safety signals. It is NOT a verified finished-product Safety Score and is not a probability of safe use.":
   "Published clinical cautions are available, but product category, dose or usage evidence is insufficient for a numeric screen.",
  signals,unknowns,
  methodology:"Policy v1: start 100; subtract 10 for sedation/GI, 15 for reported liver injury, 15 for medication interactions, 10 for thyroid/autoimmune cautions and 5 for long-term uncertainty. These weights are SafeProducts screening heuristics, not validated estimates of clinical risk. All risk signals are based on NIH-NCCIH; the exact product was not clinically tested. Never interpret the index as regulatory approval or safety probability.",
  source_count:1,scope:"SINGLE_BOTANICAL_INGREDIENT"
 };
}
