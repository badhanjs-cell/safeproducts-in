const cid=p=>String(p?.canonical_product_id??p?.product_id??p?.product_fingerprint??'');
const price=p=>Number.isFinite(Number(p?.price))&&Number(p.price)>0?Number(p.price):null;
const score=p=>p?.display_basis==='SAFETY_QUALIFIED'&&p?.safety_determined===true&&Number.isFinite(Number(p?.profile_score))?Number(p.profile_score):null;
export function orderDistinctProducts(products=[]){
 const first=new Map();(Array.isArray(products)?products:[]).forEach((p,i)=>{const id=cid(p);if(id&&!first.has(id))first.set(id,{p,i})});const rows=[...first.values()];if(rows.length<2)return rows.map(x=>x.p);
 let safest=null;for(const r of rows){const s=score(r.p);if(s===null)continue;if(!safest||s>score(safest.p)||(s===score(safest.p)&&cid(r.p).localeCompare(cid(safest.p))<0))safest=r}
 const used=new Set(),out=[];if(safest){out.push(safest.p);used.add(cid(safest.p))}
 const priced=rows.filter(r=>!used.has(cid(r.p))&&price(r.p)!==null).sort((a,b)=>price(a.p)-price(b.p)||a.i-b.i);if(priced.length){out.push(priced[0].p);used.add(cid(priced[0].p))}
 rows.filter(r=>!used.has(cid(r.p))).sort((a,b)=>(price(a.p)??Infinity)-(price(b.p)??Infinity)||a.i-b.i).forEach(r=>out.push(r.p));return out;
}
export function orderExactOffers(products=[]){return (Array.isArray(products)?products:[]).map((p,i)=>({p,i})).sort((a,b)=>(price(a.p)??Infinity)-(price(b.p)??Infinity)||a.i-b.i).map(x=>x.p)}
export function computeBestChoice(products=[]){
 const distinct=new Map();for(const p of Array.isArray(products)?products:[]){const s=score(p),pr=price(p),id=cid(p);if(!id||s===null||pr===null)continue;const old=distinct.get(id);if(!old||pr<price(old))distinct.set(id,p)}const rows=[...distinct.values()];if(!rows.length)return null;const prices=rows.map(price),min=Math.min(...prices),max=Math.max(...prices);const ranked=rows.map(p=>{const pv=max===min?1:1-((price(p)-min)/(max-min));return{p,value:0.7*(score(p)/100)+0.3*pv}});ranked.sort((a,b)=>b.value-a.value||score(b.p)-score(a.p)||price(a.p)-price(b.p)||cid(a.p).localeCompare(cid(b.p)));return ranked[0].p;
}
