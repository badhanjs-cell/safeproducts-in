function https(value){try{const u=new URL(String(value??''));return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}}
function num(value){const n=Number(value);return Number.isFinite(n)&&n>=0?n:null}
export function canUsePaidCommerceDiscovery(packNormalizedKey,allowPaidDiscovery=false){return typeof packNormalizedKey==='string'&&packNormalizedKey.trim().length>0&&allowPaidDiscovery===true}
export function normalizeOffer(raw,expected={}){
 if(!raw||typeof raw!=='object'||raw.exactProductMatch!==true||raw.variantMatch===false) return null;
 if(expected.productId&&String(raw.productId)!==String(expected.productId)) return null;
 if(expected.packNormalizedKey&&(raw.exactPackMatch!==true||String(raw.packNormalizedKey)!==String(expected.packNormalizedKey))) return null;
 const sourceUrl=https(raw.sourceUrl); if(!sourceUrl) return null;
 const price=num(raw.price); if(price===null) return null;
 const confidence=num(raw.confidence); if(confidence===null||confidence<90||confidence>100) return null;
 const imageUrl=raw.imageUrl?https(raw.imageUrl):null;
 let domain=''; try{domain=new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./,'')}catch{}
 return {...raw,sourceUrl,imageUrl,price,confidence,sourceDomain:String(raw.sourceDomain??domain).toLowerCase(),currency:String(raw.currency??'INR').toUpperCase(),exactPackMatch:expected.packNormalizedKey?true:raw.exactPackMatch===true};
}
export function selectExactOffers(rawOffers,{productId,packNormalizedKey,limit=5}={}){
 const normalized=(Array.isArray(rawOffers)?rawOffers:[]).map(x=>normalizeOffer(x,{productId,packNormalizedKey})).filter(Boolean);
 normalized.sort((a,b)=>a.price-b.price||b.confidence-a.confidence||String(a.id??a.sourceUrl).localeCompare(String(b.id??b.sourceUrl)));
 const seen=new Set(), out=[];
 for(const offer of normalized){const key=(String(offer.merchantName??'').trim().toLowerCase()||offer.sourceDomain||String(offer.platformName??'').toLowerCase());if(seen.has(key))continue;seen.add(key);out.push(offer);if(out.length>=Math.max(1,Math.min(Number(limit)||5,5)))break;}
 return out;
}
