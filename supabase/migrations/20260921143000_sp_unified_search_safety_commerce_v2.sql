-- SafeProducts Unified Search, Safety & Commerce v2
-- Additive pack-normalization metadata plus internal read contracts.
-- Commerce/pack reads are isolated from formula qualification and safety assessment writes.

begin;

alter table public.sp_catalog_product_v1
  add column if not exists pack_normalized_value numeric,
  add column if not exists pack_normalized_unit text,
  add column if not exists pack_normalized_key text;

alter table public.sp_catalog_commerce_offer_v1
  add column if not exists pack_size_text text,
  add column if not exists pack_normalized_value numeric,
  add column if not exists pack_normalized_unit text,
  add column if not exists pack_normalized_key text,
  add column if not exists exact_pack_match boolean not null default false,
  add column if not exists pack_match_confidence numeric;

alter table public.sp_catalog_product_v1
  drop constraint if exists sp_catalog_product_v1_pack_normalized_unit_chk,
  add constraint sp_catalog_product_v1_pack_normalized_unit_chk
    check (pack_normalized_unit is null or pack_normalized_unit in ('ml','g','count'));

alter table public.sp_catalog_commerce_offer_v1
  drop constraint if exists sp_catalog_commerce_offer_v1_pack_normalized_unit_chk,
  add constraint sp_catalog_commerce_offer_v1_pack_normalized_unit_chk
    check (pack_normalized_unit is null or pack_normalized_unit in ('ml','g','count'));

alter table public.sp_catalog_commerce_offer_v1
  drop constraint if exists sp_catalog_commerce_offer_v1_pack_match_confidence_chk,
  add constraint sp_catalog_commerce_offer_v1_pack_match_confidence_chk
    check (pack_match_confidence is null or (pack_match_confidence >= 0 and pack_match_confidence <= 100));

create index if not exists sp_catalog_product_v1_pack_normalized_key_idx
  on public.sp_catalog_product_v1 (pack_normalized_key, category, market_country_code)
  where is_active = true;

create index if not exists sp_catalog_commerce_offer_v1_product_pack_retrieved_idx
  on public.sp_catalog_commerce_offer_v1 (product_id, pack_normalized_key, retrieved_at desc);

create or replace function public.sp_us2_exact_offers_v1(
  p_product_id uuid,
  p_pack_normalized_key text,
  p_limit integer default 5
)
returns table(
  id uuid,
  product_id uuid,
  platform_name text,
  merchant_name text,
  source_domain text,
  source_url text,
  affiliate_url text,
  price numeric,
  currency text,
  list_price numeric,
  availability_status text,
  image_url text,
  offer_confidence numeric,
  verified boolean,
  market_country_code text,
  pack_size_text text,
  pack_normalized_value numeric,
  pack_normalized_unit text,
  pack_normalized_key text,
  exact_pack_match boolean,
  pack_match_confidence numeric,
  retrieved_at timestamptz,
  valid_until timestamptz
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  with ranked as (
    select
      o.*,
      row_number() over (
        partition by coalesce(nullif(lower(btrim(o.merchant_name)), ''), nullif(lower(btrim(o.source_domain)), ''), lower(btrim(o.platform_name)))
        order by
          o.verified desc,
          case when o.price is not null and o.price > 0 then 0 else 1 end,
          o.price asc nulls last,
          o.offer_confidence desc nulls last,
          o.retrieved_at desc,
          o.id
      ) as merchant_rank
    from public.sp_catalog_commerce_offer_v1 o
    where o.product_id = p_product_id
      and o.market_country_code = 'IN'
      and (p_pack_normalized_key is null or (o.pack_normalized_key = p_pack_normalized_key and o.exact_pack_match = true))
  )
  select
    r.id, r.product_id, r.platform_name, r.merchant_name, r.source_domain, r.source_url,
    r.affiliate_url, r.price, r.currency, r.list_price, r.availability_status, r.image_url,
    r.offer_confidence, r.verified, r.market_country_code, r.pack_size_text,
    r.pack_normalized_value, r.pack_normalized_unit, r.pack_normalized_key,
    r.exact_pack_match, r.pack_match_confidence, r.retrieved_at, r.valid_until
  from ranked r
  where r.merchant_rank = 1
  order by
    case when r.price is not null and r.price > 0 then 0 else 1 end,
    r.price asc nulls last,
    r.verified desc,
    r.offer_confidence desc nulls last,
    r.retrieved_at desc,
    r.id
  limit greatest(1, least(coalesce(p_limit, 5), 5));
$function$;

create or replace function public.sp_us2_category_candidates_v1(
  p_category text,
  p_exclude_product_id uuid,
  p_pack_normalized_key text,
  p_limit integer default 12
)
returns table(
  id uuid,
  product_fingerprint text,
  brand_name text,
  product_name text,
  variant_name text,
  pack_size_text text,
  pack_normalized_value numeric,
  pack_normalized_unit text,
  pack_normalized_key text,
  category text,
  subcategory text,
  market_country_code text,
  barcode text,
  gtin text,
  identity_confidence numeric,
  identity_status text
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  with eligible as (
    select
      p.*,
      row_number() over (
        partition by coalesce(nullif(lower(btrim(p.brand_name)), ''), p.id::text)
        order by
          case when p.identity_status = 'VERIFIED' then 0 else 1 end,
          p.identity_confidence desc nulls last,
          p.updated_at desc,
          p.id
      ) as brand_rank
    from public.sp_catalog_product_v1 p
    where p.is_active = true
      and p.market_country_code = 'IN'
      and lower(btrim(p.category)) = lower(btrim(p_category))
      and (p_exclude_product_id is null or p.id <> p_exclude_product_id)
      and (p_pack_normalized_key is null or p.pack_normalized_key = p_pack_normalized_key)
  )
  select
    e.id, e.product_fingerprint, e.brand_name, e.product_name, e.variant_name,
    e.pack_size_text, e.pack_normalized_value, e.pack_normalized_unit, e.pack_normalized_key,
    e.category, e.subcategory, e.market_country_code, e.barcode, e.gtin,
    e.identity_confidence, e.identity_status
  from eligible e
  where e.brand_rank = 1
  order by
    case when e.identity_status = 'VERIFIED' then 0 else 1 end,
    e.identity_confidence desc nulls last,
    lower(e.brand_name) nulls last,
    lower(e.product_name),
    e.id
  limit greatest(1, least(coalesce(p_limit, 12), 20));
$function$;

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

  with scoped_attempts as (
    select
      a.*,
      coalesce(nullif(a.detail->>'paid_model_calls','')::bigint,
               nullif(a.detail->'trace'->>'paid_model_calls','')::bigint, 0) as paid_model_calls,
      coalesce(nullif(a.detail->>'commerce_discovery_calls','')::bigint,
               nullif(a.detail->'trace'->>'commerce_discovery_calls','')::bigint, 0) as commerce_discovery_calls,
      coalesce(nullif(a.detail->>'provider_input_tokens','')::bigint,
               nullif(a.detail->'trace'->>'provider_input_tokens','')::bigint, 0) as provider_input_tokens,
      coalesce(nullif(a.detail->>'provider_output_tokens','')::bigint,
               nullif(a.detail->'trace'->>'provider_output_tokens','')::bigint, 0) as provider_output_tokens,
      coalesce(nullif(a.detail->>'provider_total_tokens','')::bigint,
               nullif(a.detail->'trace'->>'provider_total_tokens','')::bigint, 0) as provider_total_tokens,
      coalesce(nullif(a.detail->>'provider_usage_observed_calls','')::bigint,
               nullif(a.detail->'trace'->>'provider_usage_observed_calls','')::bigint, 0) as provider_usage_observed_calls
    from public.sp_m1b_engine_attempt_v1 a
    join public.sp_m1b_run_v1 r on r.id=a.run_id
    where r.created_at>=p_from
      and r.created_at<p_to
      and (p_context is null or r.context=upper(p_context))
  )
  select
    count(*) filter(where paid_model_calls>0 and cost_usd is null),
    count(*) filter(where engine='M1-BR' and paid_model_calls>0 and cost_usd is null),
    coalesce(sum(paid_model_calls),0),
    coalesce(sum(commerce_discovery_calls),0),
    coalesce(sum(provider_input_tokens),0),
    coalesce(sum(provider_output_tokens),0),
    coalesce(sum(provider_total_tokens),0),
    count(*) filter(where paid_model_calls>0 and provider_usage_observed_calls<paid_model_calls),
    coalesce(sum(cost_usd) filter(where engine='M1-BR' and cost_usd is not null and cost_usd>=0),0)
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
    'paid_model_calls',v_paid_model_calls,
    'commerce_discovery_calls',v_commerce_discovery_calls,
    'provider_input_tokens',v_provider_input_tokens,
    'provider_output_tokens',v_provider_output_tokens,
    'provider_total_tokens',v_provider_total_tokens,
    'provider_usage_incomplete_attempts',v_provider_usage_incomplete_attempts,
    'unknown_paid_cost_attempts',v_unknown_paid_cost_attempts,
    'm1br_cost_usd',case when v_unknown_m1br_paid_cost_attempts>0 then null else round(v_br_cost,6) end,
    'cost_per_recovery_usd',case when v_unknown_m1br_paid_cost_attempts>0 then null when v_brq=0 then 0 else round(v_br_cost/v_brq,6) end,
    'cache_promotion_count',v_promoted
  );

  return v_result;
end;
$function$;

revoke all on function public.sp_us2_exact_offers_v1(uuid,text,integer) from public;
revoke all on function public.sp_us2_exact_offers_v1(uuid,text,integer) from anon;
revoke all on function public.sp_us2_exact_offers_v1(uuid,text,integer) from authenticated;
grant execute on function public.sp_us2_exact_offers_v1(uuid,text,integer) to service_role;

revoke all on function public.sp_us2_category_candidates_v1(text,uuid,text,integer) from public;
revoke all on function public.sp_us2_category_candidates_v1(text,uuid,text,integer) from anon;
revoke all on function public.sp_us2_category_candidates_v1(text,uuid,text,integer) from authenticated;
grant execute on function public.sp_us2_category_candidates_v1(text,uuid,text,integer) to service_role;

comment on function public.sp_us2_exact_offers_v1(uuid,text,integer) is
  'Unified Search v2 internal read: same canonical product, exact normalized pack when supplied, merchant-deduplicated and price ordered. No safety mutation.';

comment on function public.sp_us2_category_candidates_v1(text,uuid,text,integer) is
  'Unified Search v2 internal read: active India same-category candidates, exact normalized pack when supplied, one candidate per brand where available. No safety mutation.';

comment on function public.sp_m1b_get_report_v1(timestamptz,timestamptz,text) is
  'M1-B operational report with economy telemetry. Unknown paid monetary cost remains JSON null; token/call usage is reported separately.';

commit;
