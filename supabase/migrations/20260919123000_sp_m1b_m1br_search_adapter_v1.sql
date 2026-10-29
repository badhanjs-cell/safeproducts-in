-- SafeProducts M1-B catalog search adapter v1
-- Read-only candidate discovery for the feature-gated M1-B foreground endpoint.
-- This function never calculates or publishes Safety Scores.

create or replace function public.sp_m1b_search_catalog_candidates_v1(
  p_query text,
  p_category text default 'ALL',
  p_limit integer default 10
) returns jsonb
language plpgsql
stable
security definer
set search_path='pg_catalog','public','pg_temp'
set statement_timeout='5s'
as $$
declare
  v_query text:=lower(btrim(coalesce(p_query,'')));
  v_category text:=upper(btrim(coalesce(p_category,'ALL')));
  v_limit integer:=least(greatest(coalesce(p_limit,10),1),10);
  v_rows jsonb;
begin
  if v_query='' or length(v_query)>200 then
    raise exception using errcode='22023',message='M1B_SEARCH_QUERY_INVALID';
  end if;

  select coalesce(jsonb_agg(x.card order by x.rank_score desc,x.product_name), '[]'::jsonb)
    into v_rows
  from (
    select
      p.product_name,
      (
        case when lower(p.product_name)=v_query then 100 else 0 end +
        case when lower(p.brand_name||' '||p.product_name)=v_query then 80 else 0 end +
        case when lower(p.product_name) like '%'||v_query||'%' then 40 else 0 end +
        case when lower(p.brand_name||' '||p.product_name) like '%'||v_query||'%' then 30 else 0 end +
        case when lower(coalesce(p.category,'')) like '%'||v_query||'%' then 10 else 0 end
      ) as rank_score,
      jsonb_build_object(
        'product_id',p.id,
        'product_fingerprint',p.product_fingerprint,
        'brand_name',p.brand_name,
        'product_name',p.product_name,
        'variant_name',p.variant_name,
        'pack_size_text',p.pack_size_text,
        'category',p.category,
        'market_country_code',p.market_country_code,
        'gtin',p.gtin,
        'identity_status',p.identity_status,
        'offer',case when o.id is null then null else jsonb_build_object(
          'platform_name',o.platform_name,
          'merchant_name',o.merchant_name,
          'source_url',o.source_url,
          'affiliate_url',o.affiliate_url,
          'price',o.price,
          'currency',o.currency,
          'list_price',o.list_price,
          'availability_status',o.availability_status,
          'image_url',coalesce(o.image_url,i.image_url),
          'verified',o.verified,
          'retrieved_at',o.retrieved_at
        ) end,
        'image_url',coalesce(i.image_url,o.image_url)
      ) as card
    from public.sp_catalog_product_v1 p
    left join lateral (
      select co.*
      from public.sp_catalog_commerce_offer_v1 co
      where co.product_id=p.id
        and co.verified=true
        and co.price is not null and co.price>0
        and upper(co.currency)='INR'
        and co.source_url ~ '^https://'
        and co.availability_status not in ('OUT_OF_STOCK','DISCONTINUED')
      order by co.retrieved_at desc,co.offer_confidence desc nulls last
      limit 1
    ) o on true
    left join lateral (
      select pi.*
      from public.sp_catalog_product_image_v1 pi
      where pi.product_id=p.id
        and pi.verified=true
        and pi.image_url ~ '^https://'
      order by pi.is_primary_display desc,pi.retrieved_at desc nulls last
      limit 1
    ) i on true
    where p.is_active=true
      and p.market_country_code='IN'
      and p.identity_status='VERIFIED'
      and o.id is not null
      and (v_category in ('','ALL') or upper(coalesce(p.category,''))=v_category)
      and (
        lower(p.product_name) like '%'||v_query||'%'
        or lower(p.brand_name||' '||p.product_name) like '%'||v_query||'%'
        or lower(coalesce(p.category,'')) like '%'||v_query||'%'
      )
    order by rank_score desc,p.product_name
    limit v_limit
  ) x;

  return jsonb_build_object('success',true,'query',v_query,'candidate_count',jsonb_array_length(v_rows),'candidates',v_rows);
end;$$;

revoke all on function public.sp_m1b_search_catalog_candidates_v1(text,text,integer) from public,anon,authenticated;
grant execute on function public.sp_m1b_search_catalog_candidates_v1(text,text,integer) to service_role;
