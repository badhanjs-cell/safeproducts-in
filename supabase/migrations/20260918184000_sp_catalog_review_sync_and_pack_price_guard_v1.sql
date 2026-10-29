-- SafeProducts Admin review synchronization + exact-pack price guard v1

create or replace function public.sp_catalog_sync_product_review_flag_v1()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public','pg_temp'
as $$
declare v_product_id uuid;
begin
  v_product_id:=coalesce(case when tg_op<>'DELETE' then new.product_id else null end,case when tg_op<>'INSERT' then old.product_id else null end);
  if v_product_id is not null then
    update public.sp_catalog_pipeline_state_v1 ps
       set admin_review_required=exists(select 1 from public.sp_catalog_review_queue_v1 r where r.product_id=v_product_id and r.status in ('OPEN','IN_REVIEW')),
           updated_at=now()
     where ps.product_id=v_product_id;
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function public.sp_catalog_sync_product_review_flag_v1() from public,anon,authenticated;

drop trigger if exists sp_catalog_sync_product_review_flag_v1 on public.sp_catalog_review_queue_v1;
create trigger sp_catalog_sync_product_review_flag_v1
after insert or update or delete on public.sp_catalog_review_queue_v1
for each row execute function public.sp_catalog_sync_product_review_flag_v1();

create or replace function public.sp_catalog_commerce_pack_guard_v1()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public','pg_temp'
as $$
declare v_pack text;
begin
  select nullif(btrim(pack_size_text),'') into v_pack from public.sp_catalog_product_v1 where id=new.product_id;
  if new.verified=true and new.price is not null and v_pack is null then
    new.verified:=false;
    new.availability_status:='UNKNOWN';
    new.notes:=left(concat_ws(' ',new.notes,'Consumer price verification withheld because the exact product pack size is not yet known.'),4000);
  end if;
  return new;
end;
$$;
revoke all on function public.sp_catalog_commerce_pack_guard_v1() from public,anon,authenticated;

drop trigger if exists sp_catalog_commerce_pack_guard_v1 on public.sp_catalog_commerce_offer_v1;
create trigger sp_catalog_commerce_pack_guard_v1
before insert or update on public.sp_catalog_commerce_offer_v1
for each row execute function public.sp_catalog_commerce_pack_guard_v1();

create or replace function public.sp_catalog_commerce_pack_review_v1()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public','pg_temp'
as $$
declare v_pack text;
begin
  select nullif(btrim(pack_size_text),'') into v_pack from public.sp_catalog_product_v1 where id=new.product_id;
  if new.price is not null and v_pack is null and not exists(
    select 1 from public.sp_catalog_review_queue_v1 r
    where r.product_id=new.product_id and r.review_type='PRODUCT_IDENTITY' and r.status in ('OPEN','IN_REVIEW')
      and r.source_context->>'reason'='PACK_SIZE_REQUIRED_FOR_COMMERCE'
  ) then
    insert into public.sp_catalog_review_queue_v1(product_id,review_type,severity,title,detail,source_context)
    values(new.product_id,'PRODUCT_IDENTITY','NORMAL','Confirm pack size for price matching','Marketplace/merchant prices were found, but SafeProducts cannot publish an exact consumer price until the product pack size from the label is confirmed.',jsonb_build_object('reason','PACK_SIZE_REQUIRED_FOR_COMMERCE','automatic',true));
  end if;
  return new;
end;
$$;
revoke all on function public.sp_catalog_commerce_pack_review_v1() from public,anon,authenticated;

drop trigger if exists sp_catalog_commerce_pack_review_v1 on public.sp_catalog_commerce_offer_v1;
create trigger sp_catalog_commerce_pack_review_v1
after insert or update on public.sp_catalog_commerce_offer_v1
for each row execute function public.sp_catalog_commerce_pack_review_v1();

create or replace function public.sp_catalog_product_pack_resolution_v1()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public','pg_temp'
as $$
begin
  if nullif(btrim(new.pack_size_text),'') is not null and nullif(btrim(old.pack_size_text),'') is distinct from nullif(btrim(new.pack_size_text),'') then
    update public.sp_catalog_review_queue_v1
       set status='RESOLVED',resolved_at=now(),resolution_notes='Pack size supplied; commerce enrichment automatically re-queued for exact-price matching.',updated_at=now()
     where product_id=new.id and review_type='PRODUCT_IDENTITY' and status in ('OPEN','IN_REVIEW')
       and source_context->>'reason'='PACK_SIZE_REQUIRED_FOR_COMMERCE';

    update public.sp_catalog_enrichment_queue_v1
       set status='RETRY',attempt_count=0,next_attempt_at=now(),locked_at=null,worker_code=null,last_error_code='PACK_SIZE_CONFIRMED',last_error_detail='Pack size confirmed; refresh exact product price and public image.',updated_at=now()
     where product_id=new.id and task_type='CATALOG_WEB_ENRICHMENT' and status in ('COMPLETED','ADMIN_REVIEW','FAILED','RETRY','PENDING');
  end if;
  return new;
end;
$$;
revoke all on function public.sp_catalog_product_pack_resolution_v1() from public,anon,authenticated;

drop trigger if exists sp_catalog_product_pack_resolution_v1 on public.sp_catalog_product_v1;
create trigger sp_catalog_product_pack_resolution_v1
after update of pack_size_text on public.sp_catalog_product_v1
for each row execute function public.sp_catalog_product_pack_resolution_v1();

update public.sp_catalog_commerce_offer_v1 o
   set verified=false,availability_status='UNKNOWN',notes=left(concat_ws(' ',o.notes,'Consumer price verification withheld because the exact product pack size is not yet known.'),4000),updated_at=now()
  from public.sp_catalog_product_v1 p
 where p.id=o.product_id and nullif(btrim(p.pack_size_text),'') is null and o.verified=true;

insert into public.sp_catalog_review_queue_v1(product_id,review_type,severity,title,detail,source_context)
select distinct p.id,'PRODUCT_IDENTITY','NORMAL','Confirm pack size for price matching','Marketplace/merchant prices were found, but SafeProducts cannot publish an exact consumer price until the product pack size from the label is confirmed.',jsonb_build_object('reason','PACK_SIZE_REQUIRED_FOR_COMMERCE','automatic',true)
from public.sp_catalog_product_v1 p
where nullif(btrim(p.pack_size_text),'') is null
  and exists(select 1 from public.sp_catalog_commerce_offer_v1 o where o.product_id=p.id and o.price is not null)
  and not exists(select 1 from public.sp_catalog_review_queue_v1 r where r.product_id=p.id and r.review_type='PRODUCT_IDENTITY' and r.status in ('OPEN','IN_REVIEW') and r.source_context->>'reason'='PACK_SIZE_REQUIRED_FOR_COMMERCE');

update public.sp_catalog_pipeline_state_v1 ps
set admin_review_required=exists(select 1 from public.sp_catalog_review_queue_v1 r where r.product_id=ps.product_id and r.status in ('OPEN','IN_REVIEW')),
    commerce_stage=case when exists(select 1 from public.sp_catalog_commerce_offer_v1 o where o.product_id=ps.product_id and o.verified=true and o.price is not null) then 'READY'
                        when exists(select 1 from public.sp_catalog_commerce_offer_v1 o where o.product_id=ps.product_id and o.price is not null) then 'CANDIDATE_FOUND'
                        else ps.commerce_stage end,
    updated_at=now();
