-- SafeProducts M1-BR queue-aware worker dispatch v1
-- Dispatches the already-authenticated Edge worker only when recovery work can
-- actually be claimed, while also waking it to recover stale worker locks.

create or replace function sp_internal.dispatch_m1br_if_pending_v1()
returns bigint
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'sp_internal', 'pg_temp'
as $function$
declare
  v_has_work boolean := false;
  v_request_id bigint;
begin
  select exists (
    select 1
    from public.sp_m1br_recovery_queue_v1 q
    where (
      q.status in ('PENDING','RETRY')
      and q.next_attempt_at <= now()
      and q.attempt_count < q.max_attempts
    ) or (
      q.status = 'IN_PROGRESS'
      and q.locked_at < now() - interval '20 minutes'
    )
  )
  into v_has_work;

  if not v_has_work then
    return null;
  end if;

  select sp_internal.dispatch_edge_worker_v1(
    'M1BR_INGREDIENT_RECOVERY',
    'sp-m1br-recovery-worker-v1'
  )
  into v_request_id;

  return v_request_id;
end;
$function$;

comment on function sp_internal.dispatch_m1br_if_pending_v1() is
  'Queue-aware M1-BR dispatcher. Reuses the protected common Edge dispatcher only for eligible PENDING/RETRY work or stale IN_PROGRESS locks.';

revoke all on function sp_internal.dispatch_m1br_if_pending_v1() from public;
revoke all on function sp_internal.dispatch_m1br_if_pending_v1() from anon, authenticated;
grant execute on function sp_internal.dispatch_m1br_if_pending_v1() to postgres;

-- Idempotent scheduler registration. Staggered from the existing 5/10-minute
-- workers so catalog/regulatory traffic is not launched in the same minute.
do $schedule$
declare
  v_job record;
begin
  for v_job in
    select jobid
    from cron.job
    where jobname = 'sp_m1br_recovery_dispatch_v1'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end;
$schedule$;

select cron.schedule(
  'sp_m1br_recovery_dispatch_v1',
  '7-59/10 * * * *',
  $cron$select sp_internal.dispatch_m1br_if_pending_v1();$cron$
);
