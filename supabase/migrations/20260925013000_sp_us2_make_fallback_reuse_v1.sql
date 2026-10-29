-- SafeProducts SP-US2 Make market-standard fallback reuse v1.
-- Correlates completed acquisition by the user's requested pack, while reading only
-- the server-resolved same-unit fallback pack recorded by the protected callback.

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
  v_requested_pack text := nullif(lower(btrim(coalesce(p_requested_pack_key,''))),'');
  v_limit integer := least(greatest(coalesce(p_limit,10),1),10);
  v_rows jsonb;
  v_resolved_pack text;
  v_pack_resolution text;
begin
  if v_query='' or length(v_query)>200 then
    raise exception using errcode='22023',message='SP_US2_ACQUISITION_REUSE_QUERY_INVALID';
  end if;

  with recent_request as (
    select
      r.id,
      r.requested_pack_key,
      r.result_summary,
      r.completed_at,
      coalesce(
        nullif(lower(btrim(r.result_summary->>'resolved_pack_key')),''),
        r.requested_pack_key
      ) as effective_pack_key,
      coalesce(
        nullif(upper(btrim(r.result_summary->>'pack_resolution')),''),
        'REQUESTED'
      ) as pack_resolution
    from public.sp_us2_acquisition_request_v1 r
    where r.status='COMPLETED'
      and r.normalized_query=v_query
      and r.completed_at>=now()-interval '24 hours'
      and r.requested_pack_key is not distinct from v_requested_pack
      and jsonb_typeof(r.result_summary)='object'
      and (
        jsonb_typeof(r.result_summary->'candidate_product_ids')='array'
        or jsonb_typeof(r.result_summary->'reused_product_ids')='array'
      )
    order by r.completed_at desc,r.id
    limit 1
  ), correlated_ids as (
    select distinct (ids.value #>> '{}')::uuid as product_id
    from recent_request rr
    cross join lateral jsonb_array_elements(
      coalesce(rr.result_summary->'candidate_product_ids','[]'::jsonb)
      || coalesce(rr.result_summary->'reused_product_ids','[]'::jsonb)
    ) as ids(value)
    where jsonb_typeof(ids.value)='string'
      and (ids.value #>> '{}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ), rows as (
    select
      jsonb_build_object(
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
        'acquisition_correlated',true,
        'acquisition_requested_pack_key',rr.requested_pack_key,
        'acquisition_resolved_pack_key',rr.effective_pack_key,
        'acquisition_pack_resolution',rr.pack_resolution
      ) as row_data,
      o.price,
      p.brand_name,
      p.product_name,
      rr.effective_pack_key,
      rr.pack_resolution
    from recent_request rr
    join correlated_ids c on true
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
        and (rr.effective_pack_key is null or lower(co.pack_normalized_key)=rr.effective_pack_key)
        and coalesce(co.availability_status,'') not in ('OUT_OF_STOCK','DISCONTINUED')
        and (co.valid_until is null or co.valid_until>now())
      order by co.price asc nulls last,co.offer_confidence desc nulls last,co.retrieved_at desc,co.id
      limit 1
    ) o on true
    where p.is_active=true
      and p.market_country_code='IN'
      and p.identity_status in ('CANDIDATE','VERIFIED')
  ), bounded as (
    select *
    from rows
    order by price asc nulls last,brand_name,product_name
    limit v_limit
  )
  select
    coalesce(jsonb_agg(row_data order by price asc nulls last,brand_name,product_name),'[]'::jsonb),
    max(effective_pack_key),
    max(pack_resolution)
  into v_rows,v_resolved_pack,v_pack_resolution
  from bounded;

  if v_resolved_pack is null then
    select rr.effective_pack_key,rr.pack_resolution
    into v_resolved_pack,v_pack_resolution
    from (
      select
        coalesce(nullif(lower(btrim(r.result_summary->>'resolved_pack_key')),''),r.requested_pack_key) as effective_pack_key,
        coalesce(nullif(upper(btrim(r.result_summary->>'pack_resolution')),''),'REQUESTED') as pack_resolution
      from public.sp_us2_acquisition_request_v1 r
      where r.status='COMPLETED'
        and r.normalized_query=v_query
        and r.completed_at>=now()-interval '24 hours'
        and r.requested_pack_key is not distinct from v_requested_pack
        and jsonb_typeof(r.result_summary)='object'
      order by r.completed_at desc,r.id
      limit 1
    ) rr;
  end if;

  return jsonb_build_object(
    'success',true,
    'query',v_query,
    'requested_pack_key',v_requested_pack,
    'resolved_pack_key',v_resolved_pack,
    'pack_resolution',coalesce(v_pack_resolution,'REQUESTED'),
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
