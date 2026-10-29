-- M1-B / M1-BR DEV benchmark gold qualification and isolated promotion.
-- This layer copies qualified staging evidence into an immutable benchmark-only surface.
-- It does not publish records into runtime catalog, cache, commerce, or scoring flows.

create table if not exists public.sp_m1b_gold_qualification_v1 (
  id uuid primary key default gen_random_uuid(),
  staging_batch_id uuid not null references public.sp_m1b_gold_staging_batch_v1(id) on delete restrict,
  staging_batch_sha256 text not null,
  source_evidence_revision text not null,
  qualified_item_count integer not null,
  blocked_count integer not null,
  rejected_evidence_item_count integer not null default 0,
  qualification_status text not null default 'QUALIFIED_FOR_BENCHMARK_GOLD',
  publication_allowed boolean not null default false,
  runtime_promotion_allowed boolean not null default false,
  qualification_detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint sp_m1b_gold_qualification_staging_uq unique (staging_batch_id),
  constraint sp_m1b_gold_qualification_sha_ck check (staging_batch_sha256 ~ '^[0-9a-f]{64}$'),
  constraint sp_m1b_gold_qualification_revision_ck check (source_evidence_revision ~ '^[0-9a-f]{40}$'),
  constraint sp_m1b_gold_qualification_count_ck check (qualified_item_count > 0 and blocked_count >= 0 and rejected_evidence_item_count >= 0),
  constraint sp_m1b_gold_qualification_status_ck check (qualification_status = 'QUALIFIED_FOR_BENCHMARK_GOLD'),
  constraint sp_m1b_gold_qualification_publication_ck check (publication_allowed = false),
  constraint sp_m1b_gold_qualification_runtime_ck check (runtime_promotion_allowed = false),
  constraint sp_m1b_gold_qualification_detail_ck check (jsonb_typeof(qualification_detail) = 'object')
);

create table if not exists public.sp_m1b_benchmark_gold_batch_v1 (
  id uuid primary key default gen_random_uuid(),
  staging_batch_id uuid not null references public.sp_m1b_gold_staging_batch_v1(id) on delete restrict,
  qualification_id uuid not null references public.sp_m1b_gold_qualification_v1(id) on delete restrict,
  source_batch_sha256 text not null,
  source_evidence_revision text not null,
  split text not null,
  reviewer_id_sha256 text not null,
  reviewed_at timestamptz not null,
  item_count integer not null,
  blocked_candidate_ids jsonb not null default '[]'::jsonb,
  promotion_status text not null default 'PROMOTED_TO_BENCHMARK_GOLD',
  gold_status text not null default 'BENCHMARK_GOLD',
  publication_allowed boolean not null default false,
  runtime_promotion_allowed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint sp_m1b_benchmark_gold_batch_staging_uq unique (staging_batch_id),
  constraint sp_m1b_benchmark_gold_batch_qualification_uq unique (qualification_id),
  constraint sp_m1b_benchmark_gold_batch_sha_uq unique (source_batch_sha256),
  constraint sp_m1b_benchmark_gold_batch_split_ck check (split = 'DEV'),
  constraint sp_m1b_benchmark_gold_batch_hash_ck check (source_batch_sha256 ~ '^[0-9a-f]{64}$' and reviewer_id_sha256 ~ '^[0-9a-f]{64}$'),
  constraint sp_m1b_benchmark_gold_batch_revision_ck check (source_evidence_revision ~ '^[0-9a-f]{40}$'),
  constraint sp_m1b_benchmark_gold_batch_count_ck check (item_count > 0),
  constraint sp_m1b_benchmark_gold_batch_blocked_ck check (jsonb_typeof(blocked_candidate_ids) = 'array'),
  constraint sp_m1b_benchmark_gold_batch_status_ck check (promotion_status = 'PROMOTED_TO_BENCHMARK_GOLD'),
  constraint sp_m1b_benchmark_gold_batch_gold_ck check (gold_status = 'BENCHMARK_GOLD'),
  constraint sp_m1b_benchmark_gold_batch_publication_ck check (publication_allowed = false),
  constraint sp_m1b_benchmark_gold_batch_runtime_ck check (runtime_promotion_allowed = false)
);

create table if not exists public.sp_m1b_benchmark_gold_item_v1 (
  id uuid primary key default gen_random_uuid(),
  benchmark_gold_batch_id uuid not null references public.sp_m1b_benchmark_gold_batch_v1(id) on delete restrict,
  source_staging_item_id uuid not null references public.sp_m1b_gold_staging_item_v1(id) on delete restrict,
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
  source_candidate_snapshot_sha256 text not null,
  gold_status text not null default 'BENCHMARK_GOLD',
  publication_allowed boolean not null default false,
  runtime_promotion_allowed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint sp_m1b_benchmark_gold_item_source_uq unique (source_staging_item_id),
  constraint sp_m1b_benchmark_gold_item_candidate_uq unique (benchmark_gold_batch_id, candidate_id),
  constraint sp_m1b_benchmark_gold_item_slot_uq unique (benchmark_gold_batch_id, benchmark_slot_id),
  constraint sp_m1b_benchmark_gold_item_fingerprint_uq unique (benchmark_gold_batch_id, product_fingerprint),
  constraint sp_m1b_benchmark_gold_item_product_ck check (length(btrim(candidate_product_name)) > 0),
  constraint sp_m1b_benchmark_gold_item_identity_ck check (length(btrim(identity_summary)) > 0 and product_fingerprint ~ '^spfp:v1:[0-9a-f]+$'),
  constraint sp_m1b_benchmark_gold_item_declaration_ck check (length(btrim(ingredient_declaration)) > 0 and ingredient_count > 0),
  constraint sp_m1b_benchmark_gold_item_sources_ck check (
    jsonb_typeof(identity_source_urls) = 'array'
    and jsonb_typeof(evidence_sources) = 'array'
    and jsonb_array_length(evidence_sources) > 0
    and jsonb_typeof(rejected_evidence) = 'array'
  ),
  constraint sp_m1b_benchmark_gold_item_snapshot_ck check (source_candidate_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  constraint sp_m1b_benchmark_gold_item_gold_ck check (gold_status = 'BENCHMARK_GOLD'),
  constraint sp_m1b_benchmark_gold_item_publication_ck check (publication_allowed = false),
  constraint sp_m1b_benchmark_gold_item_runtime_ck check (runtime_promotion_allowed = false)
);

alter table public.sp_m1b_gold_qualification_v1 enable row level security;
alter table public.sp_m1b_benchmark_gold_batch_v1 enable row level security;
alter table public.sp_m1b_benchmark_gold_item_v1 enable row level security;

revoke all on table public.sp_m1b_gold_qualification_v1 from public, anon, authenticated;
revoke all on table public.sp_m1b_benchmark_gold_batch_v1 from public, anon, authenticated;
revoke all on table public.sp_m1b_benchmark_gold_item_v1 from public, anon, authenticated;

grant select on table public.sp_m1b_gold_qualification_v1 to service_role;
grant select on table public.sp_m1b_benchmark_gold_batch_v1 to service_role;
grant select on table public.sp_m1b_benchmark_gold_item_v1 to service_role;

create or replace function public.sp_m1b_qualify_benchmark_gold_v1(p_staging_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $$
declare
  v_batch public.sp_m1b_gold_staging_batch_v1%rowtype;
  v_item_count integer;
  v_distinct_candidates integer;
  v_distinct_slots integer;
  v_distinct_fingerprints integer;
  v_blocked_count integer;
  v_blocked_overlap integer;
  v_rejected_evidence_item_count integer;
  v_rejected_evidence_entry_count integer;
  v_source_evidence_revision text;
  v_qualification_id uuid;
  v_existing public.sp_m1b_gold_qualification_v1%rowtype;
  v_detail jsonb;
begin
  select * into v_batch
  from public.sp_m1b_gold_staging_batch_v1
  where id = p_staging_batch_id
  for share;

  if not found then
    raise exception using errcode = 'P0002', message = 'STAGING_BATCH_NOT_FOUND';
  end if;

  if v_batch.split <> 'DEV'
     or v_batch.stage_status <> 'STAGED_NOT_PROMOTED'
     or v_batch.gold_status <> 'UNASSIGNED'
     or v_batch.promotion_allowed <> false
     or v_batch.human_adjudication_complete <> true then
    raise exception using errcode = '23514', message = 'STAGING_BATCH_STATE_INVALID';
  end if;

  if coalesce(v_batch.payload_metadata->>'approval_scope', '') <> 'ALL_REVIEWABLE_PACKETS_IN_FROZEN_DEV_SNAPSHOT'
     or coalesce(v_batch.payload_metadata->>'approved_count', '') !~ '^[1-9][0-9]*$'
     or (v_batch.payload_metadata->>'approved_count')::integer <> v_batch.item_count
     or coalesce(v_batch.payload_metadata->>'blocked_count', '') !~ '^[0-9]+$'
     or coalesce(v_batch.payload_metadata->>'final_approval_confirmed', '') <> 'true'
     or coalesce(v_batch.payload_metadata->>'source_evidence_revision', '') !~ '^[0-9a-f]{40}$' then
    raise exception using errcode = '23514', message = 'STAGING_METADATA_INVALID';
  end if;

  v_source_evidence_revision := v_batch.payload_metadata->>'source_evidence_revision';
  v_blocked_count := jsonb_array_length(v_batch.blocked_candidate_ids);
  if v_blocked_count <> (v_batch.payload_metadata->>'blocked_count')::integer then
    raise exception using errcode = '23514', message = 'STAGING_BLOCKED_COUNT_MISMATCH';
  end if;

  select
    count(*)::integer,
    count(distinct candidate_id)::integer,
    count(distinct benchmark_slot_id)::integer,
    count(distinct product_fingerprint)::integer,
    count(*) filter (where jsonb_array_length(rejected_evidence) > 0)::integer,
    coalesce(sum(jsonb_array_length(rejected_evidence)), 0)::integer
  into
    v_item_count,
    v_distinct_candidates,
    v_distinct_slots,
    v_distinct_fingerprints,
    v_rejected_evidence_item_count,
    v_rejected_evidence_entry_count
  from public.sp_m1b_gold_staging_item_v1
  where batch_id = p_staging_batch_id;

  if v_item_count <> v_batch.item_count then
    raise exception using errcode = '23514', message = 'STAGING_ITEM_COUNT_MISMATCH';
  end if;
  if v_distinct_candidates <> v_item_count then
    raise exception using errcode = '23514', message = 'STAGING_DUPLICATE_CANDIDATE';
  end if;
  if v_distinct_slots <> v_item_count then
    raise exception using errcode = '23514', message = 'STAGING_DUPLICATE_SLOT';
  end if;
  if v_distinct_fingerprints <> v_item_count then
    raise exception using errcode = '23514', message = 'STAGING_DUPLICATE_FINGERPRINT';
  end if;

  select count(*)::integer into v_blocked_overlap
  from public.sp_m1b_gold_staging_item_v1 i
  join jsonb_array_elements_text(v_batch.blocked_candidate_ids) b(candidate_id)
    on i.candidate_id = b.candidate_id
  where i.batch_id = p_staging_batch_id;

  if v_blocked_overlap <> 0 then
    raise exception using errcode = '23514', message = 'BLOCKED_CANDIDATE_STAGED';
  end if;

  if exists (
    select 1
    from public.sp_m1b_gold_staging_item_v1 i
    where i.batch_id = p_staging_batch_id
      and (
        i.identity_decision <> 'APPROVE'
        or i.ingredient_declaration_decision <> 'APPROVE'
        or i.decision_status <> 'HUMAN_APPROVED_FOR_GOLD_STAGING'
        or i.stage_status <> 'STAGED_NOT_PROMOTED'
        or i.gold_status <> 'UNASSIGNED'
        or i.promotion_allowed <> false
      )
  ) then
    raise exception using errcode = '23514', message = 'STAGING_HUMAN_APPROVAL_INVALID';
  end if;

  if exists (
    select 1
    from public.sp_m1b_gold_staging_item_v1 i
    where i.batch_id = p_staging_batch_id
      and (
        length(btrim(i.candidate_id)) = 0
        or length(btrim(i.benchmark_slot_id)) = 0
        or length(btrim(i.benchmark_category)) = 0
        or length(btrim(i.candidate_product_name)) = 0
        or length(btrim(i.identity_summary)) = 0
        or i.product_fingerprint !~ '^spfp:v1:[0-9a-f]+$'
        or length(btrim(i.ingredient_declaration)) = 0
        or i.ingredient_count <= 0
        or jsonb_typeof(i.identity_source_urls) <> 'array'
        or jsonb_typeof(i.evidence_sources) <> 'array'
        or jsonb_array_length(i.evidence_sources) = 0
        or jsonb_typeof(i.rejected_evidence) <> 'array'
        or i.candidate_snapshot_sha256 !~ '^[0-9a-f]{64}$'
      )
  ) then
    raise exception using errcode = '23514', message = 'STAGING_EVIDENCE_INVALID';
  end if;

  v_detail := jsonb_build_object(
    'staging_batch_sha256', v_batch.batch_sha256,
    'source_evidence_revision', v_source_evidence_revision,
    'qualified_item_count', v_item_count,
    'blocked_count', v_blocked_count,
    'blocked_overlap_count', v_blocked_overlap,
    'distinct_candidates', v_distinct_candidates,
    'distinct_slots', v_distinct_slots,
    'distinct_fingerprints', v_distinct_fingerprints,
    'rejected_evidence_item_count', v_rejected_evidence_item_count,
    'rejected_evidence_entry_count', v_rejected_evidence_entry_count,
    'human_adjudication_complete', true,
    'publication_allowed', false,
    'runtime_promotion_allowed', false
  );

  select * into v_existing
  from public.sp_m1b_gold_qualification_v1
  where staging_batch_id = p_staging_batch_id;

  if found then
    if v_existing.staging_batch_sha256 <> v_batch.batch_sha256
       or v_existing.source_evidence_revision <> v_source_evidence_revision
       or v_existing.qualified_item_count <> v_item_count
       or v_existing.blocked_count <> v_blocked_count
       or v_existing.qualification_status <> 'QUALIFIED_FOR_BENCHMARK_GOLD' then
      raise exception using errcode = '23514', message = 'QUALIFICATION_IDEMPOTENCY_MISMATCH';
    end if;
    return jsonb_build_object(
      'success', true,
      'inserted', false,
      'qualification_id', v_existing.id,
      'staging_batch_id', p_staging_batch_id,
      'qualification_status', v_existing.qualification_status,
      'qualified_item_count', v_item_count,
      'blocked_count', v_blocked_count,
      'publication_allowed', false,
      'runtime_promotion_allowed', false,
      'detail', v_detail
    );
  end if;

  insert into public.sp_m1b_gold_qualification_v1 (
    staging_batch_id,
    staging_batch_sha256,
    source_evidence_revision,
    qualified_item_count,
    blocked_count,
    rejected_evidence_item_count,
    qualification_status,
    publication_allowed,
    runtime_promotion_allowed,
    qualification_detail
  ) values (
    p_staging_batch_id,
    v_batch.batch_sha256,
    v_source_evidence_revision,
    v_item_count,
    v_blocked_count,
    v_rejected_evidence_item_count,
    'QUALIFIED_FOR_BENCHMARK_GOLD',
    false,
    false,
    v_detail
  ) returning id into v_qualification_id;

  return jsonb_build_object(
    'success', true,
    'inserted', true,
    'qualification_id', v_qualification_id,
    'staging_batch_id', p_staging_batch_id,
    'qualification_status', 'QUALIFIED_FOR_BENCHMARK_GOLD',
    'qualified_item_count', v_item_count,
    'blocked_count', v_blocked_count,
    'publication_allowed', false,
    'runtime_promotion_allowed', false,
    'detail', v_detail
  );
end;
$$;

create or replace function public.sp_m1b_promote_benchmark_gold_v1(p_staging_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $$
declare
  v_requalification jsonb;
  v_batch public.sp_m1b_gold_staging_batch_v1%rowtype;
  v_qualification public.sp_m1b_gold_qualification_v1%rowtype;
  v_existing public.sp_m1b_benchmark_gold_batch_v1%rowtype;
  v_gold_batch_id uuid;
  v_inserted_item_count integer;
begin
  v_requalification := public.sp_m1b_qualify_benchmark_gold_v1(p_staging_batch_id);

  select * into v_qualification
  from public.sp_m1b_gold_qualification_v1
  where staging_batch_id = p_staging_batch_id
    and qualification_status = 'QUALIFIED_FOR_BENCHMARK_GOLD';

  if not found then
    raise exception using errcode = '23514', message = 'GOLD_QUALIFICATION_REQUIRED';
  end if;

  select * into v_batch
  from public.sp_m1b_gold_staging_batch_v1
  where id = p_staging_batch_id
  for share;

  if not found
     or v_batch.batch_sha256 <> v_qualification.staging_batch_sha256
     or (v_batch.payload_metadata->>'source_evidence_revision') <> v_qualification.source_evidence_revision
     or v_batch.item_count <> v_qualification.qualified_item_count then
    raise exception using errcode = '23514', message = 'GOLD_QUALIFICATION_REQUIRED';
  end if;

  select * into v_existing
  from public.sp_m1b_benchmark_gold_batch_v1
  where staging_batch_id = p_staging_batch_id;

  if found then
    if (select count(*) from public.sp_m1b_benchmark_gold_item_v1 where benchmark_gold_batch_id = v_existing.id) <> v_existing.item_count then
      raise exception using errcode = '23514', message = 'BENCHMARK_GOLD_IDEMPOTENCY_MISMATCH';
    end if;
    return jsonb_build_object(
      'success', true,
      'inserted', false,
      'benchmark_gold_batch_id', v_existing.id,
      'staging_batch_id', p_staging_batch_id,
      'qualification_id', v_existing.qualification_id,
      'item_count', v_existing.item_count,
      'gold_status', 'BENCHMARK_GOLD',
      'publication_allowed', false,
      'runtime_promotion_allowed', false
    );
  end if;

  insert into public.sp_m1b_benchmark_gold_batch_v1 (
    staging_batch_id,
    qualification_id,
    source_batch_sha256,
    source_evidence_revision,
    split,
    reviewer_id_sha256,
    reviewed_at,
    item_count,
    blocked_candidate_ids,
    promotion_status,
    gold_status,
    publication_allowed,
    runtime_promotion_allowed
  ) values (
    v_batch.id,
    v_qualification.id,
    v_batch.batch_sha256,
    v_qualification.source_evidence_revision,
    v_batch.split,
    v_batch.reviewer_id_sha256,
    v_batch.reviewed_at,
    v_batch.item_count,
    v_batch.blocked_candidate_ids,
    'PROMOTED_TO_BENCHMARK_GOLD',
    'BENCHMARK_GOLD',
    false,
    false
  ) returning id into v_gold_batch_id;

  insert into public.sp_m1b_benchmark_gold_item_v1 (
    benchmark_gold_batch_id,
    source_staging_item_id,
    candidate_id,
    benchmark_slot_id,
    benchmark_category,
    candidate_brand_name,
    candidate_product_name,
    identity_summary,
    product_fingerprint,
    ingredient_declaration,
    ingredient_count,
    identity_source_urls,
    evidence_sources,
    rejected_evidence,
    source_candidate_snapshot_sha256,
    gold_status,
    publication_allowed,
    runtime_promotion_allowed
  )
  select
    v_gold_batch_id,
    i.id,
    i.candidate_id,
    i.benchmark_slot_id,
    i.benchmark_category,
    i.candidate_brand_name,
    i.candidate_product_name,
    i.identity_summary,
    i.product_fingerprint,
    i.ingredient_declaration,
    i.ingredient_count,
    i.identity_source_urls,
    i.evidence_sources,
    i.rejected_evidence,
    i.candidate_snapshot_sha256,
    'BENCHMARK_GOLD',
    false,
    false
  from public.sp_m1b_gold_staging_item_v1 i
  where i.batch_id = p_staging_batch_id
  order by i.benchmark_slot_id;

  get diagnostics v_inserted_item_count = row_count;
  if v_inserted_item_count <> v_qualification.qualified_item_count then
    raise exception using errcode = '23514', message = 'BENCHMARK_GOLD_ITEM_COUNT_MISMATCH';
  end if;

  return jsonb_build_object(
    'success', true,
    'inserted', true,
    'benchmark_gold_batch_id', v_gold_batch_id,
    'staging_batch_id', p_staging_batch_id,
    'qualification_id', v_qualification.id,
    'item_count', v_inserted_item_count,
    'gold_status', 'BENCHMARK_GOLD',
    'publication_allowed', false,
    'runtime_promotion_allowed', false
  );
end;
$$;

revoke execute on function public.sp_m1b_qualify_benchmark_gold_v1(uuid) from public, anon, authenticated;
grant execute on function public.sp_m1b_qualify_benchmark_gold_v1(uuid) to service_role;

revoke execute on function public.sp_m1b_promote_benchmark_gold_v1(uuid) from public, anon, authenticated;
grant execute on function public.sp_m1b_promote_benchmark_gold_v1(uuid) to service_role;
