-- SafeProducts official-domain Admin review + periodic commerce refresh v1

create or replace function public.sp_catalog_domain_candidate_review_v1()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public','pg_temp'
as $$
declare v_product_id uuid;
begin
  if new.status='CANDIDATE' and (tg_op='INSERT' or old.status is distinct from new.status or old.official_base_url is distinct from new.official_base_url) then
    select p.id into v_product_id
    from public.sp_catalog_product_v1 p
    where p.brand_id=new.brand_id and p.is_active=true
    order by case when p.source_origin='USER_LABEL' then 0 else 1 end,p.updated_at desc
    limit 1;

    if not exists(
      select 1 from public.sp_catalog_review_queue_v1 r
      where r.review_type='OFFICIAL_DOMAIN' and r.status in ('OPEN','IN_REVIEW')
        and r.source_context->>'domain_id'=new.id::text
    ) then
      insert into public.sp_catalog_review_queue_v1(product_id,review_type,severity,title,detail,source_context)
      values(
        v_product_id,'OFFICIAL_DOMAIN','NORMAL','Verify official brand domain',
        'Automatic discovery found a likely official brand domain. Admin should verify or reject it before the domain is treated as authoritative.',
        jsonb_build_object('domain_id',new.id,'brand_id',new.brand_id,'domain_host',new.domain_host,'official_base_url',new.official_base_url,'verification_source_url',new.verification_source_url,'supports_shopify',new.supports_shopify,'automatic_verification',false)
      );
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.sp_catalog_domain_candidate_review_v1() from public,anon,authenticated;

drop trigger if exists sp_catalog_domain_candidate_review_v1 on public.sp_catalog_brand_domain_v1;
create trigger sp_catalog_domain_candidate_review_v1
after insert or update on public.sp_catalog_brand_domain_v1
for each row execute function public.sp_catalog_domain_candidate_review_v1();

do $$ declare d record; v_product_id uuid; begin
  for d in select * from public.sp_catalog_brand_domain_v1 where status='CANDIDATE' loop
    select p.id into v_product_id from public.sp_catalog_product_v1 p where p.brand_id=d.brand_id and p.is_active=true order by case when p.source_origin='USER_LABEL' then 0 else 1 end,p.updated_at desc limit 1;
    if not exists(select 1 from public.sp_catalog_review_queue_v1 r where r.review_type='OFFICIAL_DOMAIN' and r.status in ('OPEN','IN_REVIEW') and r.source_context->>'domain_id'=d.id::text) then
      insert into public.sp_catalog_review_queue_v1(product_id,review_type,severity,title,detail,source_context)
      values(v_product_id,'OFFICIAL_DOMAIN','NORMAL','Verify official brand domain','Automatic discovery found a likely official brand domain. Admin should verify or reject it before the domain is treated as authoritative.',jsonb_build_object('domain_id',d.id,'brand_id',d.brand_id,'domain_host',d.domain_host,'official_base_url',d.official_base_url,'verification_source_url',d.verification_source_url,'supports_shopify',d.supports_shopify,'automatic_verification',false));
    end if;
  end loop;
end $$;

create or replace function public.sp_catalog_refresh_due_web_enrichment_v1(p_stale_hours integer default 12)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','pg_temp'
as $$
declare v_hours int:=least(greatest(coalesce(p_stale_hours,12),1),168); v_count int:=0;
begin
  with due as (
    select q.id
    from public.sp_catalog_enrichment_queue_v1 q
    join public.sp_catalog_product_v1 p on p.id=q.product_id and p.is_active=true
    where q.task_type='CATALOG_WEB_ENRICHMENT' and q.status='COMPLETED'
      and (
        not exists(select 1 from public.sp_catalog_commerce_offer_v1 o where o.product_id=p.id and o.verified=true and o.price is not null and o.retrieved_at>now()-make_interval(hours=>v_hours))
        or not exists(select 1 from public.sp_catalog_brand_domain_v1 d where d.brand_id=p.brand_id and d.status in ('CANDIDATE','VERIFIED'))
        or not exists(select 1 from public.sp_catalog_product_image_v1 i where i.product_id=p.id and i.is_primary_display=true and i.verified=true and i.image_url is not null)
      )
  ), u as (
    update public.sp_catalog_enrichment_queue_v1 q
       set status='RETRY',attempt_count=case when q.attempt_count>=q.max_attempts then 0 else q.attempt_count end,
           next_attempt_at=now(),locked_at=null,worker_code=null,last_error_code='CATALOG_REFRESH_DUE',
           last_error_detail='Periodic catalog enrichment refresh due or a catalog component remains incomplete.',updated_at=now()
      from due where q.id=due.id
    returning q.id
  ) select count(*) into v_count from u;
  return jsonb_build_object('success',true,'requeued',v_count,'stale_hours',v_hours);
end;
$$;
revoke all on function public.sp_catalog_refresh_due_web_enrichment_v1(integer) from public,anon,authenticated;
grant execute on function public.sp_catalog_refresh_due_web_enrichment_v1(integer) to service_role;

select cron.unschedule(jobid) from cron.job where jobname='sp_catalog_web_enrichment_refresh_v1';
select cron.schedule('sp_catalog_web_enrichment_refresh_v1','17 * * * *',$$select public.sp_catalog_refresh_due_web_enrichment_v1(12);$$);
