-- SafeProducts SP-US2 provenance-checked Make commerce staging v1.
-- Commerce facts only; canonical product identity must already exist.

begin;

create or replace function public.sp_us2_stage_commerce_offer_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','extensions','pg_temp'
as $function$
declare
  v_product_id uuid;
  v_market text := upper(btrim(coalesce(p_payload->>'market_country_code','')));
  v_currency text := upper(btrim(coalesce(p_payload->>'currency','')));
  v_source_url text := btrim(coalesce(p_payload->>'source_url',''));
  v_source_page text;
  v_source_domain text;
  v_observed text;
  v_observed_page text;
  v_source_observed boolean := false;
  v_merchant text := nullif(left(btrim(coalesce(p_payload->>'merchant_name','')),200),'');
  v_platform text := left(coalesce(nullif(btrim(p_payload->>'platform_name'),''),'Merchant'),200);
  v_merchant_key text;
  v_price numeric;
  v_confidence numeric;
  v_pack_text text := nullif(left(btrim(coalesce(p_payload->>'pack_size_text','')),120),'');
  v_pack_key text := nullif(lower(btrim(coalesce(p_payload->>'pack_normalized_key',''))),'');
  v_requested_pack_key text := nullif(lower(btrim(coalesce(p_payload->>'requested_pack_key',''))),'');
  v_pack_match text[];
  v_pack_value numeric;
  v_pack_unit text;
  v_derived_pack_key text;
  v_exact_pack boolean := coalesce((p_payload->>'exact_pack_match')::boolean,false);
  v_image_url text := nullif(btrim(coalesce(p_payload->>'image_url','')),'');
  v_existing_id uuid;
  v_existing_verified boolean := false;
  v_existing_source_url text;
  v_upsert jsonb;
  v_upsert_url text;
begin
  if jsonb_typeof(coalesce(p_payload,'{}'::jsonb)) <> 'object' then
    raise exception using errcode='22023',message='MAKE_COMMERCE_PAYLOAD_OBJECT_REQUIRED';
  end if;

  begin
    v_product_id := nullif(p_payload->>'product_id','')::uuid;
  exception when others then
    v_product_id := null;
  end;
  if v_product_id is null or not exists(
    select 1 from public.sp_catalog_product_v1 where id=v_product_id and is_active=true and market_country_code='IN'
  ) then
    raise exception using errcode='22023',message='PRODUCT_NOT_FOUND';
  end if;

  if v_market <> 'IN' then
    raise exception using errcode='22023',message='INDIA_MARKET_REQUIRED';
  end if;
  if v_currency <> 'INR' then
    raise exception using errcode='22023',message='INR_CURRENCY_REQUIRED';
  end if;
  if v_source_url !~ '^https://' then
    raise exception using errcode='22023',message='HTTPS_SOURCE_URL_REQUIRED';
  end if;
  if v_image_url is not null and v_image_url !~ '^https://' then
    raise exception using errcode='22023',message='HTTPS_IMAGE_URL_REQUIRED';
  end if;
  if jsonb_typeof(p_payload->'observed_source_urls') <> 'array' then
    raise exception using errcode='22023',message='OBSERVED_SOURCE_URLS_REQUIRED';
  end if;

  -- Query/fragment tracking differences do not create a distinct source-page identity.
  v_source_page := regexp_replace(v_source_url,'[?#].*$','','g');
  v_source_domain := lower(regexp_replace(
    split_part(regexp_replace(v_source_page,'^https://','','i'),'/',1),
    '^www\.','','i'
  ));
  if v_source_domain='' then
    raise exception using errcode='22023',message='SOURCE_DOMAIN_INVALID';
  end if;

  for v_observed in
    select value from jsonb_array_elements_text(p_payload->'observed_source_urls') as t(value)
  loop
    if v_observed ~ '^https://' then
      v_observed_page := regexp_replace(btrim(v_observed),'[?#].*$','','g');
      if v_observed_page=v_source_page then
        v_source_observed := true;
        exit;
      end if;
    end if;
  end loop;
  if not v_source_observed then
    raise exception using errcode='22023',message='SOURCE_PROVENANCE_NOT_OBSERVED';
  end if;

  if coalesce((p_payload->>'exact_product_match')::boolean,false) is not true then
    raise exception using errcode='22023',message='EXACT_PRODUCT_REQUIRED';
  end if;
  if coalesce((p_payload->>'variant_match')::boolean,true) is not true then
    raise exception using errcode='22023',message='VARIANT_MATCH_REQUIRED';
  end if;

  begin v_price := nullif(p_payload->>'price','')::numeric; exception when others then v_price := null; end;
  if v_price is null or v_price <= 0 then
    raise exception using errcode='22023',message='PRICE_INVALID';
  end if;
  begin v_confidence := nullif(p_payload->>'confidence','')::numeric; exception when others then v_confidence := null; end;
  if v_confidence is null or v_confidence < 90 or v_confidence > 100 then
    raise exception using errcode='22023',message='COMMERCE_CONFIDENCE_INVALID';
  end if;

  -- Align deterministic pack parsing with Unified Search: L->ml, kg->g and unit-count aliases->count.
  if v_pack_text is not null then
    v_pack_match := regexp_match(
      lower(v_pack_text),
      '([0-9]+(?:\.[0-9]+)?)\s*(ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|gm|gms|grams?|grammes?|g|kg|kilograms?|capsules?|caps?|tablets?|tabs?|softgels?|sachets?|pieces?|pcs?|counts?|ct)(?:$|[^a-z])'
    );
    if v_pack_match is not null then
      v_pack_value := (v_pack_match[1])::numeric;
      if v_pack_match[2]='l' or v_pack_match[2] like 'lit%' then
        v_pack_value := v_pack_value*1000; v_pack_unit := 'ml';
      elsif v_pack_match[2]='kg' or v_pack_match[2] like 'kilogram%' then
        v_pack_value := v_pack_value*1000; v_pack_unit := 'g';
      elsif v_pack_match[2]='ml' or v_pack_match[2] like 'millilit%' then
        v_pack_unit := 'ml';
      elsif v_pack_match[2] in ('gm','gms','g') or v_pack_match[2] like 'gram%' then
        v_pack_unit := 'g';
      else
        v_pack_unit := 'count';
      end if;
      if v_pack_value > 0 then
        v_derived_pack_key := trim(to_char(v_pack_value,'FM999999990.######'))||':'||v_pack_unit;
      end if;
    end if;
  end if;

  if v_pack_key is null then
    v_pack_key := v_derived_pack_key;
  elsif v_derived_pack_key is not null and v_pack_key <> v_derived_pack_key then
    raise exception using errcode='22023',message='PACK_MISMATCH';
  end if;

  if v_requested_pack_key is not null and (v_pack_key is distinct from v_requested_pack_key or v_exact_pack is not true) then
    raise exception using errcode='22023',message='EXACT_PACK_REQUIRED';
  end if;
  if v_exact_pack and v_pack_key is null then
    raise exception using errcode='22023',message='PACK_MISMATCH';
  end if;

  if v_pack_key is not null and (v_pack_value is null or v_pack_unit is null) then
    begin
      v_pack_value := split_part(v_pack_key,':',1)::numeric;
      v_pack_unit := split_part(v_pack_key,':',2);
    exception when others then
      raise exception using errcode='22023',message='PACK_MISMATCH';
    end;
    if v_pack_value <= 0 or v_pack_unit not in ('ml','g','count') then
      raise exception using errcode='22023',message='PACK_MISMATCH';
    end if;
  end if;

  v_merchant_key := coalesce(nullif(lower(btrim(v_merchant)),''),v_source_domain);

  -- Detect equivalent prior page evidence before using the canonical upsert path.
  select o.id,o.verified,o.source_url
    into v_existing_id,v_existing_verified,v_existing_source_url
  from public.sp_catalog_commerce_offer_v1 o
  where o.product_id=v_product_id
    and coalesce(o.pack_normalized_key,'')=coalesce(v_pack_key,'')
    and regexp_replace(o.source_url,'[?#].*$','','g')=v_source_page
    and coalesce(nullif(lower(btrim(o.merchant_name)),''),lower(btrim(o.source_domain)))=v_merchant_key
  order by o.verified desc,o.retrieved_at desc,o.id
  limit 1;

  v_upsert_url := coalesce(v_existing_source_url,v_source_page);
  v_upsert := public.sp_us2_upsert_commerce_offer_v1(
    v_product_id,
    jsonb_build_object(
      'platform_name',v_platform,
      'merchant_name',v_merchant,
      'source_url',v_upsert_url,
      'price',v_price,
      'currency','INR',
      'list_price',p_payload->>'list_price',
      'availability_status',coalesce(nullif(p_payload->>'availability_status',''),'UNKNOWN'),
      'image_url',v_image_url,
      'pack_size_text',v_pack_text,
      'pack_normalized_value',v_pack_value,
      'pack_normalized_unit',v_pack_unit,
      'pack_normalized_key',v_pack_key,
      'exact_product_match',true,
      'variant_match',true,
      'exact_pack_match',v_exact_pack,
      'confidence',v_confidence
    )
  );

  return jsonb_build_object(
    'success',true,
    'offer_id',v_upsert->>'offer_id',
    'product_id',v_product_id,
    'pack_normalized_key',v_pack_key,
    'exact_pack_match',v_exact_pack,
    'existing_verified_preserved',coalesce(v_existing_verified,false)
  );
end;
$function$;

revoke all on function public.sp_us2_stage_commerce_offer_v1(jsonb) from public;
revoke all on function public.sp_us2_stage_commerce_offer_v1(jsonb) from anon;
revoke all on function public.sp_us2_stage_commerce_offer_v1(jsonb) from authenticated;
grant execute on function public.sp_us2_stage_commerce_offer_v1(jsonb) to service_role;

commit;
