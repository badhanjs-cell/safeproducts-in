function clean(value) { return typeof value === 'string' ? value.trim() : ''; }
function num(value) { if(value===null||value===undefined||value==='')return null; const n=Number(value); return Number.isFinite(n)?n:null; }
function toks(value) { return String(value??'').normalize('NFKC').toLowerCase().match(/[a-z0-9]+/g)??[]; }
function key(value) { return toks(value).join(''); }

const CATEGORY_PHRASES=[
  'after shave lotion','after shave balm','shaving cream','shaving foam','shaving gel','baby lotion','body lotion',
  'body wash','face wash','hair oil','after shave','shampoo','toothpaste','sunscreen','soap'
];
const NON_BRAND_PREFIX=new Set([
  'men','mens','male','women','womens','female','baby','babies','kid','kids','child','children','best','safe','safer','gentle',
  'natural','organic','mild','daily','everyday','adult','adults','charcoal','activated','brightening','whitening','hydrating','moisturizing',
  'moisturising','anti','dandruff','antidandruff','acne','herbal','aloe','neem','vitamin','salicylic','sulphate','sulfate','paraben','free',
  'deep','cleansing','oil','control','sensitive','refreshing','cool','menthol','serum'
]);
const PACK_RE=/\b(\d+(?:\.\d+)?)\s*(ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|gm|gms|grams?|grammes?|g|kg|kilograms?|capsules?|caps?|tablets?|tabs?|softgels?|sachets?|pieces?|pcs?|counts?|ct)\b/i;
const PACK_RE_G=/\b\d+(?:\.\d+)?\s*(?:ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|gm|gms|grams?|grammes?|g|kg|kilograms?|capsules?|caps?|tablets?|tabs?|softgels?|sachets?|pieces?|pcs?|counts?|ct)\b/gi;

export function parsePackKey(text){
  const m=clean(text).match(PACK_RE); if(!m)return null; let v=Number(m[1]); const u=m[2].toLowerCase(); let unit='g';
  if(u==='l'||u.startsWith('lit')){v*=1000;unit='ml';} else if(u==='kg'||u.startsWith('kilogram')){v*=1000;unit='g';}
  else if(u==='ml'||u.startsWith('millilit'))unit='ml'; else if(/caps|tabl|tabs|softgel|sachet|piece|pcs|count|ct/.test(u))unit='count';
  const n=Math.round(v*1e6)/1e6; return n>0?`${n}:${unit}`:null;
}
export function stripPack(text){return clean(text).replace(PACK_RE_G,' ').replace(/\s+/g,' ').trim();}

/** Total saleable pack, not its component/container size.
 * Examples: 200 ml × 3 = 600 ml; 3 x 200 ml = 600 ml; 200 ml pack of 3 = 600 ml.
 * A multipack is NEVER silently substituted for the requested single unit.
 */
function multipackKey(text){
  const s=clean(text).toLowerCase();if(!s)return null;
  const unit='ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|gm|gms|grams?|grammes?|g|kg|kilograms?';
  const forward=new RegExp('\\b(\\d+(?:\\.\\d+)?)\\s*('+unit+')\\s*(?:x|×|\\*)\\s*(\\d+)\\b','i').exec(s);
  const reverse=new RegExp('\\b(\\d+)\\s*(?:x|×|\\*)\\s*(\\d+(?:\\.\\d+)?)\\s*('+unit+')\\b','i').exec(s);
  const packOf=new RegExp('\\b(\\d+(?:\\.\\d+)?)\\s*('+unit+')\\s*(?:pack\\s*of|set\\s*of)\\s*(\\d+)\\b','i').exec(s);
  const prefixPackOf=new RegExp('\\b(?:pack|set)\\s*of\\s*(\\d+)\\D{0,35}?(\\d+(?:\\.\\d+)?)\\s*('+unit+')\\b','i').exec(s);
  let unitValue,unitName,count;
  if(forward){unitValue=Number(forward[1]);unitName=forward[2];count=Number(forward[3]);}
  else if(reverse){count=Number(reverse[1]);unitValue=Number(reverse[2]);unitName=reverse[3];}
  else if(packOf){unitValue=Number(packOf[1]);unitName=packOf[2];count=Number(packOf[3]);}
  else if(prefixPackOf){count=Number(prefixPackOf[1]);unitValue=Number(prefixPackOf[2]);unitName=prefixPackOf[3];}
  else return null;
  if(!Number.isFinite(unitValue)||!Number.isInteger(count)||count<2||count>100)return null;
  const component=parsePackKey(String(unitValue)+unitName);
  if(!component)return null;
  const [quantity,normalizedUnit]=component.split(':');
  const total=Number(quantity)*count;
  return total>0?Math.round(total*1e6)/1e6+':'+normalizedUnit:null;
}
function packKeyFromEvidence(value){const s=clean(value);return multipackKey(s)||parsePackKey(s);}
export function parseProductPackKey(text){return packKeyFromEvidence(text);}


export function deriveLiveIntent(queryText){
  const source=stripPack(queryText).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  for(const phrase of CATEGORY_PHRASES){
    const i=` ${source} `.indexOf(` ${phrase} `); if(i<0)continue;
    const real=Math.max(0,i-1); const prefix=source.slice(0,real).trim();
    if(!prefix)return {kind:'CATEGORY',brand:null,categoryQuery:phrase,providerQuery:source};
    const pt=toks(prefix);
    if(!pt.length||pt.every(t=>NON_BRAND_PREFIX.has(t))){
      return {kind:'CATEGORY',brand:null,categoryQuery:`${prefix} ${phrase}`.trim(),providerQuery:`${phrase} ${prefix}`.trim()};
    }
    if(pt.length<=3)return {kind:'BRAND_CATEGORY',brand:prefix,categoryQuery:phrase,providerQuery:source};
    return {kind:'CATEGORY',brand:null,categoryQuery:source,providerQuery:source};
  }
  return {kind:'CATEGORY',brand:null,categoryQuery:source,providerQuery:source};
}

function brandKey(p){return key(clean(p?.brand_name??p?.brand).replace(/\s+(?:men|women|baby|kids)$/i,''))||'__unknown__';}
function productId(p){return clean(p?.canonical_product_id)||clean(p?.product_fingerprint)||clean(p?.id)||`${brandKey(p)}|${key(p?.product_name??p?.name)}`;}
function packKey(p){const text=clean(p?.pack_size_text),name=clean(p?.product_name??p?.name);return multipackKey(name)||multipackKey(text)||clean(p?.pack_normalized_key).toLowerCase()||packKeyFromEvidence(text)||packKeyFromEvidence(name);}
function price(p){const n=num(p?.price);return n!==null&&n>0?n:null;}
function safety(p){if(p?.display_basis!=='SAFETY_QUALIFIED'||p?.safety_determined!==true)return null;const n=num(p?.profile_score??p?.safety_score);return n!==null&&n>=0&&n<=100?n:null;}
function identityKey(p){return productId(p);}
function descriptorBrand(p){const b=toks(p?.brand_name??p?.brand);return b.length>0&&b.every(t=>NON_BRAND_PREFIX.has(t));}
function officialDefault(p){
  const kind=clean(p?.pack_source_kind).toUpperCase();
  return p?.pack_is_official_default===true&&kind.startsWith('OFFICIAL_');
}
function packCmp(a,b){
  const [av,au]=String(a).split(':'),[bv,bu]=String(b).split(':');
  if(au!==bu)return au.localeCompare(bu);
  const an=Number(av),bn=Number(bv);
  if(Number.isFinite(an)&&Number.isFinite(bn)&&an!==bn)return an-bn;
  return String(a).localeCompare(String(b));
}
function modalPack(products=[]){
  const counts=new Map();
  for(const p of products){const pk=packKey(p);if(!pk)continue;counts.set(pk,(counts.get(pk)??0)+1);}
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]||packCmp(a[0],b[0]))[0]?.[0]??null;
}

/**
 * One immutable comparison pack per result set.
 * Explicit user pack always wins and is never substituted.
 * Without a pack, official India default evidence wins; otherwise use the
 * deterministic modal observed pack. Generic/category searches use the modal
 * official-default pack across brands when available.
 */
export function chooseComparisonPack(products=[],{mode='CATEGORY',explicitPackKey=null,intent=null}={}){
  const explicit=clean(explicitPackKey).toLowerCase();
  if(explicit)return explicit;
  let rows=Array.isArray(products)?products.filter(p=>packKey(p)):[];
  if(intent?.kind==='BRAND_CATEGORY'&&intent.brand){
    const wanted=key(intent.brand); rows=rows.filter(p=>brandKey(p)===wanted);
  }
  const official=rows.filter(officialDefault);
  if(official.length)return modalPack(official);
  return modalPack(rows);
}

export function chooseBrandCategoryPack(products=[], intent=null){
  if(intent?.kind!=='BRAND_CATEGORY')return null;
  return chooseComparisonPack(products,{mode:'SPECIFIC_PRODUCT',intent});
}

export function foregroundTargetCount(limit=10){return Math.max(1,Math.min(Math.trunc(Number(limit)||10),10));}
export function foregroundNeedsDiscovery(products=[],limit=10){return products.length<foregroundTargetCount(limit);}

function prefer(a,b){
  const as=safety(a),bs=safety(b); if((as!==null)!==(bs!==null))return bs!==null?b:a;
  const ap=price(a),bp=price(b); if(ap===null&&bp!==null)return b; if(ap!==null&&bp!==null&&bp<ap)return b;
  if(!clean(a?.image_url)&&clean(b?.image_url))return b; return a;
}

function relevant(p,intent,queryText){
  if(descriptorBrand(p))return false;
  const name=clean(p?.product_name??p?.name).toLowerCase();
  const target=clean(intent?.categoryQuery).toLowerCase();
  // Never let an incorrect stored category label substitute for a different formulation.
  if(target==='baby lotion'&&(!/\bbaby\b/.test(name)||!/\blotion\b/.test(name)))return false;
  // Do not let soap/bathing-bar catalog rows masquerade as liquid body wash.
  if(target==='body wash'&&!/(?:\bbody[ -]?wash\b|\bshower[ -]?gel\b)/.test(name))return false;
  if(target==='after shave lotion'&&!/(?:after[\s-]?shave|aftershave)\s+lotion\b/.test(name))return false;
  const hay=toks(`${p?.brand_name??p?.brand??''} ${p?.product_name??p?.name??''} ${p?.category??''}`);
  if(intent?.kind==='BRAND_CATEGORY'){
    if(brandKey(p)!==key(intent.brand))return false;
    return toks(intent.categoryQuery).every(t=>hay.some(h=>h===t||h.includes(t)));
  }
  const req=toks(stripPack(queryText)).filter(t=>!['for','with','the','and','men','mens','women','womens'].includes(t));
  return req.every(t=>hay.some(h=>h===t||(t.length>=4&&h.includes(t))));
}

export function mergeCategoryProducts(coreProducts=[],discoveryProducts=[],{query='',limit=10,selectedPackKey=null}={}){
  const intent=deriveLiveIntent(query); const all=[...coreProducts,...discoveryProducts].filter(p=>relevant(p,intent,query));
  const pack=selectedPackKey||chooseComparisonPack(all,{mode:'CATEGORY',intent}); const filtered=pack?all.filter(p=>packKey(p)===pack):all;
  const map=new Map(); const order=[];
  for(const p of filtered){
    const id=identityKey(p); if(!id)continue;
    if(!map.has(id)){map.set(id,p);order.push(id);} else map.set(id,prefer(map.get(id),p));
  }
  let rows=order.map(id=>map.get(id));
  if(intent.kind!=='BRAND_CATEGORY'){
    const perBrand=new Map(); const brandOrder=[];
    for(const p of rows){const b=brandKey(p);if(!perBrand.has(b)){perBrand.set(b,p);brandOrder.push(b);}else perBrand.set(b,prefer(perBrand.get(b),p));}
    rows=brandOrder.map(b=>perBrand.get(b));
  }
  rows.sort((a,b)=>(price(a)??Infinity)-(price(b)??Infinity)||String(a.product_name??a.name).localeCompare(String(b.product_name??b.name)));
  return {intent,selectedPackKey:pack,products:rows.slice(0,foregroundTargetCount(limit)),priceComparisonAvailable:!!pack};
}

export function propagateExactProductImage(products=[]){
  const exact=products.filter(p=>p?.result_group==='EXACT_OFFER'); const images=new Map();
  for(const p of exact){const id=clean(p?.canonical_product_id);const img=clean(p?.image_url);if(id&&img&&!images.has(id))images.set(id,img);}
  return products.map(p=>{
    if(p?.result_group!=='EXACT_OFFER'||clean(p?.image_url))return p;
    const img=images.get(clean(p?.canonical_product_id)); return img?{...p,image_url:img}:p;
  });
}

export function applySafetyRows(products=[], safetyRows=[], profile='all'){
  const byId=new Map((Array.isArray(safetyRows)?safetyRows:[]).map(r=>[clean(r.product_id),r]));
  return products.map(p=>{
    const r=byId.get(clean(p?.canonical_product_id)); if(!r)return p;
    const general=num(r.safety_score),selected=num(
      profile==='children'?r.child_score:profile==='pregnant'?r.pregnancy_score:profile==='seniors'?r.senior_score:r.safety_score);
    // No numeric recommendation for a profile whose risk evaluation was not qualified.
    if(general===null||selected===null)return {...p,display_basis:'PRICE_ONLY_FALLBACK',
      safety_determined:false,safety_score:null,profile_score:null,child_score:null,pregnancy_score:null,senior_score:null,
      ingredient_qualification_decision:'NOT_QUALIFIED',safety_status_label:'Safety Score unavailable for selected profile.',
      safety_unavailable_reason:'PROFILE_SPECIFIC_SAFETY_NOT_QUALIFIED'};
    const coverage=num(r.evidence_coverage);
    return {...p,display_basis:'SAFETY_QUALIFIED',safety_determined:true,safety_score:general,profile_score:selected,
      child_score:num(r.child_score),pregnancy_score:num(r.pregnancy_score),senior_score:num(r.senior_score),
      evidence_coverage:coverage,ingredient_qualification_decision:'QUALIFIED',safety_warnings:Array.isArray(r.warnings)?r.warnings:[],
      safety_status_label:`Safety ${Math.round(selected)}%`,safety_unavailable_reason:null,
      assessment_display_label:`Coverage-aware safety assessment · ${Math.round(coverage??0)}% evidence coverage`,
      assessment_source:clean(r.assessment_version)||'M1B_COVERAGE_AWARE_V2',assessment_disclaimer:clean(r.summary)||null};
  });
}

function merchantKey(p){return clean(p?.offer_merchant??p?.merchant_name??p?.platform_name??p?.source_domain).toLowerCase();}
function evidenceCoverage(p){return num(p?.evidence_coverage??p?.determination_confidence)??-1;}

export function finalizeSpecificResults(products=[],selectedPackKey=null){
  const rows=Array.isArray(products)?products:[];
  const exactRows=rows.filter(p=>p?.result_group==='EXACT_OFFER'&&(!selectedPackKey||packKey(p)===selectedPackKey));
  const anchorId=exactRows.map(productId).find(Boolean)??null;
  const exact=[];const seenMerchants=new Set();
  for(const p of exactRows.slice().sort((a,b)=>(price(a)??Infinity)-(price(b)??Infinity)||merchantKey(a).localeCompare(merchantKey(b)))){
    if(anchorId&&productId(p)!==anchorId)continue;
    const m=merchantKey(p);if(!m||seenMerchants.has(m))continue;seenMerchants.add(m);exact.push(p);if(exact.length>=5)break;
  }
  const alternatives=[];const seenBrands=new Set();const seenProducts=new Set(anchorId?[anchorId]:[]);
  for(const p of rows){
    if(p?.result_group!=='ALTERNATIVE'||(selectedPackKey&&packKey(p)!==selectedPackKey))continue;
    const id=productId(p),brand=brandKey(p);if(!id||seenProducts.has(id)||seenBrands.has(brand))continue;
    seenProducts.add(id);seenBrands.add(brand);alternatives.push(p);if(alternatives.length>=5)break;
  }
  return [...exact,...alternatives];
}

export function computePicks(products=[],priceComparisonAvailable=false){
  const scored=products.filter(p=>safety(p)!==null); const safest=scored.slice().sort((a,b)=>safety(b)-safety(a)||String(productId(a)).localeCompare(String(productId(b))))[0]??null;
  if(!priceComparisonAvailable)return {safest_product:safest,lowest_price_product:null,best_value_product:null};
  const hasExact=products.some(p=>p?.result_group==='EXACT_OFFER');
  const lowestPool=hasExact?products.filter(p=>p?.result_group==='EXACT_OFFER'):products;
  const priced=lowestPool.filter(p=>price(p)!==null); const low=priced.slice().sort((a,b)=>price(a)-price(b)||String(productId(a)).localeCompare(String(productId(b))))[0]??null;
  const crossProduct=hasExact
    ? products.filter(p=>p?.result_group!=='EXACT_OFFER')
    : products;
  const distinct=new Map();
  for(const p of crossProduct){
    const id=productId(p);if(!id||safety(p)===null||price(p)===null)continue;
    const old=distinct.get(id);if(!old||price(p)<price(old))distinct.set(id,p);
  }
  const ranked=[...distinct.values()].sort((a,b)=>
    safety(b)-safety(a)
    ||price(a)-price(b)
    ||evidenceCoverage(b)-evidenceCoverage(a)
    ||String(productId(a)).localeCompare(String(productId(b))));
  return {safest_product:safest,lowest_price_product:low,best_value_product:ranked[0]??null};
}

export function exactSharedImage(products=[]){return propagateExactProductImage(products);}
