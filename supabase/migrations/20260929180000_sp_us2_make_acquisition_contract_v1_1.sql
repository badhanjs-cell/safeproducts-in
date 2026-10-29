-- SafeProducts SP-US2 Make acquisition contract v1.1.
-- Additive successor only: frozen 1.0 queue RPCs and rows remain valid.
-- No external HTTP is performed here.

begin;

alter table public.sp_us2_acquisition_request_v1
  add column if not exists contract_version text;

update public.sp_us2_acquisition_request_v1
set contract_version='SP-US2-MAKE-ACQUISITION/1.0'
where contract_version is null or btrim(contract_version)='';

alter table public.sp_us2_acquisition_request_v1
  alter column contract_version set default 'SP-US2-MAKE-ACQUISITION/1.0';

alter table public.sp_us2_acquisition_request_v1
  alter column contract_version set not null;

alter table public.sp_us2_acquisition_request_v1
  add column if not exists comparison_pack_key text;

alter table public.sp_us2_acquisition_request_v1
  add column if not exists target_category_products integer not null default 0;

do $block$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid='public.sp_us2_acquisition_request_v1'::regclass
      and conname='sp_us2_acquisition_request_v1_target_category_products_ck'
  ) then
    alter table public.sp_us2_acquisition_request_v1
      add constraint sp_us2_acquisition_request_v1_target_category_products_ck
      check (target_category_products between 0 and 10);
  end if;
end;
$block$;

create index if not exists sp_us2_acquisition_request_v1_contract_due_idx
  on public.sp_us2_acquisition_request_v1(contract_version,status,next_attempt_at,created_at)
  where status in ('PENDING','RETRY');

create or replace function public.sp_us2_enqueue_acquisition_v1_1(
  p_query text,
  p_search_mode text,
  p_anchor_product_id uuid default null,
  p_requested_pack_key text default null,
  p_comparison_pack_key text default null,
  p_category text default null,
  p_target_exact_offers integer default 0,
  p_target_alternatives integer default 0,
  p_target_category_products integer default 0,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','extensions','pg_temp'
as $function$
declare
  v_contract constant text := 'SP-US2-MAKE-ACQUISITION/1.1';
  v_query text := lower(regexp_replace(btrim(coalesce(p_query,'')),'[[:space:]]+',' ','g'));
  v_mode text := upper(btrim(coalesce(p_search_mode,'')));
  v_requested_pack text := nullif(lower(btrim(coalesce(p_requested_pack_key,''))), '');
  v_comparison_pack text := nullif(lower(btrim(coalesce(p_comparison_pack_key,''))), '');
  v_category text := nullif(lower(regexp_replace(btrim(coalesce(p_category,'')),'[[:space:]]+',' ','g')), '');
  v_exact integer := least(greatest(coalesce(p_target_exact_offers,0),0),5);
  v_alt integer := least(greatest(coalesce(p_target_alternatives,0),0),5);
  v_category_target integer := least(greatest(coalesce(p_target_category_products,0),0),10);
  v_dedupe text;
  v_existing uuid;
  v_request_id uuid;
  v_hour_count integer := 0;
  v_day_count integer := 0;
  v_hour_limit integer := 60;
  v_day_limit integer := 500;
begin
  if v_query='' or length(v_query)>200 then
    raise exception using errcode='22023',message='SP_US2_ACQUISITION_QUERY_INVALID';
  end if;
  if v_mode not in ('SPECIFIC_PRODUCT','CATEGORY') then
    raise exception using errcode='22023',message='SP_US2_ACQUISITION_MODE_INVALID';
  end if;
  if p_anchor_product_id is not null and not exists(
    select 1 from public.sp_catalog_product_v1 where id=p_anchor_product_id
  ) then
    raise exception using errcode='22023',message='SP_US2_ACQUISITION_ANCHOR_NOT_FOUND';
  end if;
  if jsonb_typeof(coalesce(p_payload,'{}'::jsonb)) <> 'object' then
    raise exception using errcode='22023',message='SP_US2_ACQUISITION_PAYLOAD_OBJECT_REQUIRED';
  end if;

  -- Launch rule: an explicit user pack is immutable. A comparison pack is only
  -- meaningful for no-pack searches and can never substitute the request.
  if v_requested_pack is not null then
    v_comparison_pack := null;
  end if;

  if v_mode='SPECIFIC_PRODUCT' then
    v_category_target := 0;
  else
    v_exact := 0;
    v_alt := 0;
  end if;

  -- Successor dedupe is contract_version scoped. Including the version in the
  -- digest also keeps the existing v1.0 unique dedupe index compatible.
  v_dedupe := encode(extensions.digest(
    v_contract || '|' || v_query || '|' || v_mode || '|' || coalesce(p_anchor_product_id::text,'') || '|' ||
    coalesce(v_requested_pack,'') || '|' || coalesce(v_comparison_pack,'') || '|' || coalesce(v_category,''),
    'sha256'
  ),'hex');

  perform pg_advisory_xact_lock(hashtextextended('SP_US2_MAKE_ACQUISITION_ENQUEUE_V1_1',0));

  select id into v_existing
  from public.sp_us2_acquisition_request_v1
  where contract_version=v_contract
    and dedupe_key=v_dedupe
    and status in ('PENDING','DISPATCHING','DISPATCHED','RETRY')
  order by created_at desc
  limit 1;
  if v_existing is not null then
    return jsonb_build_object(
      'allowed',false,'reason','ACTIVE_REQUEST_EXISTS','request_id',v_existing,
      'contract_version',v_contract,
      'target_exact_offers',v_exact,'target_alternatives',v_alt,
      'target_category_products',v_category_target
    );
  end if;

  select id into v_existing
  from public.sp_us2_acquisition_request_v1
  where contract_version=v_contract
    and dedupe_key=v_dedupe
    and created_at >= now()-interval '6 hours'
  order by created_at desc
  limit 1;
  if v_existing is not null then
    return jsonb_build_object(
      'allowed',false,'reason','QUERY_COOLDOWN','request_id',v_existing,
      'contract_version',v_contract,
      'target_exact_offers',v_exact,'target_alternatives',v_alt,
      'target_category_products',v_category_target
    );
  end if;

  -- Global caps deliberately count both 1.0 and 1.1 rows: cost protection is
  -- system-wide rather than version-local.
  select count(*)::integer into v_hour_count
  from public.sp_us2_acquisition_request_v1
  where created_at >= date_trunc('hour',now());
  if v_hour_count >= v_hour_limit then
    return jsonb_build_object(
      'allowed',false,'reason','GLOBAL_HOUR_LIMIT','request_id',null,
      'contract_version',v_contract,
      'target_exact_offers',v_exact,'target_alternatives',v_alt,
      'target_category_products',v_category_target
    );
  end if;

  select count(*)::integer into v_day_count
  from public.sp_us2_acquisition_request_v1
  where created_at >= date_trunc('day',now());
  if v_day_count >= v_day_limit then
    return jsonb_build_object(
      'allowed',false,'reason','GLOBAL_DAY_LIMIT','request_id',null,
      'contract_version',v_contract,
      'target_exact_offers',v_exact,'target_alternatives',v_alt,
      'target_category_products',v_category_target
    );
  end if;

  insert into public.sp_us2_acquisition_request_v1(
    normalized_query,search_mode,anchor_product_id,dedupe_key,requested_pack_key,comparison_pack_key,category,
    target_exact_offers,target_alternatives,target_category_products,contract_version,
    status,attempt_count,max_attempts,next_attempt_at,payload
  ) values (
    v_query,v_mode,p_anchor_product_id,v_dedupe,v_requested_pack,v_comparison_pack,v_category,
    v_exact,v_alt,v_category_target,v_contract,
    'PENDING',0,3,now(),coalesce(p_payload,'{}'::jsonb)
  ) returning id into v_request_id;

  return jsonb_build_object(
    'allowed',true,'reason','QUEUED','request_id',v_request_id,
    'contract_version',v_contract,
    'requested_pack_key',v_requested_pack,
    'comparison_pack_key',v_comparison_pack,
    'target_exact_offers',v_exact,'target_alternatives',v_alt,
    'target_category_products',v_category_target
  );
end;
$function$;

create or replace function public.sp_us2_claim_acquisition_v1_1()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','pg_temp'
as $function$
declare
  v_row public.sp_us2_acquisition_request_v1%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('SP_US2_MAKE_ACQUISITION_CLAIM_V1_1',0));

  select * into v_row
  from public.sp_us2_acquisition_request_v1
  where contract_version = 'SP-US2-MAKE-ACQUISITION/1.1'
    and status in ('PENDING','RETRY')
    and next_attempt_at <= now()
    and attempt_count < max_attempts
  order by next_attempt_at,created_at,id
  for update skip locked
  limit 1;

  if v_row.id is null then
    return jsonb_build_object('claimed',false,'contract_version','SP-US2-MAKE-ACQUISITION/1.1');
  end if;

  update public.sp_us2_acquisition_request_v1
  set status='DISPATCHING',
      attempt_count=public.sp_us2_acquisition_request_v1.attempt_count+1,
      updated_at=now()
  where id=v_row.id
  returning * into v_row;

  return jsonb_build_object('claimed',true,'contract_version','SP-US2-MAKE-ACQUISITION/1.1','request',to_jsonb(v_row));
end;
$function$;

revoke all on function public.sp_us2_enqueue_acquisition_v1_1(text,text,uuid,text,text,text,integer,integer,integer,jsonb) from public;
revoke all on function public.sp_us2_enqueue_acquisition_v1_1(text,text,uuid,text,text,text,integer,integer,integer,jsonb) from anon;
revoke all on function public.sp_us2_enqueue_acquisition_v1_1(text,text,uuid,text,text,text,integer,integer,integer,jsonb) from authenticated;
grant execute on function public.sp_us2_enqueue_acquisition_v1_1(text,text,uuid,text,text,text,integer,integer,integer,jsonb) to service_role;

revoke all on function public.sp_us2_claim_acquisition_v1_1() from public;
revoke all on function public.sp_us2_claim_acquisition_v1_1() from anon;
revoke all on function public.sp_us2_claim_acquisition_v1_1() from authenticated;
grant execute on function public.sp_us2_claim_acquisition_v1_1() to service_role;

commit;
