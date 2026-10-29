-- SafeProducts Check My Label -> catalog registry + automatic GRIL progression
-- Production foundation: 2026-09-18
-- Safe principles:
--   * accepted user-label identity/evidence can populate the product catalog;
--   * incomplete regulatory evidence is stored as INSUFFICIENT_EVIDENCE, not qualified safety;
--   * GRIL research progresses automatically, but ambiguous identity/legal publication stays fail-closed.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;

create index if not exists sp_catalog_ingredient_evidence_v1_analysis_idx
  on public.sp_catalog_ingredient_evidence_v1 ((retrieval_metadata->>'analysis_id'))
  where retrieval_metadata ? 'analysis_id';

create or replace function public.sp_catalog_ingest_label_result_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, gril, extensions, pg_temp
as $$
declare
  v_brand_name text := left(btrim(coalesce(p_payload->>'brand_name','')),200);
  v_product_name text := left(btrim(coalesce(p_payload->>'product_name','')),300);
  v_variant text := nullif(left(btrim(coalesce(p_payload->>'variant_name','')),200),'');
  v_brand_norm text;
  v_product_norm text;
  v_variant_norm text;
  v_fingerprint text;
  v_brand_id uuid;
  v_product_id uuid;
  v_front_image_id uuid;
  v_ingredient_image_id uuid;
  v_evidence_id uuid;
  v_detected jsonb := coalesce(p_payload->'detected_ingredients','[]'::jsonb);
  v_warnings jsonb := coalesce(p_payload->'warnings','[]'::jsonb);
  v_name text;
  v_norm text;
  v_seq integer := 0;
  v_resolution jsonb;
  v_gril_id bigint;
  v_item_status text;
  v_snapshot_sha text;
  v_evidence_coverage numeric := nullif(p_payload->>'evidence_coverage','')::numeric;
  v_pending integer := coalesce(nullif(p_payload->>'research_pending_count','')::integer,0);
  v_assessment_status text;
  v_profile text := coalesce(nullif(p_payload->>'profile_used',''),'ALL');
  v_score numeric := nullif(p_payload->>'safety_score','')::numeric;
  v_front_hash text := nullif(p_payload->>'front_image_sha256','');
  v_ing_hash text := nullif(p_payload->>'ingredient_image_sha256','');
  v_front_w integer := nullif(p_payload->>'front_width_px','')::integer;
  v_front_h integer := nullif(p_payload->>'front_height_px','')::integer;
  v_ing_w integer := nullif(p_payload->>'ingredient_width_px','')::integer;
  v_ing_h integer := nullif(p_payload->>'ingredient_height_px','')::integer;
begin
  if v_brand_name='' or v_product_name='' then
    raise exception using errcode='22023', message='SP_CATALOG_LABEL_IDENTITY_REQUIRED';
  end if;
  if jsonb_typeof(v_detected) <> 'array' or jsonb_array_length(v_detected)=0 then
    raise exception using errcode='22023', message='SP_CATALOG_LABEL_INGREDIENTS_REQUIRED';
  end if;
  if jsonb_typeof(v_warnings) <> 'array' then v_warnings := '[]'::jsonb; end if;

  perform set_config('sp.catalog_audit_reason','AUTOMATED_USER_LABEL_INGEST',true);

  v_brand_norm := regexp_replace(lower(v_brand_name),'[^a-z0-9]+','','g');
  v_product_norm := regexp_replace(lower(v_product_name),'[^a-z0-9]+','','g');
  v_variant_norm := regexp_replace(lower(coalesce(v_variant,'')),'[^a-z0-9]+','','g');
  v_fingerprint := encode(extensions.digest(v_brand_norm||'|'||v_product_norm||'|'||v_variant_norm||'|IN','sha256'),'hex');

  select id into v_brand_id
    from public.sp_catalog_brand_v1
   where lower(normalized_brand_name)=lower(v_brand_norm)
   limit 1;

  if v_brand_id is null then
    insert into public.sp_catalog_brand_v1(brand_name,normalized_brand_name,status,notes)
    values(v_brand_name,v_brand_norm,'ACTIVE','Created automatically from an accepted user front-label image.')
    on conflict do nothing
    returning id into v_brand_id;

    if v_brand_id is null then
      select id into v_brand_id
        from public.sp_catalog_brand_v1
       where lower(normalized_brand_name)=lower(v_brand_norm)
       limit 1;
    end if;
  end if;

  insert into public.sp_catalog_product_v1(
    product_fingerprint,brand_id,brand_name,product_name,normalized_product_name,variant_name,
    market_country_code,identity_status,source_origin,is_active,notes
  ) values(
    v_fingerprint,v_brand_id,v_brand_name,v_product_name,v_product_norm,v_variant,
    'IN','VERIFIED','USER_LABEL',true,'Identity obtained from the accepted front/product label image.'
  )
  on conflict (product_fingerprint) do update set
    brand_id=excluded.brand_id,
    brand_name=excluded.brand_name,
    product_name=excluded.product_name,
    normalized_product_name=excluded.normalized_product_name,
    variant_name=coalesce(excluded.variant_name,public.sp_catalog_product_v1.variant_name),
    identity_status='VERIFIED',source_origin='USER_LABEL',is_active=true
  returning id into v_product_id;

  if v_front_hash is not null then
    insert into public.sp_catalog_product_image_v1(
      product_id,image_role,source_kind,image_sha256,width_px,height_px,market_country_code,
      identity_evidence,ingredient_evidence,verified,retrieved_at,notes
    ) values(
      v_product_id,'FRONT_LABEL','USER_UPLOAD',v_front_hash,v_front_w,v_front_h,'IN',
      true,false,true,now(),'User-uploaded front image accepted by the label eligibility gate; bytes are not stored in this catalog row.'
    )
    on conflict (product_id,image_sha256) where image_sha256 is not null do update set
      image_role='FRONT_LABEL',identity_evidence=true,verified=true,
      width_px=coalesce(excluded.width_px,public.sp_catalog_product_image_v1.width_px),
      height_px=coalesce(excluded.height_px,public.sp_catalog_product_image_v1.height_px),retrieved_at=now()
    returning id into v_front_image_id;
  end if;

  if v_ing_hash is not null then
    insert into public.sp_catalog_product_image_v1(
      product_id,image_role,source_kind,image_sha256,width_px,height_px,market_country_code,
      identity_evidence,ingredient_evidence,verified,retrieved_at,notes
    ) values(
      v_product_id,'INGREDIENT_LABEL','USER_UPLOAD',v_ing_hash,v_ing_w,v_ing_h,'IN',
      false,true,true,now(),'User-uploaded ingredient image accepted and analysed; bytes are not stored in this catalog row.'
    )
    on conflict (product_id,image_sha256) where image_sha256 is not null do update set
      image_role='INGREDIENT_LABEL',ingredient_evidence=true,verified=true,
      width_px=coalesce(excluded.width_px,public.sp_catalog_product_image_v1.width_px),
      height_px=coalesce(excluded.height_px,public.sp_catalog_product_image_v1.height_px),retrieved_at=now()
    returning id into v_ingredient_image_id;
  end if;

  insert into public.sp_catalog_ingredient_evidence_v1(
    product_id,image_id,evidence_kind,source_name,independent_group_key,parsed_ingredients,
    extraction_method,engine_version,evidence_sha256,retrieval_metadata,verification_status,
    is_primary_evidence,retrieved_at
  ) values(
    v_product_id,v_ingredient_image_id,'USER_LABEL','Check My Label','USER_LABEL:'||coalesce(v_ing_hash,v_fingerprint),v_detected,
    'VLM_LABEL_EXTRACTION',left(coalesce(p_payload->>'edge_version',p_payload->>'engine_version','UNKNOWN'),120),v_ing_hash,
    jsonb_build_object('analysis_id',p_payload->>'analysis_id','profile',v_profile,'product_scope',p_payload->>'product_scope','evidence_coverage',v_evidence_coverage,'research_pending_count',v_pending),
    'AUTO_QUALIFIED',true,now()
  )
  on conflict (product_id,evidence_sha256) where evidence_sha256 is not null do update set
    image_id=excluded.image_id,parsed_ingredients=excluded.parsed_ingredients,engine_version=excluded.engine_version,
    retrieval_metadata=excluded.retrieval_metadata,verification_status='AUTO_QUALIFIED',is_primary_evidence=true,retrieved_at=now()
  returning id into v_evidence_id;

  delete from public.sp_catalog_ingredient_item_v1 where evidence_id=v_evidence_id;
  update public.sp_catalog_product_ingredient_v1
     set qualification_status='SUPERSEDED'
   where product_id=v_product_id and qualification_status in ('QUALIFIED','PENDING');

  for v_name in select value from jsonb_array_elements_text(v_detected) loop
    v_seq := v_seq + 1;
    v_norm := regexp_replace(lower(btrim(v_name)),'[^a-z0-9]+','','g');
    v_resolution := public.sp_web_resolve_label_ingredient_v2(v_name,coalesce(p_payload->>'product_scope','UNKNOWN'));
    v_gril_id := nullif(v_resolution->>'gril_identity_id','')::bigint;
    v_item_status := case
      when v_norm in ('excipients','excipient','qs') then 'AMBIGUOUS'
      when v_gril_id is not null or coalesce((v_resolution->>'identity_verified')::boolean,false) then 'RESOLVED'
      else 'UNRESOLVED'
    end;

    insert into public.sp_catalog_ingredient_item_v1(
      evidence_id,ingredient_sequence,raw_name,normalized_name,canonical_ingredient_id,resolution_status
    ) values(v_evidence_id,v_seq,left(v_name,300),v_norm,v_gril_id,v_item_status);

    if exists(select 1 from public.sp_catalog_product_ingredient_v1 where product_id=v_product_id and lower(normalized_name)=lower(v_norm)) then
      update public.sp_catalog_product_ingredient_v1
         set ingredient_sequence=v_seq,display_name=left(v_name,300),canonical_ingredient_id=coalesce(v_gril_id,canonical_ingredient_id),
             source_count=greatest(source_count,1),independent_source_count=greatest(independent_source_count,1),
             evidence_ids=case when v_evidence_id=any(evidence_ids) then evidence_ids else array_append(evidence_ids,v_evidence_id) end,
             qualification_status=case when v_norm in ('excipients','excipient','qs') then 'PENDING' else 'QUALIFIED' end,
             qualified_at=case when v_norm in ('excipients','excipient','qs') then qualified_at else now() end
       where product_id=v_product_id and lower(normalized_name)=lower(v_norm);
    else
      insert into public.sp_catalog_product_ingredient_v1(
        product_id,ingredient_sequence,display_name,normalized_name,canonical_ingredient_id,source_count,independent_source_count,evidence_ids,qualification_status,qualified_at
      ) values(
        v_product_id,v_seq,left(v_name,300),v_norm,v_gril_id,1,1,array[v_evidence_id],
        case when v_norm in ('excipients','excipient','qs') then 'PENDING' else 'QUALIFIED' end,
        case when v_norm in ('excipients','excipient','qs') then null else now() end
      );
    end if;
  end loop;

  v_snapshot_sha := encode(extensions.digest(v_detected::text,'sha256'),'hex');
  v_assessment_status := case when coalesce(v_evidence_coverage,0) >= 80 and v_pending=0 then 'QUALIFIED' else 'INSUFFICIENT_EVIDENCE' end;

  update public.sp_catalog_safety_assessment_v1 set is_current=false where product_id=v_product_id and is_current=true;
  insert into public.sp_catalog_safety_assessment_v1(
    product_id,assessment_version,assessment_status,overall_score,determination_confidence,
    ingredient_snapshot_sha256,regulatory_snapshot_ref,warnings,summary,determination_source,is_current,determined_at
  ) values(
    v_product_id,left(coalesce(p_payload->>'engine_version','LABEL_SAFETY_V3'),120),v_assessment_status,v_score,v_evidence_coverage,
    v_snapshot_sha,nullif(p_payload->>'analysis_id',''),v_warnings,left(coalesce(p_payload->>'summary',''),2000),'SYSTEM',true,now()
  );

  insert into public.sp_catalog_pipeline_state_v1(
    product_id,identity_stage,domain_stage,ingredient_stage,safety_stage,commerce_stage,image_stage,
    admin_review_required,last_error_code,last_error_detail
  ) values(
    v_product_id,'VERIFIED','PENDING',case when v_pending>0 then 'RESEARCH_PENDING' else 'QUALIFIED' end,
    v_assessment_status,'PENDING','EVIDENCE_CAPTURED',false,null,null
  )
  on conflict (product_id) do update set
    identity_stage='VERIFIED',ingredient_stage=excluded.ingredient_stage,safety_stage=excluded.safety_stage,
    image_stage='EVIDENCE_CAPTURED',last_error_code=null,last_error_detail=null;

  return jsonb_build_object('success',true,'brand_id',v_brand_id,'product_id',v_product_id,'ingredient_evidence_id',v_evidence_id,'assessment_status',v_assessment_status);
end;
$$;

revoke all on function public.sp_catalog_ingest_label_result_v1(jsonb) from public,anon,authenticated;
grant execute on function public.sp_catalog_ingest_label_result_v1(jsonb) to service_role;

create or replace function public.sp_catalog_ingest_label_analysis_by_id_v2(
  p_analysis_id uuid,
  p_analysis_image_sha256 text,
  p_identity jsonb,
  p_image_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, gril, pg_temp
as $$
declare
  v_row public.sp_web_label_analyses_v1%rowtype;
  v_payload jsonb;
  v_existing_product uuid;
  v_existing_brand uuid;
  v_existing_status text;
  v_ing_raw_hash text := nullif(p_image_meta->>'ingredient_image_sha256','');
begin
  if p_analysis_id is null then raise exception using errcode='22023',message='SP_CATALOG_ANALYSIS_ID_REQUIRED'; end if;
  if coalesce(p_analysis_image_sha256,'') !~ '^[0-9a-f]{64}$' then raise exception using errcode='22023',message='SP_CATALOG_ANALYSIS_HASH_REQUIRED'; end if;
  if coalesce(v_ing_raw_hash,'') !~ '^[0-9a-f]{64}$' then raise exception using errcode='22023',message='SP_CATALOG_INGREDIENT_FILE_HASH_REQUIRED'; end if;
  if nullif(btrim(coalesce(p_identity->>'brand_name','')),'') is null
     or nullif(btrim(coalesce(p_identity->>'product_name','')),'') is null then
    raise exception using errcode='22023',message='SP_CATALOG_PRODUCT_IDENTITY_REQUIRED';
  end if;

  select e.product_id,p.brand_id,sa.assessment_status
    into v_existing_product,v_existing_brand,v_existing_status
    from public.sp_catalog_ingredient_evidence_v1 e
    join public.sp_catalog_product_v1 p on p.id=e.product_id
    left join public.sp_catalog_safety_assessment_v1 sa on sa.product_id=p.id and sa.is_current
   where e.retrieval_metadata->>'analysis_id'=p_analysis_id::text
   limit 1;
  if found then
    return jsonb_build_object('success',true,'idempotent_replay',true,'product_id',v_existing_product,'brand_id',v_existing_brand,'assessment_status',v_existing_status);
  end if;

  select * into v_row
    from public.sp_web_label_analyses_v1
   where id=p_analysis_id and image_sha256=p_analysis_image_sha256
   limit 1;
  if not found then raise exception using errcode='P0002',message='SP_CATALOG_ANALYSIS_NOT_FOUND_OR_HASH_MISMATCH'; end if;

  v_payload := jsonb_build_object(
    'brand_name',p_identity->>'brand_name','product_name',p_identity->>'product_name','variant_name',coalesce(p_identity->>'variant',''),
    'front_image_sha256',p_image_meta->>'front_image_sha256','front_width_px',p_image_meta->>'front_width_px','front_height_px',p_image_meta->>'front_height_px',
    'ingredient_image_sha256',v_ing_raw_hash,'ingredient_width_px',p_image_meta->>'ingredient_width_px','ingredient_height_px',p_image_meta->>'ingredient_height_px',
    'detected_ingredients',coalesce(v_row.detected_ingredients,'[]'::jsonb),'safety_score',v_row.safety_score,'warnings',coalesce(v_row.warnings,'[]'::jsonb),
    'summary',v_row.summary,'profile_used',v_row.profile_used,'product_scope',v_row.product_scope,'evidence_coverage',v_row.evidence_coverage,
    'research_pending_count',coalesce(v_row.research_pending_count,0),'engine_version',v_row.engine_version,
    'edge_version',coalesce(v_row.resolution_snapshot->>'edge_version',''),'analysis_id',v_row.id::text
  );

  return public.sp_catalog_ingest_label_result_v1(v_payload);
end;
$$;

revoke all on function public.sp_catalog_ingest_label_analysis_by_id_v2(uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.sp_catalog_ingest_label_analysis_by_id_v2(uuid,text,jsonb,jsonb) to service_role;

create or replace function public.sp_web_progress_label_research_v1(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, gril, pg_temp
as $$
declare
  r record;
  v_res jsonb;
  v_gril_id bigint;
  v_reg_app boolean;
  v_reg_found boolean;
  v_processed integer := 0;
  v_resolved integer := 0;
  v_routed integer := 0;
  v_parent record;
  v_queue_status text;
begin
  p_limit := least(greatest(coalesce(p_limit,50),1),200);
  for r in
    select * from public.sp_web_label_identity_research_v1
     where research_status like 'PENDING_%'
     order by last_seen_at asc
     limit p_limit
     for update skip locked
  loop
    v_processed := v_processed + 1;

    if r.normalized_input in ('excipients','excipient','qs') then
      update public.sp_web_label_identity_research_v1
         set identity_resolution_status='LABEL_PLACEHOLDER',regulatory_resolution_status='NOT_APPLICABLE',research_status='RESOLVED_PLACEHOLDER',
             last_evidence=coalesce(last_evidence,'{}'::jsonb)||jsonb_build_object('autoflow','SP-LABEL-GRIL-AUTOFLOW/1.0','note','Generic label placeholder; not a discrete ingredient identity.')
       where normalized_input=r.normalized_input;
      insert into public.regulatory_knowledge_queue(canonical_name,normalized_canonical_name,first_seen_at,last_seen_at,occurrence_count,current_status,priority,research_payload)
      values(r.display_name,r.normalized_input,r.first_seen_at,now(),r.occurrence_count,'NOT_AN_INGREDIENT','NORMAL',jsonb_build_object('queued_by','SP-LABEL-GRIL-AUTOFLOW/1.0','automatic_publication',false,'source','CHECK_MY_LABEL'))
      on conflict (normalized_canonical_name) do update set current_status='NOT_AN_INGREDIENT',last_seen_at=now(),research_payload=coalesce(public.regulatory_knowledge_queue.research_payload,'{}'::jsonb)||excluded.research_payload;
      v_resolved := v_resolved + 1;
      continue;
    end if;

    v_res := public.sp_web_resolve_label_ingredient_v2(r.display_name,coalesce(r.last_product_scope,'UNKNOWN'));
    v_gril_id := nullif(v_res->>'gril_identity_id','')::bigint;
    v_reg_app := coalesce((v_res->>'regulatory_applicable')::boolean,false);
    v_reg_found := coalesce((v_res->>'regulatory_found')::boolean,false);

    if v_reg_app then
      update public.sp_web_label_identity_research_v1
         set gril_identity_id=coalesce(v_gril_id,gril_identity_id),gril_canonical_name=coalesce(v_res->>'canonical_name',gril_canonical_name),
             identity_resolution_status=case when v_gril_id is not null then 'GRIL_VERIFIED' else identity_resolution_status end,
             regulatory_resolution_status='APPLICABLE_RULE',research_status='RESOLVED',
             last_evidence=coalesce(last_evidence,'{}'::jsonb)||jsonb_build_object('autoflow','SP-LABEL-GRIL-AUTOFLOW/1.0','match_basis',v_res->>'match_basis','agency',v_res->>'agency')
       where normalized_input=r.normalized_input;
      v_resolved := v_resolved + 1;
      continue;
    end if;

    if v_gril_id is not null then
      update public.sp_web_label_identity_research_v1
         set gril_identity_id=v_gril_id,gril_canonical_name=v_res->>'canonical_name',identity_resolution_status='GRIL_VERIFIED',
             regulatory_resolution_status=case when v_reg_found then 'OUT_OF_SCOPE_RULE' else 'REGULATORY_GAP' end,
             research_status='PENDING_GRIL_REGULATORY_RESEARCH',
             last_evidence=coalesce(last_evidence,'{}'::jsonb)||jsonb_build_object('autoflow','SP-LABEL-GRIL-AUTOFLOW/1.0','match_basis',v_res->>'match_basis')
       where normalized_input=r.normalized_input;
      v_queue_status := 'REGULATORY_RESEARCH';
    else
      select gi.id,gi.canonical_name into v_parent
        from gril.ingredient_identity gi
       where gi.identity_status='ACTIVE' and char_length(gi.canonical_name)>=8
         and lower(r.display_name) like lower(gi.canonical_name)||'%'
       order by char_length(gi.canonical_name) desc,gi.id
       limit 1;
      if found then
        update public.sp_web_label_identity_research_v1
           set identity_resolution_status='PARENT_IDENTITY_CANDIDATE',research_status='PENDING_GRIL_SEMANTIC_REVIEW',
               last_evidence=coalesce(last_evidence,'{}'::jsonb)||jsonb_build_object('autoflow','SP-LABEL-GRIL-AUTOFLOW/1.0','parent_candidate_id',v_parent.id,'parent_candidate_name',v_parent.canonical_name,'binding','NOT_AUTOMATIC')
         where normalized_input=r.normalized_input;
      end if;
      v_queue_status := 'IDENTITY_REVIEW';
    end if;

    insert into public.regulatory_knowledge_queue(
      canonical_name,normalized_canonical_name,first_seen_at,last_seen_at,occurrence_count,current_status,priority,source_authorities,source_references,research_payload
    ) values(
      coalesce(v_res->>'canonical_name',r.display_name),r.normalized_input,r.first_seen_at,now(),r.occurrence_count,v_queue_status,
      case when r.occurrence_count>=3 then 'HIGH' else 'NORMAL' end,'[]'::jsonb,'[]'::jsonb,
      jsonb_build_object('queued_by','SP-LABEL-GRIL-AUTOFLOW/1.0','source','CHECK_MY_LABEL','product_scope',r.last_product_scope,
        'pubchem_status',r.pubchem_status,'pubchem_cid',r.pubchem_cid,'automatic_publication',false,
        'required_next_channel',case when v_queue_status='IDENTITY_REVIEW' then 'GRIL_SEMANTIC_IDENTITY_RESEARCH' else 'AUTHORITATIVE_REGULATORY_RESEARCH' end)
    )
    on conflict (normalized_canonical_name) do update set
      canonical_name=excluded.canonical_name,last_seen_at=now(),
      current_status=case when public.regulatory_knowledge_queue.current_status in ('APPROVED','REJECTED','NOT_AN_INGREDIENT') then public.regulatory_knowledge_queue.current_status else excluded.current_status end,
      priority=case when public.regulatory_knowledge_queue.priority='CRITICAL' then 'CRITICAL' when excluded.priority='HIGH' then 'HIGH' else public.regulatory_knowledge_queue.priority end,
      research_payload=coalesce(public.regulatory_knowledge_queue.research_payload,'{}'::jsonb)||excluded.research_payload;
    v_routed := v_routed + 1;
  end loop;

  return jsonb_build_object('success',true,'processed',v_processed,'resolved',v_resolved,'routed',v_routed,'automatic_publication',false);
end;
$$;

revoke all on function public.sp_web_progress_label_research_v1(integer) from public,anon,authenticated;
grant execute on function public.sp_web_progress_label_research_v1(integer) to service_role;

-- Advance current backlog once and then keep it moving without manual triggers.
select public.sp_web_progress_label_research_v1(200);

do $$
declare j bigint;
begin
  for j in select jobid from cron.job where jobname='sp-label-gril-autoflow-v1' loop
    perform cron.unschedule(j);
  end loop;
  perform cron.schedule('sp-label-gril-autoflow-v1','*/5 * * * *','select public.sp_web_progress_label_research_v1(50);');
end $$;
