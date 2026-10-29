-- Versioned SafeProducts browse RPC successor.
-- Profile/category browsing is relevance-first and fail-closed: no unrelated filler products.
-- Personal Care / Skin Care are diversified across product families before repeating a family.

create or replace function public.sp_web_featured_products_v1_2(
  p_profile text default 'ALL'::text,
  p_category text default 'all'::text,
  p_limit integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  v_profile text := upper(coalesce(nullif(btrim(p_profile),''),'ALL'));
  v_category text := lower(coalesce(nullif(btrim(p_category),''),'all'));
  v_limit integer := least(greatest(coalesce(p_limit,10),1),10);
  v_results jsonb := '[]'::jsonb;
  v_count integer := 0;
begin
  if v_profile not in ('ALL','CHILDREN','PREGNANT WOMEN','SENIORS','CHILD','PREGNANT','SENIOR') then
    raise exception using errcode='22023', message='INVALID_FEATURED_PROFILE';
  end if;
  if v_category not in ('all','skincare','personalcare','baby','supplements','nutraceuticals','special_dietary') then
    raise exception using errcode='22023', message='INVALID_FEATURED_CATEGORY';
  end if;

  if v_category='special_dietary' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id','seed-'||s.id::text,'name',s.product_name,'brand',s.brand_name,'category',s.category_label,
      'image_url',s.image_url,'price',null,'currency','INR','platform','Source-grounded catalogue',
      'affiliate_url',null,'source_url',s.source_url,'profile_score',null,'general_score',null,'confidence',null,
      'source_kind','BACKEND_CATALOG','safety_claim_available',false,'category_match',true,
      'display_note','Source-grounded catalogue preview. Run SafePrice for current evidence and commerce.',
      'assessment_disclaimer','No Safety Score is claimed on this browse card.'
    ) order by s.verified_at desc,s.product_name),'[]'::jsonb)
    into v_results
    from (
      select * from public.sp_web_browse_seed_catalog_v1
      where active=true and browse_bucket='special_dietary'
      order by verified_at desc,product_name limit v_limit
    ) s;
    v_count := jsonb_array_length(v_results);
    return jsonb_build_object('status',case when v_count>=6 then 'READY' else 'INSUFFICIENT_CATALOG_COVERAGE' end,
      'contract_version','SP_WEB_FEATURED_PRODUCTS_V1_2','profile',v_profile,'category',v_category,
      'requested_limit',v_limit,'result_count',v_count,'exact_category_count',v_count,'results',v_results);
  end if;

  if v_category='all' and v_profile in ('PREGNANT WOMEN','PREGNANT') then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id','profile-seed-'||s.id::text,'name',s.product_name,'brand',s.brand_name,'category',s.category_label,
      'image_url',s.image_url,'price',null,'currency','INR','platform','Source-grounded profile catalogue',
      'affiliate_url',null,'source_url',s.source_url,'profile_score',null,'general_score',null,'confidence',null,
      'source_kind','BACKEND_CATALOG','safety_claim_available',false,'category_match',true,
      'display_note','Source-grounded prenatal/maternal catalogue preview. Run SafePrice for a current assessment.',
      'assessment_disclaimer','No Safety Score is claimed on this browse card.'
    ) order by s.display_order,s.product_name),'[]'::jsonb)
    into v_results
    from (
      select * from public.sp_web_profile_seed_catalog_v1
      where active=true and profile_code='PREGNANT WOMEN'
      order by display_order,product_name limit v_limit
    ) s;
    v_count := jsonb_array_length(v_results);
    return jsonb_build_object('status',case when v_count>=6 then 'READY' else 'INSUFFICIENT_PROFILE_COVERAGE' end,
      'contract_version','SP_WEB_FEATURED_PRODUCTS_V1_2','profile','PREGNANT WOMEN','category','all',
      'requested_limit',v_limit,'result_count',v_count,'exact_category_count',v_count,'results',v_results);
  end if;

  with catalog as (
    select
      p.id,p.product_name,nullif(btrim(p.brand_name),'') as brand_name,p.category,p.updated_at,
      o.merchant_name,o.platform_name,o.source_url,o.affiliate_url,
      case when o.price is not null and o.price>0 and (o.valid_until is null or o.valid_until>now()) then o.price else null end as current_price,
      coalesce(nullif(img.image_url,''),nullif(o.image_url,'')) as display_image_url,
      s.overall_score,s.child_score,s.pregnancy_score,s.senior_score,s.determination_confidence,
      case v_profile when 'CHILDREN' then s.child_score when 'CHILD' then s.child_score
        when 'PREGNANT WOMEN' then s.pregnancy_score when 'PREGNANT' then s.pregnancy_score
        when 'SENIORS' then s.senior_score when 'SENIOR' then s.senior_score else s.overall_score end as profile_score,
      case
        when lower(coalesce(p.category,'')||' '||p.product_name) ~ 'after.?shave' then 'after_shave'
        when lower(coalesce(p.category,'')||' '||p.product_name) ~ 'body wash' then 'body_wash'
        when lower(coalesce(p.category,'')||' '||p.product_name) ~ 'shampoo' then 'shampoo'
        when lower(coalesce(p.category,'')||' '||p.product_name) ~ 'face wash' then 'face_wash'
        when lower(coalesce(p.category,'')||' '||p.product_name) ~ 'sunscreen' then 'sunscreen'
        when lower(coalesce(p.category,'')||' '||p.product_name) ~ 'moistur' then 'moisturizer'
        when lower(coalesce(p.category,'')||' '||p.product_name) ~ 'serum' then 'serum'
        when lower(coalesce(p.category,'')||' '||p.product_name) ~ 'toothpaste' then 'toothpaste'
        when lower(coalesce(p.category,'')||' '||p.product_name) ~ 'deodorant' then 'deodorant'
        when lower(coalesce(p.category,'')||' '||p.product_name) ~ 'soap' then 'soap'
        when lower(coalesce(p.category,'')||' '||p.product_name) ~ '(baby|child|infant|toddler)' then 'baby_child'
        when lower(coalesce(p.category,'')||' '||p.product_name) ~ '(supplement|vitamin|mineral|protein|omega)' then 'supplement'
        when lower(coalesce(p.category,'')||' '||p.product_name) ~ '(probiotic|nutraceutical|herbal|botanical)' then 'nutraceutical'
        else coalesce(nullif(lower(btrim(p.category)),''),'other') end as family_key,
      row_number() over (
        partition by lower(coalesce(nullif(btrim(p.brand_name),''),p.product_name))
        order by case when s.id is not null then 0 else 1 end,
          case when o.price is not null and o.price>0 and (o.valid_until is null or o.valid_until>now()) then 0 else 1 end,
          o.price asc nulls last,p.updated_at desc,p.id
      ) as brand_rank
    from public.sp_catalog_product_v1 p
    join lateral (
      select o.* from public.sp_catalog_commerce_offer_v1 o
      where o.product_id=p.id and o.verified=true and o.market_country_code='IN'
        and o.source_url ~ '^https://' and coalesce(o.availability_status,'') not in ('OUT_OF_STOCK','DISCONTINUED')
      order by case when o.price is not null and o.price>0 and (o.valid_until is null or o.valid_until>now()) then 0 else 1 end,
        o.offer_confidence desc nulls last,o.retrieved_at desc,o.id limit 1
    ) o on true
    left join lateral (
      select i.image_url from public.sp_catalog_product_image_v1 i
      where i.product_id=p.id and i.verified=true and i.exact_product_match=true and i.image_url ~ '^https://'
      order by i.is_primary_display desc,
        case upper(coalesce(i.source_kind,'')) when 'OFFICIAL_BRAND' then 0 when 'OFFICIAL_SHOPIFY' then 1 when 'TRUSTED_RETAILER' then 2 else 3 end,
        coalesce(i.width_px,0)*coalesce(i.height_px,0) desc,i.retrieved_at desc nulls last,i.id limit 1
    ) img on true
    left join lateral (
      select sa.* from public.sp_catalog_safety_assessment_v1 sa
      where sa.product_id=p.id and sa.assessment_status='QUALIFIED' and sa.is_current=true and (sa.expires_at is null or sa.expires_at>now())
      order by sa.determined_at desc,sa.created_at desc,sa.id limit 1
    ) s on true
    where p.is_active=true and p.market_country_code='IN' and btrim(coalesce(p.product_name,''))<>''
      and (
        v_profile='ALL'
        or (v_profile in ('CHILDREN','CHILD') and lower(coalesce(p.category,'')||' '||p.product_name) ~ '(baby|child|children|infant|toddler|kid|kids)')
        or (v_profile in ('PREGNANT WOMEN','PREGNANT') and lower(coalesce(p.category,'')||' '||p.product_name) ~ '(pregnan|prenatal|maternal|maternity|lactat|breastfeed|mother)')
        or (v_profile in ('SENIORS','SENIOR') and lower(coalesce(p.category,'')||' '||p.product_name) ~ '(senior|elderly|geriatric|ageing|aging|older adult|50\+|60\+)')
      )
      and (
        v_category='all'
        or (v_category='skincare' and lower(coalesce(p.category,'')||' '||p.product_name) ~ '(face wash|skin care|skincare|sunscreen|moistur|serum|face cream|body lotion|hand cream)'
          and lower(coalesce(p.category,'')||' '||p.product_name) !~ '(after.?shave|baby|child|infant)')
        or (v_category='personalcare' and lower(coalesce(p.category,'')||' '||p.product_name) ~ '(body wash|shampoo|after.?shave|face wash|soap|deodorant|toothpaste)'
          and lower(coalesce(p.category,'')||' '||p.product_name) !~ '(baby|child|infant)')
        or (v_category='baby' and lower(coalesce(p.category,'')||' '||p.product_name) ~ '(baby|child|children|infant|toddler|kid|kids)')
        or (v_category='supplements' and lower(coalesce(p.category,'')||' '||p.product_name) ~ '(health|supplement|vitamin|mineral|nutrition|protein|omega)')
        or (v_category='nutraceuticals' and lower(coalesce(p.category,'')||' '||p.product_name) ~ '(nutraceutical|probiotic|herbal|botanical|gut health|immunity)')
      )
  ),
  family_ranked as (
    select c.*,row_number() over (
      partition by c.family_key
      order by case when c.profile_score is not null then 0 else 1 end,c.profile_score desc nulls last,
        case when c.current_price is not null then 0 else 1 end,c.current_price asc nulls last,c.updated_at desc,c.id
    ) as family_rank
    from catalog c where c.brand_rank=1
  ),
  chosen as (
    select * from family_ranked
    order by case when v_category in ('personalcare','skincare') or v_profile<>'ALL' then family_rank else 1 end,
      case when profile_score is not null then 0 else 1 end,profile_score desc nulls last,
      case when current_price is not null then 0 else 1 end,current_price asc nulls last,updated_at desc,id
    limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id','catalog-'||c.id::text,'name',c.product_name,'brand',c.brand_name,'category',c.category,
    'image_url',c.display_image_url,'price',c.current_price,'currency','INR',
    'platform',coalesce(nullif(c.merchant_name,''),nullif(c.platform_name,'')),
    'affiliate_url',c.affiliate_url,'source_url',c.source_url,'profile_score',c.profile_score,
    'general_score',c.overall_score,'confidence',c.determination_confidence,
    'source_kind',case when c.profile_score is not null then 'QUALIFIED_CACHE' else 'BACKEND_CATALOG' end,
    'safety_claim_available',(c.profile_score is not null),'category_match',true,
    'display_note',case when c.profile_score is not null then 'Current qualified SafeProducts assessment from canonical evidence.'
      else 'Canonical SafeProducts catalogue product. Safety Score is shown only after evidence qualification.' end,
    'assessment_disclaimer',case when c.profile_score is not null then 'Safety belongs to the canonical product/formula, not the merchant offer.'
      else 'No Safety Score is inferred from commerce evidence.' end
  ) order by case when v_category in ('personalcare','skincare') or v_profile<>'ALL' then c.family_rank else 1 end,
    case when c.profile_score is not null then 0 else 1 end,c.profile_score desc nulls last,
    case when c.current_price is not null then 0 else 1 end,c.current_price asc nulls last,c.id),'[]'::jsonb)
  into v_results from chosen c;

  v_count := jsonb_array_length(v_results);
  return jsonb_build_object('status',case when v_count>=6 then 'READY' else 'INSUFFICIENT_CATALOG_COVERAGE' end,
    'contract_version','SP_WEB_FEATURED_PRODUCTS_V1_2','profile',v_profile,'category',v_category,
    'requested_limit',v_limit,'result_count',v_count,'exact_category_count',v_count,'results',v_results);
end;
$function$;

revoke all on function public.sp_web_featured_products_v1_2(text,text,integer) from public;
grant execute on function public.sp_web_featured_products_v1_2(text,text,integer) to anon, authenticated, service_role;
