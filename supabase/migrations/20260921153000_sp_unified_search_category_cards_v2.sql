create or replace function public.sp_us2_category_cards_v1(p_category text,p_exclude_product_id uuid,p_pack_normalized_key text,p_limit integer default 10) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,extensions,pg_temp set statement_timeout='5s' as $f$
declare v_rows jsonb;
begin
 with ranked as (
  select p.*,
    row_number() over(partition by coalesce(nullif(lower(btrim(p.brand_name)),''),p.id::text) order by case when p.identity_status='VERIFIED' then 0 else 1 end,p.identity_confidence desc nulls last,p.updated_at desc,p.id) brand_rank
  from public.sp_catalog_product_v1 p
  where p.is_active=true and p.market_country_code='IN' and p.identity_status='VERIFIED'
    and lower(btrim(p.category))=lower(btrim(p_category))
    and (p_exclude_product_id is null or p.id<>p_exclude_product_id)
    and (p_pack_normalized_key is null or p.pack_normalized_key=p_pack_normalized_key)
 ), cards as (
  select jsonb_build_object(
    'product_id',p.id,'product_fingerprint',p.product_fingerprint,'brand_name',p.brand_name,'product_name',p.product_name,
    'variant_name',p.variant_name,'pack_size_text',p.pack_size_text,'pack_normalized_key',p.pack_normalized_key,
    'category',p.category,'market_country_code',p.market_country_code,'gtin',p.gtin,'identity_status',p.identity_status,
    'offer',case when o.id is null then null else jsonb_build_object('id',o.id,'platform_name',o.platform_name,'merchant_name',o.merchant_name,'source_url',o.source_url,'affiliate_url',o.affiliate_url,'price',o.price,'currency',o.currency,'list_price',o.list_price,'availability_status',o.availability_status,'image_url',coalesce(o.image_url,i.image_url),'verified',o.verified,'retrieved_at',o.retrieved_at,'pack_normalized_key',o.pack_normalized_key,'exact_pack_match',o.exact_pack_match) end,
    'image_url',coalesce(i.image_url,o.image_url),
    'strict_safety',case when s.id is null then null else jsonb_build_object('assessment_id',s.id,'assessment_version',s.assessment_version,'assessment_status',s.assessment_status,'safety_score',s.overall_score,'child_score',s.child_score,'pregnancy_score',s.pregnancy_score,'senior_score',s.senior_score,'determination_confidence',s.determination_confidence,'ingredient_snapshot_sha256',s.ingredient_snapshot_sha256,'regulatory_snapshot_ref',s.regulatory_snapshot_ref,'warnings',s.warnings,'summary',s.summary,'expires_at',s.expires_at) end
  ) card,
  p.brand_name,p.product_name
  from ranked p
  left join lateral(select co.* from public.sp_catalog_commerce_offer_v1 co where co.product_id=p.id and co.verified=true and co.price is not null and co.price>0 and upper(co.currency)='INR' and co.source_url~'^https://' and co.availability_status not in('OUT_OF_STOCK','DISCONTINUED') and (p_pack_normalized_key is null or(co.pack_normalized_key=p_pack_normalized_key and co.exact_pack_match=true)) order by co.price asc,co.offer_confidence desc nulls last,co.retrieved_at desc limit 1)o on true
  left join lateral(select pi.* from public.sp_catalog_product_image_v1 pi where pi.product_id=p.id and pi.verified=true and pi.image_url~'^https://' order by pi.is_primary_display desc,pi.retrieved_at desc nulls last limit 1)i on true
  left join lateral(select sa.* from public.sp_catalog_safety_assessment_v1 sa where sa.product_id=p.id and sa.is_current=true and sa.assessment_status='QUALIFIED' and sa.assessment_version='M1B_STRICT_REGULATORY_V1' and sa.expires_at>now() order by sa.determined_at desc limit 1)s on true
  where p.brand_rank=1
  order by p.identity_confidence desc nulls last,lower(p.brand_name),lower(p.product_name)
  limit greatest(1,least(coalesce(p_limit,10),10))
 ) select coalesce(jsonb_agg(card),'[]'::jsonb) into v_rows from cards;
 return jsonb_build_object('success',true,'cards',v_rows,'count',jsonb_array_length(v_rows));
end;$f$;
revoke all on function public.sp_us2_category_cards_v1(text,uuid,text,integer) from public;
revoke all on function public.sp_us2_category_cards_v1(text,uuid,text,integer) from anon;
revoke all on function public.sp_us2_category_cards_v1(text,uuid,text,integer) from authenticated;
grant execute on function public.sp_us2_category_cards_v1(text,uuid,text,integer) to service_role;
