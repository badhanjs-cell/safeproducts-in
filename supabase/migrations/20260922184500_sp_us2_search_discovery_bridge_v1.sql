-- SP-US2 search discovery -> canonical catalog candidate bridge.
-- Discovery may create identity candidates only. It never creates ingredient evidence,
-- Safety Scores, or a verified product identity.

create or replace function public.sp_catalog_stage_search_discovery_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','extensions','pg_temp'
as $function$
declare
  v_brand_name text := left(btrim(coalesce(p_payload->>'brand_name','')),200);
  v_product_name text := left(btrim(coalesce(p_payload->>'product_name','')),300);
  v_variant_name text := nullif(left(btrim(coalesce(p_payload->>'variant_name','')),200),'');
  v_pack_text text := nullif(left(btrim(coalesce(p_payload->>'pack_size_text','')),120),'');
  v_category text := nullif(left(btrim(coalesce(p_payload->>'category','')),160),'');
  v_source_url text := left(btrim(coalesce(p_payload->>'source_url','')),2000);
  v_source_name text := nullif(left(btrim(coalesce(p_payload->>'source_name','')),200),'');
  v_identity_confidence numeric;
  v_brand_norm text;
  v_product_norm text;
  v_variant_norm text;
  v_pack_norm text;
  v_fingerprint text;
  v_brand_id uuid;
  v_product_id uuid;
  v_existing_status text;
  v_existing_origin text;
  v_pack_match text[];
  v_pack_value numeric;
  v_pack_unit text;
  v_pack_key text;
  v_enqueue jsonb;
begin
  if jsonb_typeof(coalesce(p_payload,'{}'::jsonb)) <> 'object' then
    raise exception using errcode='22023', message='SEARCH_DISCOVERY_PAYLOAD_OBJECT_REQUIRED';
  end if;
  if v_brand_name='' or v_product_name='' then
    raise exception using errcode='22023', message='SEARCH_DISCOVERY_IDENTITY_REQUIRED';
  end if;
  if v_source_url !~ '^https://' then
    raise exception using errcode='22023', message='SEARCH_DISCOVERY_HTTPS_SOURCE_REQUIRED';
  end if;
  if p_payload ?| array['safety_score','profile_score','ingredients','detected_ingredients','ingredient_declaration','warnings'] then
    raise exception using errcode='22023', message='SEARCH_DISCOVERY_SAFETY_FIELDS_FORBIDDEN';
  end if;

  begin
    v_identity_confidence := nullif(p_payload->>'identity_confidence','')::numeric;
  exception when others then
    raise exception using errcode='22023', message='SEARCH_DISCOVERY_CONFIDENCE_INVALID';
  end;
  if v_identity_confidence is not null and (v_identity_confidence < 0 or v_identity_confidence > 100) then
    raise exception using errcode='22023', message='SEARCH_DISCOVERY_CONFIDENCE_INVALID';
  end if;

  v_brand_norm := regexp_replace(lower(v_brand_name),'[^a-z0-9]+','','g');
  v_product_norm := regexp_replace(lower(v_product_name),'[^a-z0-9]+','','g');
  v_variant_norm := regexp_replace(lower(coalesce(v_variant_name,'')),'[^a-z0-9]+','','g');
  v_pack_norm := regexp_replace(lower(coalesce(v_pack_text,'')),'[^a-z0-9]+','','g');
  if v_brand_norm='' or v_product_norm='' then
    raise exception using errcode='22023', message='SEARCH_DISCOVERY_NORMALIZED_IDENTITY_REQUIRED';
  end if;

  if v_pack_text is not null then
    v_pack_match := regexp_match(lower(v_pack_text),'([0-9]+(?:\.[0-9]+)?)\s*(ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|gm|gms|grams?|grammes?|g|kg|kilograms?|capsules?|caps?|tablets?|tabs?|softgels?|sachets?|pieces?|pcs?|counts?|ct)(?:$|[^a-z])');
    if v_pack_match is not null then
      v_pack_value := (v_pack_match[1])::numeric;
      if v_pack_match[2] = 'l' or v_pack_match[2] like 'lit%' then
        v_pack_value := v_pack_value * 1000; v_pack_unit := 'ml';
      elsif v_pack_match[2] = 'kg' or v_pack_match[2] like 'kilogram%' then
        v_pack_value := v_pack_value * 1000; v_pack_unit := 'g';
      elsif v_pack_match[2] = 'ml' or v_pack_match[2] like 'millilit%' then
        v_pack_unit := 'ml';
      elsif v_pack_match[2] in ('gm','gms','g') or v_pack_match[2] like 'gram%' then
        v_pack_unit := 'g';
      else
        v_pack_unit := 'count';
      end if;
      if v_pack_value > 0 then
        v_pack_key := trim(to_char(v_pack_value,'FM999999990.######')) || ':' || v_pack_unit;
      else
        v_pack_value := null; v_pack_unit := null;
      end if;
    end if;
  end if;

  -- Match the canonical label-ingest identity formula exactly: no-pack identities omit
  -- the pack segment entirely, while known-pack identities include normalized pack text.
  v_fingerprint := case when v_pack_text is null then
    encode(extensions.digest(
      v_brand_norm || '|' || v_product_norm || '|' || v_variant_norm || '|IN',
      'sha256'
    ),'hex')
  else
    encode(extensions.digest(
      v_brand_norm || '|' || v_product_norm || '|' || v_variant_norm || '|' || v_pack_norm || '|IN',
      'sha256'
    ),'hex')
  end;

  select id into v_brand_id
  from public.sp_catalog_brand_v1
  where lower(normalized_brand_name)=lower(v_brand_norm)
  order by case when status='ACTIVE' then 0 else 1 end, created_at
  limit 1;

  if v_brand_id is null then
    insert into public.sp_catalog_brand_v1(brand_name,normalized_brand_name,status,notes)
    values(v_brand_name,v_brand_norm,'REVIEW','Machine-discovered brand candidate from SafeProducts search. Human verification required before official-brand authority use.')
    on conflict do nothing
    returning id into v_brand_id;

    if v_brand_id is null then
      select id into v_brand_id
      from public.sp_catalog_brand_v1
      where lower(normalized_brand_name)=lower(v_brand_norm)
      order by case when status='ACTIVE' then 0 else 1 end, created_at
      limit 1;
    end if;
  end if;

  if v_brand_id is null then
    raise exception using errcode='P0002', message='SEARCH_DISCOVERY_BRAND_UPSERT_FAILED';
  end if;

  insert into public.sp_catalog_product_v1(
    product_fingerprint,brand_id,brand_name,product_name,normalized_product_name,
    variant_name,pack_size_text,category,market_country_code,
    identity_confidence,identity_status,source_origin,is_active,notes,
    pack_normalized_value,pack_normalized_unit,pack_normalized_key,
    pack_is_official_default,pack_source_kind
  ) values (
    v_fingerprint,v_brand_id,v_brand_name,v_product_name,v_product_norm,
    v_variant_name,v_pack_text,v_category,'IN',
    v_identity_confidence,'CANDIDATE','SEARCH',true,
    'Search-discovered identity candidate. Source: '||v_source_url||'. Verification is required before scored canonical use.',
    v_pack_value,v_pack_unit,v_pack_key,false,
    case when v_pack_key is not null then 'SEARCH_DISCOVERY' else null end
  )
  on conflict(product_fingerprint) do update set
    brand_id=coalesce(public.sp_catalog_product_v1.brand_id,excluded.brand_id),
    brand_name=case when public.sp_catalog_product_v1.identity_status='CANDIDATE' then excluded.brand_name else public.sp_catalog_product_v1.brand_name end,
    product_name=case when public.sp_catalog_product_v1.identity_status='CANDIDATE' then excluded.product_name else public.sp_catalog_product_v1.product_name end,
    normalized_product_name=case when public.sp_catalog_product_v1.identity_status='CANDIDATE' then excluded.normalized_product_name else public.sp_catalog_product_v1.normalized_product_name end,
    variant_name=case when public.sp_catalog_product_v1.identity_status='CANDIDATE' then coalesce(excluded.variant_name,public.sp_catalog_product_v1.variant_name) else public.sp_catalog_product_v1.variant_name end,
    pack_size_text=case when public.sp_catalog_product_v1.identity_status='CANDIDATE' then coalesce(excluded.pack_size_text,public.sp_catalog_product_v1.pack_size_text) else public.sp_catalog_product_v1.pack_size_text end,
    category=case when public.sp_catalog_product_v1.identity_status='CANDIDATE' then coalesce(excluded.category,public.sp_catalog_product_v1.category) else public.sp_catalog_product_v1.category end,
    identity_confidence=case when public.sp_catalog_product_v1.identity_status='CANDIDATE' then greatest(coalesce(public.sp_catalog_product_v1.identity_confidence,0),coalesce(excluded.identity_confidence,0)) else public.sp_catalog_product_v1.identity_confidence end,
    pack_normalized_value=case when public.sp_catalog_product_v1.identity_status='CANDIDATE' then coalesce(excluded.pack_normalized_value,public.sp_catalog_product_v1.pack_normalized_value) else public.sp_catalog_product_v1.pack_normalized_value end,
    pack_normalized_unit=case when public.sp_catalog_product_v1.identity_status='CANDIDATE' then coalesce(excluded.pack_normalized_unit,public.sp_catalog_product_v1.pack_normalized_unit) else public.sp_catalog_product_v1.pack_normalized_unit end,
    pack_normalized_key=case when public.sp_catalog_product_v1.identity_status='CANDIDATE' then coalesce(excluded.pack_normalized_key,public.sp_catalog_product_v1.pack_normalized_key) else public.sp_catalog_product_v1.pack_normalized_key end,
    notes=case when public.sp_catalog_product_v1.identity_status='CANDIDATE' then excluded.notes else public.sp_catalog_product_v1.notes end,
    updated_at=now()
  returning id, identity_status, source_origin into v_product_id,v_existing_status,v_existing_origin;

  if v_existing_status='CANDIDATE' then
    if not exists(
      select 1 from public.sp_catalog_review_queue_v1
      where product_id=v_product_id and review_type='PRODUCT_IDENTITY'
        and status in ('OPEN','IN_REVIEW')
        and source_context->>'reason'='SEARCH_DISCOVERY_IDENTITY_CONFIRMATION'
    ) then
      insert into public.sp_catalog_review_queue_v1(
        product_id,review_type,severity,status,title,detail,source_context
      ) values (
        v_product_id,'PRODUCT_IDENTITY','NORMAL','OPEN',
        'Confirm search-discovered product identity',
        'Verify exact India-market brand, product, variant and pack before this candidate may become a scored canonical product.',
        jsonb_build_object(
          'reason','SEARCH_DISCOVERY_IDENTITY_CONFIRMATION',
          'source_url',v_source_url,
          'source_name',v_source_name,
          'pack_size_text',v_pack_text,
          'pack_normalized_key',v_pack_key,
          'identity_confidence',v_identity_confidence
        )
      );
    end if;
    v_enqueue := public.sp_catalog_enqueue_default_enrichment_v1(v_product_id);
  else
    v_enqueue := jsonb_build_object('success',true,'enqueued',0,'reason','EXISTING_NON_CANDIDATE_IDENTITY');
  end if;

  return jsonb_build_object(
    'success',true,
    'product_id',v_product_id,
    'product_fingerprint',v_fingerprint,
    'identity_status',v_existing_status,
    'source_origin',v_existing_origin,
    'pack_normalized_key',v_pack_key,
    'review_required',(v_existing_status='CANDIDATE'),
    'enrichment',v_enqueue
  );
end;
$function$;

revoke all on function public.sp_catalog_stage_search_discovery_v1(jsonb) from public;
revoke all on function public.sp_catalog_stage_search_discovery_v1(jsonb) from anon;
revoke all on function public.sp_catalog_stage_search_discovery_v1(jsonb) from authenticated;
grant execute on function public.sp_catalog_stage_search_discovery_v1(jsonb) to service_role;
