import {test,expect} from "bun:test";
import {evaluateBenchmark,type BenchmarkCase} from "../src/lib/safetyValidationBenchmark";
const sha="a".repeat(64);
function cases(scope:BenchmarkCase["scope"]="SUPPLEMENT_ORAL"):BenchmarkCase[]{
 return Array.from({length:120},(_,i)=>{
  const high=i<25,regRestricted=i%10===0;
  return {
   id:"OUTSIDE-"+scope+"-"+i,scope,family:"INDEPENDENT-PACK-FAMILY-"+i,
   profile:i%4===0?"Children":i%4===1?"Pregnant Women":i%4===2?"Seniors":"ALL",
   holdout:true,
   prediction:{clinical:high?"HIGH_CONCERN":i>=115?"ABSTAIN":"LOW_CONCERN",
    regulatory:regRestricted?"RESTRICTED":"PERMITTED",numericCandidate:null,policySha256:sha},
   reviews:[
    {dimension:"CLINICAL",reviewerId:"cA",organization:"Hospital A",isBuilder:false,
     gold:high?"HIGH_CONCERN":"LOW_CONCERN",evidenceUrl:"https://journal.example.org/clinical/"+i},
    {dimension:"CLINICAL",reviewerId:"cB",organization:"Hospital B",isBuilder:false,
     gold:high?"HIGH_CONCERN":"LOW_CONCERN",evidenceUrl:"https://journal.example.org/clinical/"+i},
    {dimension:"REGULATORY",reviewerId:"rA",organization:"Regulatory Organization A",isBuilder:false,
     gold:regRestricted?"RESTRICTED":"PERMITTED",evidenceUrl:"https://regulator.example.org/food/"+i},
    {dimension:"REGULATORY",reviewerId:"rB",organization:"Regulatory Organization B",isBuilder:false,
     gold:regRestricted?"RESTRICTED":"PERMITTED",evidenceUrl:"https://regulator.example.org/food/"+i}
   ] as BenchmarkCase["reviews"]
  } as BenchmarkCase;
 });
}
test("synthetic policy-gate fixture passes only with independent labels and clean predictions",()=>{
 for(const scope of ["SUPPLEMENT_ORAL","FOOD_BEVERAGE","COSMETIC_TOPICAL"] as const){
  const result=evaluateBenchmark(cases(scope),sha);
  expect(result.verdict).toBe("PASS");
  expect(result.total).toBe(120);
  expect(result.goldAgreements).toBe(120);
  expect(result.falseReassurance).toBe(0);
  expect(result.falseRegulatoryPermission).toBe(0);
 }
});
test("false reassurance on one clinically high-concern case vetoes promotion",()=>{
 const set=cases();set[0].prediction.clinical="LOW_CONCERN";
 const r=evaluateBenchmark(set,sha);
 expect(r.verdict).toBe("BLOCKED");
 expect(r.criticalIssues).toContain("CRITICAL_FALSE_REASSURANCE");
});
test("falsely permitting a restricted ingredient vetoes promotion",()=>{
 const set=cases();set[10].prediction.regulatory="PERMITTED";
 const r=evaluateBenchmark(set,sha);
 expect(r.verdict).toBe("BLOCKED");
 expect(r.criticalIssues).toContain("FALSE_REGULATORY_CLEARANCE");
});
test("no self-authored, duplicate organization or disputed gold labels qualify",()=>{
 const set=cases();set[2].reviews[0].isBuilder=true;
 expect(evaluateBenchmark(set,sha).criticalIssues).toContain("INCOMPLETE_INDEPENDENT_GOLD");
 const sameOrg=cases();sameOrg[3].reviews[1].organization="Hospital A";
 expect(evaluateBenchmark(sameOrg,sha).verdict).toBe("BLOCKED");
 const disputed=cases();disputed[40].reviews[0].gold="HIGH_CONCERN";
 expect(evaluateBenchmark(disputed,sha).verdict).toBe("BLOCKED");
});
test("insufficient samples, insufficient critical examples, wrong policy or absent holdouts fail",()=>{
 expect(evaluateBenchmark(cases().slice(0,30),sha).verdict).toBe("BLOCKED");
 const incorrect=cases();incorrect[0].prediction.policySha256="b".repeat(64);
 expect(evaluateBenchmark(incorrect,sha).criticalIssues).toContain("POLICY_MISMATCH");
 const contaminated=cases();contaminated[0].holdout=false;
 expect(evaluateBenchmark(contaminated,sha).criticalIssues).toContain("DEVELOPMENT_CASE_PRESENT");
});
test("abstention is measured, but cannot erase high-risk misses",()=>{
 const set=cases();for(let i=0;i<60;i++)set[i].prediction.clinical="ABSTAIN";
 const r=evaluateBenchmark(set,sha);
 expect(r.verdict).toBe("BLOCKED");
 expect(r.criticalIssues).toContain("EXCESSIVE_ABSTENTION");
 expect(r.criticalIssues).toContain("INSUFFICIENT_HIGH_CONCERN_RECALL");
});
test("synthetic case examples never count as external expert validation",()=>{
 const r=evaluateBenchmark(cases(),sha);
 expect(r.verdict).toBe("PASS");
 // This is a unit test of rejection/approval arithmetic; none of the four
 // fictional reviewer identities belongs in the live credential registry.
 expect(cases()[0].reviews[0].evidenceUrl).toContain("example.org");
});
