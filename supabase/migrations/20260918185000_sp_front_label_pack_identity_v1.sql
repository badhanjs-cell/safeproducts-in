-- SafeProducts front-label pack identity v1
-- Adds pack-size propagation to label catalog ingest and makes user-label product identity pack-aware.

create or replace function public.sp_catalog_ingest_label_result_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','gril','extensions','pg_temp'
as $$
declare
  v_brand_name text := left(btrim(coalesce(p_payload->>'brand_name','')),200);
  v_product_name text := left(btrim(coalesce(p_payload->>'product_name','')),300);
  v_variant text := nullif(left(btrim(coalesce(p_payload->>'variant_name','')),200),'');
  v_pack text := nullif(left(btrim(coalesce(p_payload->>'pack_size_text','')),120),'');
  v_brand_norm text; v_product_norm text; v_variant_norm text; v_pack_norm text;
  v_legacy_fingerprint text; v_fingerprint text;
  v_brand_id uuid; v_product_id uuid; v_legacy_product_id uuid;
  v_pack_sibling_count integer := 0;
  v_front_image_id uuid; v_ingredient_image_id uuid; v_evidence_id uuid;
  v_detected jsonb := coalesce(p_payload->'detected_ingredients','[]'::jsonb);
  v_warnings jsonb := coalesce(p_payload->'warnings','[]'::jsonb);
  v_name text; v_norm text; v_seq integer := 0; v_resolution jsonb; v_gril_id bigint; v_item_status text; v_snapshot_sha text;
  v_evidence_coverage numeric := nullif(p_payload->>'evidence_coverage','')::numeric;
  v_pending integer := coalesce(nullif(p_payload->>'research_pending_count','')::integer,0);
  v_assessment_status text; v_profile text := coalesce(nullif(p_payload->>'profile_used',''),'ALL');
  v_score numeric := nullif(p_payload->>'safety_score','')::numeric;
  v_front_hash text := nullif(p_payload->>'front_image_sha256',''); v_ing_hash text := nullif(p_payload->>'ingredient_image_sha256','');
  v_front_w integer := nullif(p_payload->>'front_width_px','')::integer; v_front_h integer := nullif(p_payload->>'front_height_px','')::integer;
  v_ing_w integer := nullif(p_payload->>'ingredient_width_px','')::integer; v_ing_h integer := nullif(p_payload->>'ingredient_height_px','')::integer;
begin
  if v_brand_name='' or v_product_name='' then raise exception using errcode='22023', message='SP_CATALOG_LABEL_IDENTITY_REQUIRED'; end if;
  if jsonb_typeof(v_detected) <> 'array' or jsonb_array_length(v_detected)=0 then raise exception using errcode='22023', message='SP_CATALOG_LABEL_INGREDIENTS_REQUIRED'; end if;
  if jsonb_typeof(v_warnings) <> 'array' then v_warnings := '[]'::jsonb; end if;

  perform set_config('sp.catalog_audit_reason','AUTOMATED_USER_LABEL_INGEST',true);
  v_brand_norm := regexp_replace(lower(v_brand_name),'[^a-z0-9]+','','g');
  v_product_norm := regexp_replace(lower(v_product_name),'[^a-z0-9]+','','g');
  v_variant_norm := regexp_replace(lower(coalesce(v_variant,'')),'[^a-z0-9]+','','g');
  v_pack_norm := regexp_replace(lower(coalesce(v_pack,'')),'[^a-z0-9]+','','g');
  v_legacy_fingerprint := encode(extensions.digest(v_brand_norm||'|'||v_product_norm||'|'||v_variant_norm||'|IN','sha256'),'hex');
  v_fingerprint := case when v_pack is null then v_legacy_fingerprint else encode(extensions.digest(v_brand_norm||'|'||v_product_norm||'|'||v_variant_norm||'|'||v_pack_norm||'|IN','sha256'),'hex') end;

  select id into v_brand_id from public.sp_catalog_brand_v1 where lower(normalized_brand_name)=lower(v_brand_norm) limit 1;
  if v_brand_id is null then
    insert into public.sp_catalog_brand_v1(brand_name,normalized_brand_name,status,notes)
    values(v_brand_name,v_brand_norm,'ACTIVE','Created automatically from an accepted user front-label image.')
    on conflict do nothing returning id into v_brand_id;
    if v_brand_id is null then select id into v_brand_id from public.sp_catalog_brand_v1 where lower(normalized_brand_name)=lower(v_brand_norm) limit 1; end if;
  end if;

  if v_pack is not null then
    select id into v_product_id from public.sp_catalog_product_v1 where product_fingerprint=v_fingerprint limit 1;

    if v_product_id is null then
      select count(*) into v_pack_sibling_count
      from public.sp_catalog_product_v1 p
      where p.brand_id=v_brand_id
        and p.normalized_product_name=v_product_norm
        and regexp_replace(lower(coalesce(p.variant_name,'')),'[^a-z0-9]+','','g')=v_variant_norm
        and nullif(btrim(p.pack_size_text),'') is not null;

      if v_pack_sibling_count=0 then
        select p.id into v_legacy_product_id
        from public.sp_catalog_product_v1 p
        where p.brand_id=v_brand_id
          and p.normalized_product_name=v_product_norm
          and regexp_replace(lower(coalesce(p.variant_name,'')),'[^a-z0-9]+','','g')=v_variant_norm
          and nullif(btrim(p.pack_size_text),'') is null
        order by p.created_at
        limit 1;
      end if;

      if v_legacy_product_id is not null then
        update public.sp_catalog_product_v1
           set product_fingerprint=v_fingerprint,
               brand_id=v_brand_id,
               brand_name=v_brand_name,
               product_name=v_product_name,
               normalized_product_name=v_product_norm,
               variant_name=coalesce(v_variant,variant_name),
               pack_size_text=v_pack,
               identity_status='VERIFIED',
               source_origin='USER_LABEL',
               is_active=true,
               notes='Identity and pack size obtained from the accepted front/product label image.'
         where id=v_legacy_product_id
         returning id into v_product_id;
      end if;
    end if;

    if v_product_id is null then
      insert into public.sp_catalog_product_v1(product_fingerprint,brand_id,brand_name,product_name,normalized_product_name,variant_name,pack_size_text,market_country_code,identity_status,source_origin,is_active,notes)
      values(v_fingerprint,v_brand_id,v_brand_name,v_product_name,v_product_norm,v_variant,v_pack,'IN','VERIFIED','USER_LABEL',true,'Identity and pack size obtained from the accepted front/product label image.')
      on conflict(product_fingerprint) do update set
        brand_id=excluded.brand_id,
        brand_name=excluded.brand_name,
        product_name=excluded.product_name,
        normalized_product_name=excluded.normalized_product_name,
        variant_name=coalesce(excluded.variant_name,public.sp_catalog_product_v1.variant_name),
        pack_size_text=coalesce(excluded.pack_size_text,public.sp_catalog_product_v1.pack_size_text),
        identity_status='VERIFIED',source_origin='USER_LABEL',is_active=true
      returning id into v_product_id;
    else
      update public.sp_catalog_product_v1
         set pack_size_text=coalesce(v_pack,pack_size_text),
             brand_name=v_brand_name,
             product_name=v_product_name,
             variant_name=coalesce(v_variant,variant_name),
             identity_status='VERIFIED',source_origin='USER_LABEL',is_active=true
       where id=v_product_id;
    end if;
  else
    insert into public.sp_catalog_product_v1(product_fingerprint,brand_id,brand_name,product_name,normalized_product_name,variant_name,market_country_code,identity_status,source_origin,is_active,notes)
    values(v_fingerprint,v_brand_id,v_brand_name,v_product_name,v_product_norm,v_variant,'IN','VERIFIED','USER_LABEL',true,'Identity obtained from the accepted front/product label image; pack size was not visible with sufficient confidence.')
    on conflict(product_fingerprint) do update set
      brand_id=excluded.brand_id,
      brand_name=excluded.brand_name,
      product_name=excluded.product_name,
      normalized_product_name=excluded.normalized_product_name,
      variant_name=coalesce(excluded.variant_name,public.sp_catalog_product_v1.variant_name),
      identity_status='VERIFIED',source_origin='USER_LABEL',is_active=true
    returning id into v_product_id;
  end if;

  if v_front_hash is not null then
    insert into public.sp_catalog_product_image_v1(product_id,image_role,source_kind,image_sha256,width_px,height_px,market_country_code,identity_evidence,ingredient_evidence,verified,retrieved_at,notes)
    values(v_product_id,'FRONT_LABEL','USER_UPLOAD',v_front_hash,v_front_w,v_front_h,'IN',true,false,true,now(),'User-uploaded front image accepted by the label eligibility gate; bytes are not stored in this catalog row.')
    on conflict(product_id,image_sha256) where image_sha256 is not null do update set image_role='FRONT_LABEL',identity_evidence=true,verified=true,width_px=coalesce(excluded.width_px,public.sp_catalog_product_image_v1.width_px),height_px=coalesce(excluded.height_px,public.sp_catalog_product_image_v1.height_px),retrieved_at=now() returning id into v_front_image_id;
  end if;
  if v_ing_hash is not null then
    insert into public.sp_catalog_product_image_v1(product_id,image_role,source_kind,image_sha256,width_px,height_px,market_country_code,identity_evidence,ingredient_evidence,verified,retrieved_at,notes)
    values(v_product_id,'INGREDIENT_LABEL','USER_UPLOAD',v_ing_hash,v_ing_w,v_ing_h,'IN',false,true,true,now(),'User-uploaded ingredient image accepted and analysed; bytes are not stored in this catalog row.')
    on conflict(product_id,image_sha256) where image_sha256 is not null do update set image_role='INGREDIENT_LABEL',ingredient_evidence=true,verified=true,width_px=coalesce(excluded.width_px,public.sp_catalog_product_image_v1.width_px),height_px=coalesce(excluded.height_px,public.sp_catalog_product_image_v1.height_px),retrieved_at=now() returning id into v_ingredient_image_id;
  end if;

  insert into public.sp_catalog_ingredient_evidence_v1(product_id,image_id,evidence_kind,source_name,independent_group_key,parsed_ingredients,extraction_method,engine_version,evidence_sha256,retrieval_metadata,verification_status,is_primary_evidence,retrieved_at)
  values(v_product_id,v_ingredient_image_id,'USER_LABEL','Check My Label','USER_LABEL:'||coalesce(v_ing_hash,v_fingerprint),v_detected,'VLM_LABEL_EXTRACTION',left(coalesce(p_payload->>'edge_version',p_payload->>'engine_version','UNKNOWN'),120),v_ing_hash,jsonb_build_object('analysis_id',p_payload->>'analysis_id','profile',v_profile,'product_scope',p_payload->>'product_scope','evidence_coverage',v_evidence_coverage,'research_pending_count',v_pending,'pack_size_text',v_pack),'AUTO_QUALIFIED',true,now())
  on conflict(product_id,evidence_sha256) where evidence_sha256 is not null do update set image_id=excluded.image_id,parsed_ingredients=excluded.parsed_ingredients,engine_version=excluded.engine_version,retrieval_metadata=excluded.retrieval_metadata,verification_status='AUTO_QUALIFIED',is_primary_evidence=true,retrieved_at=now() returning id into v_evidence_id;

  delete from public.sp_catalog_ingredient_item_v1 where evidence_id=v_evidence_id;
  update public.sp_catalog_product_ingredient_v1 set qualification_status='SUPERSEDED' where product_id=v_product_id and qualification_status in('QUALIFIED','PENDING');
  for v_name in select value from jsonb_array_elements_text(v_detected) loop
    v_seq:=v_seq+1; v_norm:=regexp_replace(lower(btrim(v_name)),'[^a-z0-9]+','','g'); v_resolution:=public.sp_web_resolve_label_ingredient_v2(v_name,coalesce(p_payload->>'product_scope','UNKNOWN')); v_gril_id:=nullif(v_resolution->>'gril_identity_id','')::bigint;
    v_item_status:=case when v_norm in('excipients','excipient','qs') then 'AMBIGUOUS' when v_gril_id is not null or coalesce((v_resolution->>'identity_verified')::boolean,false) then 'RESOLVED' else 'UNRESOLVED' end;
    insert into public.sp_catalog_ingredient_item_v1(evidence_id,ingredient_sequence,raw_name,normalized_name,canonical_ingredient_id,resolution_status) values(v_evidence_id,v_seq,left(v_name,300),v_norm,v_gril_id,v_item_status);
    if exists(select 1 from public.sp_catalog_product_ingredient_v1 where product_id=v_product_id and lower(normalized_name)=lower(v_norm)) then
      update public.sp_catalog_product_ingredient_v1 set ingredient_sequence=v_seq,display_name=left(v_name,300),canonical_ingredient_id=coalesce(v_gril_id,canonical_ingredient_id),source_count=greatest(source_count,1),independent_source_count=greatest(independent_source_count,1),evidence_ids=case when v_evidence_id=any(evidence_ids) then evidence_ids else array_append(evidence_ids,v_evidence_id) end,qualification_status=case when v_norm in('excipients','excipient','qs') then 'PENDING' else 'QUALIFIED' end,qualified_at=case when v_norm in('excipients','excipient','qs') then qualified_at else now() end where product_id=v_product_id and lower(normalized_name)=lower(v_norm);
    else
      insert into public.sp_catalog_product_ingredient_v1(product_id,ingredient_sequence,display_name,normalized_name,canonical_ingredient_id,source_count,independent_source_count,evidence_ids,qualification_status,qualified_at) values(v_product_id,v_seq,left(v_name,300),v_norm,v_gril_id,1,1,array[v_evidence_id],case when v_norm in('excipients','excipient','qs') then 'PENDING' else 'QUALIFIED' end,case when v_norm in('excipients','excipient','qs') then null else now() end);
    end if;
  end loop;

  v_snapshot_sha:=encode(extensions.digest(v_detected::text,'sha256'),'hex');
  v_assessment_status:=case when coalesce(v_evidence_coverage,0)>=80 and v_pending=0 then 'QUALIFIED' else 'INSUFFICIENT_EVIDENCE' end;
  update public.sp_catalog_safety_assessment_v1 set is_current=false where product_id=v_product_id and is_current=true;
  insert into public.sp_catalog_safety_assessment_v1(product_id,assessment_version,assessment_status,overall_score,determination_confidence,ingredient_snapshot_sha256,regulatory_snapshot_ref,warnings,summary,determination_source,is_current,determined_at)
  values(v_product_id,left(coalesce(p_payload->>'engine_version','LABEL_SAFETY_V3'),120),v_assessment_status,v_score,v_evidence_coverage,v_snapshot_sha,nullif(p_payload->>'analysis_id',''),v_warnings,left(coalesce(p_payload->>'summary',''),2000),'SYSTEM',true,now());

  insert into public.sp_catalog_pipeline_state_v1(product_id,identity_stage,domain_stage,ingredient_stage,safety_stage,commerce_stage,image_stage,admin_review_required,last_error_code,last_error_detail)
  values(v_product_id,'VERIFIED','PENDING',case when v_pending>0 then 'RESEARCH_PENDING' else 'QUALIFIED' end,v_assessment_status,'PENDING','EVIDENCE_CAPTURED',false,null,null)
  on conflict(product_id) do update set identity_stage='VERIFIED',ingredient_stage=excluded.ingredient_stage,safety_stage=excluded.safety_stage,image_stage='EVIDENCE_CAPTURED',last_error_code=null,last_error_detail=null;

  return jsonb_build_object('success',true,'brand_id',v_brand_id,'product_id',v_product_id,'ingredient_evidence_id',v_evidence_id,'assessment_status',v_assessment_status,'pack_size_text',v_pack);
end;
$$;

create or replace function public.sp_catalog_ingest_label_analysis_by_id_v2(p_analysis_id uuid, p_analysis_image_sha256 text, p_identity jsonb, p_image_meta jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','gril','pg_temp'
as $$
declare
  v_row public.sp_web_label_analyses_v1%rowtype;
  v_payload jsonb;
  v_existing_product uuid;
  v_existing_brand uuid;
  v_existing_status text;
  v_existing_pack text;
  v_ing_raw_hash text := nullif(p_image_meta->>'ingredient_image_sha256','');
begin
  if p_analysis_id is null then raise exception using errcode='22023',message='SP_CATALOG_ANALYSIS_ID_REQUIRED'; end if;
  if coalesce(p_analysis_image_sha256,'') !~ '^[0-9a-f]{64}$' then raise exception using errcode='22023',message='SP_CATALOG_ANALYSIS_HASH_REQUIRED'; end if;
  if coalesce(v_ing_raw_hash,'') !~ '^[0-9a-f]{64}$' then raise exception using errcode='22023',message='SP_CATALOG_INGREDIENT_FILE_HASH_REQUIRED'; end if;
  if nullif(btrim(coalesce(p_identity->>'brand_name','')),'') is null or nullif(btrim(coalesce(p_identity->>'product_name','')),'') is null then raise exception using errcode='22023',message='SP_CATALOG_PRODUCT_IDENTITY_REQUIRED'; end if;

  select e.product_id,p.brand_id,sa.assessment_status,p.pack_size_text
    into v_existing_product,v_existing_brand,v_existing_status,v_existing_pack
    from public.sp_catalog_ingredient_evidence_v1 e
    join public.sp_catalog_product_v1 p on p.id=e.product_id
    left join public.sp_catalog_safety_assessment_v1 sa on sa.product_id=p.id and sa.is_current
   where e.retrieval_metadata->>'analysis_id'=p_analysis_id::text
   limit 1;
  if found then
    return jsonb_build_object('success',true,'idempotent_replay',true,'product_id',v_existing_product,'brand_id',v_existing_brand,'assessment_status',v_existing_status,'pack_size_text',v_existing_pack);
  end if;

  select * into v_row from public.sp_web_label_analyses_v1 where id=p_analysis_id and image_sha256=p_analysis_image_sha256 limit 1;
  if not found then raise exception using errcode='P0002',message='SP_CATALOG_ANALYSIS_NOT_FOUND_OR_HASH_MISMATCH'; end if;

  v_payload := jsonb_build_object(
    'brand_name',p_identity->>'brand_name',
    'product_name',p_identity->>'product_name',
    'variant_name',coalesce(p_identity->>'variant',''),
    'pack_size_text',coalesce(p_identity->>'pack_size_text',''),
    'front_image_sha256',p_image_meta->>'front_image_sha256',
    'front_width_px',p_image_meta->>'front_width_px',
    'front_height_px',p_image_meta->>'front_height_px',
    'ingredient_image_sha256',v_ing_raw_hash,
    'ingredient_width_px',p_image_meta->>'ingredient_width_px',
    'ingredient_height_px',p_image_meta->>'ingredient_height_px',
    'detected_ingredients',coalesce(v_row.detected_ingredients,'[]'::jsonb),
    'safety_score',v_row.safety_score,
    'warnings',coalesce(v_row.warnings,'[]'::jsonb),
    'summary',v_row.summary,
    'profile_used',v_row.profile_used,
    'product_scope',v_row.product_scope,
    'evidence_coverage',v_row.evidence_coverage,
    'research_pending_count',coalesce(v_row.research_pending_count,0),
    'engine_version',v_row.engine_version,
    'edge_version',coalesce(v_row.resolution_snapshot->>'edge_version',''),
    'analysis_id',v_row.id::text
  );

  return public.sp_catalog_ingest_label_result_v1(v_payload);
end;
$$;