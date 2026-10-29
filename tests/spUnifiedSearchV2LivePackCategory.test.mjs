import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  parsePackKey,parseProductPackKey,mergeCategoryProducts,
  finalizeSpecificResults,applySafetyRows
} from "../supabase/functions/sp-us2-search-v3/live-policy.mjs";

const q=(product,brand,category,pack="200:ml",price=150)=>({
 canonical_product_id:brand+":"+product,
 product_fingerprint:brand+":"+product,
 product_name:product,brand_name:brand,category,
 pack_size_text:product,pack_normalized_key:pack,price,currency:"INR",
 result_group:"CATEGORY_PRODUCT",display_basis:"PRICE_ONLY_FALLBACK",safety_determined:false,
 safety_score:null,profile_score:null,child_score:null,pregnancy_score:null,senior_score:null
});
test("explicit 200 ml search stays 200 ml",()=>{
 assert.equal(parsePackKey("baby lotion 200 ml"),"200:ml");
 assert.equal(parseProductPackKey("baby lotion 200 ml"),"200:ml");
});
test("a 200ml x 3 saleable multipack is 600 ml even if catalog says 200:ml",()=>{
 assert.equal(parseProductPackKey("Himalaya Baby Cream Combo Pack. 200ml X 3 = 600ml"),"600:ml");
 assert.equal(parseProductPackKey("Himalaya Baby Lotion 3 x 200 ml"),"600:ml");
 assert.equal(parseProductPackKey("Himalaya Baby Lotion 200 ml pack of 3"),"600:ml");
 assert.equal(parseProductPackKey("Himalaya Baby Lotion 2 x 0.5 l"),"1000:ml");
 const wrong=q("Himalaya Baby Lotion Combo 200ml X 3 = 600ml","Himalaya","baby lotion","200:ml");
 const good=q("Johnson's Baby Milk Lotion 200ml","Johnson's","baby lotion");
 const r=mergeCategoryProducts([wrong,good],[],{query:"baby lotion 200 ml",selectedPackKey:"200:ml"});
 assert.equal(r.products.length,1);
 assert.equal(r.products[0].brand_name,"Johnson's");
});
test("baby cream incorrectly classified as baby lotion never enters baby lotion results",()=>{
 const wrong=q("Himalaya Baby Cream Extra Soft & Gentle Combo Pack. 200ml X 3 = 600ml","Himalaya","baby lotion");
 const wrongSingle=q("NIVEA Baby Soft Cream 200 ml","NIVEA","baby lotion");
 const correct=q("Johnson's Baby Milk Lotion 200 ml","Johnson's","baby lotion");
 const r=mergeCategoryProducts([wrong,wrongSingle,correct],[],{query:"baby lotion 200 ml",selectedPackKey:"200:ml"});
 assert.deepEqual(r.products.map(p=>p.brand_name),["Johnson's"]);
});
test("generic after shave lotion does not include explicitly different balm category",()=>{
 const lotion=q("Wild Stone After Shave Lotion 100ml","Wild Stone","after shave lotion","100:ml");
 const balm=q("LetsShave After Shave Balm 100ml","LetsShave","after shave lotion","100:ml");
 const r=mergeCategoryProducts([lotion,balm],[],{query:"after shave lotion",selectedPackKey:"100:ml"});
 assert.deepEqual(r.products.map(p=>p.brand_name),["Wild Stone"]);
});
test("exact-product merchant offers share one canonical identity, keep lowest distinct merchant prices, same pack",()=>{
 const exact=(merchant,price,pack="100:ml")=>({...q("NIVEA MEN Deep Comfort After Shave Lotion 100 ml","NIVEA MEN","after shave lotion",pack,price),
 canonical_product_id:"real-canonical",product_fingerprint:"real-canonical::offer::"+merchant,
 result_group:"EXACT_OFFER",offer_merchant:merchant,merchant_offer_id:merchant});
 const rows=[exact("A",220),exact("A",200),exact("B",229),exact("C",239),exact("D",245),exact("E",260),exact("F",300),exact("Z",1,"400:ml")];
 const result=finalizeSpecificResults(rows,"100:ml");
 assert.equal(result.length,5);
 assert.deepEqual(result.map(x=>x.offer_merchant),["A","B","C","D","E"]);
 assert.deepEqual(result.map(x=>x.price),[200,229,239,245,260]);
 assert.ok(result.every(x=>x.canonical_product_id==="real-canonical"));
});
test("do not infer pregnancy, child or senior scores from overall profile score",()=>{
 const product={...q("NIVEA MEN Deep Comfort After Shave Lotion 100 ml","NIVEA MEN","after shave lotion","100:ml"),canonical_product_id:"valid-1"};
 const safety=[{product_id:"valid-1",safety_score:89,child_score:null,pregnancy_score:null,senior_score:null,evidence_coverage:94,assessment_version:"M1B_COVERAGE_AWARE_V2"}];
 const general=applySafetyRows([product],safety,"all")[0];
 assert.equal(general.safety_determined,true);
 assert.equal(general.safety_score,89);
 assert.equal(general.profile_score,89);
 assert.equal(general.child_score,null);
 for(const profile of ["children","pregnant","seniors"]){
   const row=applySafetyRows([product],safety,profile)[0];
   assert.equal(row.safety_determined,false);
   assert.equal(row.display_basis,"PRICE_ONLY_FALLBACK");
   assert.equal(row.safety_score,null);
   assert.equal(row.profile_score,null);
 }
});
test("v3 ingestion uses normalized total pack parser and profile-sensitive safety adapter",()=>{
 const src=readFileSync("supabase/functions/sp-us2-search-v3/index.ts","utf8");
 assert.match(src,/const pk=parseProductPackKey\(title\)/);
 assert.match(src,/const requestedPackKey=parseProductPackKey\(query\)/);
 assert.match(src,/applySafetyRows\(composed,safety,profile\)/);
});
