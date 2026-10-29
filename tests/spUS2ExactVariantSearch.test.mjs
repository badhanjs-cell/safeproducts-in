import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isExactAnchorQuery} from "../supabase/functions/sp-m1b-search-v1/query-policy.mjs";
import {mergeCategoryProducts} from "../supabase/functions/sp-us2-search-v3/live-policy.mjs";

const verified={brand_name:"Tata 1mg",product_name:"Tejasya",variant_name:"KSM-66 Ashwagandha Pure Herb",pack_size_text:"60 Capsules"};
test("Tejasya exact brand+product+variant-prefix query is SPECIFIC",()=>{
 assert.equal(isExactAnchorQuery("Tata 1mg Tejasya KSM-66 Ashwagandha 60 Capsules",verified),true);
 assert.equal(isExactAnchorQuery("Tata 1mg Tejasya KSM-66 Ashwagandha Pure Herb 60 Capsules",verified),true);
 assert.equal(isExactAnchorQuery("Tata 1mg Tejasya 60 Capsules",verified),true);
});
test("different variant and broad category queries do not become exact",()=>{
 assert.equal(isExactAnchorQuery("Tata 1mg Tejasya Extra Strength 60 Capsules",verified),false);
 assert.equal(isExactAnchorQuery("Dove body wash",verified),false);
 assert.equal(isExactAnchorQuery("Ashwagandha 60 Capsules",verified),false);
});
test("SQL catalog fallback retains verified India identity and stored variant qualification",()=>{
 const sql=readFileSync("supabase/migrations/20261027222000_sp_us2_exact_variant_candidate_lookup_v1.sql","utf8");
 assert.match(sql,/v_identity_normalized/);
 assert.match(sql,/p\.identity_status='VERIFIED'/);
 assert.match(sql,/p\.market_country_code='IN'/);
 assert.match(sql,/p\.is_active=true/);
 assert.match(sql,/p\.variant_name/);
 assert.match(sql,/sp_m1b_search_catalog_candidates_v1/);
});

test("body-wash catalogue results exclude bathing bars and preserve genuine body wash",()=>{
 const rows=[{canonical_product_id:"bar",brand_name:"Dove",product_name:"Dove Bathing Bar 300 g",price:50},{canonical_product_id:"wash",brand_name:"Dove",product_name:"Dove Deeply Nourishing Body Wash 250 ml",price:220}];
 const result=mergeCategoryProducts([],rows,{query:"Dove body wash",limit:10});
 assert.deepEqual(result.products.map(x=>x.canonical_product_id),["wash"]);
});
