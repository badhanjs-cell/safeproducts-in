// SafeProducts multi-category safety-evidence aggregator v1.
// Auditable pilot corpus; not a validated product score, regulatory approval,
// clinical diagnosis, or confirmation of finished-product quality.
export type EvidenceCategory="SUPPLEMENT_ORAL"|"FOOD_BEVERAGE"|"COSMETIC_TOPICAL"|"HOUSEHOLD_OTHER";
export type EvidenceSignalSeverity="CAUTION"|"EXPOSURE_CHECK"|"PROFILE_CAUTION";
export type EvidenceSource={
 id:string; authority:string; category:"CLINICAL_SCIENCE"|"PUBLIC_HEALTH"|"REGULATORY_GUIDANCE"|"NOMENCLATURE";
 url:string; role:string;
};
export type EvidenceRecord={
 id:string;canonical:string;aliases:string[];scopes:EvidenceCategory[];
 source_id:string;severity:EvidenceSignalSeverity;summary:string;
 context:string;requires_exposure:boolean;profiles:string[];
};
export type MatchedEvidence={
 ingredient:string;canonical:string;id:string;severity:EvidenceSignalSeverity;
 summary:string;context:string;requires_exposure:boolean;source:EvidenceSource;
};
export type MultiSourceReview={
 version:"SP_MULTI_SOURCE_EVIDENCE_V1";
 qualification:"CURATED_PILOT_NOT_INDEPENDENTLY_VALIDATED";
 product_scope:string;category:string;source_count:number;matched_ingredient_count:number;
 assessable_ingredient_count:number;ingredient_evidence_coverage:number;
 assessment_band:"PROFILE_CAUTION"|"EVIDENCE_CAUTION"|"EVIDENCE_PARTIAL"|"NO_APPLICABLE_EVIDENCE";
 evidence:MatchedEvidence[];unresolved_ingredients:string[];disclosure_gaps:string[];
 source_roles:string[];warnings:string[];numeric_product_safety_score:null;
 methodology:string;
};
export const EVIDENCE_SOURCES:EvidenceSource[]=[
 {id:"NCCIH_ASHWAGANDHA",authority:"NIH-NCCIH",category:"CLINICAL_SCIENCE",url:"https://www.nccih.nih.gov/health/ashwagandha",role:"Botanical clinical risks; not Indian regulatory approval"},
 {id:"ODS_VITAMIN_D",authority:"NIH Office of Dietary Supplements",category:"CLINICAL_SCIENCE",url:"https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/",role:"Age-dependent intake limits and toxicity"},
 {id:"ODS_IRON",authority:"NIH Office of Dietary Supplements",category:"CLINICAL_SCIENCE",url:"https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/",role:"Iron excess and accidental ingestion risks"},
 {id:"ODS_CALCIUM",authority:"NIH Office of Dietary Supplements",category:"CLINICAL_SCIENCE",url:"https://ods.od.nih.gov/factsheets/calcium-HealthProfessional/",role:"Mineral dose considerations and interactions"},
 {id:"ODS_OMEGA3",authority:"NIH Office of Dietary Supplements",category:"CLINICAL_SCIENCE",url:"https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/",role:"Omega-3 adverse effects and drug interactions"},
 {id:"ODS_NIACIN",authority:"NIH Office of Dietary Supplements",category:"CLINICAL_SCIENCE",url:"https://ods.od.nih.gov/factsheets/Niacin-HealthProfessional/",role:"Form-dependent supplemental niacin risks"},
 {id:"FDA_CAFFEINE",authority:"US FDA",category:"PUBLIC_HEALTH",url:"https://www.fda.gov/consumers/consumer-updates/spilling-beans-how-much-caffeine-too-much",role:"Adult caffeine exposure advice; not an India-specific legal limit"},
 {id:"FDA_COSMETIC_ALLERGENS",authority:"US FDA",category:"PUBLIC_HEALTH",url:"https://www.fda.gov/cosmetics/cosmetic-ingredients/allergens-cosmetics",role:"Cosmetic sensitization and undeclared fragrance components"},
 {id:"FDA_BHA",authority:"US FDA",category:"PUBLIC_HEALTH",url:"https://www.fda.gov/cosmetics/cosmetic-ingredients/beta-hydroxy-acids",role:"Salicylic acid topical irritation, sun exposure and child precautions"},
 {id:"EC_COSING",authority:"European Commission",category:"NOMENCLATURE",url:"https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en",role:"Cosmetic ingredient nomenclature only; not proof of permission/safety"},
 {id:"FSSAI_STANDARDS",authority:"FSSAI",category:"REGULATORY_GUIDANCE",url:"https://fssai.gov.in/standards/product-standards?pr=1",role:"India food category rules require separate applicability checks"}
];
// Each claim is a narrowly scoped, source-grounded concern. No weight/score
// is inferred from the source and no therapeutic benefit is asserted.
export const EVIDENCE_RECORDS:EvidenceRecord[]=[
 {id:"ASHWA_GENERAL",canonical:"Withania somnifera (Ashwagandha)",aliases:["ashwagandha","withania somnifera"],scopes:["SUPPLEMENT_ORAL"],source_id:"NCCIH_ASHWAGANDHA",severity:"CAUTION",summary:"Adverse effects, rare liver injury reports and medication interactions warrant review.",context:"Herbal root extract; pregnancy/breastfeeding and some thyroid or autoimmune conditions require particular caution.",requires_exposure:true,profiles:["ALL","Seniors","Pregnant Women"]},
 {id:"ASHWA_PREGNANCY",canonical:"Withania somnifera (Ashwagandha)",aliases:["ashwagandha","withania somnifera"],scopes:["SUPPLEMENT_ORAL"],source_id:"NCCIH_ASHWAGANDHA",severity:"PROFILE_CAUTION",summary:"NIH-NCCIH advises avoiding Ashwagandha during pregnancy and breastfeeding.",context:"Pregnancy-profile warning; not a calculation of individual risk.",requires_exposure:false,profiles:["Pregnant Women"]},
 {id:"VITD_EXCESS",canonical:"Vitamin D",aliases:["vitamin d3","cholecalciferol","vitamin d2","ergocalciferol","vitamin d"],scopes:["SUPPLEMENT_ORAL","FOOD_BEVERAGE"],source_id:"ODS_VITAMIN_D",severity:"EXPOSURE_CHECK",summary:"Excess supplemental Vitamin D may cause toxicity; age-dependent tolerable upper intake limits apply.",context:"Assess total daily intake, IU/mcg conversion, age and all supplement sources; presence alone is not hazardous.",requires_exposure:true,profiles:[]},
 {id:"IRON_EXCESS",canonical:"Iron",aliases:["elemental iron","ferrous fumarate","ferrous sulfate","ferrous sulphate","ferrous gluconate","iron"],scopes:["SUPPLEMENT_ORAL","FOOD_BEVERAGE"],source_id:"ODS_IRON",severity:"EXPOSURE_CHECK",summary:"Iron overload and accidental ingestion can be serious; the dose and child access matter.",context:"Assess elemental-iron dose, indication, age and packaging. Iron in normal foods must not be equated with overdose.",requires_exposure:true,profiles:[]},
 {id:"CALCIUM_INTERACT",canonical:"Calcium",aliases:["calcium carbonate","calcium citrate","calcium lactate","calcium"],scopes:["SUPPLEMENT_ORAL","FOOD_BEVERAGE"],source_id:"ODS_CALCIUM",severity:"EXPOSURE_CHECK",summary:"Supplemental calcium can affect absorption of certain medicines, including levothyroxine and some antibiotics.",context:"Check amount, dosing schedule, other sources and medicine use; calcium presence alone is not a safety defect.",requires_exposure:true,profiles:[]},
 {id:"OMEGA3_INTERACT",canonical:"Omega-3 EPA/DHA",aliases:["omega-3","omega 3","fish oil","epa","dha","eicosapentaenoic acid","docosahexaenoic acid"],scopes:["SUPPLEMENT_ORAL","FOOD_BEVERAGE"],source_id:"ODS_OMEGA3",severity:"EXPOSURE_CHECK",summary:"Higher-dose omega-3 use requires reviewing anticoagulant medicines and total EPA/DHA intake.",context:"Check actual daily EPA/DHA quantities and medications, not only the fish-oil capsule weight.",requires_exposure:true,profiles:[]},
 {id:"NIACIN_FORM",canonical:"Niacin",aliases:["niacin","nicotinic acid","nicotinamide","niacinamide"],scopes:["SUPPLEMENT_ORAL","FOOD_BEVERAGE"],source_id:"ODS_NIACIN",severity:"EXPOSURE_CHECK",summary:"Supplemental niacin risks differ by chemical form and dose; nicotinic acid can cause flushing.",context:"Assess supplemental form, mg per daily serving and any medication use. Food-level niacin is not equivalent to high-dose supplements.",requires_exposure:true,profiles:[]},
 {id:"CAFFEINE_DOSE",canonical:"Caffeine",aliases:["caffeine","caffeine anhydrous"],scopes:["SUPPLEMENT_ORAL","FOOD_BEVERAGE"],source_id:"FDA_CAFFEINE",severity:"EXPOSURE_CHECK",summary:"Total caffeine from drinks and supplements matters; FDA cites 400 mg/day as generally not associated with negative effects for most adults.",context:"This is not an applicable limit for children, pregnancy or people with sensitivity and is not an Indian product authorization.",requires_exposure:true,profiles:[]},
 {id:"FRAGRANCE_SENSITIZATION",canonical:"Fragrance / Perfume",aliases:["fragrance","parfum","perfume"],scopes:["COSMETIC_TOPICAL"],source_id:"FDA_COSMETIC_ALLERGENS",severity:"CAUTION",summary:"Fragrance mixtures may contain allergens and can trigger contact dermatitis in susceptible users.",context:"Generic 'fragrance' may not disclose each component. Do not infer that a cosmetic is automatically unsafe.",requires_exposure:false,profiles:[]},
 {id:"BHA_SALICYLIC",canonical:"Salicylic acid (topical)",aliases:["salicylic acid","beta hydroxy acid"],scopes:["COSMETIC_TOPICAL"],source_id:"FDA_BHA",severity:"CAUTION",summary:"Topical BHA products can irritate skin; FDA recommends following directions and sun protection.",context:"Concentration, application frequency and formulation matter; this is not an Indian licensing determination.",requires_exposure:true,profiles:[]},
 {id:"BHA_CHILDREN",canonical:"Salicylic acid (topical)",aliases:["salicylic acid","beta hydroxy acid"],scopes:["COSMETIC_TOPICAL"],source_id:"FDA_BHA",severity:"PROFILE_CAUTION",summary:"FDA advises avoiding BHA-containing cosmetics on infants and children.",context:"Applicable child-profile precaution, not a claim about adult products.",requires_exposure:false,profiles:["Children"]}
];
const normalize=(s:string)=>s.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const includesAlias=(raw:string,alias:string)=>{
 const text=normalize(raw),term=normalize(alias);
 return !!term&&(" "+text+" ").includes(" "+term+" ");
};
const isDisclosure=(s:string)=>/^(?:excipients?|inactive ingredients?|other ingredients?|q\.?s\.?|fragrance components?\s*q\.?s\.?)(?:\s*[-—:]\s*(?:q\.?\s*s\.?|quantity sufficient|as needed))?\.?$/i.test(s.trim());
const resolveCategory=(scope:string)=>scope==="COSMETIC_TOPICAL"?"COSMETIC_TOPICAL":
 scope==="FOOD_BEVERAGE"?"FOOD_BEVERAGE":scope==="SUPPLEMENT_ORAL"?"SUPPLEMENT_ORAL":
 scope==="HOUSEHOLD_OTHER"?"HOUSEHOLD_OTHER":null;
export function buildMultiSourceReview(ingredients:string[],scope:string,profile:string):MultiSourceReview|null{
 const category=resolveCategory(scope);
 if(!category||!Array.isArray(ingredients)||ingredients.length<1||ingredients.length>150)return null;
 const clean=ingredients.map(x=>typeof x==="string"?x.slice(0,350).trim():"").filter(Boolean);
 const disclosed=clean.filter(isDisclosure),named=clean.filter(x=>!isDisclosure(x));
 if(!named.length)return {
   version:"SP_MULTI_SOURCE_EVIDENCE_V1",qualification:"CURATED_PILOT_NOT_INDEPENDENTLY_VALIDATED",
   product_scope:scope,category,source_count:0,matched_ingredient_count:0,assessable_ingredient_count:0,
   ingredient_evidence_coverage:0,assessment_band:"NO_APPLICABLE_EVIDENCE",evidence:[],
   unresolved_ingredients:[],disclosure_gaps:disclosed,
   source_roles:[],warnings:["No individually identifiable ingredients could be assessed."],
   numeric_product_safety_score:null,
   methodology:"Source-linked ingredient evidence coverage, not regulatory verification or a validated finished-product Safety Score."
 };
 const matched=new Set<number>(),evidence:MatchedEvidence[]=[];
 const sourceMap=new Map(EVIDENCE_SOURCES.map(s=>[s.id,s]));
 for(let i=0;i<named.length;i++){
  for(const r of EVIDENCE_RECORDS){
   if(!r.scopes.includes(category))continue;
   if(r.profiles.length>0&&!r.profiles.includes(profile))continue;
   if(!r.aliases.some(alias=>includesAlias(named[i],alias)))continue;
   const source=sourceMap.get(r.source_id);if(!source)continue;
   matched.add(i);
   evidence.push({ingredient:named[i],canonical:r.canonical,id:r.id,severity:r.severity,
      summary:r.summary,context:r.context,requires_exposure:r.requires_exposure,source});
  }
 }
 const unique=new Set(evidence.map(e=>e.source.url)),unknown=named.filter((_,i)=>!matched.has(i));
 const band=evidence.some(e=>e.severity==="PROFILE_CAUTION")?"PROFILE_CAUTION":
  evidence.some(e=>e.severity==="CAUTION"||e.severity==="EXPOSURE_CHECK")?"EVIDENCE_CAUTION":
  unknown.length?"EVIDENCE_PARTIAL":"NO_APPLICABLE_EVIDENCE";
 const warnings:string[]=["Pilot source-linked ingredient screening: NOT an independently validated product-level safety determination."];
 if(unknown.length)warnings.push(unknown.length+" ingredient(s) have no matched applicable source in this curated evidence set; no safety conclusion is inferred.");
 if(disclosed.length)warnings.push("Undisclosed mixture or q.s. excipients remain outside individual assessment.");
 if(evidence.some(e=>e.requires_exposure))warnings.push("Relevant dose, route, frequency and individual context must be confirmed before a product-level safety judgment.");
 if(category==="HOUSEHOLD_OTHER")warnings.push("Household chemical hazards require product-specific and concentration-specific guidance; no cross-domain medicine/cosmetic rule is applied.");
 return {
  version:"SP_MULTI_SOURCE_EVIDENCE_V1",qualification:"CURATED_PILOT_NOT_INDEPENDENTLY_VALIDATED",
  product_scope:scope,category,source_count:unique.size,matched_ingredient_count:matched.size,
  assessable_ingredient_count:named.length,
  ingredient_evidence_coverage:Math.round(matched.size/named.length*100),
  assessment_band:band,evidence,unresolved_ingredients:unknown,disclosure_gaps:disclosed,
  source_roles:[...new Set(evidence.map(e=>e.source.category))],warnings,
  numeric_product_safety_score:null,
  methodology:"v1: exact word-boundary ingredient aliases matched only within compatible use-category; selected evidence from published official sources; unique source count is a traceability metric. Ingredient coverage equals matched named ingredients divided by named declared ingredients (not FSSAI compliance or product safety probability). No severity weighting, numeric score, or approval is inferred. Benchmark validation, local legal scope, dose and finished-product evidence are separate requirements."
 };
}
