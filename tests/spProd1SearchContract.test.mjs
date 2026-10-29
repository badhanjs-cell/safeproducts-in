import test from 'node:test';
import assert from 'node:assert/strict';
import {numberOrNull,toApiProfile,buildMakeSearchBody,normalizeProduct,normalizeSearchResponse} from '../src/lib/searchContract.ts';

// Entirely synthetic. No regulatory evidence is asserted or published by tests.
const product=(override={})=>({product_fingerprint:'fixture-a',product_name:'Synthetic fixture A',brand_name:'Fixture',category:'Hair Care',
  safety_score:90,child_score:70,pregnancy_score:65,senior_score:80,min_price:200,currency:'INR',merchant:'Fixture merchant',
  image_url:'https://example.com/image.png',best_offer_url:'https://example.com/product',raw_ingredient_text:'Water, Glycerin',
  safety_warnings:['Fixture warning'],recommendation_class:'RECOMMENDED',confidence_score:90,
  production_qualified:true,safety_engine_version:'2.2',qualification:{trusted_source:true,product_identity_verified:true,
    resolver_required:false,canonical:{status:'RESOLVED',unresolved_count:0},
    indian_regulatory:{jurisdiction:'IN',status:'VERIFIED',evidence_id:'SYNTHETIC-TEST-NOT-LEGAL-EVIDENCE'}},...override});
const envelope=(results=[product()],more={})=>({contract_version:'SP-PROD-1C/1.0',user_profile:'all',status:'READY',results,
  picks:{safest_product_id:'fixture-a',lowest_price_product_id:'fixture-a',best_value_product_id:'fixture-a'},
  value_policy_version:'SYNTHETIC-TEST-POLICY',...more});

test('missing scores remain null, including false and blank',()=>{
  for(const v of [null,undefined,'',false,true,[],{},'NaN','Infinity','0x64']) assert.equal(numberOrNull(v),null);
  assert.equal(numberOrNull(0),0); assert.equal(normalizeProduct(product({safety_score:null}),'all').safety_score,null);
});
test('actual child, pregnancy and senior aliases survive',()=>{
  assert.equal(normalizeProduct(product(),'children').profile_score,70);
  assert.equal(normalizeProduct(product(),'pregnant').profile_score,65);
  assert.equal(normalizeProduct(product(),'seniors').profile_score,80);
});
test('profile aliases are explicit and invalid profiles rejected',()=>{
  assert.equal(toApiProfile('Children'),'children'); assert.equal(toApiProfile('Pregnant Women'),'pregnant');
  assert.throws(()=>toApiProfile('unknown'));
});
test('Make request uses the four actual webhook field names and limit',()=>{
  const b=buildMakeSearchBody(' shampoo ','children',5,'Hair Care','Delhi');
  assert.deepEqual(b,{search_query:'shampoo',user_profile:'children',category:'Hair Care',location:'Delhi',result_limit:5,contract_version:'SP-PROD-1C/1.0'});
  assert.equal('query' in b,false); assert.equal('profile' in b,false);
});
test('request input cannot be empty or exceed shortlist cap',()=>{
  assert.throws(()=>buildMakeSearchBody(' ','all'));assert.throws(()=>buildMakeSearchBody('shampoo','all',11));
});
test('legacy array is not production readiness evidence',()=>assert.equal(normalizeSearchResponse([product()],'all').results.length,0));
test('explicit qualification is mandatory',()=>assert.equal(normalizeSearchResponse(envelope([product({production_qualified:false})]),'all').results.length,0));
test('wrong Safety Engine version is rejected',()=>assert.equal(normalizeSearchResponse(envelope([product({safety_engine_version:'2.1'})]),'all').results.length,0));
test('unknown ingredient resolution blocks recommendation',()=>{
  const p=product();p.qualification.canonical.unresolved_count=1;
  assert.equal(normalizeSearchResponse(envelope([p]),'all').results.length,0);
});
test('European lookup cannot masquerade as Indian verification',()=>{
  const p=product();p.qualification.indian_regulatory.jurisdiction='EU';
  assert.equal(normalizeSearchResponse(envelope([p]),'all').results.length,0);
});
test('untrusted source and required unresolved resolver each block readiness',()=>{
  for(const patch of [{trusted_source:false},{resolver_required:true,resolver_status:'REQUIRED'},{product_identity_verified:false}]){
    const p=product();Object.assign(p.qualification,patch);assert.equal(normalizeProduct(p,'all').production_qualified,false);
  }
});
test('delimiter-only ingredients cannot qualify',()=>assert.equal(normalizeProduct(product({raw_ingredient_text:', ,'}),'all').production_qualified,false));
test('zero, negative, absent and non-INR prices cannot receive price badge',()=>{
  for(const p of [product({min_price:0}),product({min_price:-1}),product({min_price:null}),product({currency:'USD'})])
    assert.equal(normalizeSearchResponse(envelope([p]),'all').results.length,0);
});
test('actual price, merchant, image, URL, warnings, recommendation and confidence preserved',()=>{
  const p=normalizeProduct(product(),'all');assert.equal(p.price,200);assert.equal(p.platform,'Fixture merchant');
  assert.equal(p.image_url,'https://example.com/image.png');assert.equal(p.affiliate_link,'https://example.com/product');
  assert.deepEqual(p.warnings,['Fixture warning']);assert.equal(p.recommendation,'RECOMMENDED');assert.equal(p.confidence,90);
});
test('untrusted URL schemes cannot qualify',()=>{
  assert.equal(normalizeProduct(product({best_offer_url:'javascript:alert(1)'}),'all').production_qualified,false);
  assert.equal(normalizeProduct(product({image_url:'http://example.com/image.png'}),'all').production_qualified,false);
});
test('selected profile never falls back to general score',()=>assert.equal(normalizeProduct(product({child_score:null}),'children').production_qualified,false));
test('one product can hold all three awards',()=>{
  const p=normalizeSearchResponse(envelope(),'all').results[0];assert.deepEqual(p.badges,{safest:true,lowestPrice:true,bestValue:true});
});
test('incorrect safest and cheapest picks are suppressed',()=>{
  const r=normalizeSearchResponse(envelope([product(),product({product_fingerprint:'fixture-b',safety_score:95,min_price:100})]),'all');
  assert.equal(r.results[0].badges.safest,false);assert.equal(r.results[0].badges.lowestPrice,false);
});
test('missing value policy and nonexistent pick cannot become awards',()=>{
  const p=normalizeSearchResponse(envelope(undefined,{value_policy_version:null,picks:{best_value_product_id:'missing'}}),'all').results[0];
  assert.equal(p.badges.bestValue,false);assert.equal(p.badges.safest,false);
});
test('warnings remain visible on avoid results and safe/value badges are suppressed',()=>{
  const p=normalizeSearchResponse(envelope([product({recommendation_class:'AVOID'})]),'all').results[0];
  assert.deepEqual(p.warnings,['Fixture warning']);assert.equal(p.badges.safest,false);assert.equal(p.badges.bestValue,false);
});
test('malformed warnings do not become an empty safe warning list',()=>assert.equal(normalizeProduct(product({safety_warnings:{warning:'lost'}}),'all').production_qualified,false));
test('profile mismatch and duplicate identity fail closed',()=>{
  assert.equal(normalizeSearchResponse(envelope(),'children').results.length,0);
  assert.equal(normalizeSearchResponse(envelope([product(),product()]),'all').results.length,0);
});
test('partial response skips unqualified products',()=>{
  const r=normalizeSearchResponse(envelope([product(),product({product_fingerprint:'bad',production_qualified:false})]),'all');
  assert.equal(r.results.length,1);assert.equal(r.status,'PARTIAL');assert.equal(r.rejectedCount,1);
});
test('timeout is distinct from an empty qualified result',()=>{
  assert.equal(normalizeSearchResponse(envelope([],{status:'TIMED_OUT'}),'all').status,'TIMED_OUT');
  assert.equal(normalizeSearchResponse(envelope([],{status:'NO_QUALIFIED_PRODUCTS'}),'all').status,'NO_QUALIFIED_PRODUCTS');
});

// ---------------- SP-PROD-1G consumer display contract (synthetic only) ----------------
const PROMISE='We will try to determine safety first. When reliable ingredient information is unavailable, we will still help you compare available products—but we will say clearly that safety could not be determined.';
const gSafe=(i)=>({product_fingerprint:`g-safe-${i}`,product_name:`Synthetic G safe ${i}`,brand_name:'Fixture',category:'Hair Care',
  offer_merchant:'Fixture merchant',price:100+i,price_text:`₹${100+i}`,currency:'INR',image_url:'https://example.com/i.png',
  affiliate_url:'https://example.com/p',safety_score:80,profile_score:80,child_score:70,pregnancy_score:65,senior_score:75,
  recommendation_class:'RECOMMENDED',safety_warnings:['Fixture warning'],overall_confidence:90,display_basis:'SAFETY_QUALIFIED',
  safety_determined:true,ingredient_qualification_decision:'QUALIFIED',trusted_source:true});
const gFall=(i,over={})=>({product_fingerprint:`g-fall-${i}`,product_name:`Synthetic G fallback ${i}`,brand_name:'Fixture',category:'Hair Care',
  offer_merchant:'Fixture merchant',price:50+i,price_text:`₹${50+i}`,currency:'INR',original_product_url:'https://example.com/p',
  safety_score:null,profile_score:null,child_score:null,pregnancy_score:null,senior_score:null,
  display_basis:'PRICE_ONLY_FALLBACK',safety_determined:false,safety_status_label:'Safety not determined',
  safety_unavailable_reason:'Ingredient list unavailable',ingredient_qualification_decision:'NOT_QUALIFIED',...over});
const gEnvelope=(products,more={})=>({status:'READY',profile:'ALL',products,safest_product:products[0]??null,
  lowest_price_product:products[products.length-1]??null,best_value_product:products[0]??null,
  price_fallback_count:0,safety_qualified_count:products.length,fallback_safety_claim:false,
  trust_promise:null,trust_promise_display_required:false,consumer_notice:null,ranking_version:'C2-v4.0-SP-PROD-1G',...more});

test('SP-PROD-1G mixed safety and fallback products all display with null fallback scores',()=>{
  const products=[gSafe(1),gSafe(2),gSafe(3),gFall(1),gFall(2),gFall(3)];
  const r=normalizeSearchResponse(gEnvelope(products,{status:'PARTIAL_SAFETY_WITH_PRICE_FALLBACK',price_fallback_count:3,
    safety_qualified_count:3,trust_promise:PROMISE,trust_promise_display_required:true,consumer_notice:'Some products show price only.'}),'all');
  assert.equal(r.results.length,6);
  assert.equal(r.trustPromiseDisplayRequired,true);assert.equal(r.trustPromise,PROMISE);
  for(const p of r.results.filter(x=>x.display_basis==='PRICE_ONLY_FALLBACK')){
    assert.equal(p.safety_score,null);assert.equal(p.profile_score,null);assert.equal(p.safety_determined,false);
    assert.equal(p.production_qualified,false);assert.equal(p.display_eligible,true);assert.equal(p.recommendation,null);
  }
});
test('all-fallback emergency displays products, keeps commercial badge only, requires promise',()=>{
  const products=[1,2,3,4,5,6].map(i=>gFall(i));
  const r=normalizeSearchResponse(gEnvelope(products,{status:'PRICE_ONLY_FALLBACK_READY',price_fallback_count:6,safety_qualified_count:0,
    safest_product:products[0],best_value_product:products[0],lowest_price_product:products[0],
    trust_promise:PROMISE,trust_promise_display_required:true}),'all');
  assert.equal(r.results.length,6);assert.equal(r.status,'PRICE_ONLY_FALLBACK_READY');
  assert.equal(r.results[0].badges.lowestPrice,true);
  assert.equal(r.results.some(p=>p.badges.safest||p.badges.bestValue),false);
  assert.equal(r.trustPromise,PROMISE);
});
test('fully scored READY response carries no trust promise',()=>{
  const r=normalizeSearchResponse(gEnvelope([1,2,3,4,5,6].map(i=>gSafe(i))),'all');
  assert.equal(r.results.length,6);assert.equal(r.trustPromiseDisplayRequired,false);assert.equal(r.trustPromise,null);
});
test('fallback carrying a safety score or claiming determination fails closed',()=>{
  assert.equal(normalizeSearchResponse(gEnvelope([gFall(1,{safety_score:70})]),'all').status,'INVALID_RESPONSE');
  assert.equal(normalizeSearchResponse(gEnvelope([gFall(1,{safety_determined:true})]),'all').status,'INVALID_RESPONSE');
  assert.equal(normalizeSearchResponse(gEnvelope([gFall(1,{child_score:40})]),'all').status,'INVALID_RESPONSE');
});
test('malformed featured hints cannot award safety badges to a fallback product',()=>{
  const f=gFall(1,{featured_type:'SAFEST'});
  const r=normalizeSearchResponse(gEnvelope([f,gSafe(1)],{safest_product:f,best_value_product:f,lowest_price_product:f}),'all');
  assert.equal(r.results[0].badges.safest,false);assert.equal(r.results[0].badges.bestValue,false);
  assert.equal(r.results[0].badges.lowestPrice,true);
});
test('backend-detected warnings stay visible on fallback products',()=>{
  const r=normalizeSearchResponse(gEnvelope([gFall(1,{safety_warnings:['Contains undeclared allergen risk']})]),'all');
  assert.deepEqual(r.results[0].warnings,['Contains undeclared allergen risk']);
});
test('SP-PROD-1G profile token mismatch and unknown display basis fail closed',()=>{
  assert.equal(normalizeSearchResponse(gEnvelope([gSafe(1)],{profile:'CHILD'}),'all').status,'INVALID_RESPONSE');
  assert.equal(normalizeSearchResponse(gEnvelope([gFall(1,{display_basis:'MYSTERY'})]),'all').status,'INVALID_RESPONSE');
});
test('backend profile tokens map deterministically',()=>{
  const r=normalizeSearchResponse(gEnvelope([gSafe(1)],{profile:'children'}),'children');
  assert.equal(r.results.length,1);assert.equal(r.results[0].profile_score,70);
});
