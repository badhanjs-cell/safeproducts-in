-- SafeProducts M1-B + M1-BR runtime foundation v1
-- Additive orchestration/audit state only. No Safety Score calculation and no regulatory publication.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists sp_internal;

create table if not exists public.sp_m1b_run_v1 (
  id uuid primary key default gen_random_uuid(),
  context text not null check (context in ('BENCHMARK','NORMAL_SEARCH','CHECK_MY_LABEL')),
  product_id uuid references public.sp_catalog_product_v1(id) on delete set null,
  product_fingerprint text not null check (length(btrim(product_fingerprint)) between 1 and 256),
  benchmark_slot_id text,
  session_key_hash text,
  m1b_status text not null default 'PENDING' check (m1b_status in ('PENDING','RUNNING','QUALIFIED','FAILED','CONFLICT')),
  m1b_failure_code text,
  m1br_status text not null default 'NOT_REQUIRED' check (m1br_status in ('NOT_REQUIRED','QUEUED','RUNNING','QUALIFIED','INSUFFICIENT_EVIDENCE','CONFLICT_REQUIRES_REVIEW','FAILED')),
  final_ingredient_status text check (final_ingredient_status is null or final_ingredient_status in ('QUALIFIED','INSUFFICIENT_EVIDENCE','CONFLICT_REQUIRES_REVIEW')),
  benchmark_sealed_at timestamptz,
  metrics_recorded_at timestamptz,
  displayed_at timestamptz,
  promotion_status text not null default 'BLOCKED' check (promotion_status in ('BLOCKED','ELIGIBLE','PROMOTED','REJECTED')),
  promoted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (context <> 'BENCHMARK' or (benchmark_slot_id is not null and session_key_hash is not null))
);
create index if not exists sp_m1b_run_v1_context_created_idx on public.sp_m1b_run_v1(context,created_at desc);
create index if not exists sp_m1b_run_v1_product_idx on public.sp_m1b_run_v1(product_id,created_at desc);
create index if not exists sp_m1b_run_v1_fingerprint_idx on public.sp_m1b_run_v1(product_fingerprint,created_at desc);

create table if not exists public.sp_m1b_engine_attempt_v1 (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.sp_m1b_run_v1(id) on delete cascade,
  engine text not null check (engine in ('M1-B','M1-BR','HUMAN_REVIEW')),
  stage text not null check (length(btrim(stage)) between 1 and 120),
  status text not null check (status in ('STARTED','COMPLETED','QUALIFIED','INSUFFICIENT_EVIDENCE','CONFLICT_REQUIRES_REVIEW','FAILED','TIMED_OUT')),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  cost_usd numeric(14,6) check (cost_usd is null or cost_usd >= 0),
  search_calls integer not null default 0 check (search_calls >= 0),
  ocr_calls integer not null default 0 check (ocr_calls >= 0),
  vlm_calls integer not null default 0 check (vlm_calls >= 0),
  failure_code text,
  metrics jsonb not null default '{}'::jsonb,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists sp_m1b_engine_attempt_v1_run_idx on public.sp_m1b_engine_attempt_v1(run_id,created_at);
create index if not exists sp_m1b_engine_attempt_v1_engine_idx on public.sp_m1b_engine_attempt_v1(engine,status,created_at desc);

create table if not exists public.sp_m1br_recovery_queue_v1 (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.sp_m1b_run_v1(id) on delete cascade,
  product_id uuid references public.sp_catalog_product_v1(id) on delete set null,
  status text not null default 'PENDING' check (status in ('PENDING','IN_PROGRESS','RETRY','COMPLETED','FAILED','ADMIN_REVIEW')),
  priority text not null default 'NORMAL' check (priority in ('LOW','NORMAL','HIGH','CRITICAL')),
  failure_code text,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  worker_code text,
  last_error_code text,
  last_error_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sp_m1br_recovery_queue_v1_ready_idx on public.sp_m1br_recovery_queue_v1(status,next_attempt_at,priority,created_at);
create unique index if not exists sp_m1br_recovery_queue_v1_active_run_id_uq
  on public.sp_m1br_recovery_queue_v1(run_id)
  where status in ('PENDING','IN_PROGRESS','RETRY');

alter table public.sp_m1b_run_v1 enable row level security;
alter table public.sp_m1b_engine_attempt_v1 enable row level security;
alter table public.sp_m1br_recovery_queue_v1 enable row level security;

revoke all on public.sp_m1b_run_v1 from public,anon,authenticated;
revoke all on public.sp_m1b_engine_attempt_v1 from public,anon,authenticated;
revoke all on public.sp_m1br_recovery_queue_v1 from public,anon,authenticated;

drop policy if exists sp_m1b_run_admin_read_v1 on public.sp_m1b_run_v1;
create policy sp_m1b_run_admin_read_v1 on public.sp_m1b_run_v1 for select to authenticated
using (coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false and public.sp_web_has_role_v1(auth.uid(),'admin'::public.sp_web_app_role_v1));
drop policy if exists sp_m1b_attempt_admin_read_v1 on public.sp_m1b_engine_attempt_v1;
create policy sp_m1b_attempt_admin_read_v1 on public.sp_m1b_engine_attempt_v1 for select to authenticated
using (coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false and public.sp_web_has_role_v1(auth.uid(),'admin'::public.sp_web_app_role_v1));
drop policy if exists sp_m1br_queue_admin_read_v1 on public.sp_m1br_recovery_queue_v1;
create policy sp_m1br_queue_admin_read_v1 on public.sp_m1br_recovery_queue_v1 for select to authenticated
using (coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false and public.sp_web_has_role_v1(auth.uid(),'admin'::public.sp_web_app_role_v1));

grant select on public.sp_m1b_run_v1, public.sp_m1b_engine_attempt_v1, public.sp_m1br_recovery_queue_v1 to authenticated;

-- Preserve the existing immutable catalog audit convention where available.
do $$
begin
  if to_regprocedure('public.sp_catalog_audit_row_v1()') is not null then
    execute 'drop trigger if exists sp_m1b_run_audit_v1 on public.sp_m1b_run_v1';
    execute 'create trigger sp_m1b_run_audit_v1 after insert or update or delete on public.sp_m1b_run_v1 for each row execute function public.sp_catalog_audit_row_v1()';
    execute 'drop trigger if exists sp_m1b_attempt_audit_v1 on public.sp_m1b_engine_attempt_v1';
    execute 'create trigger sp_m1b_attempt_audit_v1 after insert or update or delete on public.sp_m1b_engine_attempt_v1 for each row execute function public.sp_catalog_audit_row_v1()';
    execute 'drop trigger if exists sp_m1br_queue_audit_v1 on public.sp_m1br_recovery_queue_v1';
    execute 'create trigger sp_m1br_queue_audit_v1 after insert or update or delete on public.sp_m1br_recovery_queue_v1 for each row execute function public.sp_catalog_audit_row_v1()';
  end if;
end $$;

-- Worker token is generated inside the protected internal schema. No raw token is exposed here.
do $$
begin
  if to_regclass('sp_internal.worker_secret_v1') is not null then
    insert into sp_internal.worker_secret_v1(worker_code,token)
    values ('M1BR_INGREDIENT_RECOVERY',encode(extensions.gen_random_bytes(32),'hex'))
    on conflict (worker_code) do nothing;
  end if;
end $$;

create or replace function public.sp_m1b_begin_run_v1(
  p_context text,
  p_product_id uuid,
  p_product_fingerprint text,
  p_benchmark_slot_id text default null,
  p_session_key text default null
) returns jsonb
language plpgsql security definer
set search_path='pg_catalog','public','extensions','pg_temp'
as $$
declare
  v_context text := upper(btrim(coalesce(p_context,'')));
  v_fp text := btrim(coalesce(p_product_fingerprint,''));
  v_session_hash text;
  v_id uuid;
begin
  if v_context not in ('BENCHMARK','NORMAL_SEARCH','CHECK_MY_LABEL') then
    raise exception using errcode='22023',message='M1B_INVALID_CONTEXT';
  end if;
  if v_fp='' or length(v_fp)>256 then
    raise exception using errcode='22023',message='M1B_PRODUCT_FINGERPRINT_REQUIRED';
  end if;
  if p_product_id is not null and not exists(select 1 from public.sp_catalog_product_v1 where id=p_product_id) then
    raise exception using errcode='22023',message='M1B_PRODUCT_NOT_FOUND';
  end if;
  if v_context='BENCHMARK' and (nullif(btrim(coalesce(p_benchmark_slot_id,'')),'') is null or nullif(p_session_key,'') is null) then
    raise exception using errcode='22023',message='M1B_BENCHMARK_SLOT_AND_SESSION_REQUIRED';
  end if;
  if nullif(p_session_key,'') is not null then
    v_session_hash := encode(extensions.digest(p_session_key,'sha256'),'hex');
  end if;
  insert into public.sp_m1b_run_v1(context,product_id,product_fingerprint,benchmark_slot_id,session_key_hash,m1b_status)
  values(v_context,p_product_id,v_fp,nullif(btrim(coalesce(p_benchmark_slot_id,'')),''),v_session_hash,'RUNNING')
  returning id into v_id;
  return jsonb_build_object('success',true,'run_id',v_id,'context',v_context,'m1b_status','RUNNING');
end;$$;
revoke all on function public.sp_m1b_begin_run_v1(text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.sp_m1b_begin_run_v1(text,uuid,text,text,text) to service_role;

create or replace function public.sp_m1b_record_attempt_v1(
  p_run_id uuid,
  p_engine text,
  p_stage text,
  p_status text,
  p_metrics jsonb default '{}'::jsonb,
  p_failure_code text default null,
  p_detail jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer
set search_path='pg_catalog','public','pg_temp'
as $$
declare
  v_engine text := upper(btrim(coalesce(p_engine,'')));
  v_status text := upper(btrim(coalesce(p_status,'')));
  v_latency integer;
  v_cost numeric;
  v_search integer;
  v_ocr integer;
  v_vlm integer;
  v_id uuid;
begin
  if not exists(select 1 from public.sp_m1b_run_v1 where id=p_run_id) then
    raise exception using errcode='22023',message='M1B_RUN_NOT_FOUND';
  end if;
  if v_engine not in ('M1-B','M1-BR','HUMAN_REVIEW') then raise exception using errcode='22023',message='M1B_INVALID_ENGINE'; end if;
  if v_status not in ('STARTED','COMPLETED','QUALIFIED','INSUFFICIENT_EVIDENCE','CONFLICT_REQUIRES_REVIEW','FAILED','TIMED_OUT') then raise exception using errcode='22023',message='M1B_INVALID_ATTEMPT_STATUS'; end if;
  begin v_latency := nullif(p_metrics->>'latency_ms','')::integer; exception when others then v_latency := null; end;
  begin v_cost := nullif(p_metrics->>'cost_usd','')::numeric; exception when others then v_cost := null; end;
  begin v_search := greatest(coalesce(nullif(p_metrics->>'search_calls','')::integer,0),0); exception when others then v_search := 0; end;
  begin v_ocr := greatest(coalesce(nullif(p_metrics->>'ocr_calls','')::integer,0),0); exception when others then v_ocr := 0; end;
  begin v_vlm := greatest(coalesce(nullif(p_metrics->>'vlm_calls','')::integer,0),0); exception when others then v_vlm := 0; end;
  insert into public.sp_m1b_engine_attempt_v1(run_id,engine,stage,status,latency_ms,cost_usd,search_calls,ocr_calls,vlm_calls,failure_code,metrics,detail)
  values(p_run_id,v_engine,left(btrim(coalesce(p_stage,'UNKNOWN')),120),v_status,v_latency,v_cost,v_search,v_ocr,v_vlm,nullif(p_failure_code,''),coalesce(p_metrics,'{}'::jsonb),coalesce(p_detail,'{}'::jsonb)) returning id into v_id;

  if v_engine='M1-B' then
    update public.sp_m1b_run_v1 set
      m1b_status=case v_status when 'QUALIFIED' then 'QUALIFIED' when 'CONFLICT_REQUIRES_REVIEW' then 'CONFLICT' when 'FAILED' then 'FAILED' when 'TIMED_OUT' then 'FAILED' when 'INSUFFICIENT_EVIDENCE' then 'FAILED' else m1b_status end,
      m1b_failure_code=case when v_status in ('FAILED','TIMED_OUT','INSUFFICIENT_EVIDENCE','CONFLICT_REQUIRES_REVIEW') then nullif(p_failure_code,'') else m1b_failure_code end,
      final_ingredient_status=case when v_status='QUALIFIED' then 'QUALIFIED' when v_status='CONFLICT_REQUIRES_REVIEW' then 'CONFLICT_REQUIRES_REVIEW' else final_ingredient_status end,
      updated_at=now() where id=p_run_id;
  elsif v_engine='M1-BR' then
    update public.sp_m1b_run_v1 set
      m1br_status=case when v_status='QUALIFIED' then 'QUALIFIED' when v_status='INSUFFICIENT_EVIDENCE' then 'INSUFFICIENT_EVIDENCE' when v_status='CONFLICT_REQUIRES_REVIEW' then 'CONFLICT_REQUIRES_REVIEW' when v_status in ('FAILED','TIMED_OUT') then 'FAILED' when v_status='STARTED' then 'RUNNING' else m1br_status end,
      final_ingredient_status=case when v_status in ('QUALIFIED','INSUFFICIENT_EVIDENCE','CONFLICT_REQUIRES_REVIEW') then v_status else final_ingredient_status end,
      updated_at=now() where id=p_run_id;
  end if;
  return jsonb_build_object('success',true,'attempt_id',v_id,'engine',v_engine,'status',v_status);
end;$$;
revoke all on function public.sp_m1b_record_attempt_v1(uuid,text,text,text,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.sp_m1b_record_attempt_v1(uuid,text,text,text,jsonb,text,jsonb) to service_role;

create or replace function public.sp_m1b_enqueue_recovery_v1(
  p_run_id uuid,
  p_product_id uuid,
  p_failure_code text,
  p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer
set search_path='pg_catalog','public','pg_temp'
as $$
declare v_task uuid; v_existing boolean := false;
begin
  if not exists(select 1 from public.sp_m1b_run_v1 where id=p_run_id) then raise exception using errcode='22023',message='M1B_RUN_NOT_FOUND'; end if;
  select id into v_task from public.sp_m1br_recovery_queue_v1 where run_id=p_run_id and status in ('PENDING','IN_PROGRESS','RETRY') order by created_at limit 1;
  if v_task is not null then v_existing:=true;
  else
    insert into public.sp_m1br_recovery_queue_v1(run_id,product_id,failure_code,payload)
    values(p_run_id,p_product_id,nullif(p_failure_code,''),coalesce(p_payload,'{}'::jsonb)) returning id into v_task;
  end if;
  update public.sp_m1b_run_v1 set m1br_status='QUEUED',m1b_failure_code=coalesce(nullif(p_failure_code,''),m1b_failure_code),updated_at=now() where id=p_run_id and m1br_status not in ('QUALIFIED','INSUFFICIENT_EVIDENCE','CONFLICT_REQUIRES_REVIEW');
  return jsonb_build_object('success',true,'task_id',v_task,'idempotent_replay',v_existing,'m1br_status','QUEUED');
exception when unique_violation then
  select id into v_task from public.sp_m1br_recovery_queue_v1 where run_id=p_run_id and status in ('PENDING','IN_PROGRESS','RETRY') order by created_at limit 1;
  return jsonb_build_object('success',true,'task_id',v_task,'idempotent_replay',true,'m1br_status','QUEUED');
end;$$;
revoke all on function public.sp_m1b_enqueue_recovery_v1(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.sp_m1b_enqueue_recovery_v1(uuid,uuid,text,jsonb) to service_role;

create or replace function public.sp_m1br_claim_tasks_v1(p_worker_code text,p_limit integer default 2)
returns jsonb language plpgsql security definer
set search_path='pg_catalog','public','pg_temp'
as $$
declare v_limit integer:=least(greatest(coalesce(p_limit,2),1),10); v_rows jsonb;
begin
  if nullif(btrim(coalesce(p_worker_code,'')),'') is null then raise exception using errcode='22023',message='M1BR_WORKER_CODE_REQUIRED'; end if;
  update public.sp_m1br_recovery_queue_v1 set status='RETRY',locked_at=null,worker_code=null,next_attempt_at=now(),last_error_code=coalesce(last_error_code,'STALE_WORKER_LOCK'),updated_at=now()
  where status='IN_PROGRESS' and locked_at < now()-interval '20 minutes';
  with picked as (
    select id from public.sp_m1br_recovery_queue_v1
    where status in ('PENDING','RETRY') and next_attempt_at<=now() and attempt_count<max_attempts
    order by case priority when 'CRITICAL' then 1 when 'HIGH' then 2 when 'NORMAL' then 3 else 4 end,created_at
    limit v_limit for update skip locked
  ), claimed as (
    update public.sp_m1br_recovery_queue_v1 q set status='IN_PROGRESS',attempt_count=q.attempt_count+1,locked_at=now(),worker_code=p_worker_code,updated_at=now()
    from picked where q.id=picked.id returning q.*
  )
  select coalesce(jsonb_agg(jsonb_build_object('task_id',c.id,'run_id',c.run_id,'product_id',c.product_id,'failure_code',c.failure_code,'payload',c.payload,'attempt_count',c.attempt_count,'max_attempts',c.max_attempts)),'[]'::jsonb) into v_rows from claimed c;
  update public.sp_m1b_run_v1 r set m1br_status='RUNNING',updated_at=now() where exists(select 1 from public.sp_m1br_recovery_queue_v1 q where q.run_id=r.id and q.status='IN_PROGRESS' and q.worker_code=p_worker_code);
  return v_rows;
end;$$;
revoke all on function public.sp_m1br_claim_tasks_v1(text,integer) from public,anon,authenticated;
grant execute on function public.sp_m1br_claim_tasks_v1(text,integer) to service_role;

create or replace function public.sp_m1br_complete_task_v1(
  p_task_id uuid,
  p_success boolean,
  p_status text,
  p_result jsonb default '{}'::jsonb,
  p_failure_code text default null,
  p_error_detail text default null,
  p_retry_minutes integer default 30
) returns jsonb language plpgsql security definer
set search_path='pg_catalog','public','pg_temp'
as $$
declare v_task public.sp_m1br_recovery_queue_v1%rowtype; v_status text:=upper(btrim(coalesce(p_status,''))); v_queue_status text;
begin
  select * into v_task from public.sp_m1br_recovery_queue_v1 where id=p_task_id for update;
  if v_task.id is null then raise exception using errcode='22023',message='M1BR_TASK_NOT_FOUND'; end if;
  if v_status not in ('QUALIFIED','INSUFFICIENT_EVIDENCE','CONFLICT_REQUIRES_REVIEW','FAILED') then raise exception using errcode='22023',message='M1BR_INVALID_TERMINAL_STATUS'; end if;
  if p_success and v_status='QUALIFIED' then v_queue_status:='COMPLETED';
  elsif v_status in ('INSUFFICIENT_EVIDENCE','CONFLICT_REQUIRES_REVIEW') then v_queue_status:='ADMIN_REVIEW';
  elsif v_task.attempt_count < v_task.max_attempts and coalesce(p_retry_minutes,0)>0 then v_queue_status:='RETRY';
  else v_queue_status:='FAILED'; end if;
  update public.sp_m1br_recovery_queue_v1 set status=v_queue_status,result=coalesce(p_result,'{}'::jsonb),failure_code=coalesce(nullif(p_failure_code,''),failure_code),last_error_code=case when v_queue_status in ('RETRY','FAILED') then coalesce(nullif(p_failure_code,''),'M1BR_RECOVERY_FAILED') else null end,last_error_detail=case when v_queue_status in ('RETRY','FAILED') then left(coalesce(p_error_detail,''),4000) else null end,next_attempt_at=case when v_queue_status='RETRY' then now()+make_interval(mins=>greatest(coalesce(p_retry_minutes,30),1)) else next_attempt_at end,locked_at=null,worker_code=null,updated_at=now() where id=p_task_id;
  update public.sp_m1b_run_v1 set m1br_status=case when v_queue_status='RETRY' then 'QUEUED' when v_status='QUALIFIED' then 'QUALIFIED' when v_status='INSUFFICIENT_EVIDENCE' then 'INSUFFICIENT_EVIDENCE' when v_status='CONFLICT_REQUIRES_REVIEW' then 'CONFLICT_REQUIRES_REVIEW' else 'FAILED' end,final_ingredient_status=case when v_status in ('QUALIFIED','INSUFFICIENT_EVIDENCE','CONFLICT_REQUIRES_REVIEW') then v_status else final_ingredient_status end,updated_at=now() where id=v_task.run_id;
  return jsonb_build_object('success',true,'task_id',p_task_id,'queue_status',v_queue_status,'ingredient_status',v_status);
end;$$;
revoke all on function public.sp_m1br_complete_task_v1(uuid,boolean,text,jsonb,text,text,integer) from public,anon,authenticated;
grant execute on function public.sp_m1br_complete_task_v1(uuid,boolean,text,jsonb,text,text,integer) to service_role;

create or replace function public.sp_m1b_seal_benchmark_result_v1(p_run_id uuid,p_metrics_recorded boolean default true)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','pg_temp' as $$
declare v public.sp_m1b_run_v1%rowtype;
begin
  select * into v from public.sp_m1b_run_v1 where id=p_run_id for update;
  if v.id is null then raise exception using errcode='22023',message='M1B_RUN_NOT_FOUND'; end if;
  if v.context<>'BENCHMARK' then return jsonb_build_object('success',false,'code','NOT_A_BENCHMARK_RUN'); end if;
  if v.final_ingredient_status is null then return jsonb_build_object('success',false,'code','BENCHMARK_RESULT_NOT_FINAL'); end if;
  update public.sp_m1b_run_v1 set benchmark_sealed_at=coalesce(benchmark_sealed_at,now()),metrics_recorded_at=case when p_metrics_recorded then coalesce(metrics_recorded_at,now()) else metrics_recorded_at end,updated_at=now() where id=p_run_id;
  return jsonb_build_object('success',true,'run_id',p_run_id,'sealed',true);
end;$$;
revoke all on function public.sp_m1b_seal_benchmark_result_v1(uuid,boolean) from public,anon,authenticated;
grant execute on function public.sp_m1b_seal_benchmark_result_v1(uuid,boolean) to service_role;

create or replace function public.sp_m1b_ack_benchmark_display_v1(p_run_id uuid,p_session_key text)
returns jsonb language plpgsql security definer
set search_path='pg_catalog','public','extensions','pg_temp'
as $$
declare v public.sp_m1b_run_v1%rowtype; v_hash text;
begin
  select * into v from public.sp_m1b_run_v1 where id=p_run_id for update;
  if v.id is null then raise exception using errcode='22023',message='M1B_RUN_NOT_FOUND'; end if;
  if v.context<>'BENCHMARK' then return jsonb_build_object('success',false,'code','NOT_A_BENCHMARK_RUN'); end if;
  if v.benchmark_sealed_at is null then return jsonb_build_object('success',false,'code','BENCHMARK_SEAL_REQUIRED_BEFORE_DISPLAY'); end if;
  if v.final_ingredient_status<>'QUALIFIED' then return jsonb_build_object('success',false,'code','BENCHMARK_QUALIFICATION_REQUIRED'); end if;
  if nullif(p_session_key,'') is null then return jsonb_build_object('success',false,'code','BENCHMARK_SESSION_REQUIRED'); end if;
  v_hash:=encode(extensions.digest(p_session_key,'sha256'),'hex');
  if v.session_key_hash is distinct from v_hash then return jsonb_build_object('success',false,'code','BENCHMARK_SESSION_MISMATCH'); end if;
  update public.sp_m1b_run_v1 set displayed_at=coalesce(displayed_at,now()),promotion_status='ELIGIBLE',updated_at=now() where id=p_run_id;
  return jsonb_build_object('success',true,'run_id',p_run_id,'display_acknowledged',true,'promotion_status','ELIGIBLE');
end;$$;
revoke all on function public.sp_m1b_ack_benchmark_display_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.sp_m1b_ack_benchmark_display_v1(uuid,text) to service_role;

create or replace function public.sp_m1b_promote_after_display_v1(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','pg_temp' as $$
declare v_run public.sp_m1b_run_v1%rowtype;
begin
  select * into v_run from public.sp_m1b_run_v1 where id=p_run_id for update;
  if v_run.id is null then raise exception using errcode='22023',message='M1B_RUN_NOT_FOUND'; end if;
  if v_run.final_ingredient_status<>'QUALIFIED' then return jsonb_build_object('success',false,'code','INGREDIENT_QUALIFICATION_REQUIRED'); end if;
  if v_run.context = 'BENCHMARK'
     and (v_run.benchmark_sealed_at is null or v_run.displayed_at is null) then
    return jsonb_build_object('success',false,'code','BENCHMARK_DISPLAY_OR_SEAL_REQUIRED');
  end if;
  update public.sp_m1b_run_v1 set promotion_status='PROMOTED',promoted_at=coalesce(promoted_at,now()),updated_at=now() where id=p_run_id;
  -- This v1 foundation records promotion admission only. Artifact copy/admission is implemented by the later promotion-control milestone.
  return jsonb_build_object('success',true,'run_id',p_run_id,'promotion_status','PROMOTED','artifact_promotion_applied',false);
end;$$;
revoke all on function public.sp_m1b_promote_after_display_v1(uuid) from public,anon,authenticated;
grant execute on function public.sp_m1b_promote_after_display_v1(uuid) to service_role;

create or replace function public.sp_m1b_get_report_v1(p_from timestamptz,p_to timestamptz,p_context text default null)
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','public','pg_temp' as $$
declare
  v_attempted bigint; v_m1bq bigint; v_fail bigint; v_brinv bigint; v_brq bigint; v_review bigint; v_promoted bigint;
  v_result jsonb;
begin
  if auth.role()<>'service_role' and not (coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false and public.sp_web_has_role_v1(auth.uid(),'admin'::public.sp_web_app_role_v1)) then
    raise exception using errcode='42501',message='M1B_REPORT_ADMIN_REQUIRED';
  end if;
  if p_from is null or p_to is null or p_to<=p_from then raise exception using errcode='22023',message='M1B_REPORT_RANGE_INVALID'; end if;
  select count(*),count(*) filter(where r.m1b_status='QUALIFIED'),count(*) filter(where r.m1b_status in ('FAILED','CONFLICT')),
         count(*) filter(where r.m1br_status<>'NOT_REQUIRED'),count(*) filter(where r.m1br_status='QUALIFIED'),
         count(*) filter(where r.m1br_status in ('INSUFFICIENT_EVIDENCE','CONFLICT_REQUIRES_REVIEW','FAILED')),
         count(*) filter(where r.promotion_status='PROMOTED')
    into v_attempted,v_m1bq,v_fail,v_brinv,v_brq,v_review,v_promoted
    from public.sp_m1b_run_v1 r
   where r.created_at>=p_from and r.created_at<p_to and (p_context is null or r.context=upper(p_context));
  v_result:=jsonb_build_object(
    'attempted',v_attempted,
    'm1b_qualified',v_m1bq,
    'm1b_failed',v_fail,
    'm1b_success_rate',case when v_attempted=0 then 0 else round(v_m1bq::numeric/v_attempted,6) end,
    'm1br_invocations',v_brinv,
    'm1br_qualified',v_brq,
    'm1br_recovery_rate',case when v_brinv=0 then 0 else round(v_brq::numeric/v_brinv,6) end,
    'combined_qualified',v_m1bq+v_brq,
    'combined_qualification_rate',case when v_attempted=0 then 0 else round((v_m1bq+v_brq)::numeric/v_attempted,6) end,
    'm1br_absolute_lift',case when v_attempted=0 then 0 else round(v_brq::numeric/v_attempted,6) end,
    'human_review_required',v_review,
    'cache_promotion_count',v_promoted
  );
  return v_result;
end;$$;
revoke all on function public.sp_m1b_get_report_v1(timestamptz,timestamptz,text) from public,anon;
grant execute on function public.sp_m1b_get_report_v1(timestamptz,timestamptz,text) to authenticated,service_role;
