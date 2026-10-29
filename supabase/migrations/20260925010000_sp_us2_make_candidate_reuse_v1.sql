-- SafeProducts SP-US2 recent Make candidate reuse v1.
-- Read-only bridge from completed acquisition audit rows back into unscored discovery.

begin;

create or replace function public.sp_us2_recent_acquisition_results_v1(
  p_query text,
  p_requested_pack_key text default null,
  p_limit integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','pg_temp'
set statement_timeout to '3s'
as $function$
declare
  v_query text := lower(regexp_replace(btrim(coalesce(p_query,'')),'[[:space:]]+',' ','g'));
  v_pack text := nullif(lower(btrim(coalesce(p_requested_pack_key,''))),'');
  v_limit integer := least(greatest(coalesce(p_limit,10),1),10);
  v_rows jsonb;
begin
  if v_query='' or length(v_query)>200 then
    raise exception using errcode='22023',message='SP_US2_ACQUISITION_REUSE_QUERY_INVALID';
  end if;

  with recent_requests as (
    select r.id,r.result_summary,r.completed_at
    from public.sp_us2_acquisition_request_v1 r
    where r.status='COMPLETED'
      and r.normalized_query=v_query
      and r.completed_at>=now()-interval '6 hours'
      and r.requested_pack_key is not distinct from v_pack
      and jsonb_typeof(r.result_summary->'candidate_product_ids')='array'
    order by r.completed_at desc,r.id
    limit 5
  ), candidate_ids as (
    select distinct (value #>> '{}')::uuid as product_id
    from recent_requests rr
    cross join lateral jsonb_array_elements(rr.result_summary->'candidate_product_ids') as ids(value)
    where jsonb_typeof(value)='string'
      and (value #>> '{}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ), rows as (
    select jsonb_build_object(
      'id',p.id,
      'product_id',p.id,
      'product_fingerprint',p.product_fingerprint,
      'name',p.product_name,
      'product_name',p.product_name,
      'brand',p.brand_name,
      'brand_name',p.brand_name,
      'variant_name',p.variant_name,
      'category',p.category,
      'pack_size_text',coalesce(o.pack_size_text,p.pack_size_text),
      'pack_normalized_key',o.pack_normalized_key,
      'source_url',o.source_url,
      'source_name',coalesce(o.platform_name,o.merchant_name,o.source_domain),
      'merchant_name',o.merchant_name,
      'platform',o.platform_name,
      'price',o.price,
      'currency','INR',
      'image_url',o.image_url,
      'identity_confidence',coalesce(p.identity_confidence,0),
      'market_country_code','IN',
      'acquisition_correlated',true
    ) as row_data,
    o.price,
    p.brand_name,
    p.product_name
    from candidate_ids c
    join public.sp_catalog_product_v1 p on p.id=c.product_id
    join lateral (
      select co.*
      from public.sp_catalog_commerce_offer_v1 co
      where co.product_id=p.id
        and co.verified=true
        and upper(coalesce(co.currency,''))='INR'
        and upper(coalesce(co.market_country_code,''))='IN'
        and co.source_url~'^https://'
        and co.exact_pack_match=true
        and co.pack_normalized_key is not null
        and (v_pack is null or lower(co.pack_normalized_key)=v_pack)
        and coalesce(co.availability_status,'') not in ('OUT_OF_STOCK','DISCONTINUED')
        and (co.valid_until is null or co.valid_until>now())
      order by co.price asc nulls last,co.offer_confidence desc nulls last,co.retrieved_at desc,co.id
      limit 1
    ) o on true
    where p.is_active=true
      and p.market_country_code='IN'
      and p.identity_status='CANDIDATE'
      and p.source_origin='SEARCH'
  )
  select coalesce(jsonb_agg(row_data order by price asc nulls last,brand_name,product_name),'[]'::jsonb)
  into v_rows
  from (select * from rows order by price asc nulls last,brand_name,product_name limit v_limit) bounded;

  return jsonb_build_object(
    'success',true,
    'query',v_query,
    'requested_pack_key',v_pack,
    'result_count',jsonb_array_length(v_rows),
    'results',v_rows
  );
end;
$function$;

revoke all on function public.sp_us2_recent_acquisition_results_v1(text,text,integer) from public;
revoke all on function public.sp_us2_recent_acquisition_results_v1(text,text,integer) from anon;
revoke all on function public.sp_us2_recent_acquisition_results_v1(text,text,integer) from authenticated;
grant execute on function public.sp_us2_recent_acquisition_results_v1(text,text,integer) to service_role;

commit;
