-- SafeProducts SP-US2 bounded Make acquisition queue v1.
-- Queue/dispatch state only. This migration never acquires external data itself.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.sp_us2_acquisition_request_v1 (
  id uuid primary key default gen_random_uuid(),
  normalized_query text not null check (length(normalized_query) between 1 and 200),
  search_mode text not null check (search_mode in ('SPECIFIC_PRODUCT','CATEGORY')),
  anchor_product_id uuid references public.sp_catalog_product_v1(id) on delete set null,
  dedupe_key text not null check (length(dedupe_key) between 16 and 128),
  requested_pack_key text,
  category text,
  target_exact_offers integer not null default 0 check (target_exact_offers between 0 and 5),
  target_alternatives integer not null default 0 check (target_alternatives between 0 and 10),
  status text not null default 'PENDING' check (status in ('PENDING','DISPATCHING','DISPATCHED','RETRY','COMPLETED','FAILED')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 3),
  next_attempt_at timestamptz not null default now(),
  dispatched_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object'),
  result_summary jsonb check (result_summary is null or jsonb_typeof(result_summary)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sp_us2_acquisition_request_v1_active_dedupe_uq
  on public.sp_us2_acquisition_request_v1(dedupe_key)
  where status in ('PENDING','DISPATCHING','DISPATCHED','RETRY');

create index if not exists sp_us2_acquisition_request_v1_due_idx
  on public.sp_us2_acquisition_request_v1(status,next_attempt_at,created_at)
  where status in ('PENDING','RETRY');

create index if not exists sp_us2_acquisition_request_v1_created_idx
  on public.sp_us2_acquisition_request_v1(created_at desc);

alter table public.sp_us2_acquisition_request_v1 enable row level security;
revoke all on table public.sp_us2_acquisition_request_v1 from public;
revoke all on table public.sp_us2_acquisition_request_v1 from anon;
revoke all on table public.sp_us2_acquisition_request_v1 from authenticated;
grant select,insert,update,delete on table public.sp_us2_acquisition_request_v1 to service_role;

create or replace function public.sp_us2_enqueue_acquisition_v1(
  p_query text,
  p_search_mode text,
  p_anchor_product_id uuid default null,
  p_requested_pack_key text default null,
  p_category text default null,
  p_target_exact_offers integer default 5,
  p_target_alternatives integer default 5,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','extensions','pg_temp'
as $function$
declare
  v_query text := lower(regexp_replace(btrim(coalesce(p_query,'')),'[[:space:]]+',' ','g'));
  v_mode text := upper(btrim(coalesce(p_search_mode,'')));
  v_pack text := nullif(lower(btrim(coalesce(p_requested_pack_key,''))), '');
  v_category text := nullif(lower(regexp_replace(btrim(coalesce(p_category,'')),'[[:space:]]+',' ','g')), '');
  v_exact integer := least(greatest(coalesce(p_target_exact_offers,5),0),5);
  v_alt integer := least(greatest(coalesce(p_target_alternatives,5),0),10);
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

  v_dedupe := encode(extensions.digest(
    v_query || '|' || v_mode || '|' || coalesce(p_anchor_product_id::text,'') || '|' || coalesce(v_pack,'') || '|' || coalesce(v_category,''),
    'sha256'
  ),'hex');

  -- Serialize enqueue decisions so cooldown and global caps cannot be overrun by concurrency.
  perform pg_advisory_xact_lock(hashtextextended('SP_US2_MAKE_ACQUISITION_ENQUEUE_V1',0));

  select id into v_existing
  from public.sp_us2_acquisition_request_v1
  where dedupe_key=v_dedupe
    and status in ('PENDING','DISPATCHING','DISPATCHED','RETRY')
  order by created_at desc
  limit 1;
  if v_existing is not null then
    return jsonb_build_object(
      'allowed',false,'reason','ACTIVE_REQUEST_EXISTS','request_id',v_existing,
      'target_exact_offers',v_exact,'target_alternatives',v_alt
    );
  end if;

  select id into v_existing
  from public.sp_us2_acquisition_request_v1
  where dedupe_key=v_dedupe
    and created_at >= now()-interval '6 hours'
  order by created_at desc
  limit 1;
  if v_existing is not null then
    return jsonb_build_object(
      'allowed',false,'reason','QUERY_COOLDOWN','request_id',v_existing,
      'target_exact_offers',v_exact,'target_alternatives',v_alt
    );
  end if;

  select count(*)::integer into v_hour_count
  from public.sp_us2_acquisition_request_v1
  where created_at >= date_trunc('hour',now());
  if v_hour_count >= v_hour_limit then
    return jsonb_build_object(
      'allowed',false,'reason','GLOBAL_HOUR_LIMIT','request_id',null,
      'target_exact_offers',v_exact,'target_alternatives',v_alt
    );
  end if;

  select count(*)::integer into v_day_count
  from public.sp_us2_acquisition_request_v1
  where created_at >= date_trunc('day',now());
  if v_day_count >= v_day_limit then
    return jsonb_build_object(
      'allowed',false,'reason','GLOBAL_DAY_LIMIT','request_id',null,
      'target_exact_offers',v_exact,'target_alternatives',v_alt
    );
  end if;

  insert into public.sp_us2_acquisition_request_v1(
    normalized_query,search_mode,anchor_product_id,dedupe_key,requested_pack_key,category,
    target_exact_offers,target_alternatives,status,attempt_count,max_attempts,next_attempt_at,payload
  ) values (
    v_query,v_mode,p_anchor_product_id,v_dedupe,v_pack,v_category,
    v_exact,v_alt,'PENDING',0,3,now(),coalesce(p_payload,'{}'::jsonb)
  ) returning id into v_request_id;

  return jsonb_build_object(
    'allowed',true,'reason','QUEUED','request_id',v_request_id,
    'target_exact_offers',v_exact,'target_alternatives',v_alt
  );
end;
$function$;

create or replace function public.sp_us2_claim_acquisition_v1()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','pg_temp'
as $function$
declare
  v_row public.sp_us2_acquisition_request_v1%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('SP_US2_MAKE_ACQUISITION_CLAIM_V1',0));

  select * into v_row
  from public.sp_us2_acquisition_request_v1
  where status in ('PENDING','RETRY')
    and next_attempt_at <= now()
    and attempt_count < max_attempts
  order by next_attempt_at,created_at,id
  for update skip locked
  limit 1;

  if v_row.id is null then
    return jsonb_build_object('claimed',false);
  end if;

  update public.sp_us2_acquisition_request_v1
  set status='DISPATCHING',
      attempt_count=public.sp_us2_acquisition_request_v1.attempt_count+1,
      updated_at=now()
  where id=v_row.id
  returning * into v_row;

  return jsonb_build_object('claimed',true,'request',to_jsonb(v_row));
end;
$function$;

create or replace function public.sp_us2_finish_acquisition_v1(
  p_request_id uuid,
  p_status text,
  p_error_code text default null,
  p_result_summary jsonb default null,
  p_retry_after_seconds integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','pg_temp'
as $function$
declare
  v_row public.sp_us2_acquisition_request_v1%rowtype;
  v_target text := upper(btrim(coalesce(p_status,'')));
  v_retry_seconds integer := least(greatest(coalesce(p_retry_after_seconds,60),30),3600);
begin
  if v_target not in ('DISPATCHED','COMPLETED','RETRY','FAILED') then
    raise exception using errcode='22023',message='SP_US2_ACQUISITION_FINISH_STATUS_INVALID';
  end if;
  if p_result_summary is not null and jsonb_typeof(p_result_summary) <> 'object' then
    raise exception using errcode='22023',message='SP_US2_ACQUISITION_RESULT_OBJECT_REQUIRED';
  end if;

  select * into v_row
  from public.sp_us2_acquisition_request_v1
  where id=p_request_id
  for update;
  if v_row.id is null then
    raise exception using errcode='P0002',message='SP_US2_ACQUISITION_REQUEST_NOT_FOUND';
  end if;

  if v_row.status='COMPLETED' then
    return jsonb_build_object('success',true,'request_id',v_row.id,'status','COMPLETED','idempotent',true);
  end if;

  if v_target='RETRY' and v_row.attempt_count >= v_row.max_attempts then
    v_target := 'FAILED';
  end if;

  if v_row.status not in ('DISPATCHING','DISPATCHED','RETRY') then
    raise exception using errcode='22023',message='SP_US2_ACQUISITION_TRANSITION_INVALID';
  end if;

  update public.sp_us2_acquisition_request_v1
  set status=v_target,
      dispatched_at=case when v_target='DISPATCHED' then coalesce(dispatched_at,now()) else dispatched_at end,
      completed_at=case when v_target in ('COMPLETED','FAILED') then coalesce(completed_at,now()) else completed_at end,
      next_attempt_at=case when v_target='RETRY' then now()+make_interval(secs=>v_retry_seconds) else next_attempt_at end,
      last_error_code=case when v_target in ('RETRY','FAILED') then nullif(left(btrim(coalesce(p_error_code,'')),160),'') else null end,
      result_summary=coalesce(p_result_summary,result_summary),
      updated_at=now()
  where id=p_request_id
  returning * into v_row;

  return jsonb_build_object(
    'success',true,
    'request_id',v_row.id,
    'status',v_row.status,
    'attempt_count',v_row.attempt_count,
    'max_attempts',v_row.max_attempts,
    'next_attempt_at',v_row.next_attempt_at
  );
end;
$function$;

revoke all on function public.sp_us2_enqueue_acquisition_v1(text,text,uuid,text,text,integer,integer,jsonb) from public;
revoke all on function public.sp_us2_enqueue_acquisition_v1(text,text,uuid,text,text,integer,integer,jsonb) from anon;
revoke all on function public.sp_us2_enqueue_acquisition_v1(text,text,uuid,text,text,integer,integer,jsonb) from authenticated;
grant execute on function public.sp_us2_enqueue_acquisition_v1(text,text,uuid,text,text,integer,integer,jsonb) to service_role;

revoke all on function public.sp_us2_claim_acquisition_v1() from public;
revoke all on function public.sp_us2_claim_acquisition_v1() from anon;
revoke all on function public.sp_us2_claim_acquisition_v1() from authenticated;
grant execute on function public.sp_us2_claim_acquisition_v1() to service_role;

revoke all on function public.sp_us2_finish_acquisition_v1(uuid,text,text,jsonb,integer) from public;
revoke all on function public.sp_us2_finish_acquisition_v1(uuid,text,text,jsonb,integer) from anon;
revoke all on function public.sp_us2_finish_acquisition_v1(uuid,text,text,jsonb,integer) from authenticated;
grant execute on function public.sp_us2_finish_acquisition_v1(uuid,text,text,jsonb,integer) to service_role;

commit;
