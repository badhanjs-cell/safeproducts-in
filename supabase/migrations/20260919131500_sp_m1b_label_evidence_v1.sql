-- SafeProducts M1-B Check My Label evidence foundation v1
-- Exact-pack identity + original image provenance + ingredient evidence only.
-- No Safety Score is created by either RPC.

create or replace function public.sp_m1b_label_register_evidence_v1(
  p_identity jsonb,
  p_image_meta jsonb
) returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','extensions','pg_temp'
as $$
declare
  v_brand_name text:=left(btrim(coalesce(p_identity->>'brand_name','')),200);
  v_product_name text:=left(btrim(coalesce(p_identity->>'product_name','')),300);
  v_variant text:=nullif(left(btrim(coalesce(p_identity->>'variant','')),200),'');
  v_pack text:=nullif(left(btrim(coalesce(p_identity->>'pack_size_text','')),120),'');
  v_market text:=upper(left(coalesce(nullif(btrim(p_identity->>'market_country_code'),''),'IN'),2));
  v_gtin text:=nullif(left(btrim(coalesce(p_identity->>'gtin','')),64),'');
  v_brand_norm text; v_product_norm text; v_variant_norm text; v_pack_norm text;
  v_fingerprint text; v_brand_id uuid; v_product_id uuid;
  v_front_hash text:=lower(coalesce(p_image_meta->>'front_image_sha256',''));
  v_ing_hash text:=lower(coalesce(p_image_meta->>'ingredient_image_sha256',''));
  v_front_w integer; v_front_h integer; v_ing_w integer; v_ing_h integer;
begin
  if v_brand_name='' or v_product_name='' then raise exception using errcode='22023',message='M1B_LABEL_IDENTITY_REQUIRED'; end if;
  if v_market !~ '^[A-Z]{2}$' then raise exception using errcode='22023',message='M1B_LABEL_MARKET_INVALID'; end if;
  if v_front_hash !~ '^[0-9a-f]{64}$' or v_ing_hash !~ '^[0-9a-f]{64}$' or v_front_hash=v_ing_hash then
    raise exception using errcode='22023',message='M1B_LABEL_IMAGE_HASHES_INVALID';
  end if;
  begin v_front_w:=(p_image_meta->>'front_width_px')::integer; v_front_h:=(p_image_meta->>'front_height_px')::integer;
        v_ing_w:=(p_image_meta->>'ingredient_width_px')::integer; v_ing_h:=(p_image_meta->>'ingredient_height_px')::integer;
  exception when others then raise exception using errcode='22023',message='M1B_LABEL_IMAGE_DIMENSIONS_INVALID'; end;
  if least(v_front_w,v_front_h,v_ing_w,v_ing_h)<=0 or greatest(v_front_w,v_front_h,v_ing_w,v_ing_h)>30000 then
    raise exception using errcode='22023',message='M1B_LABEL_IMAGE_DIMENSIONS_INVALID';
  end if;

  v_brand_norm:=regexp_replace(lower(v_brand_name),'[^a-z0-9]+','','g');
  v_product_norm:=regexp_replace(lower(v_product_name),'[^a-z0-9]+','','g');
  v_variant_norm:=regexp_replace(lower(coalesce(v_variant,'')),'[^a-z0-9]+','','g');
  v_pack_norm:=regexp_replace(lower(coalesce(v_pack,'')),'[^a-z0-9]+','','g');
  v_fingerprint:=encode(extensions.digest(v_brand_norm||'|'||v_product_norm||'|'||v_variant_norm||'|'||v_pack_norm||'|'||v_market,'sha256'),'hex');
  perform set_config('sp.catalog_audit_reason','M1B_CHECK_MY_LABEL_IDENTITY_EVIDENCE',true);

  select id into v_brand_id from public.sp_catalog_brand_v1 where lower(normalized_brand_name)=lower(v_brand_norm) limit 1;
  if v_brand_id is null then
    insert into public.sp_catalog_brand_v1(brand_name,normalized_brand_name,status,notes)
    values(v_brand_name,v_brand_norm,'ACTIVE','Created from an accepted Check My Label front image.')
    on conflict do nothing returning id into v_brand_id;
    if v_brand_id is null then
      select id into v_brand_id from public.sp_catalog_brand_v1 where lower(normalized_brand_name)=lower(v_brand_norm) limit 1;
    end if;
  end if;

  insert into public.sp_catalog_product_v1(
    product_fingerprint,brand_id,brand_name,product_name,normalized_product_name,variant_name,
    pack_size_text,market_country_code,gtin,identity_confidence,identity_status,source_origin,is_active,notes
  ) values(
    v_fingerprint,v_brand_id,v_brand_name,v_product_name,v_product_norm,v_variant,v_pack,v_market,v_gtin,
    100,'VERIFIED','USER_LABEL',true,'Identity captured from pair-validated front/product label; fingerprint includes visible pack when supplied.'
  )
  on conflict(product_fingerprint) do update set
    brand_id=excluded.brand_id,brand_name=excluded.brand_name,product_name=excluded.product_name,
    normalized_product_name=excluded.normalized_product_name,variant_name=coalesce(excluded.variant_name,public.sp_catalog_product_v1.variant_name),
    pack_size_text=coalesce(excluded.pack_size_text,public.sp_catalog_product_v1.pack_size_text),
    gtin=coalesce(excluded.gtin,public.sp_catalog_product_v1.gtin),identity_confidence=greatest(coalesce(public.sp_catalog_product_v1.identity_confidence,0),100),
    identity_status='VERIFIED',source_origin='USER_LABEL',is_active=true,updated_at=now()
  returning id into v_product_id;

  insert into public.sp_catalog_product_image_v1(
    product_id,image_role,source_kind,image_sha256,width_px,height_px,market_country_code,
    is_primary_display,identity_evidence,ingredient_evidence,verified,retrieved_at,notes
  ) values(
    v_product_id,'FRONT_LABEL','USER_UPLOAD',v_front_hash,v_front_w,v_front_h,v_market,
    false,true,false,true,now(),'Pair-validated front image provenance; image bytes are not retained by this row.'
  ) on conflict(product_id,image_sha256) where image_sha256 is not null do update set
    image_role='FRONT_LABEL',identity_evidence=true,verified=true,width_px=excluded.width_px,height_px=excluded.height_px,retrieved_at=now(),updated_at=now();

  insert into public.sp_catalog_product_image_v1(
    product_id,image_role,source_kind,image_sha256,width_px,height_px,market_country_code,
    is_primary_display,identity_evidence,ingredient_evidence,verified,retrieved_at,notes
  ) values(
    v_product_id,'INGREDIENT_LABEL','USER_UPLOAD',v_ing_hash,v_ing_w,v_ing_h,v_market,
    false,false,true,true,now(),'Pair-validated ingredient-panel image provenance; image bytes are not retained by this row.'
  ) on conflict(product_id,image_sha256) where image_sha256 is not null do update set
    image_role='INGREDIENT_LABEL',ingredient_evidence=true,verified=true,width_px=excluded.width_px,height_px=excluded.height_px,retrieved_at=now(),updated_at=now();

  insert into public.sp_catalog_pipeline_state_v1(
    product_id,identity_stage,domain_stage,ingredient_stage,safety_stage,commerce_stage,image_stage,
    admin_review_required,last_error_code,last_error_detail
  ) values(v_product_id,'VERIFIED','PENDING','PENDING','PENDING','PENDING','EVIDENCE_CAPTURED',false,null,null)
  on conflict(product_id) do update set identity_stage='VERIFIED',image_stage='EVIDENCE_CAPTURED',updated_at=now();

  return jsonb_build_object('success',true,'product_id',v_product_id,'product_fingerprint',v_fingerprint,'pack_size_text',v_pack);
end;$$;
revoke all on function public.sp_m1b_label_register_evidence_v1(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.sp_m1b_label_register_evidence_v1(jsonb,jsonb) to service_role;

create or replace function public.sp_m1b_label_apply_ingredient_evidence_v1(
  p_run_id uuid,
  p_product_id uuid,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','extensions','pg_temp'
as $$
declare
  v_run public.sp_m1b_run_v1%rowtype;
  v_hash text:=lower(coalesce(p_payload->>'ingredient_image_sha256',''));
  v_ingredients jsonb:=coalesce(p_payload->'detected_ingredients','[]'::jsonb);
  v_complete boolean:=coalesce((p_payload->>'declaration_complete')::boolean,false);
  v_uncertain jsonb:=coalesce(p_payload->'uncertain_tokens','[]'::jsonb);
  v_scope text:=left(coalesce(nullif(p_payload->>'product_scope',''),'UNKNOWN'),80);
  v_evidence_id uuid; v_image_id uuid; v_name text; v_norm text; v_seq int:=0; v_qualified boolean;
begin
  select * into v_run from public.sp_m1b_run_v1 where id=p_run_id for update;
  if v_run.id is null then raise exception using errcode='22023',message='M1B_LABEL_RUN_NOT_FOUND'; end if;
  if v_run.context<>'CHECK_MY_LABEL' then raise exception using errcode='22023',message='M1B_LABEL_CONTEXT_REQUIRED'; end if;
  if v_run.product_id is distinct from p_product_id then raise exception using errcode='22023',message='M1B_LABEL_RUN_PRODUCT_MISMATCH'; end if;
  if v_hash !~ '^[0-9a-f]{64}$' or jsonb_typeof(v_ingredients)<>'array' or jsonb_array_length(v_ingredients)=0 then
    raise exception using errcode='22023',message='M1B_LABEL_INGREDIENT_EVIDENCE_INVALID';
  end if;
  if jsonb_typeof(v_uncertain)<>'array' then v_uncertain:='[]'::jsonb; end if;
  v_qualified:=v_complete and jsonb_array_length(v_uncertain)=0;
  select id into v_image_id from public.sp_catalog_product_image_v1
   where product_id=p_product_id and image_sha256=v_hash limit 1;
  if v_image_id is null then raise exception using errcode='22023',message='M1B_LABEL_INGREDIENT_IMAGE_NOT_REGISTERED'; end if;

  perform set_config('sp.catalog_audit_reason','M1B_CHECK_MY_LABEL_INGREDIENT_EVIDENCE',true);
  insert into public.sp_catalog_ingredient_evidence_v1(
    product_id,image_id,evidence_kind,source_name,independent_group_key,parsed_ingredients,
    extraction_method,engine_version,extraction_confidence,source_confidence,ingredient_confidence,
    evidence_sha256,retrieval_metadata,verification_status,is_primary_evidence,retrieved_at
  ) values(
    p_product_id,v_image_id,'USER_LABEL','Check My Label','USER_LABEL:'||v_hash,v_ingredients,
    'M1B_VLM_LABEL_EXTRACTION',left(coalesce(p_payload->>'engine_version','SP-M1B-LABEL/1.0'),120),
    case when v_qualified then 100 else null end,100,case when v_qualified then 100 else null end,
    v_hash,jsonb_build_object('m1b_run_id',p_run_id,'product_scope',v_scope,'declaration_complete',v_complete,'uncertain_tokens',v_uncertain),
    case when v_qualified then 'AUTO_QUALIFIED' else 'PENDING' end,v_qualified,now()
  ) on conflict(product_id,evidence_sha256) where evidence_sha256 is not null do update set
    image_id=excluded.image_id,parsed_ingredients=excluded.parsed_ingredients,extraction_method=excluded.extraction_method,
    engine_version=excluded.engine_version,extraction_confidence=excluded.extraction_confidence,source_confidence=excluded.source_confidence,
    ingredient_confidence=excluded.ingredient_confidence,retrieval_metadata=excluded.retrieval_metadata,
    verification_status=excluded.verification_status,is_primary_evidence=excluded.is_primary_evidence,retrieved_at=now(),updated_at=now()
  returning id into v_evidence_id;

  delete from public.sp_catalog_ingredient_item_v1 where evidence_id=v_evidence_id;
  if v_qualified then
    update public.sp_catalog_product_ingredient_v1 set qualification_status='SUPERSEDED',updated_at=now()
      where product_id=p_product_id and qualification_status in('QUALIFIED','PENDING');
  end if;
  for v_name in select value from jsonb_array_elements_text(v_ingredients) loop
    v_seq:=v_seq+1; v_norm:=regexp_replace(lower(btrim(v_name)),'[^a-z0-9]+','','g');
    if v_norm='' then continue; end if;
    insert into public.sp_catalog_ingredient_item_v1(evidence_id,ingredient_sequence,raw_name,normalized_name,confidence,resolution_status)
    values(v_evidence_id,v_seq,left(v_name,300),v_norm,case when v_qualified then 100 else null end,case when v_qualified then 'RESOLVED' else 'UNRESOLVED' end);
    insert into public.sp_catalog_product_ingredient_v1(
      product_id,ingredient_sequence,display_name,normalized_name,source_count,independent_source_count,
      confidence,evidence_ids,qualification_status,qualified_at
    ) values(
      p_product_id,v_seq,left(v_name,300),v_norm,1,1,case when v_qualified then 100 else null end,
      array[v_evidence_id],case when v_qualified then 'QUALIFIED' else 'PENDING' end,case when v_qualified then now() else null end
    ) on conflict(product_id,lower(normalized_name)) do update set
      ingredient_sequence=excluded.ingredient_sequence,display_name=excluded.display_name,
      source_count=greatest(public.sp_catalog_product_ingredient_v1.source_count,1),
      independent_source_count=greatest(public.sp_catalog_product_ingredient_v1.independent_source_count,1),
      confidence=excluded.confidence,
      evidence_ids=case when v_evidence_id=any(public.sp_catalog_product_ingredient_v1.evidence_ids) then public.sp_catalog_product_ingredient_v1.evidence_ids else array_append(public.sp_catalog_product_ingredient_v1.evidence_ids,v_evidence_id) end,
      qualification_status=excluded.qualification_status,qualified_at=excluded.qualified_at,updated_at=now();
  end loop;
  update public.sp_catalog_pipeline_state_v1 set
    ingredient_stage=case when v_qualified then 'QUALIFIED' else 'RESEARCH_PENDING' end,
    safety_stage='PENDING',admin_review_required=false,last_error_code=null,last_error_detail=null,updated_at=now()
  where product_id=p_product_id;
  return jsonb_build_object('success',true,'ingredient_evidence_id',v_evidence_id,'ingredient_qualified',v_qualified);
end;$$;
revoke all on function public.sp_m1b_label_apply_ingredient_evidence_v1(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.sp_m1b_label_apply_ingredient_evidence_v1(uuid,uuid,jsonb) to service_role;
