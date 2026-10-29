-- SafeProducts M1-B Qualification Policy v2 + Human Review Recovery v2
-- Runtime evidence admission is relaxed in the Path A Edge code only.
-- This migration adds the authenticated admin terminal-recovery path.
-- It deliberately does not alter benchmark-gold tables or the strict regulatory safety scorer.

begin;

create or replace function public.sp_m1b_submit_human_recovery_v2(
  p_review_id uuid,
  p_source_url text,
  p_source_kind text,
  p_ingredient_declaration text,
  p_parsed_ingredients jsonb,
  p_identity_confirmed boolean,
  p_reviewer_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'auth', 'pg_temp'
as $function$
declare
  v_review public.sp_catalog_review_queue_v1%rowtype;
  v_run public.sp_m1b_run_v1%rowtype;
  v_product public.sp_catalog_product_v1%rowtype;
  v_run_id uuid;
  v_source_url text := btrim(coalesce(p_source_url,''));
  v_source_kind text := upper(btrim(coalesce(p_source_kind,'')));
  v_declaration text := btrim(coalesce(p_ingredient_declaration,''));
  v_note text := nullif(btrim(coalesce(p_reviewer_note,'')),'');
  v_domain text;
  v_conf numeric;
  v_tier text;
  v_hash text;
  v_evidence_id uuid;
  v_name text;
  v_norm text;
  v_seq integer := 0;
  v_score jsonb;
  v_result jsonb;
  v_existing jsonb;
begin
  if public.sp_web_has_role_v1(auth.uid(),'admin'::public.sp_web_app_role_v1) is not true then
    raise exception using errcode='42501', message='ADMIN_ACCESS_REQUIRED';
  end if;

  if p_review_id is null then
    raise exception using errcode='22023', message='REVIEW_ID_REQUIRED';
  end if;
  if p_identity_confirmed is not true then
    raise exception using errcode='22023', message='EXACT_PRODUCT_IDENTITY_CONFIRMATION_REQUIRED';
  end if;
  if v_source_url !~ '^https://' then
    raise exception using errcode='22023', message='SOURCE_URL_HTTPS_REQUIRED';
  end if;
  if v_source_kind not in ('OFFICIAL_BRAND','OFFICIAL_FIRST_PARTY_RETAIL','TRUSTED_STRUCTURED_SOURCE','MANUAL_WEB_REVIEW') then
    raise exception using errcode='22023', message='SOURCE_KIND_INVALID';
  end if;
  if length(v_declaration) < 3 or length(v_declaration) > 100000 then
    raise exception using errcode='22023', message='INGREDIENT_DECLARATION_REQUIRED';
  end if;
  if jsonb_typeof(p_parsed_ingredients) <> 'array' or jsonb_array_length(p_parsed_ingredients) = 0 then
    raise exception using errcode='22023', message='PARSED_INGREDIENT_ARRAY_REQUIRED';
  end if;
  if jsonb_array_length(p_parsed_ingredients) > 250 then
    raise exception using errcode='22023', message='PARSED_INGREDIENT_LIMIT_EXCEEDED';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_parsed_ingredients) e
    where jsonb_typeof(e) <> 'string'
       or length(btrim(e #>> '{}')) < 1
       or length(btrim(e #>> '{}')) > 300
  ) then
    raise exception using errcode='22023', message='PARSED_INGREDIENT_ENTRY_INVALID';
  end if;

  select * into v_review
  from public.sp_catalog_review_queue_v1
  where id=p_review_id
  for update;
  if v_review.id is null then
    raise exception using errcode='P0002', message='INGREDIENT_RECOVERY_REVIEW_NOT_FOUND';
  end if;
  if v_review.review_type <> 'INGREDIENT_RECOVERY' then
    raise exception using errcode='22023', message='INGREDIENT_RECOVERY_REVIEW_REQUIRED';
  end if;
  if v_review.product_id is null then
    raise exception using errcode='22023', message='REVIEW_PRODUCT_REQUIRED';
  end if;

  if v_review.status='RESOLVED' then
    v_existing := v_review.source_context->'human_recovery_v2_result';
    if v_existing is not null and jsonb_typeof(v_existing)='object' then
      return v_existing || jsonb_build_object('success',true,'inserted',false,'idempotent_replay',true);
    end if;
    raise exception using errcode='22023', message='REVIEW_ALREADY_RESOLVED';
  end if;
  if v_review.status not in ('OPEN','IN_REVIEW') then
    raise exception using errcode='22023', message='REVIEW_NOT_OPEN';
  end if;

  begin
    v_run_id := nullif(v_review.source_context->>'m1b_run_id','')::uuid;
  exception when others then
    v_run_id := null;
  end;
  if v_run_id is null then
    raise exception using errcode='22023', message='REVIEW_M1B_RUN_REQUIRED';
  end if;

  select * into v_run from public.sp_m1b_run_v1 where id=v_run_id for update;
  if v_run.id is null then
    raise exception using errcode='P0002', message='M1B_RUN_NOT_FOUND';
  end if;
  if v_run.context='BENCHMARK' then
    raise exception using errcode='22023', message='BENCHMARK_RECOVERY_SEPARATE';
  end if;
  if v_run.product_id is distinct from v_review.product_id then
    raise exception using errcode='22023', message='REVIEW_RUN_PRODUCT_MISMATCH';
  end if;

  select * into v_product from public.sp_catalog_product_v1 where id=v_review.product_id for update;
  if v_product.id is null then
    raise exception using errcode='P0002', message='PRODUCT_NOT_FOUND';
  end if;

  v_domain := lower(regexp_replace(split_part(regexp_replace(v_source_url,'^https?://','','i'),'/',1),'^www\\.','','i'));
  v_conf := case v_source_kind
    when 'OFFICIAL_BRAND' then 100
    when 'OFFICIAL_FIRST_PARTY_RETAIL' then 96
    when 'TRUSTED_STRUCTURED_SOURCE' then 92
    else 88
  end;
  v_tier := case when v_conf >= 90 then 'HIGH' when v_conf >= 80 then 'MODERATE' else 'LOW' end;
  v_hash := encode(extensions.digest(v_source_url||'|HUMAN_VERIFIED_WEB|'||v_declaration||'|'||p_parsed_ingredients::text,'sha256'),'hex');

  perform set_config('sp.catalog_audit_reason','M1B_HUMAN_REVIEW_RECOVERY_V2',true);

  -- Preserve all prior evidence for audit, but make the newly verified declaration primary.
  update public.sp_catalog_ingredient_evidence_v1
     set is_primary_evidence=false, updated_at=now(), updated_by=auth.uid()
   where product_id=v_review.product_id
     and is_primary_evidence=true;

  insert into public.sp_catalog_ingredient_evidence_v1(
    product_id,evidence_kind,source_name,source_url,source_domain,independent_group_key,
    raw_text,ingredient_span,parsed_ingredients,extraction_method,engine_version,
    extraction_confidence,source_confidence,ingredient_confidence,evidence_sha256,
    retrieval_metadata,verification_status,is_primary_evidence,retrieved_at,
    verified_by,verified_at,verification_notes,created_by,updated_by
  ) values(
    v_review.product_id,'ADMIN_MANUAL',left(v_domain,250),v_source_url,v_domain,v_domain,
    v_declaration,v_declaration,p_parsed_ingredients,'HUMAN_VERIFIED_WEB','SP-M1B-HUMAN-RECOVERY/2.0',
    100,v_conf,v_conf,v_hash,
    jsonb_build_object(
      'm1b_run_id',v_run_id,
      'review_id',v_review.id,
      'source_kind',v_source_kind,
      'identity_confirmed',true,
      'evidence_confidence',v_conf,
      'evidence_tier',v_tier,
      'qualification_policy_version','M1B_QUALIFICATION_V2',
      'reviewer_user_id',auth.uid()
    ),
    'ADMIN_VERIFIED',true,now(),auth.uid(),now(),v_note,auth.uid(),auth.uid()
  )
  on conflict(product_id,evidence_sha256) where evidence_sha256 is not null do update set
    source_name=excluded.source_name,
    source_url=excluded.source_url,
    source_domain=excluded.source_domain,
    raw_text=excluded.raw_text,
    ingredient_span=excluded.ingredient_span,
    parsed_ingredients=excluded.parsed_ingredients,
    extraction_method='HUMAN_VERIFIED_WEB',
    engine_version='SP-M1B-HUMAN-RECOVERY/2.0',
    extraction_confidence=100,
    source_confidence=excluded.source_confidence,
    ingredient_confidence=excluded.ingredient_confidence,
    retrieval_metadata=excluded.retrieval_metadata,
    verification_status='ADMIN_VERIFIED',
    is_primary_evidence=true,
    retrieved_at=now(),
    verified_by=auth.uid(),
    verified_at=now(),
    verification_notes=excluded.verification_notes,
    updated_by=auth.uid(),
    updated_at=now()
  returning id into v_evidence_id;

  if v_evidence_id is null then
    select id into v_evidence_id
    from public.sp_catalog_ingredient_evidence_v1
    where product_id=v_review.product_id and evidence_sha256=v_hash
    limit 1;
  end if;

  delete from public.sp_catalog_ingredient_item_v1 where evidence_id=v_evidence_id;

  update public.sp_catalog_product_ingredient_v1
     set qualification_status='SUPERSEDED', updated_at=now(), updated_by=auth.uid()
   where product_id=v_review.product_id
     and qualification_status in ('QUALIFIED','PENDING','CONFLICT');

  for v_name in select value from jsonb_array_elements_text(p_parsed_ingredients) loop
    v_name := btrim(v_name);
    v_norm := regexp_replace(lower(v_name),'[^a-z0-9]+','','g');
    if v_norm='' then continue; end if;
    v_seq := v_seq + 1;

    insert into public.sp_catalog_ingredient_item_v1(
      evidence_id,ingredient_sequence,raw_name,normalized_name,confidence,resolution_status,created_by
    ) values(
      v_evidence_id,v_seq,left(v_name,300),v_norm,v_conf,'UNRESOLVED',auth.uid()
    );

    insert into public.sp_catalog_product_ingredient_v1(
      product_id,ingredient_sequence,display_name,normalized_name,source_count,
      independent_source_count,confidence,evidence_ids,qualification_status,
      admin_override,override_reason,qualified_at,created_by,updated_by
    ) values(
      v_review.product_id,v_seq,left(v_name,300),v_norm,1,1,v_conf,array[v_evidence_id],
      'QUALIFIED',true,'HUMAN_REVIEW_RECOVERY_V2',now(),auth.uid(),auth.uid()
    )
    on conflict(product_id,lower(normalized_name)) do update set
      ingredient_sequence=excluded.ingredient_sequence,
      display_name=excluded.display_name,
      source_count=greatest(public.sp_catalog_product_ingredient_v1.source_count,1),
      independent_source_count=greatest(public.sp_catalog_product_ingredient_v1.independent_source_count,1),
      confidence=excluded.confidence,
      evidence_ids=array[v_evidence_id],
      qualification_status='QUALIFIED',
      admin_override=true,
      override_reason='HUMAN_REVIEW_RECOVERY_V2',
      qualified_at=now(),
      updated_by=auth.uid(),
      updated_at=now();
  end loop;

  if v_seq=0 then
    raise exception using errcode='22023', message='NO_VALID_PARSED_INGREDIENTS';
  end if;

  update public.sp_m1b_run_v1
     set final_ingredient_status='QUALIFIED', updated_at=now()
   where id=v_run_id;

  insert into public.sp_catalog_pipeline_state_v1(
    product_id,identity_stage,domain_stage,ingredient_stage,safety_stage,commerce_stage,image_stage,
    admin_review_required,last_error_code,last_error_detail,updated_by
  ) values(
    v_review.product_id,
    case when v_product.identity_status='VERIFIED' then 'VERIFIED' else 'PENDING' end,
    'PENDING','QUALIFIED','PENDING','PENDING','PENDING',false,null,null,auth.uid()
  )
  on conflict(product_id) do update set
    ingredient_stage='QUALIFIED',
    safety_stage='PENDING',
    admin_review_required=false,
    last_error_code=null,
    last_error_detail=null,
    updated_by=auth.uid(),
    updated_at=now();

  -- Safety Score remains governed by the existing strict regulatory coverage gate.
  v_score := public.sp_m1b_score_qualified_product_v1(v_run_id,v_review.product_id,'ALL');

  v_result := jsonb_build_object(
    'success',true,
    'inserted',true,
    'review_id',v_review.id,
    'run_id',v_run_id,
    'product_id',v_review.product_id,
    'ingredient_evidence_id',v_evidence_id,
    'ingredient_count',v_seq,
    'evidence_confidence',v_conf,
    'evidence_tier',v_tier,
    'qualification_policy_version','M1B_QUALIFICATION_V2',
    'score_available',coalesce((v_score->>'score_available')::boolean,false),
    'safety_score',v_score->'safety_score',
    'assessment_status',v_score->>'assessment_status',
    'regulatory_reason',v_score->>'reason',
    'regulatory_evidence_coverage',v_score->'evidence_coverage',
    'production_publication_allowed',false
  );

  update public.sp_catalog_review_queue_v1
     set status='RESOLVED',
         resolved_at=now(),
         assigned_to=coalesce(assigned_to,auth.uid()),
         resolution_notes=coalesce(v_note,'Human Review Recovery v2: exact identity and complete ingredient declaration manually verified; strict safety requalification executed.'),
         source_context=coalesce(source_context,'{}'::jsonb) || jsonb_build_object('human_recovery_v2_result',v_result),
         updated_by=auth.uid(),
         updated_at=now()
   where id=v_review.id;

  return v_result;
end;
$function$;

revoke all on function public.sp_m1b_submit_human_recovery_v2(uuid,text,text,text,jsonb,boolean,text) from public;
revoke all on function public.sp_m1b_submit_human_recovery_v2(uuid,text,text,text,jsonb,boolean,text) from anon;
revoke all on function public.sp_m1b_submit_human_recovery_v2(uuid,text,text,text,jsonb,boolean,text) from authenticated;
grant execute on function public.sp_m1b_submit_human_recovery_v2(uuid,text,text,text,jsonb,boolean,text) to authenticated;
grant execute on function public.sp_m1b_submit_human_recovery_v2(uuid,text,text,text,jsonb,boolean,text) to service_role;

comment on function public.sp_m1b_submit_human_recovery_v2(uuid,text,text,text,jsonb,boolean,text) is
  'Admin-only terminal ingredient evidence recovery. Persists human-verified provenance, requalifies ingredients, and invokes the existing strict regulatory safety scorer. Benchmark-gold state is never modified.';

commit;
