-- SafeProducts M1-BR ingredient-only persistence + human-review handoff v1
-- Additive. No commerce/image-display writes. No Safety Score writes.

alter table public.sp_catalog_review_queue_v1
  drop constraint if exists sp_catalog_review_queue_v1_review_type_check;
alter table public.sp_catalog_review_queue_v1
  add constraint sp_catalog_review_queue_v1_review_type_check
  check (review_type in (
    'PRODUCT_IDENTITY','OFFICIAL_DOMAIN','INGREDIENT_EVIDENCE','INGREDIENT_CONFLICT',
    'INGREDIENT_RECOVERY','SAFETY_FAILURE','PRICE','IMAGE','GENERAL'
  ));

create unique index if not exists sp_catalog_review_queue_v1_m1br_open_uq
  on public.sp_catalog_review_queue_v1(product_id,(source_context->>'m1b_run_id'))
  where review_type='INGREDIENT_RECOVERY' and status in ('OPEN','IN_REVIEW');

create or replace function public.sp_m1br_apply_ingredient_result_v1(
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
  v_status text:=upper(btrim(coalesce(p_result->>'ingredient_status','')));
  v_source_url text:=nullif(btrim(coalesce(p_result->>'source_url','')),'');
  v_source_name text:=left(coalesce(nullif(btrim(p_result->>'source_name'),''),'M1-BR Recovery'),250);
  v_method text:=upper(coalesce(nullif(p_result->>'extraction_method',''),'OCR'));
  v_evidence_kind text;
  v_ing jsonb:=coalesce(p_result->'parsed_ingredients','[]'::jsonb);
  v_raw text:=left(coalesce(p_result->>'raw_text',''),100000);
  v_conf numeric;
  v_evidence_hash text;
  v_evidence_id uuid;
  v_name text;
  v_norm text;
  v_seq int:=0;
  v_saved boolean:=false;
begin
  select * into v_run from public.sp_m1b_run_v1 where id=p_run_id for update;
  if v_run.id is null then raise exception using errcode='22023',message='M1BR_RUN_NOT_FOUND'; end if;
  select * into v_product from public.sp_catalog_product_v1 where id=p_product_id;
  if v_product.id is null then raise exception using errcode='22023',message='M1BR_PRODUCT_NOT_FOUND'; end if;
  if v_run.product_id is not null and v_run.product_id<>p_product_id then raise exception using errcode='22023',message='M1BR_RUN_PRODUCT_MISMATCH'; end if;
  if v_status<>'QUALIFIED' then
    return jsonb_build_object('success',true,'ingredient_saved',false,'reason','NOT_QUALIFIED');
  end if;
  if v_run.context='BENCHMARK' then
    return jsonb_build_object('success',true,'ingredient_saved',false,'deferred_for_benchmark',true);
  end if;
  if jsonb_typeof(v_ing)<>'array' or jsonb_array_length(v_ing)=0 or v_source_url !~ '^https://' then
    raise exception using errcode='22023',message='M1BR_QUALIFIED_EVIDENCE_REQUIRED';
  end if;
  begin v_conf:=nullif(p_result->>'ingredient_confidence','')::numeric; exception when others then v_conf:=null; end;
  if v_conf is null or v_conf<0 or v_conf>100 then raise exception using errcode='22023',message='M1BR_CONFIDENCE_REQUIRED'; end if;
  v_evidence_kind:=case when v_method like '%VLM%' then 'VLM' else 'OCR' end;
  v_evidence_hash:=encode(extensions.digest(v_source_url||'|'||v_method||'|'||v_ing::text,'sha256'),'hex');
  perform set_config('sp.catalog_audit_reason','M1BR_CONTROLLED_INGREDIENT_PERSISTENCE',true);

  insert into public.sp_catalog_ingredient_evidence_v1(
    product_id,evidence_kind,source_name,source_url,source_domain,independent_group_key,
    raw_text,ingredient_span,parsed_ingredients,extraction_method,engine_version,
    extraction_confidence,source_confidence,ingredient_confidence,evidence_sha256,
    retrieval_metadata,verification_status,is_primary_evidence,retrieved_at
  ) values(
    p_product_id,v_evidence_kind,v_source_name,v_source_url,
    lower(regexp_replace(split_part(regexp_replace(v_source_url,'^https?://','','i'),'/',1),'^www\.','','i')),
    coalesce(nullif(p_result->>'lineage_cluster_id',''),lower(regexp_replace(split_part(regexp_replace(v_source_url,'^https?://','','i'),'/',1),'^www\.','','i'))),
    v_raw,v_raw,v_ing,v_method,left(coalesce(p_result->>'engine_version','SP-M1BR/1.0'),120),
    v_conf,v_conf,v_conf,v_evidence_hash,
    jsonb_build_object(
      'm1b_run_id',p_run_id,
      'recovery_method',p_result->>'recovery_method',
      'source_lineages',coalesce(p_result->'source_lineages','[]'::jsonb),
      'ocr_consensus',coalesce(p_result->'ocr_consensus','{}'::jsonb),
      'vlm_uncertainty',coalesce(p_result->'vlm_uncertainty','[]'::jsonb)
    ),
    'AUTO_QUALIFIED',true,now()
  )
  on conflict(product_id,evidence_sha256) where evidence_sha256 is not null do update set
    parsed_ingredients=excluded.parsed_ingredients,
    raw_text=excluded.raw_text,
    ingredient_span=excluded.ingredient_span,
    extraction_method=excluded.extraction_method,
    engine_version=excluded.engine_version,
    extraction_confidence=excluded.extraction_confidence,
    source_confidence=excluded.source_confidence,
    ingredient_confidence=excluded.ingredient_confidence,
    retrieval_metadata=excluded.retrieval_metadata,
    verification_status='AUTO_QUALIFIED',is_primary_evidence=true,retrieved_at=now(),updated_at=now()
  returning id into v_evidence_id;
  if v_evidence_id is null then
    select id into v_evidence_id from public.sp_catalog_ingredient_evidence_v1
     where product_id=p_product_id and evidence_sha256=v_evidence_hash limit 1;
  end if;

  delete from public.sp_catalog_ingredient_item_v1 where evidence_id=v_evidence_id;
  update public.sp_catalog_product_ingredient_v1
     set qualification_status='SUPERSEDED',updated_at=now()
   where product_id=p_product_id and qualification_status in ('QUALIFIED','PENDING');

  for v_name in select value from jsonb_array_elements_text(v_ing) loop
    v_seq:=v_seq+1;
    v_norm:=regexp_replace(lower(btrim(v_name)),'[^a-z0-9]+','','g');
    if v_norm='' then continue; end if;
    insert into public.sp_catalog_ingredient_item_v1(
      evidence_id,ingredient_sequence,raw_name,normalized_name,confidence,resolution_status
    ) values(v_evidence_id,v_seq,left(v_name,300),v_norm,v_conf,'UNRESOLVED');
    insert into public.sp_catalog_product_ingredient_v1(
      product_id,ingredient_sequence,display_name,normalized_name,source_count,
      independent_source_count,confidence,evidence_ids,qualification_status,qualified_at
    ) values(
      p_product_id,v_seq,left(v_name,300),v_norm,
      greatest(coalesce(nullif(p_result->>'source_count','')::int,1),1),
      greatest(coalesce(nullif(p_result->>'independent_source_count','')::int,1),1),
      v_conf,array[v_evidence_id],'QUALIFIED',now()
    )
    on conflict(product_id,lower(normalized_name)) do update set
      ingredient_sequence=excluded.ingredient_sequence,
      display_name=excluded.display_name,
      source_count=greatest(public.sp_catalog_product_ingredient_v1.source_count,excluded.source_count),
      independent_source_count=greatest(public.sp_catalog_product_ingredient_v1.independent_source_count,excluded.independent_source_count),
      confidence=excluded.confidence,
      evidence_ids=case when v_evidence_id=any(public.sp_catalog_product_ingredient_v1.evidence_ids)
        then public.sp_catalog_product_ingredient_v1.evidence_ids
        else array_append(public.sp_catalog_product_ingredient_v1.evidence_ids,v_evidence_id) end,
      qualification_status='QUALIFIED',qualified_at=now(),updated_at=now();
  end loop;

  insert into public.sp_catalog_pipeline_state_v1(
    product_id,identity_stage,domain_stage,ingredient_stage,safety_stage,commerce_stage,image_stage,
    admin_review_required,last_error_code,last_error_detail
  ) values(
    p_product_id,case when v_product.identity_status='VERIFIED' then 'VERIFIED' else 'PENDING' end,
    'PENDING','QUALIFIED','PENDING','PENDING','PENDING',false,null,null
  )
  on conflict(product_id) do update set
    ingredient_stage='QUALIFIED',admin_review_required=false,
    last_error_code=null,last_error_detail=null,updated_at=now();
  v_saved:=true;
  return jsonb_build_object('success',true,'ingredient_saved',v_saved,'ingredient_evidence_id',v_evidence_id);
end;$$;
revoke all on function public.sp_m1br_apply_ingredient_result_v1(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.sp_m1br_apply_ingredient_result_v1(uuid,uuid,jsonb) to service_role;

create or replace function public.sp_m1br_create_review_v1(
  p_run_id uuid,
  p_product_id uuid,
  p_terminal_status text,
  p_packet jsonb
) returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','pg_temp'
as $$
declare
  v_status text:=upper(btrim(coalesce(p_terminal_status,'')));
  v_id uuid;
  v_existing boolean:=false;
  v_title text;
begin
  if not exists(select 1 from public.sp_m1b_run_v1 where id=p_run_id) then
    raise exception using errcode='22023',message='M1BR_RUN_NOT_FOUND';
  end if;
  if p_product_id is not null and not exists(select 1 from public.sp_catalog_product_v1 where id=p_product_id) then
    raise exception using errcode='22023',message='M1BR_PRODUCT_NOT_FOUND';
  end if;
  if v_status not in ('INSUFFICIENT_EVIDENCE','CONFLICT_REQUIRES_REVIEW','FAILED') then
    raise exception using errcode='22023',message='M1BR_REVIEW_STATUS_INVALID';
  end if;
  v_title:=case when v_status='CONFLICT_REQUIRES_REVIEW'
    then 'Ingredient formulation conflict requires review'
    else 'Ingredient recovery requires human review' end;
  select id into v_id from public.sp_catalog_review_queue_v1
   where product_id is not distinct from p_product_id
     and review_type='INGREDIENT_RECOVERY'
     and status in ('OPEN','IN_REVIEW')
     and source_context->>'m1b_run_id'=p_run_id::text
   order by opened_at limit 1;
  if v_id is not null then
    v_existing:=true;
    update public.sp_catalog_review_queue_v1
       set severity=case when v_status='CONFLICT_REQUIRES_REVIEW' then 'HIGH' else severity end,
           title=v_title,
           detail=left('M1-BR terminal state: '||v_status,4000),
           source_context=coalesce(p_packet,'{}'::jsonb)||jsonb_build_object('m1b_run_id',p_run_id,'terminal_status',v_status),
           updated_at=now()
     where id=v_id;
  else
    insert into public.sp_catalog_review_queue_v1(product_id,review_type,severity,status,title,detail,source_context)
    values(
      p_product_id,'INGREDIENT_RECOVERY',
      case when v_status='CONFLICT_REQUIRES_REVIEW' then 'HIGH' else 'NORMAL' end,
      'OPEN',v_title,left('M1-BR terminal state: '||v_status,4000),
      coalesce(p_packet,'{}'::jsonb)||jsonb_build_object('m1b_run_id',p_run_id,'terminal_status',v_status)
    ) returning id into v_id;
  end if;
  if p_product_id is not null then
    update public.sp_catalog_pipeline_state_v1
       set admin_review_required=true,last_error_code=v_status,
           last_error_detail='Automated M1-BR recovery exhausted; human review required.',updated_at=now()
     where product_id=p_product_id;
  end if;
  return jsonb_build_object('success',true,'review_id',v_id,'idempotent_replay',v_existing);
exception when unique_violation then
  select id into v_id from public.sp_catalog_review_queue_v1
   where product_id is not distinct from p_product_id
     and review_type='INGREDIENT_RECOVERY' and status in ('OPEN','IN_REVIEW')
     and source_context->>'m1b_run_id'=p_run_id::text order by opened_at limit 1;
  return jsonb_build_object('success',true,'review_id',v_id,'idempotent_replay',true);
end;$$;
revoke all on function public.sp_m1br_create_review_v1(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.sp_m1br_create_review_v1(uuid,uuid,text,jsonb) to service_role;
