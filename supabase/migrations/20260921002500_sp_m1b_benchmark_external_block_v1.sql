-- SafeProducts M1-B/M1-BR benchmark external dependency block control v1
-- Purpose: fail closed when a benchmark-only external provider dependency is unavailable.
-- This migration never writes catalog, safety-score, publication, or runtime-promotion data.

begin;

alter table public.sp_m1b_benchmark_execution_batch_v1
  add column if not exists blocked_reason text,
  add column if not exists blocked_at timestamptz,
  add column if not exists resumed_at timestamptz;

alter table public.sp_m1b_benchmark_execution_batch_v1
  drop constraint if exists sp_m1b_benchmark_execution_batch_status_ck;

alter table public.sp_m1b_benchmark_execution_batch_v1
  add constraint sp_m1b_benchmark_execution_batch_status_ck
  check (status = any (array[
    'PENDING'::text,
    'RUNNING'::text,
    'BLOCKED_EXTERNAL'::text,
    'COMPLETED'::text,
    'FAILED'::text
  ]));

create or replace function public.sp_m1b_pause_benchmark_external_v1(
  p_execution_batch_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  v_batch public.sp_m1b_benchmark_execution_batch_v1%rowtype;
  v_reason text := upper(btrim(coalesce(p_reason, '')));
  v_paused integer := 0;
begin
  if p_execution_batch_id is null then
    raise exception using errcode='22023', message='BENCHMARK_EXECUTION_BATCH_REQUIRED';
  end if;

  if v_reason not in (
    'M1BR_PROVIDER_CREDIT_EXHAUSTED',
    'M1BR_PROVIDER_RATE_LIMIT',
    'M1BR_PROVIDER_UNAVAILABLE'
  ) then
    raise exception using errcode='22023', message='BENCHMARK_EXTERNAL_BLOCK_REASON_INVALID';
  end if;

  select * into v_batch
  from public.sp_m1b_benchmark_execution_batch_v1
  where id=p_execution_batch_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='BENCHMARK_EXECUTION_BATCH_NOT_FOUND';
  end if;

  if v_batch.publication_allowed<>false or v_batch.runtime_promotion_allowed<>false then
    raise exception using errcode='23514', message='BENCHMARK_EXECUTION_SAFETY_STATE_INVALID';
  end if;

  if v_batch.status in ('COMPLETED','FAILED') then
    return jsonb_build_object(
      'success', false,
      'code', 'BENCHMARK_EXECUTION_ALREADY_TERMINAL',
      'execution_batch_id', p_execution_batch_id,
      'status', v_batch.status,
      'publication_allowed', false,
      'runtime_promotion_allowed', false
    );
  end if;

  update public.sp_m1br_recovery_queue_v1 q
     set status='RETRY',
         next_attempt_at='infinity'::timestamptz,
         locked_at=null,
         worker_code=null,
         last_error_code=v_reason,
         last_error_detail=case v_reason
           when 'M1BR_PROVIDER_CREDIT_EXHAUSTED' then 'External provider credit balance exhausted. Benchmark recovery parked pending explicit service-role resume; retry attempts preserved.'
           when 'M1BR_PROVIDER_RATE_LIMIT' then 'External provider rate limit requires operator-controlled benchmark resume; retry attempts preserved.'
           else 'External provider unavailable. Benchmark recovery parked pending explicit service-role resume; retry attempts preserved.'
         end,
         updated_at=now()
    from public.sp_m1b_benchmark_execution_item_v1 e
   where e.execution_batch_id=p_execution_batch_id
     and e.run_id=q.run_id
     and e.status='WAITING_M1BR'
     and q.status in ('PENDING','RETRY','IN_PROGRESS');

  get diagnostics v_paused = row_count;

  update public.sp_m1b_benchmark_execution_batch_v1
     set status='BLOCKED_EXTERNAL',
         blocked_reason=v_reason,
         blocked_at=coalesce(blocked_at, now()),
         resumed_at=null,
         updated_at=now()
   where id=p_execution_batch_id
     and publication_allowed=false
     and runtime_promotion_allowed=false;

  return jsonb_build_object(
    'success', true,
    'execution_batch_id', p_execution_batch_id,
    'status', 'BLOCKED_EXTERNAL',
    'blocked_reason', v_reason,
    'paused_recovery_count', v_paused,
    'retry_attempts_preserved', true,
    'publication_allowed', false,
    'runtime_promotion_allowed', false
  );
end;
$function$;

create or replace function public.sp_m1b_resume_benchmark_external_v1(
  p_execution_batch_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  v_batch public.sp_m1b_benchmark_execution_batch_v1%rowtype;
  v_resumed integer := 0;
begin
  if p_execution_batch_id is null then
    raise exception using errcode='22023', message='BENCHMARK_EXECUTION_BATCH_REQUIRED';
  end if;

  select * into v_batch
  from public.sp_m1b_benchmark_execution_batch_v1
  where id=p_execution_batch_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='BENCHMARK_EXECUTION_BATCH_NOT_FOUND';
  end if;

  if v_batch.publication_allowed<>false or v_batch.runtime_promotion_allowed<>false then
    raise exception using errcode='23514', message='BENCHMARK_EXECUTION_SAFETY_STATE_INVALID';
  end if;

  if v_batch.status<>'BLOCKED_EXTERNAL' then
    return jsonb_build_object(
      'success', true,
      'inserted', false,
      'execution_batch_id', p_execution_batch_id,
      'status', v_batch.status,
      'resumed_recovery_count', 0,
      'publication_allowed', false,
      'runtime_promotion_allowed', false
    );
  end if;

  update public.sp_m1br_recovery_queue_v1 q
     set status='RETRY',
         next_attempt_at=now(),
         locked_at=null,
         worker_code=null,
         updated_at=now()
    from public.sp_m1b_benchmark_execution_item_v1 e
   where e.execution_batch_id=p_execution_batch_id
     and e.run_id=q.run_id
     and e.status='WAITING_M1BR'
     and q.status='RETRY'
     and q.next_attempt_at='infinity'::timestamptz
     and q.attempt_count<q.max_attempts;

  get diagnostics v_resumed = row_count;

  update public.sp_m1b_benchmark_execution_batch_v1
     set status='RUNNING',
         resumed_at=now(),
         updated_at=now()
   where id=p_execution_batch_id
     and publication_allowed=false
     and runtime_promotion_allowed=false;

  return jsonb_build_object(
    'success', true,
    'inserted', true,
    'execution_batch_id', p_execution_batch_id,
    'status', 'RUNNING',
    'blocked_reason', v_batch.blocked_reason,
    'resumed_recovery_count', v_resumed,
    'retry_attempts_preserved', true,
    'publication_allowed', false,
    'runtime_promotion_allowed', false
  );
end;
$function$;

revoke all on function public.sp_m1b_pause_benchmark_external_v1(uuid,text) from public;
revoke all on function public.sp_m1b_pause_benchmark_external_v1(uuid,text) from anon;
revoke all on function public.sp_m1b_pause_benchmark_external_v1(uuid,text) from authenticated;
grant execute on function public.sp_m1b_pause_benchmark_external_v1(uuid,text) to service_role;

revoke all on function public.sp_m1b_resume_benchmark_external_v1(uuid) from public;
revoke all on function public.sp_m1b_resume_benchmark_external_v1(uuid) from anon;
revoke all on function public.sp_m1b_resume_benchmark_external_v1(uuid) from authenticated;
grant execute on function public.sp_m1b_resume_benchmark_external_v1(uuid) to service_role;

comment on function public.sp_m1b_pause_benchmark_external_v1(uuid,text) is
  'Backend-only fail-closed pause for DEV benchmark recovery when an external provider dependency is unavailable. Preserves retry attempts; never enables publication or runtime promotion.';
comment on function public.sp_m1b_resume_benchmark_external_v1(uuid) is
  'Backend-only explicit resume for an externally blocked DEV benchmark batch after dependency recovery. Preserves retry attempts; never enables publication or runtime promotion.';

commit;
