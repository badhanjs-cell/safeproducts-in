// Official-source supplement review. Label assertions are only made for observed
// text; a two-image check cannot establish package-wide compliance or lab quality.
export type SupplementObservation = {
  category_declaration: string; directions: string; daily_dose: string; ayush_manufacturing_license: string;
  fssai_license_number: string; not_for_medicinal_use: string;
  batch_and_expiry: string; precautions: string; claims: string;
  producer_details: string; veg_nonveg_mark: string;
};
export type ReviewCheck = {key:string;title:string;status:"REFERENCE_MATCH"|"VISIBLE"|"NOT_VISIBLE"|"REQUIRES_VERIFICATION"|"APPLICABILITY_UNCONFIRMED";detail:string;source_key:string};
export type RegulatoryReview = {
  review_version:string; regulatory_category:string; category_confirmed:boolean;
  scope_note:string; checks:ReviewCheck[]; references:{key:string;authority:string;role:string;title:string;url:string}[];
  caveat:string;
};
export const SUPPLEMENT_SOURCES = [
 {key:"FSSAI_NUTRA_2022",authority:"FSSAI",role:"Operational direction and schedules",title:"FSS (Nutra) Regulations 2022 operationalized direction, Annexure 1 and 2",url:"https://www.fssai.gov.in/upload/advisories/2022/04/624ac1be799dbDirection_Nutra_30_03_2022.pdf"},
 {key:"FSSAI_ASHWA_ROOT_2026",authority:"FSSAI",role:"Official advisory",title:"16 April 2026 advisory on Ashwagandha root-only use in food products",url:"https://www.fssai.gov.in/upload/advisories/2026/04/69e0d84fcac2fAdvisory%20on%20non%20use%20of%20ashwagandha%20leaves%20in%20crude%20or%20extract%20or%20any%20other%20form%20in%20food%20products-%20reg.pdf"},
 {key:"FSSAI_LABEL_2020",authority:"FSSAI",role:"Binding labelling framework",title:"Food Safety and Standards (Labelling and Display) Regulations 2020, compendium",url:"https://fssai.gov.in/upload/uploadfiles/files/Comp_Labelling%20Display_Version%20VII_03042025.pdf"},
 {key:"ICMR_RDA_2020",authority:"ICMR-NIN",role:"Nutrition guidance, not product approval",title:"Nutrient Requirements for Indians: RDA, EAR and upper limits",url:"https://www.icmr.gov.in/icmrobject/custom_data/1702892982_icmr_press_release_recommended_dietary_allowances_for_indians.pdf"},
 {key:"NIN_DIET_2024",authority:"ICMR-NIN",role:"Dietary advice, not product certification",title:"Dietary Guidelines for Indians, 2024",url:"https://www.nin.res.in/dietaryguidelines/pdfjs/locale/DGI07052024P.pdf"},
 {key:"AYUSH_DRUG_RULE161",authority:"Government of India / CDSCO",role:"Ayurvedic medicine labelling",title:"Drugs Rules 1945 Rule 161: Ayurvedic proprietary medicine labels",url:"https://cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2022/drug_rules/Drugs%20Rules%201945_2024%2009.09.2024.pdf"},
 {key:"NCCIH_ASHWA",authority:"NIH-NCCIH",role:"Clinical safety information, not Indian regulation",title:"Ashwagandha: Usefulness and Safety",url:"https://www.nccih.nih.gov/health/ashwagandha"}
] as const;
const clean=(s:unknown)=>typeof s==="string"?s.trim().slice(0,480):"";
export const EMPTY_SUPPLEMENT_OBSERVATION:SupplementObservation={
 category_declaration:"",directions:"",daily_dose:"",fssai_license_number:"",ayush_manufacturing_license:"",
 not_for_medicinal_use:"",batch_and_expiry:"",precautions:"",claims:"",
 producer_details:"",veg_nonveg_mark:""
};
export function buildSupplementReview(ingredients:string[],scope:string,profile:string,raw:unknown,schedule:unknown=null):RegulatoryReview|null{
 const full=ingredients.join(" ");
 const candidate=scope==="SUPPLEMENT_ORAL" || (scope==="UNKNOWN"&&/\bashwagandha\b|\bwithania somnifera\b/i.test(full));
 if(!candidate)return null;
 const s=(schedule&&typeof schedule==="object"?schedule:{}) as Record<string,unknown>;
 const scheduleConfirmed=s.reference_status==="SCHEDULE_REFERENCE_ONLY"&&s.agency==="FSSAI"
  &&s.standard_id==="FSSAI-NUTRA-2022-SCH-II"&&s.form==="extract"
  &&typeof s.usage_min_g_per_day==="number"&&typeof s.usage_max_g_per_day==="number"
  &&Number(s.usage_min_g_per_day)>0&&Number(s.usage_max_g_per_day)>=Number(s.usage_min_g_per_day);
 const x=(raw&&typeof raw==="object"?raw:{}) as Record<string,unknown>;
 const obs=Object.fromEntries(Object.keys(EMPTY_SUPPLEMENT_OBSERVATION).map(k=>[k,clean(x[k])])) as SupplementObservation;
 const checks:ReviewCheck[]=[];
 const add=(key:string,title:string,status:ReviewCheck["status"],detail:string,source_key:string)=>{
  checks.push({key,title,status,detail,source_key});
 };
 const field=(key:keyof SupplementObservation,title:string,source_key:string,explanation:string)=>{
  const v=obs[key];
  add(key,title,v?"VISIBLE":"NOT_VISIBLE",v?"Visible on photographed ingredient panel: "+v:explanation,source_key);
 };
 const declaredAyush=/\bayurvedic\s+proprietary\s+medicine\b/i.test(obs.category_declaration);
 const category=declaredAyush?"AYURVEDIC_PROPRIETARY_MEDICINE":/\bhealth\s+supplement\b/i.test(obs.category_declaration)?"HEALTH_SUPPLEMENT":
  /\bnutraceutical\b/i.test(obs.category_declaration)?"NUTRACEUTICAL":"UNCONFIRMED_FOOD_SUPPLEMENT";
 add("category","Applicable FSSAI category",category==="UNCONFIRMED_FOOD_SUPPLEMENT"?"APPLICABILITY_UNCONFIRMED":"VISIBLE",
   category==="UNCONFIRMED_FOOD_SUPPLEMENT"?
   "This resembles an oral supplement, but its legal food category and food-versus-AYUSH licence classification cannot be confirmed from the supplied panel alone.":
   "The photographed text declares "+obs.category_declaration+". Verify the applicable manufacturing licence and full label.",
   declaredAyush?"AYUSH_DRUG_RULE161":"FSSAI_NUTRA_2022");
 const ashwa=/\bashwagandha\b|\bwithania\s+somnifera\b/i.test(full);
 if(ashwa){
  add("fssai_schedule_master","FSSAI botanical-schedule database",declaredAyush?"APPLICABILITY_UNCONFIRMED":scheduleConfirmed?"REFERENCE_MATCH":"REQUIRES_VERIFICATION",
   declaredAyush?"Declared Ayurvedic proprietary medicine: FSSAI food-supplement rules do not govern approval of this product. The FSSAI botanical schedule is informative, not a compliance decision.":scheduleConfirmed?
    "Official FSSAI 2022 schedule match: Ashwagandha extract ("+s.usage_min_g_per_day+"–"+s.usage_max_g_per_day+" g per day). This is a listed botanical reference, not a product approval.":
    "No matching FSSAI schedule entry was returned by this read-only lookup. See linked original FSSAI document.",
   "FSSAI_NUTRA_2022");
  const root=/\broot\b/i.test(full),leaf=/\blea(?:f|ves)\b/i.test(full);
  add("ashwagandha_plant_part","Ashwagandha plant part",
   root&&!leaf?"REFERENCE_MATCH":"REQUIRES_VERIFICATION",
   root&&!leaf?
   declaredAyush?"The label declares root extract. The FSSAI root-only food advisory is not this Ayurvedic medicine\'s licensing criterion; authenticity remains unverified.":"The root-extract declaration is consistent with the FSSAI food advisory, without proving finished-product compliance.":
   leaf?"Leaf material appears in the declaration: FSSAI's April 2026 food advisory calls for root-only use. Requires urgent expert review.":
   "The plant part was not unambiguously identified. FSSAI advises roots and root extracts only, subject to relevant limits.",
   "FSSAI_ASHWA_ROOT_2026");
  const declaredMg=full.match(/\b(\d{2,4}(?:\.\d+)?)\s*mg\b/i);
  const dailyCount=obs.daily_dose.match(/\b(\d+(?:\.\d+)?)\s*(?:capsules?|tablets?)\s*(?:per\s*day|daily|a\s*day)\b/i);
  const grams=declaredMg&&dailyCount?Number(declaredMg[1])*Number(dailyCount[1])/1000:null;
  const clearDaily=grams!==null&&Number.isFinite(grams);
  add("ashwagandha_daily_usage","Ashwagandha extract daily-intake range",declaredAyush?"APPLICABILITY_UNCONFIRMED":clearDaily?"REQUIRES_VERIFICATION":"NOT_VISIBLE",
    clearDaily?
    "The ingredient amount and reported directions imply approximately "+grams!.toFixed(2)+" g/day. "+(scheduleConfirmed?"The matched FSSAI reference range is "+s.usage_min_g_per_day+"–"+s.usage_max_g_per_day+" g/day. ":"")+"Verify serving basis, legal food category, extract specification and current amendments before a compliance decision.":
    (scheduleConfirmed?"The matched FSSAI botanical extract range is "+s.usage_min_g_per_day+"–"+s.usage_max_g_per_day+" g/day. ":"The current FSSAI botanical schedule still requires verification. ")+"An ingredient amount is not the daily dose: recommended capsules per day and strength per capsule must be confirmed. No compliance determination is made.",
    "FSSAI_NUTRA_2022");
  add("clinical_precautions","Additional Ashwagandha safety considerations","REQUIRES_VERIFICATION",
    profile==="Pregnant Women"?
    "Pregnancy profile: NIH-NCCIH advises against Ashwagandha in pregnancy and breastfeeding. This is a clinically important caution, not a product compliance finding.":
    "Review pregnancy/breastfeeding, thyroid or autoimmune disorders, liver symptoms and potential medicine interactions (including sedatives and thyroid, diabetes or blood-pressure medicines) with a healthcare professional. NIH-NCCIH guidance is not FSSAI approval.",
    "NCCIH_ASHWA");
 }
 field("category_declaration","Declared product category",declaredAyush?"AYUSH_DRUG_RULE161":"FSSAI_NUTRA_2022","The applicable category declaration is not readable in the provided panel; do not treat this as proof it is absent from the entire pack.");
 if(declaredAyush)field("ayush_manufacturing_license","Ayurvedic manufacturing licence","AYUSH_DRUG_RULE161","A medicine manufacturing licence number is not legible in this photo; verify the full packaging and state AYUSH licensing record.");
 else field("fssai_license_number","FSSAI licence identification","FSSAI_LABEL_2020","A licence number was not legible in the provided panel. Check full packaging and official FoSCoS records.");
 field("directions","Directions for use",declaredAyush?"AYUSH_DRUG_RULE161":"FSSAI_NUTRA_2022","Directions are not readable here. A full directions panel is needed to check intended use.");
 field("daily_dose","Recommended daily usage",declaredAyush?"AYUSH_DRUG_RULE161":"FSSAI_NUTRA_2022","Recommended number of capsules per day is not readable; do not infer it from ingredient strength.");
 if(!declaredAyush)field("not_for_medicinal_use","Not-for-medicinal-use statement","FSSAI_NUTRA_2022","The statement is not visible in the supplied panel; check another side of the pack before evaluating labelling.");
 field("precautions","Warnings and precautions",declaredAyush?"AYUSH_DRUG_RULE161":"FSSAI_NUTRA_2022","Precautions, contraindications and interactions were not legible in this panel; do not claim they are absent on the pack.");
 field("batch_and_expiry","Batch, manufacturing and expiry details",declaredAyush?"AYUSH_DRUG_RULE161":"FSSAI_LABEL_2020","Batch/date information is not visible on this panel; inspect the side or bottom of pack.");
 field("producer_details","Manufacturer/marketer identification",declaredAyush?"AYUSH_DRUG_RULE161":"FSSAI_LABEL_2020","Manufacturer/marketer information was not visible in this image.");
 if(!declaredAyush)field("veg_nonveg_mark","Vegetarian/non-vegetarian declaration","FSSAI_LABEL_2020","The declaration is not visible here; inspect the complete pack and applicable exemptions.");
 field("claims","Health and disease claims",declaredAyush?"AYUSH_DRUG_RULE161":"FSSAI_NUTRA_2022","No assessable claim text was captured from this ingredient photo. Review complete packaging and promotional claims before evaluating.");
 add("nin_icmr","Role of ICMR-NIN reference values","APPLICABILITY_UNCONFIRMED",
   "ICMR-NIN nutrient RDAs guide vitamin/mineral intake where applicable; they do not approve individual brands or establish a separate RDA for this Ashwagandha extract. No unsupported RDA comparison has been made.",
   "ICMR_RDA_2020");
 return {
  review_version:"SP_SUPPLEMENT_REVIEW_V1",regulatory_category:category,
  category_confirmed:category!=="UNCONFIRMED_FOOD_SUPPLEMENT",
  scope_note:declaredAyush?"Label states Ayurvedic proprietary medicine. Review medicine labelling under AYUSH/Drugs Rules 1945, not as an FSSAI food supplement. No finished-product certification.":"India-focused FSSAI supplement screening; licensing category must be verified. No compliance certificate.",
  checks,references:SUPPLEMENT_SOURCES.map(r=>({...r})),
  caveat:"Results reflect only photographed readable text and cited public guidance. A complete label, official licensing validation, certificate of analysis, contaminants/microbiology and claims review are required for a full product assessment."
 };
}
