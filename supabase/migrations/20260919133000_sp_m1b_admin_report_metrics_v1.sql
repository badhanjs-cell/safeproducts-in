-- SafeProducts M1-B admin report metrics v1
-- Extends the existing admin/service-role read-only report with latency, review-rate and cost metrics.

create or replace function public.sp_m1b_get_report_v1(
  p_from timestamp with time zone,
  p_to timestamp with time zone,
  p_context text default null
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','pg_temp'
as $$
declare
  v_attempted bigint;
  v_m1bq bigint;
  v_fail bigint;
  v_brinv bigint;
  v_brq bigint;
  v_review bigint;
  v_promoted bigint;
  v_p50 numeric := 0;
  v_p95 numeric := 0;
  v_br_cost numeric := 0;
  v_result jsonb;
begin
  if auth.role()<>'service_role'
     and not (
       coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
       and public.sp_web_has_role_v1(auth.uid(),'admin'::public.sp_web_app_role_v1)
     ) then
    raise exception using errcode='42501',message='M1B_REPORT_ADMIN_REQUIRED';
  end if;

  if p_from is null or p_to is null or p_to<=p_from then
    raise exception using errcode='22023',message='M1B_REPORT_RANGE_INVALID';
  end if;

  select
    count(*),
    count(*) filter(where r.m1b_status='QUALIFIED'),
    count(*) filter(where r.m1b_status in ('FAILED','CONFLICT')),
    count(*) filter(where r.m1br_status<>'NOT_REQUIRED'),
    count(*) filter(where r.m1br_status='QUALIFIED'),
    count(*) filter(where r.m1br_status in ('INSUFFICIENT_EVIDENCE','CONFLICT_REQUIRES_REVIEW','FAILED')),
    count(*) filter(where r.promotion_status='PROMOTED')
  into v_attempted,v_m1bq,v_fail,v_brinv,v_brq,v_review,v_promoted
  from public.sp_m1b_run_v1 r
  where r.created_at>=p_from
    and r.created_at<p_to
    and (p_context is null or r.context=upper(p_context));

  with scoped_runs as (
    select r.id
    from public.sp_m1b_run_v1 r
    where r.created_at>=p_from
      and r.created_at<p_to
      and (p_context is null or r.context=upper(p_context))
  ), per_run as (
    select a.run_id, max(a.latency_ms)::numeric as run_latency_ms
    from public.sp_m1b_engine_attempt_v1 a
    join scoped_runs s on s.id=a.run_id
    where a.latency_ms is not null and a.latency_ms>=0
    group by a.run_id
  )
  select
    coalesce(percentile_cont(0.50) within group(order by run_latency_ms),0)::numeric,
    coalesce(percentile_cont(0.95) within group(order by run_latency_ms),0)::numeric
  into v_p50,v_p95
  from per_run;

  select coalesce(sum(a.cost_usd),0)
  into v_br_cost
  from public.sp_m1b_engine_attempt_v1 a
  join public.sp_m1b_run_v1 r on r.id=a.run_id
  where r.created_at>=p_from
    and r.created_at<p_to
    and (p_context is null or r.context=upper(p_context))
    and a.engine='M1-BR'
    and a.cost_usd is not null
    and a.cost_usd>=0;

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
    'human_review_rate',case when v_attempted=0 then 0 else round(v_review::numeric/v_attempted,6) end,
    'p50_latency_ms',round(v_p50,2),
    'p95_latency_ms',round(v_p95,2),
    'm1br_cost_usd',round(v_br_cost,6),
    'cost_per_recovery_usd',case when v_brq=0 then 0 else round(v_br_cost/v_brq,6) end,
    'cache_promotion_count',v_promoted
  );

  return v_result;
end;
$$;

revoke all on function public.sp_m1b_get_report_v1(timestamp with time zone,timestamp with time zone,text) from public,anon;
grant execute on function public.sp_m1b_get_report_v1(timestamp with time zone,timestamp with time zone,text) to authenticated,service_role;
