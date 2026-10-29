-- SafeProducts M1-B runtime performance hotfix v1
-- Scope: M1-B/M1-BR tables only. No product, safety, homepage, or rollout behavior changes.

create index if not exists sp_m1br_recovery_queue_v1_product_idx
  on public.sp_m1br_recovery_queue_v1(product_id, created_at desc);

-- Supabase/PostgREST performance guidance: wrap auth helpers in scalar SELECTs
-- so they are initialized once per statement instead of once per row.

drop policy if exists sp_m1b_run_admin_read_v1 on public.sp_m1b_run_v1;
create policy sp_m1b_run_admin_read_v1
  on public.sp_m1b_run_v1
  for select
  to authenticated
  using (
    coalesce((((select auth.jwt()) ->> 'is_anonymous'))::boolean, false) = false
    and public.sp_web_has_role_v1((select auth.uid()), 'admin'::public.sp_web_app_role_v1)
  );

drop policy if exists sp_m1b_attempt_admin_read_v1 on public.sp_m1b_engine_attempt_v1;
create policy sp_m1b_attempt_admin_read_v1
  on public.sp_m1b_engine_attempt_v1
  for select
  to authenticated
  using (
    coalesce((((select auth.jwt()) ->> 'is_anonymous'))::boolean, false) = false
    and public.sp_web_has_role_v1((select auth.uid()), 'admin'::public.sp_web_app_role_v1)
  );

drop policy if exists sp_m1br_queue_admin_read_v1 on public.sp_m1br_recovery_queue_v1;
create policy sp_m1br_queue_admin_read_v1
  on public.sp_m1br_recovery_queue_v1
  for select
  to authenticated
  using (
    coalesce((((select auth.jwt()) ->> 'is_anonymous'))::boolean, false) = false
    and public.sp_web_has_role_v1((select auth.uid()), 'admin'::public.sp_web_app_role_v1)
  );
