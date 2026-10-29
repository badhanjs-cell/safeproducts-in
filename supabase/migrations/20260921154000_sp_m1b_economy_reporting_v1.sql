-- SafeProducts M1-B economy reporting v1
-- Reads persisted attempt metrics. Paid work with unknown monetary cost remains NULL, never fabricated as zero.

begin;

create or replace function public.sp_m1b_get_report_v1(
  p_from timestamptz,
  p_to timestamptz,
  p_context text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  v_attempted bigint := 0;
  v_m1bq bigint := 0;
  v_fail bigint := 0;
  v_brinv bigint := 0;
  v_brq bigint := 0;
  v_review bigint := 0;
  v_promoted bigint := 0;
  v_p50 numeric := 0;
  v_p95 numeric := 0;
  v_br_cost numeric := 0;
  v_unknown_paid_cost_attempts bigint := 0;
  v_unknown_m1br_paid_cost_attempts bigint := 0;
  v_paid_model_calls bigint := 0;
  v_commerce_discovery_calls bigint := 0;
  v_provider_input_tokens bigint := 0;
  v_provider_output_tokens bigint := 0;
  v_provider_total_tokens bigint := 0;
  v_provider_usage_incomplete_attempts bigint := 0;
  v_result jsonb;
begin
  if auth.role() <> 'service_role'
     and not (
       coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
       and public.sp_web_has_role_v1(auth.uid(), 'admin'::public.sp_web_app_role_v1)
     ) then
    raise exception using errcode='42501', message='M1B_REPORT_ADMIN_REQUIRED';
  end if;

  if p_from is null or p_to is null or p_to <= p_from then
    raise exception using errcode='22023', message='M1B_REPORT_RANGE_INVALID';
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
  where r.created_at >= p_from
    and r.created_at < p_to
    and (p_context is null or r.context = upper(p_context));

  with scoped_runs as (
    select r.id
    from public.sp_m1b_run_v1 r
    where r.created_at >= p_from
      and r.created_at < p_to
      and (p_context is null or r.context = upper(p_context))
  ), per_run as (
    select a.run_id, max(a.latency_ms)::numeric as run_latency_ms
    from public.sp_m1b_engine_attempt_v1 a
    join scoped_runs s on s.id = a.run_id
    where a.latency_ms is not null and a.latency_ms >= 0
    group by a.run_id
  )
  select
    coalesce(percentile_cont(0.50) within group(order by run_latency_ms),0)::numeric,
    coalesce(percentile_cont(0.95) within group(order by run_latency_ms),0)::numeric
  into v_p50,v_p95
  from per_run;

  with scoped_attempts as (
    select
      a.*,
      case when coalesce(a.metrics->>'paid_model_calls','') ~ '^[0-9]+$'
        then (a.metrics->>'paid_model_calls')::bigint else 0 end as paid_model_calls,
      case when coalesce(a.metrics->>'commerce_discovery_calls','') ~ '^[0-9]+$'
        then (a.metrics->>'commerce_discovery_calls')::bigint else 0 end as commerce_discovery_calls,
      case when coalesce(a.metrics->>'provider_input_tokens','') ~ '^[0-9]+$'
        then (a.metrics->>'provider_input_tokens')::bigint else 0 end as provider_input_tokens,
      case when coalesce(a.metrics->>'provider_output_tokens','') ~ '^[0-9]+$'
        then (a.metrics->>'provider_output_tokens')::bigint else 0 end as provider_output_tokens,
      case when coalesce(a.metrics->>'provider_total_tokens','') ~ '^[0-9]+$'
        then (a.metrics->>'provider_total_tokens')::bigint else 0 end as provider_total_tokens,
      case when coalesce(a.metrics->>'provider_usage_observed_calls','') ~ '^[0-9]+$'
        then (a.metrics->>'provider_usage_observed_calls')::bigint else 0 end as provider_usage_observed_calls
    from public.sp_m1b_engine_attempt_v1 a
    join public.sp_m1b_run_v1 r on r.id = a.run_id
    where r.created_at >= p_from
      and r.created_at < p_to
      and (p_context is null or r.context = upper(p_context))
  )
  select
    count(*) filter(where paid_model_calls > 0 and cost_usd is null),
    count(*) filter(where engine='M1-BR' and paid_model_calls > 0 and cost_usd is null),
    coalesce(sum(paid_model_calls),0),
    coalesce(sum(commerce_discovery_calls),0),
    coalesce(sum(provider_input_tokens),0),
    coalesce(sum(provider_output_tokens),0),
    coalesce(sum(provider_total_tokens),0),
    count(*) filter(where paid_model_calls > 0 and provider_usage_observed_calls < paid_model_calls),
    coalesce(sum(cost_usd) filter(where engine='M1-BR' and cost_usd is not null and cost_usd >= 0),0)
  into
    v_unknown_paid_cost_attempts,
    v_unknown_m1br_paid_cost_attempts,
    v_paid_model_calls,
    v_commerce_discovery_calls,
    v_provider_input_tokens,
    v_provider_output_tokens,
    v_provider_total_tokens,
    v_provider_usage_incomplete_attempts,
    v_br_cost
  from scoped_attempts;

  v_result := jsonb_build_object(
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
    'paid_model_calls',v_paid_model_calls,
    'commerce_discovery_calls',v_commerce_discovery_calls,
    'provider_input_tokens',v_provider_input_tokens,
    'provider_output_tokens',v_provider_output_tokens,
    'provider_total_tokens',v_provider_total_tokens,
    'provider_usage_incomplete_attempts',v_provider_usage_incomplete_attempts,
    'unknown_paid_cost_attempts',v_unknown_paid_cost_attempts,
    'm1br_cost_usd',case when v_unknown_m1br_paid_cost_attempts > 0 then null else round(v_br_cost,6) end,
    'cost_per_recovery_usd',case when v_unknown_m1br_paid_cost_attempts > 0 then null when v_brq=0 then 0 else round(v_br_cost/v_brq,6) end,
    'cache_promotion_count',v_promoted
  );

  return v_result;
end;
$function$;

revoke all on function public.sp_m1b_get_report_v1(timestamptz,timestamptz,text) from public;
revoke all on function public.sp_m1b_get_report_v1(timestamptz,timestamptz,text) from anon;
grant execute on function public.sp_m1b_get_report_v1(timestamptz,timestamptz,text) to authenticated;
grant execute on function public.sp_m1b_get_report_v1(timestamptz,timestamptz,text) to service_role;

comment on function public.sp_m1b_get_report_v1(timestamptz,timestamptz,text) is
  'M1-B operational report with persisted economy telemetry. Unknown paid monetary cost remains JSON null; provider call/token usage is reported separately.';

commit;
