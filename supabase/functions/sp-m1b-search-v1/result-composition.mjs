function key(v){return String(v??'').trim().toLowerCase()}
function packMatches(row,selectedPackKey){return !selectedPackKey||key(row?.pack_normalized_key)===key(selectedPackKey)}
function canonicalId(row){return String(row?.canonical_product_id??row?.product_id??'')}
function canonicalFingerprint(row){return String(row?.canonical_product_fingerprint??row?.product_fingerprint??'')}
function brandKey(row){return key(row?.brand_name)||'__unknown_brand__'}

export function composeSpecificResults({anchor,offers=[],alternatives=[],selectedPackKey=null}={}){
 if(!anchor||!canonicalId(anchor)) return [];
 const exact=[]; const seenMerchant=new Set();
 for(const offer of Array.isArray(offers)?offers:[]){
  if(exact.length>=5) break;
  const offerProduct=String(offer?.productId??offer?.product_id??canonicalId(anchor));
  if(offerProduct!==canonicalId(anchor)||!packMatches({pack_normalized_key:offer?.packNormalizedKey??offer?.pack_normalized_key},selectedPackKey)) continue;
  if(selectedPackKey&&offer?.exactPackMatch!==true&&offer?.exact_pack_match!==true) continue;
  const merchantKey=key(offer?.merchantName??offer?.merchant_name??offer?.sourceDomain??offer?.source_domain??offer?.platformName??offer?.platform_name);
  if(!merchantKey||seenMerchant.has(merchantKey)) continue; seenMerchant.add(merchantKey);
  const offerId=String(offer?.id??offer?.offer_id??offer?.sourceUrl??offer?.source_url??exact.length);
  exact.push({
   ...anchor,
   product_fingerprint:`${canonicalFingerprint(anchor)}::offer::${offerId}`,
   canonical_product_id:canonicalId(anchor),
   canonical_product_fingerprint:canonicalFingerprint(anchor),
   merchant_offer_id:offerId,
   result_group:'EXACT_OFFER',
   offer_merchant:offer?.merchantName??offer?.merchant_name??offer?.platformName??offer?.platform_name??anchor.offer_merchant??null,
   price:Number.isFinite(Number(offer?.price))?Number(offer.price):anchor.price??null,
   currency:String(offer?.currency??anchor.currency??'INR').toUpperCase(),
   original_product_url:offer?.sourceUrl??offer?.source_url??anchor.original_product_url??null,
   image_url:offer?.imageUrl??offer?.image_url??anchor.image_url??null,
   pack_size_text:offer?.packSizeText??offer?.pack_size_text??anchor.pack_size_text??null,
   pack_normalized_key:offer?.packNormalizedKey??offer?.pack_normalized_key??selectedPackKey??anchor.pack_normalized_key??null,
  });
 }
 const alt=[]; const seenBrand=new Set(); const seenProduct=new Set([canonicalId(anchor)]);
 for(const row of Array.isArray(alternatives)?alternatives:[]){
  if(alt.length>=5) break;
  const pid=canonicalId(row); const brand=brandKey(row);
  if(!pid||seenProduct.has(pid)||!packMatches(row,selectedPackKey)||seenBrand.has(brand)) continue;
  seenProduct.add(pid); seenBrand.add(brand);
  alt.push({...row,canonical_product_id:pid,canonical_product_fingerprint:canonicalFingerprint(row),merchant_offer_id:row?.merchant_offer_id??null,result_group:'ALTERNATIVE'});
 }
 return [...exact,...alt];
}

export function composeCategoryResults({products=[],selectedPackKey=null,limit=10}={}){
 const cap=Math.max(1,Math.min(Number(limit)||10,10)); const out=[]; const seenProduct=new Set(); const seenBrand=new Set();
 const eligible=(Array.isArray(products)?products:[]).filter(row=>packMatches(row,selectedPackKey));
 for(const row of eligible){
  if(out.length>=cap) break;
  const pid=canonicalId(row),brand=brandKey(row);
  if(!pid||seenProduct.has(pid)||seenBrand.has(brand))continue;
  seenProduct.add(pid);
  seenBrand.add(brand);
  out.push({...row,canonical_product_id:pid,canonical_product_fingerprint:canonicalFingerprint(row),merchant_offer_id:row?.merchant_offer_id??null,result_group:'CATEGORY_PRODUCT'});
 }
 return out;
}
