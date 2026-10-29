// SafeProducts independent benchmark evaluator.
// Distinct from consumer scoring. This is a deterministic validation gate only.
// Synthetic contract tests do NOT establish independent clinical validation.
export type ClinicalGold="LOW_CONCERN"|"CAUTION"|"HIGH_CONCERN";
export type RegulatoryGold="PERMITTED"|"RESTRICTED"|"PROHIBITED"|"NOT_APPLICABLE";
export type Prediction={
 clinical:ClinicalGold|"ABSTAIN";
 regulatory:RegulatoryGold|"UNDETERMINED";
 numericCandidate:number|null;
 policySha256:string;
};
export type Judgement={
 dimension:"CLINICAL"|"REGULATORY";
 reviewerId:string;organization:string;isBuilder:boolean;
 gold:ClinicalGold|RegulatoryGold;
 evidenceUrl:string;
};
export type BenchmarkCase={
 id:string;scope:"SUPPLEMENT_ORAL"|"FOOD_BEVERAGE"|"COSMETIC_TOPICAL";
 family:string;profile:"ALL"|"Children"|"Pregnant Women"|"Seniors";
 holdout:boolean;prediction:Prediction;reviews:Judgement[];
};
export type BenchmarkReport={
 verdict:"PASS"|"BLOCKED";
 category:string;total:number;goldAgreements:number;
 clinicallyHigh:number;detectedHigh:number;highRecall:number;
 falseReassurance:number;falseRegulatoryPermission:number;
 predictionCoverage:number;missingGold:number;
 criticalIssues:string[];
};
export function evaluateBenchmark(cases:BenchmarkCase[],expectedPolicySha:string):BenchmarkReport{
 if(!/^[a-f0-9]{64}$/.test(expectedPolicySha))throw Error("POLICY_SHA_REQUIRED");
 const scope=cases[0]?.scope??"UNKNOWN";
 const seen=new Set<string>();
 let goldAgreements=0,clinicallyHigh=0,detectedHigh=0,falseReassurance=0;
 let falseRegulatoryPermission=0,predictionsWithCoverage=0,missingGold=0;
 const issues:string[]=[];
 for(const c of cases){
  if(c.scope!==scope)issues.push("MIXED_CATEGORY");
  if(seen.has(c.id))issues.push("DUPLICATE_CASE");seen.add(c.id);
  if(!c.holdout)issues.push("DEVELOPMENT_CASE_PRESENT");
  if(c.prediction.policySha256!==expectedPolicySha)issues.push("POLICY_MISMATCH");
  const adjudicate=(dimension:"CLINICAL"|"REGULATORY")=>{
   const reviews=c.reviews.filter(r=>r.dimension===dimension);
   if(reviews.length!==2||reviews[0]?.reviewerId===reviews[1]?.reviewerId
    ||reviews[0]?.organization===reviews[1]?.organization
    ||reviews.some(r=>r.isBuilder||!r.evidenceUrl.startsWith("https://"))
    ||reviews[0]?.gold!==reviews[1]?.gold)return null;
   return reviews[0].gold;
  };
  const cg=adjudicate("CLINICAL"),rg=adjudicate("REGULATORY");
  if(!cg||!rg){missingGold++;continue}
  goldAgreements++;
  if(cg==="HIGH_CONCERN"){
   clinicallyHigh++;
   if(c.prediction.clinical==="HIGH_CONCERN")detectedHigh++;
   if(c.prediction.clinical==="LOW_CONCERN")falseReassurance++;
  }
  if((rg==="PROHIBITED"||rg==="RESTRICTED")&&c.prediction.regulatory==="PERMITTED")
   falseRegulatoryPermission++;
  if(c.prediction.clinical!=="ABSTAIN"&&c.prediction.regulatory!=="UNDETERMINED")
   predictionsWithCoverage++;
  if(c.prediction.numericCandidate!==null&&
     (!Number.isFinite(c.prediction.numericCandidate)||c.prediction.numericCandidate<0||c.prediction.numericCandidate>100))
    issues.push("INVALID_SCORE");
 }
 const highRecall=clinicallyHigh?detectedHigh/clinicallyHigh:0;
 const predictionCoverage=cases.length?predictionsWithCoverage/cases.length:0;
 if(cases.length<100)issues.push("INSUFFICIENT_HOLDOUT_SAMPLE");
 if(clinicallyHigh<20)issues.push("INSUFFICIENT_HIGH_CONCERN_CASES");
 if(goldAgreements!==cases.length)issues.push("INCOMPLETE_INDEPENDENT_GOLD");
 if(highRecall<.98)issues.push("INSUFFICIENT_HIGH_CONCERN_RECALL");
 if(predictionCoverage<.90)issues.push("EXCESSIVE_ABSTENTION");
 if(falseReassurance>0)issues.push("CRITICAL_FALSE_REASSURANCE");
 if(falseRegulatoryPermission>0)issues.push("FALSE_REGULATORY_CLEARANCE");
 return {verdict:issues.length?"BLOCKED":"PASS",category:scope,
  total:cases.length,goldAgreements,clinicallyHigh,detectedHigh,
  highRecall:Number(highRecall.toFixed(4)),falseReassurance,falseRegulatoryPermission,
  predictionCoverage:Number(predictionCoverage.toFixed(4)),missingGold,
  criticalIssues:[...new Set(issues)]};
}
