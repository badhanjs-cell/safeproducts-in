-- SafeProducts M1-B Path A controlled persistence v1
-- Persists qualified ingredient evidence plus independent image/commerce assets.
-- Does not write Safety Scores. BENCHMARK artifacts remain deferred until display-before-cache promotion.

create or replace function public.sp_m1b_apply_path_a_result_v1(
  p_run_id uuid,
  p_product_id uuid,
  p_result jsonb
) returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','extensions','pg_temp'
as $$
declare
  v_run public.sp_m1b_run_v1%rowtype;
  v_product public.sp_catalog_product_v1%rowtype;
  v_source_url text:=nullif(btrim(coalesce(p_result->>'source_url','')),'');
  v_source_kind text:=upper(coalesce(nullif(p_result->>'source_kind',''),'TRUSTED_RETAILER'));
  v_ing jsonb:=coalesce(p_result->'parsed_ingredients','[]'::jsonb);
  v_conf numeric;
  v_evidence_kind text;
  v_evidence_hash text;
  v_evidence_id uuid;
  v_name text;
  v_norm text;
  v_seq int:=0;
  v_image jsonb:=p_result->'display_image';
  v_offer jsonb:=p_result->'offer';
  v_image_saved boolean:=false;
  v_commerce_saved boolean:=false;
  v_ingredient_saved boolean:=false;
  v_image_source_kind text;
  v_offer_conf numeric;
  v_offer_verified boolean:=false;
begin
  select * into v_run from public.sp_m1b_run_v1 where id=p_run_id for update;
  if v_run.id is null then raise exception using errcode='22023',message='M1B_RUN_NOT_FOUND'; end if;
  select * into v_product from public.sp_catalog_product_v1 where id=p_product_id;
  if v_product.id is null then raise exception using errcode='22023',message='M1B_PRODUCT_NOT_FOUND'; end if;
  if v_run.product_id is not null and v_run.product_id<>p_product_id then raise exception using errcode='22023',message='M1B_RUN_PRODUCT_MISMATCH'; end if;
  if v_run.context='BENCHMARK' then
    return jsonb_build_object('success',true,'deferred_for_benchmark',true,'ingredient_saved',false,'image_saved',false,'commerce_saved',false);
  end if;
  perform set_config('sp.catalog_audit_reason','M1B_PATH_A_CONTROLLED_PERSISTENCE',true);

  -- Independent display-image lane. Only official/trusted exact evidence can become primary automatically.
  if jsonb_typeof(v_image)='object'
     and coalesce(v_image->>'image_url','')~'^https://'
     and coalesce(v_image->>'source_url','')~'^https://' then
    v_image_source_kind:=upper(coalesce(nullif(v_image->>'source_kind',''),'SEARCH_DISCOVERY'));
    if v_image_source_kind not in ('OFFICIAL_BRAND','OFFICIAL_SHOPIFY','TRUSTED_RETAILER','MARKETPLACE','OPEN_DATABASE','SEARCH_DISCOVERY') then v_image_source_kind:='SEARCH_DISCOVERY'; end if;
    if v_image_source_kind in ('OFFICIAL_BRAND','OFFICIAL_SHOPIFY','TRUSTED_RETAILER') then
      update public.sp_catalog_product_image_v1 set is_primary_display=false,updated_at=now() where product_id=p_product_id and is_primary_display=true;
    end if;
    insert into public.sp_catalog_product_image_v1(product_id,image_role,source_kind,source_url,image_url,market_country_code,is_primary_display,identity_evidence,ingredient_evidence,verified,retrieved_at,notes)
    values(p_product_id,'CATALOG_PRIMARY',v_image_source_kind,v_image->>'source_url',v_image->>'image_url',coalesce(v_product.market_country_code,'IN'),v_image_source_kind in ('OFFICIAL_BRAND','OFFICIAL_SHOPIFY','TRUSTED_RETAILER'),true,false,v_image_source_kind in ('OFFICIAL_BRAND','OFFICIAL_SHOPIFY','TRUSTED_RETAILER'),now(),'M1-B Path A display-image acquisition; independent from Safety Score.')
    on conflict do nothing;
    v_image_saved:=true;
  end if;

  -- Independent commerce lane. Price never participates in ingredient/safety confidence.
  if jsonb_typeof(v_offer)='object' and coalesce(v_offer->>'source_url','')~'^https://' and nullif(btrim(coalesce(v_offer->>'platform_name','')),'') is not null then
    begin v_offer_conf:=nullif(v_offer->>'confidence','')::numeric; exception when others then v_offer_conf:=0; end;
    if v_offer_conf>0 and v_offer_conf<=1 then v_offer_conf:=v_offer_conf*100; end if;
    v_offer_conf:=least(greatest(coalesce(v_offer_conf,0),0),100);
    v_offer_verified:=coalesce((v_offer->>'exact_product_match')::boolean,false) and coalesce((v_offer->>'direct_merchant_page')::boolean,false) and v_offer_conf>=95 and nullif(btrim(coalesce(v_product.pack_size_text,'')),'') is not null;
    insert into public.sp_catalog_commerce_offer_v1(product_id,platform_name,merchant_name,source_domain,source_url,price,currency,list_price,availability_status,image_url,offer_confidence,verified,market_country_code,retrieved_at,valid_until,notes)
    values(p_product_id,left(v_offer->>'platform_name',200),nullif(left(coalesce(v_offer->>'merchant_name',''),200),''),lower(regexp_replace(split_part(regexp_replace(v_offer->>'source_url','^https?://','','i'),'/',1),'^www\.','','i')),v_offer->>'source_url',case when coalesce(v_offer->>'price','')~'^[0-9]+(\.[0-9]+)?$' then (v_offer->>'price')::numeric else null end,upper(left(coalesce(nullif(v_offer->>'currency',''),'INR'),8)),case when coalesce(v_offer->>'list_price','')~'^[0-9]+(\.[0-9]+)?$' then (v_offer->>'list_price')::numeric else null end,case when v_offer->>'availability_status' in ('IN_STOCK','OUT_OF_STOCK','LIMITED','UNKNOWN','DISCONTINUED') then v_offer->>'availability_status' else 'UNKNOWN' end,case when coalesce(v_offer->>'image_url','')~'^https://' then v_offer->>'image_url' else null end,v_offer_conf,v_offer_verified,coalesce(v_product.market_country_code,'IN'),now(),now()+interval '24 hours','M1-B Path A commerce acquisition; never an input to Safety Score.')
    on conflict(product_id,source_url) do update set price=excluded.price,currency=excluded.currency,list_price=excluded.list_price,availability_status=excluded.availability_status,image_url=coalesce(excluded.image_url,public.sp_catalog_commerce_offer_v1.image_url),offer_confidence=excluded.offer_confidence,verified=excluded.verified,retrieved_at=now(),valid_until=excluded.valid_until,updated_at=now();
    v_commerce_saved:=true;
  end if;

  if v_run.final_ingredient_status='QUALIFIED' and jsonb_typeof(v_ing)='array' and jsonb_array_length(v_ing)>0 and v_source_url~'^https://' then
    begin v_conf:=nullif(p_result->>'ingredient_confidence','')::numeric; exception when others then v_conf:=null; end;
    if v_source_kind in ('OFFICIAL_BRAND','OFFICIAL_PAGE') then v_evidence_kind:='OFFICIAL_PAGE';
    elsif v_source_kind='OFFICIAL_SHOPIFY' then v_evidence_kind:='OFFICIAL_SHOPIFY';
    elsif v_source_kind='TRUSTED_RETAILER' then v_evidence_kind:='TRUSTED_RETAILER';
    elsif v_source_kind='OPEN_DATABASE' then v_evidence_kind:='OPEN_DATABASE';
    else v_evidence_kind:='MARKETPLACE'; end if;
    v_evidence_hash:=encode(extensions.digest(v_source_url||'|'||v_ing::text,'sha256'),'hex');
    insert into public.sp_catalog_ingredient_evidence_v1(product_id,evidence_kind,source_name,source_url,source_domain,independent_group_key,raw_text,ingredient_span,parsed_ingredients,extraction_method,engine_version,extraction_confidence,source_confidence,ingredient_confidence,evidence_sha256,retrieval_metadata,verification_status,is_primary_evidence,retrieved_at)
    values(p_product_id,v_evidence_kind,'M1-B Path A',v_source_url,lower(regexp_replace(split_part(regexp_replace(v_source_url,'^https?://','','i'),'/',1),'^www\.','','i')),lower(regexp_replace(split_part(regexp_replace(v_source_url,'^https?://','','i'),'/',1),'^www\.','','i')),array_to_string(array(select jsonb_array_elements_text(v_ing)),', '),array_to_string(array(select jsonb_array_elements_text(v_ing)),', '),v_ing,'STRUCTURED_WEB_EVIDENCE','SP-M1B-PATH-A/1.0',v_conf,v_conf,v_conf,v_evidence_hash,jsonb_build_object('m1b_run_id',p_run_id,'evidence_components',coalesce(p_result->'evidence_components','{}'::jsonb),'benchmark_mode',false),'AUTO_QUALIFIED',true,now())
    on conflict(product_id,evidence_sha256) where evidence_sha256 is not null do update set parsed_ingredients=excluded.parsed_ingredients,extraction_confidence=excluded.extraction_confidence,source_confidence=excluded.source_confidence,ingredient_confidence=excluded.ingredient_confidence,retrieval_metadata=excluded.retrieval_metadata,verification_status='AUTO_QUALIFIED',is_primary_evidence=true,retrieved_at=now(),updated_at=now()
    returning id into v_evidence_id;

    if v_evidence_id is null then select id into v_evidence_id from public.sp_catalog_ingredient_evidence_v1 where product_id=p_product_id and evidence_sha256=v_evidence_hash limit 1; end if;
    delete from public.sp_catalog_ingredient_item_v1 where evidence_id=v_evidence_id;
    update public.sp_catalog_product_ingredient_v1 set qualification_status='SUPERSEDED',updated_at=now() where product_id=p_product_id and qualification_status in ('QUALIFIED','PENDING');
    for v_name in select value from jsonb_array_elements_text(v_ing) loop
      v_seq:=v_seq+1; v_norm:=regexp_replace(lower(btrim(v_name)),'[^a-z0-9]+','','g');
      if v_norm='' then continue; end if;
      insert into public.sp_catalog_ingredient_item_v1(evidence_id,ingredient_sequence,raw_name,normalized_name,confidence,resolution_status) values(v_evidence_id,v_seq,left(v_name,300),v_norm,v_conf,'UNRESOLVED');
      insert into public.sp_catalog_product_ingredient_v1(product_id,ingredient_sequence,display_name,normalized_name,source_count,independent_source_count,confidence,evidence_ids,qualification_status,qualified_at)
      values(p_product_id,v_seq,left(v_name,300),v_norm,1,1,v_conf,array[v_evidence_id],'QUALIFIED',now())
      on conflict(product_id,lower(normalized_name)) do update set ingredient_sequence=excluded.ingredient_sequence,display_name=excluded.display_name,source_count=greatest(public.sp_catalog_product_ingredient_v1.source_count,1),independent_source_count=greatest(public.sp_catalog_product_ingredient_v1.independent_source_count,1),confidence=excluded.confidence,evidence_ids=case when v_evidence_id=any(public.sp_catalog_product_ingredient_v1.evidence_ids) then public.sp_catalog_product_ingredient_v1.evidence_ids else array_append(public.sp_catalog_product_ingredient_v1.evidence_ids,v_evidence_id) end,qualification_status='QUALIFIED',qualified_at=now(),updated_at=now();
    end loop;
    v_ingredient_saved:=true;
  end if;

  insert into public.sp_catalog_pipeline_state_v1(product_id,identity_stage,domain_stage,ingredient_stage,safety_stage,commerce_stage,image_stage,admin_review_required,last_error_code,last_error_detail)
  values(p_product_id,case when v_product.identity_status='VERIFIED' then 'VERIFIED' else 'PENDING' end,'PENDING',case when v_ingredient_saved then 'QUALIFIED' else 'PENDING' end,'PENDING',case when v_commerce_saved then 'READY' else 'PENDING' end,case when v_image_saved then 'READY' else 'PENDING' end,false,null,null)
  on conflict(product_id) do update set ingredient_stage=case when v_ingredient_saved then 'QUALIFIED' else public.sp_catalog_pipeline_state_v1.ingredient_stage end,commerce_stage=case when v_commerce_saved then 'READY' else public.sp_catalog_pipeline_state_v1.commerce_stage end,image_stage=case when v_image_saved then 'READY' else public.sp_catalog_pipeline_state_v1.image_stage end,updated_at=now();

  return jsonb_build_object('success',true,'deferred_for_benchmark',false,'ingredient_saved',v_ingredient_saved,'image_saved',v_image_saved,'commerce_saved',v_commerce_saved,'ingredient_evidence_id',v_evidence_id);
end;$$;

revoke all on function public.sp_m1b_apply_path_a_result_v1(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.sp_m1b_apply_path_a_result_v1(uuid,uuid,jsonb) to service_role;
