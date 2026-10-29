import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeSearchResponse } from '../src/lib/searchContract.ts';
import { searchProgressPhase, SEARCH_PROGRESS_NOTE, SEARCH_PROGRESS_PHASES } from '../src/lib/searchProgress.ts';

// Entirely synthetic. HF10 backend facts appear only as expectations about frontend behaviour.
const gSafe=(i,over={})=>({product_fingerprint:`hf10-safe-${i}`,product_name:`Synthetic HF10 safe ${i}`,brand_name:'Fixture',
  category:'Hair Care',offer_merchant:'Fixture merchant',price:100+i,price_text:`₹${100+i}`,currency:'INR',
  image_url:'https://example.com/i.png',affiliate_url:'https://example.com/p',safety_score:80,profile_score:80,
  child_score:70,pregnancy_score:65,senior_score:75,recommendation_class:'RECOMMENDED',safety_warnings:[],
  overall_confidence:90,display_basis:'SAFETY_QUALIFIED',safety_determined:true,
  ingredient_qualification_decision:'QUALIFIED',trusted_source:true,...over});
const gFall=(i,over={})=>({product_fingerprint:`hf10-fall-${i}`,product_name:`Synthetic HF10 fallback ${i}`,brand_name:'Fixture',
  category:'Hair Care',offer_merchant:'Fixture merchant',price:50+i,price_text:`₹${50+i}`,currency:'INR',
  original_product_url:'https://example.com/p',safety_score:null,profile_score:null,child_score:null,
  pregnancy_score:null,senior_score:null,display_basis:'PRICE_ONLY_FALLBACK',safety_determined:false,
  safety_status_label:'Safety not determined',safety_unavailable_reason:'Ingredient list unavailable',
  ingredient_qualification_decision:'NOT_QUALIFIED',...over});
const env=(products,more={})=>({status:'READY',profile:'ALL',products,safest_product:products[0]??null,
  lowest_price_product:products[products.length-1]??null,best_value_product:products[0]??null,
  price_fallback_count:0,safety_qualified_count:products.length,fallback_safety_claim:false,
  trust_promise:null,trust_promise_display_required:false,consumer_notice:null,
  ranking_version:'C2-v6.0-SP-PROD-H4.6',...more});

const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('server abort stays at 90s and browser deadline stays just above it at 95s',()=>{
  const server=read('src/lib/productSearch.functions.ts');
  const client=read('src/lib/searchClient.ts');
  const serverMs=Number(/controller\.abort\(\),\s*(\d+)\)/.exec(server)[1]);
  const clientMs=Number(/unavailable\('TIMED_OUT'\)\),\s*(\d+)\)/.exec(client)[1]);
  assert.equal(serverMs,90000);
  assert.equal(clientMs,95000);
  assert.ok(clientMs>serverMs,'browser deadline must lose to the server ceiling');
});

test('loading phases are deterministic by elapsed time only',()=>{
  assert.equal(searchProgressPhase(0),'Finding matching products…');
  assert.equal(searchProgressPhase(3999),'Finding matching products…');
  assert.equal(searchProgressPhase(4000),'Checking available product evidence…');
  assert.equal(searchProgressPhase(14999),'Checking available product evidence…');
  assert.equal(searchProgressPhase(15000),'Completing independent regulatory safety checks…');
  assert.equal(searchProgressPhase(34999),'Completing independent regulatory safety checks…');
  assert.equal(searchProgressPhase(35000),'Finalizing eligible results…');
  assert.equal(searchProgressPhase(600000),'Finalizing eligible results…');
  assert.equal(searchProgressPhase(-5),'Finding matching products…');
  assert.equal(searchProgressPhase(NaN),'Finding matching products…');
});

test('loading copy carries no percentage, safety conclusion or cache wording',()=>{
  const copy=[...SEARCH_PROGRESS_PHASES.map(p=>p.label),SEARCH_PROGRESS_NOTE].join(' ').toLowerCase();
  for(const banned of ['%','percent','is safe','are safe','unsafe','safest','cache','cached','warm','cold',
    'serpapi','make.com','railway','429'])
    assert.equal(copy.includes(banned),false,`loading copy must not mention ${banned}`);
});

test('H4.6 READY response is still accepted',()=>{
  const r=normalizeSearchResponse(env([gSafe(1),gSafe(2)]),'all');
  assert.equal(r.status,'READY');
  assert.equal(r.results.length,2);
  assert.equal(r.results[0].display_eligible,true);
});

test('fallback products still cannot expose safety scores',()=>{
  const r=normalizeSearchResponse(env([gFall(1)],{status:'PRICE_ONLY_FALLBACK_READY',price_fallback_count:1,
    safety_qualified_count:0,safest_product:null,best_value_product:null}),'all');
  const p=r.results[0];
  assert.equal(p.safety_score,null);assert.equal(p.profile_score,null);
  assert.equal(p.safety_determined,false);assert.equal(p.recommendation,null);
  assert.equal(p.badges.safest,false);assert.equal(p.badges.bestValue,false);
  assert.equal(normalizeSearchResponse(env([gFall(2,{safety_score:65})]),'all').status,'INVALID_RESPONSE');
});

test('compliance score is suppressed when backend marks evidence unavailable',()=>{
  const r=normalizeSearchResponse(env([gSafe(1,{compliance_score_available:false,regulatory_compliance_score:72,
    compliance_coverage_label:'Compliance evidence not applicable'})]),'all');
  assert.equal(r.results[0].compliance_score_available,false);
  assert.equal(r.results[0].regulatory_compliance_score,null);
});

test('unknown cache-related top-level metadata cannot change consumer output',()=>{
  const base=normalizeSearchResponse(env([gSafe(1),gFall(1)],{status:'PARTIAL_SAFETY_WITH_PRICE_FALLBACK',
    price_fallback_count:1,safety_qualified_count:1}),'all');
  const noisy=normalizeSearchResponse(env([gSafe(1),gFall(1)],{status:'PARTIAL_SAFETY_WITH_PRICE_FALLBACK',
    price_fallback_count:1,safety_qualified_count:1,cache_hit:true,cache_age_seconds:42,warm:true,
    railway_version:'1.8.1-H4.6B-HF10',b5_cache_ttl_minutes:15}),'all');
  assert.deepEqual(noisy,base);
  assert.equal(JSON.stringify(noisy).toLowerCase().includes('cache'),false);
});

test('no browser source references a Make webhook variable or value',()=>{
  const files=[];
  (function walk(dir){ for(const name of readdirSync(dir)) {
    const p=join(dir,name);
    if(statSync(p).isDirectory()) walk(p);
    else if(/\.(ts|tsx|js|jsx)$/.test(name)) files.push(p);
  }})('src');
  for(const f of files) {
    const src=readFileSync(f,'utf8');
    const browserWebhookName=['VITE','MAKE','SEARCH','WEBHOOK','URL'].join('_');
    assert.equal(src.includes(browserWebhookName),false,`${f} must not reference a browser webhook variable`);
    assert.equal(/https:\/\/hook[^\s'"`]*\.make\.com/.test(src),false,`${f} must not embed a Make webhook URL`);
    if(src.includes('MAKE_SEARCH_WEBHOOK_URL'))
      assert.ok(f.endsWith('productSearch.functions.ts'),`${f} must not read the server-only webhook variable`);
  }
});
