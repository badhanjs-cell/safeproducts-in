-- SafeProducts M1-B / M1-BR isolated DEV benchmark execution v1.
-- Runs the real Path A and M1-BR engines against BENCHMARK_GOLD identities only.
-- Gold ingredient truth is intentionally NOT copied into execution tables or worker payloads.
-- No catalog, safety-score, commerce, cache, publication, or runtime-promotion writes are performed here.

create table if not exists public.sp_m1b_benchmark_execution_batch_v1 (
  id uuid primary key default gen_random_uuid(),
  benchmark_gold_batch_id uuid not null references public.sp_m1b_benchmark_gold_batch_v1(id) on delete restrict,
  engine_revision text not null default 'SP-M1B-M1BR-BENCH/1.0',
  split text not null default 'DEV',
  expected_item_count integer not null,
  status text not null default 'PENDING',
  publication_allowed boolean not null default false,
  runtime_promotion_allowed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint sp_m1b_benchmark_execution_batch_uq unique (benchmark_gold_batch_id, engine_revision),
  constraint sp_m1b_benchmark_execution_batch_split_ck check (split = 'DEV'),
  constraint sp_m1b_benchmark_execution_batch_count_ck check (expected_item_count > 0),
  constraint sp_m1b_benchmark_execution_batch_status_ck check (status in ('PENDING','RUNNING','COMPLETED','FAILED')),
  constraint sp_m1b_benchmark_execution_batch_publication_ck check (publication_allowed = false),
  constraint sp_m1b_benchmark_execution_batch_runtime_ck check (runtime_promotion_allowed = false)
);

create table if not exists public.sp_m1b_benchmark_execution_item_v1 (
  id uuid primary key default gen_random_uuid(),
  execution_batch_id uuid not null references public.sp_m1b_benchmark_execution_batch_v1(id) on delete restrict,
  benchmark_gold_item_id uuid not null references public.sp_m1b_benchmark_gold_item_v1(id) on delete restrict,
  candidate_id text not null,
  benchmark_slot_id text not null,
  benchmark_category text not null,
  candidate_brand_name text,
  candidate_product_name text not null,
  identity_summary text not null,
  product_fingerprint text not null,
  run_id uuid references public.sp_m1b_run_v1(id) on delete restrict,
  status text not null default 'PENDING',
  attempt_count integer not null default 0,
  m1b_status text,
  m1br_status text,
  final_state text,
  predicted_ingredients jsonb not null default '[]'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  path_a_result jsonb not null default '{}'::jsonb,
  recovery_result jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint sp_m1b_benchmark_execution_item_gold_uq unique (execution_batch_id, benchmark_gold_item_id),
  constraint sp_m1b_benchmark_execution_item_slot_uq unique (execution_batch_id, benchmark_slot_id),
  constraint sp_m1b_benchmark_execution_item_candidate_uq unique (execution_batch_id, candidate_id),
  constraint sp_m1b_benchmark_execution_item_fp_uq unique (execution_batch_id, product_fingerprint),
  constraint sp_m1b_benchmark_execution_item_status_ck check (status in ('PENDING','RUNNING','WAITING_M1BR','COMPLETED','FAILED')),
  constraint sp_m1b_benchmark_execution_item_attempt_ck check (attempt_count between 0 and 3),
  constraint sp_m1b_benchmark_execution_item_arrays_ck check (jsonb_typeof(predicted_ingredients)='array' and jsonb_typeof(source_refs)='array'),
  constraint sp_m1b_benchmark_execution_item_objects_ck check (jsonb_typeof(path_a_result)='object' and jsonb_typeof(recovery_result)='object' and jsonb_typeof(metrics)='object')
);

create index if not exists sp_m1b_benchmark_execution_item_ready_idx
  on public.sp_m1b_benchmark_execution_item_v1(status, created_at);
create index if not exists sp_m1b_benchmark_execution_item_run_idx
  on public.sp_m1b_benchmark_execution_item_v1(run_id) where run_id is not null;

alter table public.sp_m1b_benchmark_execution_batch_v1 enable row level security;
alter table public.sp_m1b_benchmark_execution_item_v1 enable row level security;

revoke all on table public.sp_m1b_benchmark_execution_batch_v1 from public, anon, authenticated;
revoke all on table public.sp_m1b_benchmark_execution_item_v1 from public, anon, authenticated;
grant select on table public.sp_m1b_benchmark_execution_batch_v1 to service_role;
grant select on table public.sp_m1b_benchmark_execution_item_v1 to service_role;

-- Dedicated high-entropy dispatch credential. It is generated in the database and never embedded in code.
insert into sp_internal.worker_secret_v1(worker_code, token)
values ('M1B_BENCHMARK_EXECUTOR', encode(extensions.gen_random_bytes(32),'hex'))
on conflict(worker_code) do nothing;

create or replace function public.sp_m1b_create_benchmark_execution_v1(p_benchmark_gold_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','pg_temp'
as $$
declare
  v_gold public.sp_m1b_benchmark_gold_batch_v1%rowtype;
  v_batch public.sp_m1b_benchmark_execution_batch_v1%rowtype;
  v_count integer;
begin
  select * into v_gold
  from public.sp_m1b_benchmark_gold_batch_v1
  where id=p_benchmark_gold_batch_id
  for share;
  if not found then raise exception using errcode='P0002',message='BENCHMARK_GOLD_BATCH_NOT_FOUND'; end if;
  if v_gold.gold_status<>'BENCHMARK_GOLD' or v_gold.split<>'DEV'
     or v_gold.publication_allowed<>false or v_gold.runtime_promotion_allowed<>false then
    raise exception using errcode='23514',message='BENCHMARK_GOLD_BATCH_STATE_INVALID';
  end if;

  select * into v_batch
  from public.sp_m1b_benchmark_execution_batch_v1
  where benchmark_gold_batch_id=p_benchmark_gold_batch_id
    and engine_revision='SP-M1B-M1BR-BENCH/1.0';
  if found then
    return jsonb_build_object('success',true,'inserted',false,'execution_batch_id',v_batch.id,'expected_item_count',v_batch.expected_item_count,'status',v_batch.status,'publication_allowed',false,'runtime_promotion_allowed',false);
  end if;

  select count(*)::integer into v_count
  from public.sp_m1b_benchmark_gold_item_v1 g
  where g.benchmark_gold_batch_id=p_benchmark_gold_batch_id
    and g.gold_status='BENCHMARK_GOLD'
    and g.publication_allowed=false
    and g.runtime_promotion_allowed=false;
  if v_count<>v_gold.item_count or v_count<=0 then
    raise exception using errcode='23514',message='BENCHMARK_GOLD_ITEM_COUNT_MISMATCH';
  end if;

  insert into public.sp_m1b_benchmark_execution_batch_v1(
    benchmark_gold_batch_id,engine_revision,split,expected_item_count,status,publication_allowed,runtime_promotion_allowed
  ) values(p_benchmark_gold_batch_id,'SP-M1B-M1BR-BENCH/1.0','DEV',v_count,'PENDING',false,false)
  returning * into v_batch;

  -- Intentionally copy identity only. The gold ingredient declaration never enters the execution surface.
  insert into public.sp_m1b_benchmark_execution_item_v1(
    execution_batch_id,benchmark_gold_item_id,candidate_id,benchmark_slot_id,benchmark_category,
    candidate_brand_name,candidate_product_name,identity_summary,product_fingerprint,status
  )
  select v_batch.id,g.id,g.candidate_id,g.benchmark_slot_id,g.benchmark_category,
         g.candidate_brand_name,g.candidate_product_name,g.identity_summary,g.product_fingerprint,'PENDING'
  from public.sp_m1b_benchmark_gold_item_v1 g
  where g.benchmark_gold_batch_id=p_benchmark_gold_batch_id
    and g.gold_status='BENCHMARK_GOLD'
    and g.publication_allowed=false
    and g.runtime_promotion_allowed=false
  order by g.benchmark_slot_id;

  return jsonb_build_object('success',true,'inserted',true,'execution_batch_id',v_batch.id,'expected_item_count',v_count,'status','PENDING','publication_allowed',false,'runtime_promotion_allowed',false);
end;
$$;

create or replace function public.sp_m1b_claim_benchmark_execution_item_v1(p_worker_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','pg_temp'
as $$
declare v_item public.sp_m1b_benchmark_execution_item_v1%rowtype;
begin
  if p_worker_code<>'M1B_BENCHMARK_EXECUTOR' then
    raise exception using errcode='42501',message='BENCHMARK_WORKER_CODE_INVALID';
  end if;
  update public.sp_m1b_benchmark_execution_item_v1
     set status='PENDING',started_at=null,error_code=coalesce(error_code,'STALE_BENCHMARK_WORKER'),updated_at=now()
   where status='RUNNING' and started_at<now()-interval '4 minutes' and attempt_count<3;

  select * into v_item
  from public.sp_m1b_benchmark_execution_item_v1
  where status='PENDING' and attempt_count<3
  order by created_at,benchmark_slot_id
  limit 1 for update skip locked;
  if not found then return jsonb_build_object('success',true,'item',null); end if;

  update public.sp_m1b_benchmark_execution_item_v1
     set status='RUNNING',attempt_count=attempt_count+1,started_at=now(),updated_at=now(),error_code=null
   where id=v_item.id returning * into v_item;
  update public.sp_m1b_benchmark_execution_batch_v1 set status='RUNNING',updated_at=now()
   where id=v_item.execution_batch_id and status='PENDING';

  return jsonb_build_object('success',true,'item',jsonb_build_object(
    'item_id',v_item.id,'execution_batch_id',v_item.execution_batch_id,
    'candidate_id',v_item.candidate_id,'benchmark_slot_id',v_item.benchmark_slot_id,
    'benchmark_category',v_item.benchmark_category,'candidate_brand_name',v_item.candidate_brand_name,
    'candidate_product_name',v_item.candidate_product_name,'identity_summary',v_item.identity_summary,
    'product_fingerprint',v_item.product_fingerprint,'attempt_count',v_item.attempt_count
  ));
end;
$$;

create or replace function public.sp_m1b_record_benchmark_path_a_v1(p_item_id uuid,p_run_id uuid,p_result jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','pg_temp'
as $$
declare
  v_item public.sp_m1b_benchmark_execution_item_v1%rowtype;
  v_run public.sp_m1b_run_v1%rowtype;
  v_status text:=upper(btrim(coalesce(p_result->>'ingredient_status','')));
  v_next text;
  v_ing jsonb:=coalesce(p_result->'parsed_ingredients','[]'::jsonb);
  v_refs jsonb:=coalesce(p_result->'evidence_refs','[]'::jsonb);
begin
  select * into v_item from public.sp_m1b_benchmark_execution_item_v1 where id=p_item_id for update;
  if not found or v_item.status<>'RUNNING' then raise exception using errcode='23514',message='BENCHMARK_ITEM_NOT_RUNNING'; end if;
  select * into v_run from public.sp_m1b_run_v1 where id=p_run_id for share;
  if not found or v_run.context<>'BENCHMARK' or v_run.benchmark_slot_id<>v_item.benchmark_slot_id or v_run.product_id is not null then
    raise exception using errcode='23514',message='BENCHMARK_RUN_BINDING_INVALID';
  end if;
  if v_status not in ('QUALIFIED','INSUFFICIENT_EVIDENCE','CONFLICT_REQUIRES_REVIEW') then
    raise exception using errcode='22023',message='BENCHMARK_PATH_A_STATUS_INVALID';
  end if;
  if jsonb_typeof(v_ing)<>'array' or jsonb_typeof(v_refs)<>'array' then
    raise exception using errcode='22023',message='BENCHMARK_PATH_A_PAYLOAD_INVALID';
  end if;
  if v_status='QUALIFIED' and (jsonb_array_length(v_ing)=0 or jsonb_array_length(v_refs)=0) then
    raise exception using errcode='23514',message='BENCHMARK_QUALIFIED_PROVENANCE_REQUIRED';
  end if;
  v_next:=case when v_status='QUALIFIED' then 'COMPLETED' else 'WAITING_M1BR' end;
  update public.sp_m1b_benchmark_execution_item_v1
     set run_id=p_run_id,status=v_next,m1b_status=v_status,
         m1br_status=case when v_status='QUALIFIED' then 'NOT_RUN' else 'QUEUED' end,
         final_state=case when v_status='QUALIFIED' then 'QUALIFIED' else null end,
         predicted_ingredients=case when v_status='QUALIFIED' then v_ing else '[]'::jsonb end,
         source_refs=case when v_status='QUALIFIED' then v_refs else '[]'::jsonb end,
         path_a_result=coalesce(p_result,'{}'::jsonb),
         completed_at=case when v_status='QUALIFIED' then now() else null end,
         updated_at=now()
   where id=p_item_id;
  if v_status='QUALIFIED' then perform public.sp_m1b_seal_benchmark_result_v1(p_run_id,true); end if;
  return jsonb_build_object('success',true,'item_id',p_item_id,'status',v_next,'m1b_status',v_status,'m1br_status',case when v_status='QUALIFIED' then 'NOT_RUN' else 'QUEUED' end);
end;
$$;

create or replace function public.sp_m1b_fail_benchmark_execution_item_v1(p_item_id uuid,p_error_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','pg_temp'
as $$
declare v_attempt integer; v_status text;
begin
  select attempt_count into v_attempt from public.sp_m1b_benchmark_execution_item_v1 where id=p_item_id for update;
  if not found then raise exception using errcode='P0002',message='BENCHMARK_ITEM_NOT_FOUND'; end if;
  v_status:=case when v_attempt<3 then 'PENDING' else 'FAILED' end;
  update public.sp_m1b_benchmark_execution_item_v1
     set status=v_status,error_code=left(coalesce(nullif(p_error_code,''),'BENCHMARK_EXECUTION_FAILED'),200),
         started_at=case when v_status='PENDING' then null else started_at end,
         completed_at=case when v_status='FAILED' then now() else null end,updated_at=now()
   where id=p_item_id;
  return jsonb_build_object('success',true,'item_id',p_item_id,'status',v_status);
end;
$$;

create or replace function public.sp_m1b_dispatch_benchmark_recovery_v1()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','sp_internal','pg_temp'
as $$
declare v_request bigint;
begin
  select sp_internal.dispatch_m1br_if_pending_v1() into v_request;
  return jsonb_build_object('success',true,'request_id',v_request);
end;
$$;

create or replace function public.sp_m1b_reconcile_benchmark_execution_v1(p_execution_batch_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','pg_temp'
as $$
declare
  v_item record;
  v_run public.sp_m1b_run_v1%rowtype;
  v_queue public.sp_m1br_recovery_queue_v1%rowtype;
  v_final text;
  v_ing jsonb;
  v_refs jsonb;
  v_metrics jsonb;
  v_done integer:=0;
  v_batch record;
begin
  for v_item in
    select e.* from public.sp_m1b_benchmark_execution_item_v1 e
    where e.status='WAITING_M1BR' and (p_execution_batch_id is null or e.execution_batch_id=p_execution_batch_id)
    order by e.created_at for update skip locked
  loop
    select * into v_run from public.sp_m1b_run_v1 where id=v_item.run_id;
    if not found then continue; end if;
    select * into v_queue from public.sp_m1br_recovery_queue_v1 where run_id=v_item.run_id order by created_at desc limit 1;
    if not found or v_queue.status not in ('COMPLETED','ADMIN_REVIEW','FAILED') then continue; end if;

    v_final:=case
      when v_run.final_ingredient_status in ('QUALIFIED','INSUFFICIENT_EVIDENCE','CONFLICT_REQUIRES_REVIEW') then v_run.final_ingredient_status
      when v_run.m1br_status='FAILED' then 'FAILED'
      else coalesce(v_run.m1br_status,'FAILED') end;
    v_ing:=case when v_final='QUALIFIED' then coalesce(v_queue.result->'final_result'->'parsed_ingredients','[]'::jsonb) else '[]'::jsonb end;
    v_refs:=case
      when v_final='QUALIFIED' and coalesce(v_queue.result->'final_result'->>'source_url','')~'^https://' then jsonb_build_array(v_queue.result->'final_result'->>'source_url')
      else '[]'::jsonb end;
    select jsonb_build_object(
      'latency_ms',coalesce(sum(a.latency_ms),0),
      'cost_usd',coalesce(sum(a.cost_usd),0),
      'search_calls',coalesce(sum(a.search_calls),0),
      'ocr_calls',coalesce(sum(a.ocr_calls),0),
      'vlm_calls',coalesce(sum(a.vlm_calls),0)
    ) into v_metrics from public.sp_m1b_engine_attempt_v1 a where a.run_id=v_item.run_id;

    if v_final='QUALIFIED' and (jsonb_array_length(v_ing)=0 or jsonb_array_length(v_refs)=0) then
      v_final:='FAILED';
    end if;
    update public.sp_m1b_benchmark_execution_item_v1
       set status=case when v_final='FAILED' then 'FAILED' else 'COMPLETED' end,
           m1br_status=coalesce(v_run.m1br_status,v_final),final_state=v_final,
           predicted_ingredients=v_ing,source_refs=v_refs,recovery_result=coalesce(v_queue.result,'{}'::jsonb),
           metrics=coalesce(v_metrics,'{}'::jsonb),
           error_code=case when v_final='FAILED' then coalesce(v_queue.last_error_code,'M1BR_BENCHMARK_FAILED') else null end,
           completed_at=now(),updated_at=now()
     where id=v_item.id;
    if v_final<>'FAILED' then perform public.sp_m1b_seal_benchmark_result_v1(v_item.run_id,true); end if;
    v_done:=v_done+1;
  end loop;

  -- Backfill metrics for direct Path A completions.
  update public.sp_m1b_benchmark_execution_item_v1 e
     set metrics=(select jsonb_build_object(
       'latency_ms',coalesce(sum(a.latency_ms),0),'cost_usd',coalesce(sum(a.cost_usd),0),
       'search_calls',coalesce(sum(a.search_calls),0),'ocr_calls',coalesce(sum(a.ocr_calls),0),'vlm_calls',coalesce(sum(a.vlm_calls),0)
     ) from public.sp_m1b_engine_attempt_v1 a where a.run_id=e.run_id),updated_at=now()
   where e.status='COMPLETED' and e.run_id is not null and e.metrics='{}'::jsonb
     and (p_execution_batch_id is null or e.execution_batch_id=p_execution_batch_id);

  for v_batch in
    select b.id,b.expected_item_count,
           count(e.*) filter(where e.status in ('COMPLETED','FAILED'))::integer as terminal_count,
           count(e.*) filter(where e.status='FAILED')::integer as failed_count
    from public.sp_m1b_benchmark_execution_batch_v1 b
    join public.sp_m1b_benchmark_execution_item_v1 e on e.execution_batch_id=b.id
    where p_execution_batch_id is null or b.id=p_execution_batch_id
    group by b.id,b.expected_item_count
  loop
    if v_batch.terminal_count=v_batch.expected_item_count then
      update public.sp_m1b_benchmark_execution_batch_v1
         set status=case when v_batch.failed_count>0 then 'FAILED' else 'COMPLETED' end,
             completed_at=now(),updated_at=now()
       where id=v_batch.id;
    end if;
  end loop;

  return jsonb_build_object('success',true,'reconciled_count',v_done);
end;
$$;

create or replace function sp_internal.dispatch_m1b_benchmark_if_pending_v1()
returns bigint
language plpgsql
security definer
set search_path to 'pg_catalog','public','sp_internal','pg_temp'
as $$
declare v_has_work boolean; v_request bigint;
begin
  select exists(select 1 from public.sp_m1b_benchmark_execution_item_v1 where status in ('PENDING','WAITING_M1BR','RUNNING')) into v_has_work;
  if not v_has_work then return null; end if;
  select sp_internal.dispatch_edge_worker_v1('M1B_BENCHMARK_EXECUTOR','sp-m1b-benchmark-runner-v1') into v_request;
  return v_request;
end;
$$;

revoke all on function public.sp_m1b_create_benchmark_execution_v1(uuid) from public,anon,authenticated;
revoke all on function public.sp_m1b_claim_benchmark_execution_item_v1(text) from public,anon,authenticated;
revoke all on function public.sp_m1b_record_benchmark_path_a_v1(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.sp_m1b_fail_benchmark_execution_item_v1(uuid,text) from public,anon,authenticated;
revoke all on function public.sp_m1b_dispatch_benchmark_recovery_v1() from public,anon,authenticated;
revoke all on function public.sp_m1b_reconcile_benchmark_execution_v1(uuid) from public,anon,authenticated;
revoke all on function sp_internal.dispatch_m1b_benchmark_if_pending_v1() from public,anon,authenticated;

grant execute on function public.sp_m1b_create_benchmark_execution_v1(uuid) to service_role;
grant execute on function public.sp_m1b_claim_benchmark_execution_item_v1(text) to service_role;
grant execute on function public.sp_m1b_record_benchmark_path_a_v1(uuid,uuid,jsonb) to service_role;
grant execute on function public.sp_m1b_fail_benchmark_execution_item_v1(uuid,text) to service_role;
grant execute on function public.sp_m1b_dispatch_benchmark_recovery_v1() to service_role;
grant execute on function public.sp_m1b_reconcile_benchmark_execution_v1(uuid) to service_role;
grant execute on function sp_internal.dispatch_m1b_benchmark_if_pending_v1() to postgres;

comment on table public.sp_m1b_benchmark_execution_item_v1 is
  'DEV benchmark execution results only. Contains identity inputs and engine predictions; never copies gold ingredient truth into the execution path.';
comment on function sp_internal.dispatch_m1b_benchmark_if_pending_v1() is
  'Secret-safe dispatch for the isolated M1-B/M1-BR benchmark executor. No public/client execution grant.';
