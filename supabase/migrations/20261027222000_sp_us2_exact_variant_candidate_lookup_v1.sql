-- SP-US2 exact-product anchor lookup: strict brand/product prefix + genuine stored variant prefix.
-- Existing verified/active/India-market and score/offer qualification guards retained.
CREATE OR REPLACE FUNCTION public.sp_m1b_search_catalog_candidates_v1(p_query text, p_category text DEFAULT 'ALL'::text, p_limit integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp'
 SET statement_timeout TO '5s'
AS $function$
declare
  v_query text := lower(btrim(coalesce(p_query,'')));
  v_identity_query text;
  v_category text := upper(btrim(coalesce(p_category,'ALL')));
  v_limit integer := least(greatest(coalesce(p_limit,10),1),10);
  v_rows jsonb;
  v_identity_normalized text;
begin
  if v_query='' or length(v_query)>200 then
    raise exception using errcode='22023',message='M1B_SEARCH_QUERY_INVALID';
  end if;

  v_identity_query := regexp_replace(
    v_query,
    '\m[0-9]+(?:\.[0-9]+)?[[:space:]]*(?:ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|gm|gms|grams?|grammes?|g|kg|kilograms?|capsules?|caps?|tablets?|tabs?|softgels?|sachets?|pieces?|pcs?|counts?|ct)\M',
    ' ',
    'gi'
  );
  v_identity_query := regexp_replace(v_identity_query,'[[:space:]]+',' ','g');
  v_identity_query := btrim(v_identity_query);
  -- Compare the full verified brand/product identity to the query, optionally
  -- permitting a visible prefix of the stored variant after that identity.
  v_identity_normalized := btrim(regexp_replace(lower(v_identity_query),'[^a-z0-9]+',' ','g'));
  if v_identity_query='' then
    v_identity_query := v_query;
  end if;

  select coalesce(jsonb_agg(x.card order by x.rank_score desc,x.product_name),'[]'::jsonb)
    into v_rows
  from (
    select p.product_name,
      (case when v_identity_normalized=btrim(regexp_replace(lower(p.brand_name||' '||p.product_name),'[^a-z0-9]+',' ','g')) then 150
             when v_identity_normalized like btrim(regexp_replace(lower(p.brand_name||' '||p.product_name),'[^a-z0-9]+',' ','g'))||' %'
              and length(btrim(coalesce(p.variant_name,'')))>0
              and btrim(regexp_replace(lower(coalesce(p.variant_name,'')),'[^a-z0-9]+',' ','g')) like
                  substr(v_identity_normalized,length(btrim(regexp_replace(lower(p.brand_name||' '||p.product_name),'[^a-z0-9]+',' ','g')))+2)||'%'
             then 140 else 0 end +
       case when lower(p.product_name)=v_identity_query then 100 else 0 end +
       case when lower(p.brand_name||' '||p.product_name)=v_identity_query then 80 else 0 end +
       case when lower(p.product_name) like '%'||v_identity_query||'%' then 40 else 0 end +
       case when lower(p.brand_name||' '||p.product_name) like '%'||v_identity_query||'%' then 30 else 0 end +
       case when lower(coalesce(p.category,'')) like '%'||v_identity_query||'%' then 10 else 0 end) as rank_score,
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
        lower(p.product_name) like '%'||v_identity_query||'%'
        or lower(p.brand_name||' '||p.product_name) like '%'||v_identity_query||'%'
        or lower(coalesce(p.category,'')) like '%'||v_identity_query||'%'
        or (
          v_identity_normalized = btrim(regexp_replace(lower(p.brand_name||' '||p.product_name),'[^a-z0-9]+',' ','g'))
          or (
            v_identity_normalized like btrim(regexp_replace(lower(p.brand_name||' '||p.product_name),'[^a-z0-9]+',' ','g'))||' %'
            and length(btrim(coalesce(p.variant_name,'')))>0
            and btrim(regexp_replace(lower(coalesce(p.variant_name,'')),'[^a-z0-9]+',' ','g')) like
              substr(v_identity_normalized,length(btrim(regexp_replace(lower(p.brand_name||' '||p.product_name),'[^a-z0-9]+',' ','g')))+2)||'%'
          )
        )
      )
    order by rank_score desc,p.product_name
    limit v_limit
  ) x;

  return jsonb_build_object(
    'success',true,
    'query',v_query,
    'identity_query',v_identity_query,
    'candidate_count',jsonb_array_length(v_rows),
    'candidates',v_rows
  );
end;
$function$
