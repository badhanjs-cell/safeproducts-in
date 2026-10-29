create or replace function public.sp_us2_upsert_commerce_offer_v1(p_product_id uuid,p_offer jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,extensions,pg_temp as $f$
declare v_id uuid; v_url text:=nullif(btrim(p_offer->>'source_url'),''); v_pack text:=nullif(btrim(p_offer->>'pack_normalized_key'),''); v_price numeric; v_conf numeric;
begin
 if p_product_id is null or v_url is null or v_url !~ '^https://' then raise exception using errcode='22023',message='VALID_PRODUCT_AND_HTTPS_URL_REQUIRED'; end if;
 if coalesce((p_offer->>'exact_product_match')::boolean,false) is not true or coalesce((p_offer->>'variant_match')::boolean,true) is not true then raise exception using errcode='22023',message='EXACT_PRODUCT_REQUIRED'; end if;
 if v_pack is not null and coalesce((p_offer->>'exact_pack_match')::boolean,false) is not true then raise exception using errcode='22023',message='EXACT_PACK_REQUIRED'; end if;
 begin v_price:=nullif(p_offer->>'price','')::numeric; exception when others then v_price:=null; end;
 begin v_conf:=nullif(p_offer->>'confidence','')::numeric; exception when others then v_conf:=null; end;
 if v_price is null or v_price<0 or v_conf is null or v_conf<90 or v_conf>100 then raise exception using errcode='22023',message='OFFER_QUALITY_INVALID'; end if;
 select id into v_id from public.sp_catalog_commerce_offer_v1 where product_id=p_product_id and source_url=v_url order by retrieved_at desc limit 1;
 if v_id is null then
  insert into public.sp_catalog_commerce_offer_v1(product_id,platform_name,merchant_name,source_domain,source_url,price,currency,list_price,availability_status,image_url,offer_confidence,verified,market_country_code,retrieved_at,valid_until,notes,pack_size_text,pack_normalized_value,pack_normalized_unit,pack_normalized_key,exact_pack_match,pack_match_confidence)
  values(p_product_id,left(coalesce(nullif(p_offer->>'platform_name',''),'Merchant'),200),nullif(left(coalesce(p_offer->>'merchant_name',''),200),''),lower(regexp_replace(split_part(regexp_replace(v_url,'^https?://','','i'),'/',1),'^www\.','','i')),v_url,v_price,upper(left(coalesce(nullif(p_offer->>'currency',''),'INR'),8)),case when coalesce(p_offer->>'list_price','')~'^[0-9]+(\.[0-9]+)?$' then (p_offer->>'list_price')::numeric else null end,case when p_offer->>'availability_status' in('IN_STOCK','OUT_OF_STOCK','LIMITED','UNKNOWN','DISCONTINUED') then p_offer->>'availability_status' else 'UNKNOWN' end,case when coalesce(p_offer->>'image_url','')~'^https://' then p_offer->>'image_url' else null end,v_conf,true,'IN',now(),now()+interval '24 hours','Unified Search v2 commerce-only evidence.',nullif(p_offer->>'pack_size_text',''),case when coalesce(p_offer->>'pack_normalized_value','')~'^[0-9]+(\.[0-9]+)?$' then (p_offer->>'pack_normalized_value')::numeric else null end,nullif(p_offer->>'pack_normalized_unit',''),v_pack,coalesce((p_offer->>'exact_pack_match')::boolean,false),v_conf) returning id into v_id;
 else
  update public.sp_catalog_commerce_offer_v1 set price=v_price,currency=upper(left(coalesce(nullif(p_offer->>'currency',''),'INR'),8)),image_url=case when coalesce(p_offer->>'image_url','')~'^https://' then p_offer->>'image_url' else image_url end,offer_confidence=v_conf,verified=true,retrieved_at=now(),valid_until=now()+interval '24 hours',pack_size_text=coalesce(nullif(p_offer->>'pack_size_text',''),pack_size_text),pack_normalized_key=coalesce(v_pack,pack_normalized_key),exact_pack_match=coalesce((p_offer->>'exact_pack_match')::boolean,exact_pack_match),pack_match_confidence=v_conf,updated_at=now() where id=v_id;
 end if;
 return jsonb_build_object('success',true,'offer_id',v_id,'exact_pack_match',coalesce((p_offer->>'exact_pack_match')::boolean,false));
end;$f$;
revoke all on function public.sp_us2_upsert_commerce_offer_v1(uuid,jsonb) from public;
revoke all on function public.sp_us2_upsert_commerce_offer_v1(uuid,jsonb) from anon;
revoke all on function public.sp_us2_upsert_commerce_offer_v1(uuid,jsonb) from authenticated;
grant execute on function public.sp_us2_upsert_commerce_offer_v1(uuid,jsonb) to service_role;
