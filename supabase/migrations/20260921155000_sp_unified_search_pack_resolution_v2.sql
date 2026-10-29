-- SafeProducts Unified Search v2 pack-resolution hardening
-- Adds explicit canonical pack provenance, keeps missing price non-blocking,
-- and preserves strict safety snapshot integrity.

begin;

alter table public.sp_catalog_product_v1
  add column if not exists pack_is_official_default boolean not null default false,
  add column if not exists pack_source_kind text;

create index if not exists sp_catalog_product_v1_official_default_pack_idx
  on public.sp_catalog_product_v1 (pack_is_official_default, pack_normalized_key)
  where is_active = true and pack_is_official_default = true;

create or replace function public.sp_us2_exact_offers_v1(
  p_product_id uuid,
  p_pack_normalized_key text,
  p_limit integer default 5
)
returns table(
  id uuid,
  product_id uuid,
  platform_name text,
  merchant_name text,
  source_domain text,
  source_url text,
  affiliate_url text,
  price numeric,
  currency text,
  list_price numeric,
  availability_status text,
  image_url text,
  offer_confidence numeric,
  verified boolean,
  market_country_code text,
  pack_size_text text,
  pack_normalized_value numeric,
  pack_normalized_unit text,
  pack_normalized_key text,
  exact_pack_match boolean,
  pack_match_confidence numeric,
  retrieved_at timestamptz,
  valid_until timestamptz
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  with ranked as (
    select
      o.*,
      row_number() over (
        partition by coalesce(nullif(lower(btrim(o.merchant_name)), ''), nullif(lower(btrim(o.source_domain)), ''), lower(btrim(o.platform_name)))
        order by
          case when o.price is not null and o.price > 0 then 0 else 1 end,
          o.price asc nulls last,
          o.offer_confidence desc nulls last,
          o.retrieved_at desc,
          o.id
      ) as merchant_rank
    from public.sp_catalog_commerce_offer_v1 o
    where o.product_id = p_product_id
      and o.market_country_code = 'IN'
      and o.verified = true
      and o.source_url ~ '^https://'
      and coalesce(o.availability_status,'') not in ('OUT_OF_STOCK','DISCONTINUED')
      and (o.valid_until is null or o.valid_until > now())
      and (
        p_pack_normalized_key is null
        or (o.pack_normalized_key = p_pack_normalized_key and o.exact_pack_match = true)
      )
  )
  select
    r.id, r.product_id, r.platform_name, r.merchant_name, r.source_domain, r.source_url,
    r.affiliate_url, r.price, r.currency, r.list_price, r.availability_status, r.image_url,
    r.offer_confidence, r.verified, r.market_country_code, r.pack_size_text,
    r.pack_normalized_value, r.pack_normalized_unit, r.pack_normalized_key,
    r.exact_pack_match, r.pack_match_confidence, r.retrieved_at, r.valid_until
  from ranked r
  where r.merchant_rank = 1
  order by
    case when r.price is not null and r.price > 0 then 0 else 1 end,
    r.price asc nulls last,
    r.offer_confidence desc nulls last,
    r.retrieved_at desc,
    r.id
  limit greatest(1, least(coalesce(p_limit, 5), 5));
$function$;

create or replace function public.sp_m1b_search_catalog_candidates_v1(
  p_query text,
  p_category text default 'ALL',
  p_limit integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
set statement_timeout to '5s'
as $function$
declare
  v_query text := lower(btrim(coalesce(p_query,'')));
  v_category text := upper(btrim(coalesce(p_category,'ALL')));
  v_limit integer := least(greatest(coalesce(p_limit,10),1),10);
  v_rows jsonb;
begin
  if v_query='' or length(v_query)>200 then
    raise exception using errcode='22023',message='M1B_SEARCH_QUERY_INVALID';
  end if;

  select coalesce(jsonb_agg(x.card order by x.rank_score desc,x.product_name),'[]'::jsonb)
    into v_rows
  from (
    select p.product_name,
      (case when lower(p.product_name)=v_query then 100 else 0 end +
       case when lower(p.brand_name||' '||p.product_name)=v_query then 80 else 0 end +
       case when lower(p.product_name) like '%'||v_query||'%' then 40 else 0 end +
       case when lower(p.brand_name||' '||p.product_name) like '%'||v_query||'%' then 30 else 0 end +
       case when lower(coalesce(p.category,'')) like '%'||v_query||'%' then 10 else 0 end) as rank_score,
      jsonb_build_object(
        'product_id',p.id,
        'product_fingerprint',p.product_fingerprint,
        'brand_name',p.brand_name,
        'product_name',p.product_name,
        'variant_name',p.variant_name,
        'pack_size_text',p.pack_size_text,
        'pack_normalized_value',p.pack_normalized_value,
        'pack_normalized_unit',p.pack_normalized_unit,
        'pack_normalized_key',p.pack_normalized_key,
        'pack_is_official_default',p.pack_is_official_default,
        'pack_source_kind',p.pack_source_kind,
        'category',p.category,
        'market_country_code',p.market_country_code,
        'gtin',p.gtin,
        'identity_status',p.identity_status,
        'offer',case when o.id is null then null else jsonb_build_object(
          'id',o.id,
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
          'retrieved_at',o.retrieved_at,
          'pack_size_text',o.pack_size_text,
          'pack_normalized_value',o.pack_normalized_value,
          'pack_normalized_unit',o.pack_normalized_unit,
          'pack_normalized_key',o.pack_normalized_key,
          'exact_pack_match',o.exact_pack_match,
          'pack_match_confidence',o.pack_match_confidence,
          'offer_confidence',o.offer_confidence
        ) end,
        'image_url',coalesce(i.image_url,o.image_url),
        'strict_safety',case when s.id is null then null else jsonb_build_object(
          'assessment_id',s.id,
          'assessment_version',s.assessment_version,
          'assessment_status',s.assessment_status,
          'safety_score',s.overall_score,
          'child_score',s.child_score,
          'pregnancy_score',s.pregnancy_score,
          'senior_score',s.senior_score,
          'determination_confidence',s.determination_confidence,
          'ingredient_snapshot_sha256',s.ingredient_snapshot_sha256,
          'regulatory_snapshot_ref',s.regulatory_snapshot_ref,
          'warnings',s.warnings,
          'summary',s.summary,
          'expires_at',s.expires_at
        ) end
      ) as card
    from public.sp_catalog_product_v1 p
    left join lateral (
      select co.*
      from public.sp_catalog_commerce_offer_v1 co
      where co.product_id=p.id
        and co.verified=true
        and upper(coalesce(co.currency,'INR'))='INR'
        and co.source_url~'^https://'
        and coalesce(co.availability_status,'') not in ('OUT_OF_STOCK','DISCONTINUED')
        and (co.valid_until is null or co.valid_until>now())
        and (
          p.pack_normalized_key is null
          or (co.pack_normalized_key=p.pack_normalized_key and co.exact_pack_match=true)
        )
      order by
        case when co.price is not null and co.price>0 then 0 else 1 end,
        co.price asc nulls last,
        co.offer_confidence desc nulls last,
        co.retrieved_at desc
      limit 1
    ) o on true
    left join lateral (
      select pi.*
      from public.sp_catalog_product_image_v1 pi
      where pi.product_id=p.id and pi.verified=true and pi.image_url~'^https://'
      order by pi.is_primary_display desc,pi.retrieved_at desc nulls last
      limit 1
    ) i on true
    left join lateral (
      select sa.*
      from public.sp_catalog_safety_assessment_v1 sa
      where sa.product_id=p.id
        and sa.is_current=true
        and sa.assessment_status='QUALIFIED'
        and sa.assessment_version='M1B_STRICT_REGULATORY_V1'
        and sa.expires_at>now()
        and sa.ingredient_snapshot_sha256=(
          select encode(extensions.digest(coalesce(string_agg(pi2.normalized_name,'|' order by pi2.ingredient_sequence,pi2.id),''),'sha256'),'hex')
          from public.sp_catalog_product_ingredient_v1 pi2
          where pi2.product_id=p.id and pi2.qualification_status='QUALIFIED'
        )
      order by sa.determined_at desc
      limit 1
    ) s on true
    where p.is_active=true
      and p.market_country_code='IN'
      and p.identity_status='VERIFIED'
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
end;
$function$;

create or replace function public.sp_us2_category_cards_v1(
  p_category text,
  p_exclude_product_id uuid,
  p_pack_normalized_key text,
  p_limit integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','extensions','pg_temp'
set statement_timeout='5s'
as $function$
declare v_rows jsonb;
begin
  with ranked as (
    select p.*,
      row_number() over(
        partition by coalesce(nullif(lower(btrim(p.brand_name)),''),p.id::text)
        order by case when p.identity_status='VERIFIED' then 0 else 1 end,p.identity_confidence desc nulls last,p.updated_at desc,p.id
      ) brand_rank
    from public.sp_catalog_product_v1 p
    where p.is_active=true
      and p.market_country_code='IN'
      and p.identity_status='VERIFIED'
      and lower(btrim(p.category))=lower(btrim(p_category))
      and (p_exclude_product_id is null or p.id<>p_exclude_product_id)
      and (p_pack_normalized_key is null or p.pack_normalized_key=p_pack_normalized_key)
  ), cards as (
    select jsonb_build_object(
      'product_id',p.id,
      'product_fingerprint',p.product_fingerprint,
      'brand_name',p.brand_name,
      'product_name',p.product_name,
      'variant_name',p.variant_name,
      'pack_size_text',p.pack_size_text,
      'pack_normalized_value',p.pack_normalized_value,
      'pack_normalized_unit',p.pack_normalized_unit,
      'pack_normalized_key',p.pack_normalized_key,
      'pack_is_official_default',p.pack_is_official_default,
      'pack_source_kind',p.pack_source_kind,
      'category',p.category,
      'market_country_code',p.market_country_code,
      'gtin',p.gtin,
      'identity_status',p.identity_status,
      'offer',case when o.id is null then null else jsonb_build_object(
        'id',o.id,
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
        'retrieved_at',o.retrieved_at,
        'pack_size_text',o.pack_size_text,
        'pack_normalized_value',o.pack_normalized_value,
        'pack_normalized_unit',o.pack_normalized_unit,
        'pack_normalized_key',o.pack_normalized_key,
        'exact_pack_match',o.exact_pack_match,
        'pack_match_confidence',o.pack_match_confidence,
        'offer_confidence',o.offer_confidence
      ) end,
      'image_url',coalesce(i.image_url,o.image_url),
      'strict_safety',case when s.id is null then null else jsonb_build_object(
        'assessment_id',s.id,
        'assessment_version',s.assessment_version,
        'assessment_status',s.assessment_status,
        'safety_score',s.overall_score,
        'child_score',s.child_score,
        'pregnancy_score',s.pregnancy_score,
        'senior_score',s.senior_score,
        'determination_confidence',s.determination_confidence,
        'ingredient_snapshot_sha256',s.ingredient_snapshot_sha256,
        'regulatory_snapshot_ref',s.regulatory_snapshot_ref,
        'warnings',s.warnings,
        'summary',s.summary,
        'expires_at',s.expires_at
      ) end
    ) card,
    p.brand_name,p.product_name
    from ranked p
    left join lateral (
      select co.*
      from public.sp_catalog_commerce_offer_v1 co
      where co.product_id=p.id
        and co.verified=true
        and upper(coalesce(co.currency,'INR'))='INR'
        and co.source_url~'^https://'
        and coalesce(co.availability_status,'') not in('OUT_OF_STOCK','DISCONTINUED')
        and (co.valid_until is null or co.valid_until>now())
        and (
          p_pack_normalized_key is null
            and (p.pack_normalized_key is null or (co.pack_normalized_key=p.pack_normalized_key and co.exact_pack_match=true))
          or p_pack_normalized_key is not null
            and co.pack_normalized_key=p_pack_normalized_key
            and co.exact_pack_match=true
        )
      order by
        case when co.price is not null and co.price>0 then 0 else 1 end,
        co.price asc nulls last,
        co.offer_confidence desc nulls last,
        co.retrieved_at desc
      limit 1
    ) o on true
    left join lateral (
      select pi.*
      from public.sp_catalog_product_image_v1 pi
      where pi.product_id=p.id and pi.verified=true and pi.image_url~'^https://'
      order by pi.is_primary_display desc,pi.retrieved_at desc nulls last
      limit 1
    ) i on true
    left join lateral (
      select sa.*
      from public.sp_catalog_safety_assessment_v1 sa
      where sa.product_id=p.id
        and sa.is_current=true
        and sa.assessment_status='QUALIFIED'
        and sa.assessment_version='M1B_STRICT_REGULATORY_V1'
        and sa.expires_at>now()
        and sa.ingredient_snapshot_sha256=(
          select encode(extensions.digest(coalesce(string_agg(pi2.normalized_name,'|' order by pi2.ingredient_sequence,pi2.id),''),'sha256'),'hex')
          from public.sp_catalog_product_ingredient_v1 pi2
          where pi2.product_id=p.id and pi2.qualification_status='QUALIFIED'
        )
      order by sa.determined_at desc
      limit 1
    ) s on true
    where p.brand_rank=1
    order by p.identity_confidence desc nulls last,lower(p.brand_name),lower(p.product_name)
    limit greatest(1,least(coalesce(p_limit,10),10))
  )
  select coalesce(jsonb_agg(card),'[]'::jsonb) into v_rows from cards;

  return jsonb_build_object('success',true,'cards',v_rows,'count',jsonb_array_length(v_rows));
end;
$function$;

revoke all on function public.sp_us2_exact_offers_v1(uuid,text,integer) from public;
revoke all on function public.sp_us2_exact_offers_v1(uuid,text,integer) from anon;
revoke all on function public.sp_us2_exact_offers_v1(uuid,text,integer) from authenticated;
grant execute on function public.sp_us2_exact_offers_v1(uuid,text,integer) to service_role;

revoke all on function public.sp_m1b_search_catalog_candidates_v1(text,text,integer) from public;
revoke all on function public.sp_m1b_search_catalog_candidates_v1(text,text,integer) from anon;
revoke all on function public.sp_m1b_search_catalog_candidates_v1(text,text,integer) from authenticated;
grant execute on function public.sp_m1b_search_catalog_candidates_v1(text,text,integer) to service_role;

revoke all on function public.sp_us2_category_cards_v1(text,uuid,text,integer) from public;
revoke all on function public.sp_us2_category_cards_v1(text,uuid,text,integer) from anon;
revoke all on function public.sp_us2_category_cards_v1(text,uuid,text,integer) from authenticated;
grant execute on function public.sp_us2_category_cards_v1(text,uuid,text,integer) to service_role;

comment on column public.sp_catalog_product_v1.pack_is_official_default is
  'True only when the canonical pack is explicitly identified by product evidence as the default pack; never inferred from mere presence of a pack size.';
comment on column public.sp_catalog_product_v1.pack_source_kind is
  'Evidence provenance for canonical pack metadata (for example OFFICIAL_BRAND, OFFICIAL_SHOPIFY, TRUSTED_RETAILER).';
comment on function public.sp_m1b_search_catalog_candidates_v1(text,text,integer) is
  'Unified Search v2 product discovery. Product identity/formula eligibility is independent of merchant price; strict cached safety is snapshot-bound.';
comment on function public.sp_us2_category_cards_v1(text,uuid,text,integer) is
  'Unified Search v2 same-category cards with pack provenance, price-optional merchant context, and snapshot-bound strict safety.';

commit;
