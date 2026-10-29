-- SP-US2 paid product-discovery budget guard.
-- Public search may request discovery, but only this service-role-only claim function
-- can authorize a paid provider call. Free/cache discovery remains available when denied.

create table if not exists public.sp_us2_paid_discovery_budget_v1 (
  scope_key text not null,
  window_kind text not null check (window_kind in ('QUERY_6H','GLOBAL_HOUR','GLOBAL_DAY')),
  window_start timestamptz not null,
  claim_count integer not null default 0 check (claim_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (scope_key, window_kind, window_start)
);

alter table public.sp_us2_paid_discovery_budget_v1 enable row level security;
revoke all on table public.sp_us2_paid_discovery_budget_v1 from public;
revoke all on table public.sp_us2_paid_discovery_budget_v1 from anon;
revoke all on table public.sp_us2_paid_discovery_budget_v1 from authenticated;
grant select, insert, update, delete on table public.sp_us2_paid_discovery_budget_v1 to service_role;

create or replace function public.sp_us2_claim_paid_discovery_v1(p_query text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','extensions','pg_temp'
as $function$
declare
  v_query text := lower(regexp_replace(btrim(coalesce(p_query,'')),'[[:space:]]+',' ','g'));
  v_query_hash text;
  v_now timestamptz := clock_timestamp();
  v_query_window timestamptz;
  v_hour_window timestamptz := date_trunc('hour',v_now);
  v_day_window timestamptz := date_trunc('day',v_now);
  v_query_count integer := 0;
  v_hour_count integer := 0;
  v_day_count integer := 0;
  v_query_limit integer := 1;
  v_hour_limit integer := 60;
  v_day_limit integer := 500;
begin
  if length(v_query) < 2 or length(v_query) > 200 then
    raise exception using errcode='22023', message='SP_US2_PAID_DISCOVERY_QUERY_INVALID';
  end if;

  v_query_hash := encode(extensions.digest(v_query,'sha256'),'hex');
  v_query_window := date_trunc('day',v_now)
    + floor(extract(hour from v_now) / 6)::integer * interval '6 hours';

  -- Serialize all budget claims so concurrent public requests cannot overrun caps.
  perform pg_advisory_xact_lock(hashtextextended('SP_US2_PAID_DISCOVERY_BUDGET_V1',0));

  select claim_count into v_query_count
  from public.sp_us2_paid_discovery_budget_v1
  where scope_key='QUERY:'||v_query_hash
    and window_kind='QUERY_6H'
    and window_start=v_query_window;
  v_query_count := coalesce(v_query_count,0);

  select claim_count into v_hour_count
  from public.sp_us2_paid_discovery_budget_v1
  where scope_key='GLOBAL'
    and window_kind='GLOBAL_HOUR'
    and window_start=v_hour_window;
  v_hour_count := coalesce(v_hour_count,0);

  select claim_count into v_day_count
  from public.sp_us2_paid_discovery_budget_v1
  where scope_key='GLOBAL'
    and window_kind='GLOBAL_DAY'
    and window_start=v_day_window;
  v_day_count := coalesce(v_day_count,0);

  if v_query_count >= v_query_limit then
    return jsonb_build_object(
      'allowed',false,
      'reason','QUERY_COOLDOWN',
      'query_window_start',v_query_window,
      'hour_count',v_hour_count,
      'day_count',v_day_count
    );
  end if;

  if v_hour_count >= v_hour_limit then
    return jsonb_build_object(
      'allowed',false,
      'reason','GLOBAL_HOUR_LIMIT',
      'hour_count',v_hour_count,
      'hour_limit',v_hour_limit,
      'day_count',v_day_count
    );
  end if;

  if v_day_count >= v_day_limit then
    return jsonb_build_object(
      'allowed',false,
      'reason','GLOBAL_DAY_LIMIT',
      'day_count',v_day_count,
      'day_limit',v_day_limit
    );
  end if;

  insert into public.sp_us2_paid_discovery_budget_v1(scope_key,window_kind,window_start,claim_count,updated_at)
  values('QUERY:'||v_query_hash,'QUERY_6H',v_query_window,1,v_now)
  on conflict(scope_key,window_kind,window_start) do update
    set claim_count=public.sp_us2_paid_discovery_budget_v1.claim_count+1,
        updated_at=excluded.updated_at;

  insert into public.sp_us2_paid_discovery_budget_v1(scope_key,window_kind,window_start,claim_count,updated_at)
  values('GLOBAL','GLOBAL_HOUR',v_hour_window,1,v_now)
  on conflict(scope_key,window_kind,window_start) do update
    set claim_count=public.sp_us2_paid_discovery_budget_v1.claim_count+1,
        updated_at=excluded.updated_at;

  insert into public.sp_us2_paid_discovery_budget_v1(scope_key,window_kind,window_start,claim_count,updated_at)
  values('GLOBAL','GLOBAL_DAY',v_day_window,1,v_now)
  on conflict(scope_key,window_kind,window_start) do update
    set claim_count=public.sp_us2_paid_discovery_budget_v1.claim_count+1,
        updated_at=excluded.updated_at;

  return jsonb_build_object(
    'allowed',true,
    'reason','CLAIMED',
    'query_window_start',v_query_window,
    'hour_count',v_hour_count+1,
    'hour_limit',v_hour_limit,
    'day_count',v_day_count+1,
    'day_limit',v_day_limit
  );
end;
$function$;

revoke all on function public.sp_us2_claim_paid_discovery_v1(text) from public;
revoke all on function public.sp_us2_claim_paid_discovery_v1(text) from anon;
revoke all on function public.sp_us2_claim_paid_discovery_v1(text) from authenticated;
grant execute on function public.sp_us2_claim_paid_discovery_v1(text) to service_role;
