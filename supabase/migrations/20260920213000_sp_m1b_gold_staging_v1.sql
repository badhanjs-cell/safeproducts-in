-- M1-B / M1-BR controlled DEV benchmark gold staging.
-- This layer is intentionally isolated from runtime catalog/cache artifacts.
-- Staging records remain UNASSIGNED and cannot promote themselves.

create table if not exists public.sp_m1b_gold_staging_batch_v1 (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null default '1.0.0',
  split text not null,
  reviewed_at timestamptz not null,
  reviewer_id_sha256 text not null,
  item_count integer not null,
  blocked_candidate_ids jsonb not null default '[]'::jsonb,
  batch_sha256 text not null unique,
  stage_status text not null default 'STAGED_NOT_PROMOTED',
  gold_status text not null default 'UNASSIGNED',
  promotion_allowed boolean not null default false,
  human_adjudication_complete boolean not null default true,
  payload_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint sp_m1b_gold_staging_batch_split_ck check (split = 'DEV'),
  constraint sp_m1b_gold_staging_batch_item_count_ck check (item_count > 0),
  constraint sp_m1b_gold_staging_batch_blocked_ck check (jsonb_typeof(blocked_candidate_ids) = 'array'),
  constraint sp_m1b_gold_staging_batch_hash_ck check (reviewer_id_sha256 ~ '^[0-9a-f]{64}$' and batch_sha256 ~ '^[0-9a-f]{64}$'),
  constraint sp_m1b_gold_staging_batch_stage_ck check (stage_status = 'STAGED_NOT_PROMOTED'),
  constraint sp_m1b_gold_staging_batch_gold_ck check (gold_status = 'UNASSIGNED'),
  constraint sp_m1b_gold_staging_batch_promotion_ck check (promotion_allowed = false),
  constraint sp_m1b_gold_staging_batch_human_ck check (human_adjudication_complete = true)
);

create table if not exists public.sp_m1b_gold_staging_item_v1 (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.sp_m1b_gold_staging_batch_v1(id) on delete restrict,
  candidate_id text not null,
  benchmark_slot_id text not null,
  benchmark_category text not null,
  candidate_brand_name text,
  candidate_product_name text not null,
  identity_summary text not null,
  product_fingerprint text not null,
  ingredient_declaration text not null,
  ingredient_count integer not null,
  identity_source_urls jsonb not null default '[]'::jsonb,
  evidence_sources jsonb not null default '[]'::jsonb,
  rejected_evidence jsonb not null default '[]'::jsonb,
  identity_decision text not null default 'APPROVE',
  ingredient_declaration_decision text not null default 'APPROVE',
  decision_status text not null default 'HUMAN_APPROVED_FOR_GOLD_STAGING',
  candidate_snapshot_sha256 text not null,
  stage_status text not null default 'STAGED_NOT_PROMOTED',
  gold_status text not null default 'UNASSIGNED',
  promotion_allowed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint sp_m1b_gold_staging_item_candidate_uq unique (batch_id, candidate_id),
  constraint sp_m1b_gold_staging_item_slot_uq unique (batch_id, benchmark_slot_id),
  constraint sp_m1b_gold_staging_item_fingerprint_uq unique (batch_id, product_fingerprint),
  constraint sp_m1b_gold_staging_item_identity_ck check (length(btrim(identity_summary)) > 0 and length(btrim(product_fingerprint)) > 0),
  constraint sp_m1b_gold_staging_item_product_ck check (length(btrim(candidate_product_name)) > 0),
  constraint sp_m1b_gold_staging_item_declaration_ck check (length(btrim(ingredient_declaration)) > 0 and ingredient_count > 0),
  constraint sp_m1b_gold_staging_item_sources_ck check (
    jsonb_typeof(identity_source_urls) = 'array'
    and jsonb_typeof(evidence_sources) = 'array'
    and jsonb_array_length(evidence_sources) > 0
    and jsonb_typeof(rejected_evidence) = 'array'
  ),
  constraint sp_m1b_gold_staging_item_identity_decision_ck check (identity_decision = 'APPROVE'),
  constraint sp_m1b_gold_staging_item_ingredient_decision_ck check (ingredient_declaration_decision = 'APPROVE'),
  constraint sp_m1b_gold_staging_item_decision_status_ck check (decision_status = 'HUMAN_APPROVED_FOR_GOLD_STAGING'),
  constraint sp_m1b_gold_staging_item_snapshot_hash_ck check (candidate_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  constraint sp_m1b_gold_staging_item_stage_ck check (stage_status = 'STAGED_NOT_PROMOTED'),
  constraint sp_m1b_gold_staging_item_gold_ck check (gold_status = 'UNASSIGNED'),
  constraint sp_m1b_gold_staging_item_promotion_ck check (promotion_allowed = false)
);

alter table public.sp_m1b_gold_staging_batch_v1 enable row level security;
alter table public.sp_m1b_gold_staging_item_v1 enable row level security;

revoke all on table public.sp_m1b_gold_staging_batch_v1 from public, anon, authenticated;
revoke all on table public.sp_m1b_gold_staging_item_v1 from public, anon, authenticated;

grant select, insert on table public.sp_m1b_gold_staging_batch_v1 to service_role;
grant select, insert on table public.sp_m1b_gold_staging_item_v1 to service_role;

create or replace function public.sp_m1b_stage_gold_batch_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $$
declare
  v_items jsonb;
  v_item jsonb;
  v_item_count integer;
  v_batch_id uuid;
  v_existing boolean := false;
  v_batch_sha256 text;
  v_blocked jsonb;
  v_metadata jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'INVALID_GOLD_STAGING_PAYLOAD';
  end if;

  if coalesce(p_payload->>'schema_version', '') <> '1.0.0'
     or coalesce(p_payload->>'split', '') <> 'DEV'
     or coalesce(p_payload->>'stage_status', '') <> 'STAGED_NOT_PROMOTED'
     or coalesce(p_payload->>'gold_status', '') <> 'UNASSIGNED'
     or coalesce((p_payload->>'promotion_allowed')::boolean, true) <> false
     or coalesce((p_payload->>'human_adjudication_complete')::boolean, false) <> true then
    raise exception using errcode = '22023', message = 'GOLD_STAGING_STATE_INVALID';
  end if;

  if coalesce(p_payload->>'reviewed_at', '') = ''
     or coalesce(p_payload->>'reviewer_id_sha256', '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_payload->>'batch_sha256', '') !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'REVIEWER_OR_BATCH_AUDIT_INVALID';
  end if;

  v_items := p_payload->'items';
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception using errcode = '22023', message = 'REVIEW_PACKET_INCOMPLETE';
  end if;

  if coalesce(p_payload->>'item_count', '') !~ '^[1-9][0-9]*$' then
    raise exception using errcode = '22023', message = 'ITEM_COUNT_INVALID';
  end if;
  v_item_count := (p_payload->>'item_count')::integer;
  if v_item_count <> jsonb_array_length(v_items) then
    raise exception using errcode = '22023', message = 'ITEM_COUNT_MISMATCH';
  end if;

  v_blocked := coalesce(p_payload->'blocked_candidate_ids', '[]'::jsonb);
  if jsonb_typeof(v_blocked) <> 'array' then
    raise exception using errcode = '22023', message = 'BLOCKED_CANDIDATES_INVALID';
  end if;
  v_metadata := coalesce(p_payload->'payload_metadata', '{}'::jsonb);
  if jsonb_typeof(v_metadata) <> 'object' then
    raise exception using errcode = '22023', message = 'PAYLOAD_METADATA_INVALID';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) e
    where coalesce(e->>'identity_decision', '') <> 'APPROVE'
       or coalesce(e->>'ingredient_declaration_decision', '') <> 'APPROVE'
       or coalesce(e->>'decision_status', '') <> 'HUMAN_APPROVED_FOR_GOLD_STAGING'
  ) then
    raise exception using errcode = '22023', message = 'HUMAN_APPROVAL_REQUIRED';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) e
    where coalesce(e->>'candidate_id', '') = ''
       or coalesce(e->>'benchmark_slot_id', '') = ''
       or coalesce(e->>'benchmark_category', '') = ''
       or coalesce(e->>'candidate_product_name', '') = ''
       or coalesce(e->>'identity_summary', '') = ''
       or coalesce(e->>'product_fingerprint', '') !~ '^spfp:v1:[0-9a-f]+$'
       or coalesce(e->>'ingredient_declaration', '') = ''
       or coalesce(e->>'ingredient_count', '') !~ '^[1-9][0-9]*$'
       or jsonb_typeof(e->'evidence_sources') <> 'array'
       or jsonb_array_length(e->'evidence_sources') = 0
       or coalesce(e->>'candidate_snapshot_sha256', '') !~ '^[0-9a-f]{64}$'
       or coalesce(e->>'stage_status', '') <> 'STAGED_NOT_PROMOTED'
       or coalesce(e->>'gold_status', '') <> 'UNASSIGNED'
       or coalesce((e->>'promotion_allowed')::boolean, true) <> false
  ) then
    raise exception using errcode = '22023', message = 'REVIEW_PACKET_INCOMPLETE';
  end if;

  if (select count(*) from jsonb_array_elements(v_items)) <>
     (select count(distinct e->>'candidate_id') from jsonb_array_elements(v_items) e) then
    raise exception using errcode = '22023', message = 'DUPLICATE_CANDIDATE_ID';
  end if;

  if (select count(*) from jsonb_array_elements(v_items)) <>
     (select count(distinct e->>'benchmark_slot_id') from jsonb_array_elements(v_items) e) then
    raise exception using errcode = '22023', message = 'DUPLICATE_BENCHMARK_SLOT_ID';
  end if;

  if (select count(*) from jsonb_array_elements(v_items)) <>
     (select count(distinct e->>'product_fingerprint') from jsonb_array_elements(v_items) e) then
    raise exception using errcode = '22023', message = 'DUPLICATE_PRODUCT_FINGERPRINT';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(v_blocked) b(candidate_id)
    join jsonb_array_elements(v_items) e on e->>'candidate_id' = b.candidate_id
  ) then
    raise exception using errcode = '22023', message = 'BLOCKED_CANDIDATE_STAGED';
  end if;

  v_batch_sha256 := p_payload->>'batch_sha256';
  select id into v_batch_id
  from public.sp_m1b_gold_staging_batch_v1
  where batch_sha256 = v_batch_sha256;

  if v_batch_id is not null then
    v_existing := true;
    if (select count(*) from public.sp_m1b_gold_staging_item_v1 where batch_id = v_batch_id) <> v_item_count then
      raise exception using errcode = '23514', message = 'IDEMPOTENT_BATCH_ITEM_COUNT_MISMATCH';
    end if;
    return jsonb_build_object(
      'success', true,
      'inserted', false,
      'batch_id', v_batch_id,
      'batch_sha256', v_batch_sha256,
      'item_count', v_item_count,
      'stage_status', 'STAGED_NOT_PROMOTED',
      'gold_status', 'UNASSIGNED',
      'promotion_allowed', false
    );
  end if;

  insert into public.sp_m1b_gold_staging_batch_v1 (
    schema_version, split, reviewed_at, reviewer_id_sha256, item_count,
    blocked_candidate_ids, batch_sha256, stage_status, gold_status,
    promotion_allowed, human_adjudication_complete, payload_metadata
  ) values (
    '1.0.0', 'DEV', (p_payload->>'reviewed_at')::timestamptz,
    p_payload->>'reviewer_id_sha256', v_item_count, v_blocked,
    v_batch_sha256, 'STAGED_NOT_PROMOTED', 'UNASSIGNED', false, true, v_metadata
  )
  returning id into v_batch_id;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    insert into public.sp_m1b_gold_staging_item_v1 (
      batch_id, candidate_id, benchmark_slot_id, benchmark_category,
      candidate_brand_name, candidate_product_name, identity_summary,
      product_fingerprint, ingredient_declaration, ingredient_count,
      identity_source_urls, evidence_sources, rejected_evidence,
      identity_decision, ingredient_declaration_decision, decision_status,
      candidate_snapshot_sha256, stage_status, gold_status, promotion_allowed
    ) values (
      v_batch_id,
      v_item->>'candidate_id',
      v_item->>'benchmark_slot_id',
      v_item->>'benchmark_category',
      nullif(v_item->>'candidate_brand_name', ''),
      v_item->>'candidate_product_name',
      v_item->>'identity_summary',
      v_item->>'product_fingerprint',
      v_item->>'ingredient_declaration',
      (v_item->>'ingredient_count')::integer,
      coalesce(v_item->'identity_source_urls', '[]'::jsonb),
      v_item->'evidence_sources',
      coalesce(v_item->'rejected_evidence', '[]'::jsonb),
      'APPROVE',
      'APPROVE',
      'HUMAN_APPROVED_FOR_GOLD_STAGING',
      v_item->>'candidate_snapshot_sha256',
      'STAGED_NOT_PROMOTED',
      'UNASSIGNED',
      false
    );
  end loop;

  return jsonb_build_object(
    'success', true,
    'inserted', not v_existing,
    'batch_id', v_batch_id,
    'batch_sha256', v_batch_sha256,
    'item_count', v_item_count,
    'stage_status', 'STAGED_NOT_PROMOTED',
    'gold_status', 'UNASSIGNED',
    'promotion_allowed', false
  );
end;
$$;

revoke execute on function public.sp_m1b_stage_gold_batch_v1(jsonb) from public, anon, authenticated;
grant execute on function public.sp_m1b_stage_gold_batch_v1(jsonb) to service_role;
