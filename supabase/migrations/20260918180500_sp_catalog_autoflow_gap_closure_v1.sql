-- SafeProducts catalog + GRIL autonomous gap closure v1
-- Additive only. No frontend changes. Automatic legal publication remains disabled.

create extension if not exists pg_net with schema extensions;
create schema if not exists sp_internal;
revoke all on schema sp_internal from public, anon, authenticated;

create table if not exists public.sp_catalog_enrichment_queue_v1 (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.sp_catalog_product_v1(id) on delete cascade,
  task_type text not null check (task_type in ('CATALOG_WEB_ENRICHMENT','SAFETY_REASSESSMENT')),
  status text not null default 'PENDING' check (status in ('PENDING','IN_PROGRESS','RETRY','COMPLETED','FAILED','ADMIN_REVIEW')),
  priority text not null default 'NORMAL' check (priority in ('LOW','NORMAL','HIGH','CRITICAL')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 4 check (max_attempts between 1 and 20),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  worker_code text,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  last_error_code text,
  last_error_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sp_catalog_enrichment_queue_v1_ready_idx on public.sp_catalog_enrichment_queue_v1(status,next_attempt_at,priority,created_at);
create index if not exists sp_catalog_enrichment_queue_v1_product_idx on public.sp_catalog_enrichment_queue_v1(product_id,task_type,status);
create unique index if not exists sp_catalog_enrichment_queue_v1_active_uq on public.sp_catalog_enrichment_queue_v1(product_id,task_type) where status in ('PENDING','IN_PROGRESS','RETRY');
alter table public.sp_catalog_enrichment_queue_v1 enable row level security;
drop policy if exists sp_catalog_admin_all_v1 on public.sp_catalog_enrichment_queue_v1;
create policy sp_catalog_admin_all_v1 on public.sp_catalog_enrichment_queue_v1 for all to authenticated
using (coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false and public.sp_web_has_role_v1(auth.uid(),'admin'::public.sp_web_app_role_v1))
with check (coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false and public.sp_web_has_role_v1(auth.uid(),'admin'::public.sp_web_app_role_v1));

create table if not exists public.sp_regulatory_research_evidence_v1 (
  id uuid primary key default gen_random_uuid(),
  queue_id bigint not null references public.regulatory_knowledge_queue(id) on delete cascade,
  normalized_canonical_name text not null,
  authority text,
  jurisdiction text,
  source_url text not null check (source_url ~ '^https://'),
  source_title text,
  evidence_summary text,
  legal_force text,
  publication_date date,
  source_sha256 text not null,
  machine_confidence numeric check (machine_confidence between 0 and 100),
  evidence_status text not null default 'CANDIDATE' check (evidence_status in ('CANDIDATE','REVIEWED','REJECTED','PROMOTED')),
  worker_version text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  retrieved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists sp_regulatory_research_evidence_v1_source_uq on public.sp_regulatory_research_evidence_v1(queue_id,source_sha256);
create index if not exists sp_regulatory_research_evidence_v1_queue_idx on public.sp_regulatory_research_evidence_v1(queue_id,evidence_status,retrieved_at desc);
alter table public.sp_regulatory_research_evidence_v1 enable row level security;
drop policy if exists sp_regulatory_research_evidence_admin_v1 on public.sp_regulatory_research_evidence_v1;
create policy sp_regulatory_research_evidence_admin_v1 on public.sp_regulatory_research_evidence_v1 for all to authenticated
using (coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false and public.sp_web_has_role_v1(auth.uid(),'admin'::public.sp_web_app_role_v1))
with check (coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false and public.sp_web_has_role_v1(auth.uid(),'admin'::public.sp_web_app_role_v1));

drop trigger if exists sp_catalog_enrichment_queue_audit_v1 on public.sp_catalog_enrichment_queue_v1;
create trigger sp_catalog_enrichment_queue_audit_v1 after insert or update or delete on public.sp_catalog_enrichment_queue_v1 for each row execute function public.sp_catalog_audit_row_v1();
drop trigger if exists sp_regulatory_research_evidence_audit_v1 on public.sp_regulatory_research_evidence_v1;
create trigger sp_regulatory_research_evidence_audit_v1 after insert or update or delete on public.sp_regulatory_research_evidence_v1 for each row execute function public.sp_catalog_audit_row_v1();

create table if not exists sp_internal.worker_secret_v1(worker_code text primary key,token text not null,created_at timestamptz not null default now());
revoke all on sp_internal.worker_secret_v1 from public,anon,authenticated;
insert into sp_internal.worker_secret_v1(worker_code,token) values
('CATALOG_WEB_ENRICHMENT',encode(extensions.gen_random_bytes(32),'hex')),
('REGULATORY_WEB_RESEARCH',encode(extensions.gen_random_bytes(32),'hex')) on conflict(worker_code) do nothing;

create or replace function public.sp_internal_worker_token_valid_v1(p_worker_code text,p_token text) returns boolean language sql stable security definer set search_path='pg_catalog','sp_internal','pg_temp' as $$
select exists(select 1 from sp_internal.worker_secret_v1 s where s.worker_code=p_worker_code and length(coalesce(p_token,''))>=32 and s.token=p_token);
$$;
revoke all on function public.sp_internal_worker_token_valid_v1(text,text) from public,anon,authenticated;
grant execute on function public.sp_internal_worker_token_valid_v1(text,text) to service_role;

create or replace function public.sp_catalog_enqueue_default_enrichment_v1(p_product_id uuid) returns jsonb language plpgsql security definer set search_path='pg_catalog','public','pg_temp' as $$
declare v_count int:=0;
begin
  if not exists(select 1 from public.sp_catalog_product_v1 where id=p_product_id and is_active=true) then return jsonb_build_object('success',false,'code','PRODUCT_NOT_FOUND'); end if;
  if not exists(select 1 from public.sp_catalog_enrichment_queue_v1 where product_id=p_product_id and task_type='CATALOG_WEB_ENRICHMENT' and status in ('PENDING','IN_PROGRESS','RETRY','COMPLETED')) then
    insert into public.sp_catalog_enrichment_queue_v1(product_id,task_type,status,priority,max_attempts,payload) values(p_product_id,'CATALOG_WEB_ENRICHMENT','PENDING','NORMAL',4,jsonb_build_object('source','CHECK_MY_LABEL_OR_CATALOG','automatic',true)); v_count:=v_count+1;
  end if;
  update public.sp_catalog_pipeline_state_v1 set domain_stage=case when domain_stage='PENDING' then 'QUEUED' else domain_stage end,commerce_stage=case when commerce_stage='PENDING' then 'QUEUED' else commerce_stage end,image_stage=case when image_stage in ('PENDING','EVIDENCE_CAPTURED') then 'ENRICHMENT_QUEUED' else image_stage end,updated_at=now() where product_id=p_product_id;
  return jsonb_build_object('success',true,'enqueued',v_count);
end;$$;
revoke all on function public.sp_catalog_enqueue_default_enrichment_v1(uuid) from public,anon,authenticated;
grant execute on function public.sp_catalog_enqueue_default_enrichment_v1(uuid) to service_role;

create or replace function public.sp_catalog_product_autoflow_trigger_v1() returns trigger language plpgsql security definer set search_path='pg_catalog','public','pg_temp' as $$ begin if new.source_origin='USER_LABEL' then perform public.sp_catalog_enqueue_default_enrichment_v1(new.id); end if; return new; end; $$;
revoke all on function public.sp_catalog_product_autoflow_trigger_v1() from public,anon,authenticated;
drop trigger if exists sp_catalog_product_autoflow_v1 on public.sp_catalog_product_v1;
create trigger sp_catalog_product_autoflow_v1 after insert on public.sp_catalog_product_v1 for each row execute function public.sp_catalog_product_autoflow_trigger_v1();

create or replace function public.sp_catalog_claim_enrichment_tasks_v1(p_worker_code text,p_task_types text[] default array['CATALOG_WEB_ENRICHMENT']::text[],p_limit integer default 2) returns jsonb language plpgsql security definer set search_path='pg_catalog','public','pg_temp' as $$
declare v_limit int:=least(greatest(coalesce(p_limit,2),1),10); v_rows jsonb;
begin
  update public.sp_catalog_enrichment_queue_v1 set status='RETRY',locked_at=null,worker_code=null,next_attempt_at=now(),last_error_code=coalesce(last_error_code,'STALE_WORKER_LOCK'),updated_at=now() where status='IN_PROGRESS' and locked_at<now()-interval '15 minutes';
  with picked as (select q.id from public.sp_catalog_enrichment_queue_v1 q where q.status in ('PENDING','RETRY') and q.next_attempt_at<=now() and q.task_type=any(p_task_types) order by case q.priority when 'CRITICAL' then 1 when 'HIGH' then 2 when 'NORMAL' then 3 else 4 end,q.created_at limit v_limit for update skip locked),
  claimed as (update public.sp_catalog_enrichment_queue_v1 q set status='IN_PROGRESS',attempt_count=q.attempt_count+1,locked_at=now(),worker_code=p_worker_code,updated_at=now() from picked where q.id=picked.id returning q.*)
  select coalesce(jsonb_agg(jsonb_build_object('task_id',c.id,'task_type',c.task_type,'attempt_count',c.attempt_count,'max_attempts',c.max_attempts,'payload',c.payload,'product_id',p.id,'brand_id',p.brand_id,'brand_name',p.brand_name,'product_name',p.product_name,'variant_name',p.variant_name,'pack_size_text',p.pack_size_text,'market_country_code',p.market_country_code,'category',p.category)),'[]'::jsonb) into v_rows from claimed c join public.sp_catalog_product_v1 p on p.id=c.product_id;
  return v_rows;
end;$$;
revoke all on function public.sp_catalog_claim_enrichment_tasks_v1(text,text[],integer) from public,anon,authenticated;
grant execute on function public.sp_catalog_claim_enrichment_tasks_v1(text,text[],integer) to service_role;

create or replace function public.sp_catalog_apply_web_enrichment_v1(p_task_id uuid,p_result jsonb) returns jsonb language plpgsql security definer set search_path='pg_catalog','public','pg_temp' as $$
declare v_task public.sp_catalog_enrichment_queue_v1%rowtype; v_product public.sp_catalog_product_v1%rowtype; v_domain jsonb; v_offer jsonb; v_image jsonb; v_host text; v_base text; v_conf numeric; v_verified boolean; v_domain_count int:=0; v_offer_count int:=0; v_image_count int:=0; v_existing uuid;
begin
  select * into v_task from public.sp_catalog_enrichment_queue_v1 where id=p_task_id for update; if v_task.id is null then raise exception using errcode='22023',message='ENRICHMENT_TASK_NOT_FOUND'; end if;
  select * into v_product from public.sp_catalog_product_v1 where id=v_task.product_id; if v_product.id is null then raise exception using errcode='22023',message='ENRICHMENT_PRODUCT_NOT_FOUND'; end if;
  v_domain:=p_result->'official_domain_candidate';
  if jsonb_typeof(v_domain)='object' then
    v_host:=lower(btrim(coalesce(v_domain->>'domain_host',''))); v_base:=btrim(coalesce(v_domain->>'official_base_url','')); begin v_conf:=coalesce(nullif(v_domain->>'confidence','')::numeric,0); exception when others then v_conf:=0; end; if v_conf>0 and v_conf<=1 then v_conf:=v_conf*100; end if;
    if v_host<>'' and v_base~'^https://' and v_conf>=70 then
      select id into v_existing from public.sp_catalog_brand_domain_v1 where lower(domain_host)=v_host limit 1;
      if v_existing is null then
        insert into public.sp_catalog_brand_domain_v1(brand_id,domain_host,official_base_url,domain_type,market_country_code,supports_shopify,supports_structured_product_data,status,verification_source_url,verification_notes)
        values(v_product.brand_id,v_host,v_base,case when v_domain->>'domain_type' in ('OFFICIAL_PRIMARY','OFFICIAL_REGIONAL','OFFICIAL_SHOPIFY','OFFICIAL_OTHER') then v_domain->>'domain_type' else 'OFFICIAL_PRIMARY' end,v_product.market_country_code,coalesce((v_domain->>'supports_shopify')::boolean,false),coalesce((v_domain->>'supports_structured_product_data')::boolean,false),'CANDIDATE',nullif(v_domain->>'source_url',''),left('Machine-discovered candidate; confidence='||round(v_conf,1)::text||'%. Admin verification required before official-domain use.',2000)); v_domain_count:=1;
      elsif exists(select 1 from public.sp_catalog_brand_domain_v1 where id=v_existing and brand_id=v_product.brand_id) then
        update public.sp_catalog_brand_domain_v1 set official_base_url=v_base,supports_shopify=coalesce((v_domain->>'supports_shopify')::boolean,supports_shopify),supports_structured_product_data=coalesce((v_domain->>'supports_structured_product_data')::boolean,supports_structured_product_data),verification_source_url=coalesce(nullif(v_domain->>'source_url',''),verification_source_url),updated_at=now() where id=v_existing and status='CANDIDATE'; v_domain_count:=1;
      else
        if not exists(select 1 from public.sp_catalog_review_queue_v1 where status in ('OPEN','IN_REVIEW') and review_type='OFFICIAL_DOMAIN' and product_id=v_product.id) then insert into public.sp_catalog_review_queue_v1(product_id,review_type,severity,title,detail,source_context) values(v_product.id,'OFFICIAL_DOMAIN','HIGH','Official-domain candidate conflicts with another brand','Automatic discovery found a domain already assigned to a different brand.',jsonb_build_object('domain_host',v_host,'task_id',p_task_id)); end if;
      end if;
    end if;
  end if;
  if jsonb_typeof(p_result->'offers')='array' then
    for v_offer in select value from jsonb_array_elements(p_result->'offers') loop
      begin v_conf:=coalesce(nullif(v_offer->>'confidence','')::numeric,0); exception when others then v_conf:=0; end; if v_conf>0 and v_conf<=1 then v_conf:=v_conf*100; end if;
      v_verified:=coalesce((v_offer->>'exact_product_match')::boolean,false) and coalesce((v_offer->>'direct_merchant_page')::boolean,false) and v_conf>=95;
      if coalesce(v_offer->>'source_url','')~'^https://' and coalesce(v_offer->>'platform_name','')<>'' then
        insert into public.sp_catalog_commerce_offer_v1(product_id,platform_name,merchant_name,source_domain,source_url,price,currency,list_price,availability_status,image_url,offer_confidence,verified,market_country_code,retrieved_at,valid_until,notes)
        values(v_product.id,left(v_offer->>'platform_name',200),nullif(left(coalesce(v_offer->>'merchant_name',''),200),''),nullif(lower(left(coalesce(v_offer->>'source_domain',''),255)),''),v_offer->>'source_url',case when coalesce(v_offer->>'price','')~'^[0-9]+(\.[0-9]+)?$' then (v_offer->>'price')::numeric else null end,case when coalesce(v_offer->>'currency','')<>'' then upper(left(v_offer->>'currency',8)) else 'INR' end,case when coalesce(v_offer->>'list_price','')~'^[0-9]+(\.[0-9]+)?$' then (v_offer->>'list_price')::numeric else null end,case when v_verified and v_offer->>'availability_status' in ('IN_STOCK','LIMITED','OUT_OF_STOCK','DISCONTINUED') then v_offer->>'availability_status' else 'UNKNOWN' end,case when coalesce(v_offer->>'image_url','')~'^https://' then v_offer->>'image_url' else null end,least(greatest(v_conf,0),100),v_verified,v_product.market_country_code,now(),now()+interval '24 hours','Automatic commerce discovery. verified=true only for >=95% exact-product direct merchant evidence.')
        on conflict(product_id,source_url) do update set platform_name=excluded.platform_name,merchant_name=excluded.merchant_name,source_domain=excluded.source_domain,price=excluded.price,currency=excluded.currency,list_price=excluded.list_price,availability_status=excluded.availability_status,image_url=excluded.image_url,offer_confidence=excluded.offer_confidence,verified=excluded.verified,retrieved_at=now(),valid_until=excluded.valid_until,updated_at=now(),notes=excluded.notes; v_offer_count:=v_offer_count+1;
      end if;
    end loop;
  end if;
  v_image:=p_result->'display_image';
  if jsonb_typeof(v_image)='object' and coalesce(v_image->>'image_url','')~'^https://' and coalesce(v_image->>'source_url','')~'^https://' and coalesce((v_image->>'verified_from_source_page')::boolean,false) then
    if not exists(select 1 from public.sp_catalog_product_image_v1 where product_id=v_product.id and image_url=v_image->>'image_url') then
      update public.sp_catalog_product_image_v1 set is_primary_display=false where product_id=v_product.id and is_primary_display=true and source_kind<>'ADMIN';
      insert into public.sp_catalog_product_image_v1(product_id,image_role,source_kind,source_url,image_url,market_country_code,is_primary_display,identity_evidence,ingredient_evidence,verified,retrieved_at,notes)
      values(v_product.id,'CATALOG_PRIMARY',case when coalesce(v_image->>'source_kind','') in ('OFFICIAL_BRAND','OFFICIAL_SHOPIFY','TRUSTED_RETAILER','MARKETPLACE') then v_image->>'source_kind' else 'SEARCH_DISCOVERY' end,v_image->>'source_url',v_image->>'image_url',v_product.market_country_code,true,false,false,true,now(),'Image URL extracted/verified from an exact product source page by the enrichment worker.'); v_image_count:=1;
    end if;
  end if;
  update public.sp_catalog_pipeline_state_v1 set domain_stage=case when exists(select 1 from public.sp_catalog_brand_domain_v1 d where d.brand_id=v_product.brand_id and d.status='VERIFIED') then 'VERIFIED' when exists(select 1 from public.sp_catalog_brand_domain_v1 d where d.brand_id=v_product.brand_id and d.status='CANDIDATE') then 'CANDIDATE_FOUND' else 'NOT_FOUND' end,commerce_stage=case when exists(select 1 from public.sp_catalog_commerce_offer_v1 o where o.product_id=v_product.id and o.verified=true and o.price is not null) then 'READY' when v_offer_count>0 then 'CANDIDATE_FOUND' else 'NOT_FOUND' end,image_stage=case when exists(select 1 from public.sp_catalog_product_image_v1 i where i.product_id=v_product.id and i.is_primary_display=true and i.verified=true and i.image_url is not null) then 'READY' else 'EVIDENCE_CAPTURED' end,updated_at=now() where product_id=v_product.id;
  return jsonb_build_object('success',true,'domain_candidates',v_domain_count,'offers',v_offer_count,'images',v_image_count);
end;$$;
revoke all on function public.sp_catalog_apply_web_enrichment_v1(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.sp_catalog_apply_web_enrichment_v1(uuid,jsonb) to service_role;

create or replace function public.sp_catalog_complete_enrichment_task_v1(p_task_id uuid,p_success boolean,p_result jsonb default '{}'::jsonb,p_error_code text default null,p_error_detail text default null,p_retry_minutes integer default 30) returns jsonb language plpgsql security definer set search_path='pg_catalog','public','pg_temp' as $$
declare v_task public.sp_catalog_enrichment_queue_v1%rowtype; v_final text; v_review_type text;
begin
  select * into v_task from public.sp_catalog_enrichment_queue_v1 where id=p_task_id for update; if v_task.id is null then raise exception using errcode='22023',message='ENRICHMENT_TASK_NOT_FOUND'; end if;
  if p_success then update public.sp_catalog_enrichment_queue_v1 set status='COMPLETED',result=coalesce(p_result,'{}'::jsonb),last_error_code=null,last_error_detail=null,locked_at=null,updated_at=now() where id=p_task_id; return jsonb_build_object('success',true,'status','COMPLETED'); end if;
  if v_task.attempt_count>=v_task.max_attempts then v_final:='ADMIN_REVIEW'; else v_final:='RETRY'; end if;
  update public.sp_catalog_enrichment_queue_v1 set status=v_final,result=coalesce(p_result,'{}'::jsonb),last_error_code=p_error_code,last_error_detail=left(p_error_detail,4000),locked_at=null,worker_code=null,next_attempt_at=case when v_final='RETRY' then now()+make_interval(mins=>least(greatest(coalesce(p_retry_minutes,30),5),1440)) else next_attempt_at end,updated_at=now() where id=p_task_id;
  if v_final='ADMIN_REVIEW' then v_review_type:=case when v_task.task_type='CATALOG_WEB_ENRICHMENT' then 'GENERAL' else 'SAFETY_FAILURE' end; if not exists(select 1 from public.sp_catalog_review_queue_v1 where product_id=v_task.product_id and review_type=v_review_type and status in ('OPEN','IN_REVIEW')) then insert into public.sp_catalog_review_queue_v1(product_id,review_type,severity,title,detail,source_context) values(v_task.product_id,v_review_type,'NORMAL','Automatic product enrichment requires Admin review',coalesce(p_error_detail,'Automatic enrichment exhausted its retry budget.'),jsonb_build_object('task_id',p_task_id,'task_type',v_task.task_type,'error_code',p_error_code)); end if; update public.sp_catalog_pipeline_state_v1 set admin_review_required=true,last_error_code=p_error_code,last_error_detail=left(p_error_detail,4000),updated_at=now() where product_id=v_task.product_id; end if;
  return jsonb_build_object('success',false,'status',v_final);
end;$$;
revoke all on function public.sp_catalog_complete_enrichment_task_v1(uuid,boolean,jsonb,text,text,integer) from public,anon,authenticated;
grant execute on function public.sp_catalog_complete_enrichment_task_v1(uuid,boolean,jsonb,text,text,integer) to service_role;

create or replace function public.sp_catalog_get_pipeline_worker_v1(p_product_id uuid) returns jsonb language sql stable security definer set search_path='pg_catalog','public','pg_temp' as $$ select coalesce((select jsonb_build_object('product_id',ps.product_id,'domain_stage',ps.domain_stage,'commerce_stage',ps.commerce_stage,'image_stage',ps.image_stage,'ingredient_stage',ps.ingredient_stage,'safety_stage',ps.safety_stage,'admin_review_required',ps.admin_review_required) from public.sp_catalog_pipeline_state_v1 ps where ps.product_id=p_product_id),'{}'::jsonb); $$;
revoke all on function public.sp_catalog_get_pipeline_worker_v1(uuid) from public,anon,authenticated;
grant execute on function public.sp_catalog_get_pipeline_worker_v1(uuid) to service_role;

create or replace function public.sp_catalog_reconcile_label_safety_v1(p_limit integer default 50) returns jsonb language plpgsql security definer set search_path='pg_catalog','public','extensions','pg_temp' as $$
declare r record; i record; v_res jsonb; v_research jsonb; v_breakdown jsonb; v_score jsonb; v_scope text; v_profile text; v_pending int; v_coverage numeric; v_status text; v_current public.sp_catalog_safety_assessment_v1%rowtype; v_snapshot text; v_checked int:=0; v_changed int:=0; v_qualified int:=0; v_escalated int:=0;
begin
 for r in select p.* from public.sp_catalog_product_v1 p where p.source_origin='USER_LABEL' and p.is_active=true and exists(select 1 from public.sp_catalog_safety_assessment_v1 s where s.product_id=p.id and s.is_current=true and s.assessment_status<>'QUALIFIED') order by p.updated_at limit least(greatest(coalesce(p_limit,50),1),200) loop
  v_checked:=v_checked+1; v_breakdown:='[]'::jsonb; v_pending:=0;
  select a.product_scope,a.profile_used into v_scope,v_profile from public.sp_catalog_ingredient_evidence_v1 e join public.sp_web_label_analyses_v1 a on a.id::text=e.retrieval_metadata->>'analysis_id' where e.product_id=r.id and e.evidence_kind='USER_LABEL' order by e.created_at desc limit 1; v_scope:=coalesce(v_scope,'UNKNOWN'); v_profile:=coalesce(v_profile,'ALL');
  for i in select * from public.sp_catalog_product_ingredient_v1 where product_id=r.id order by ingredient_sequence,id loop
   v_res:=public.sp_web_resolve_label_ingredient_v2(i.display_name,v_scope); v_research:=public.sp_web_get_label_identity_research_v1(coalesce(v_res->>'normalized_input',i.normalized_name)); if coalesce((v_res->>'regulatory_applicable')::boolean,false) is false then v_pending:=v_pending+1; end if;
   v_breakdown:=v_breakdown||jsonb_build_array(jsonb_build_object('name',i.display_name,'canonical_name',v_res->>'canonical_name','status',coalesce(v_res->>'status','unknown'),'category',v_res->>'category','risk_score',v_res->'risk_score','restriction_status_raw',v_res->>'restriction_status_raw','regulatory_found',coalesce((v_res->>'regulatory_found')::boolean,false),'regulatory_applicable',coalesce((v_res->>'regulatory_applicable')::boolean,false),'identity_verified',coalesce((v_res->>'identity_verified')::boolean,false),'pubchem_identity_verified',coalesce(v_research->>'pubchem_status','')='VERIFIED','gril_identity_id',v_res->'gril_identity_id','agency',v_res->>'agency'));
  end loop;
  v_score:=public.sp_web_score_label_safety_v1(v_breakdown,v_scope,v_profile); v_coverage:=coalesce((v_score->>'evidence_coverage')::numeric,0); v_status:=case when v_pending=0 and v_coverage>=80 then 'QUALIFIED' else 'INSUFFICIENT_EVIDENCE' end;
  select * into v_current from public.sp_catalog_safety_assessment_v1 where product_id=r.id and is_current=true order by determined_at desc limit 1; select encode(extensions.digest(coalesce(string_agg(normalized_name,'|' order by ingredient_sequence,id),''),'sha256'),'hex') into v_snapshot from public.sp_catalog_product_ingredient_v1 where product_id=r.id;
  if v_current.id is null or v_current.assessment_status<>v_status or coalesce(v_current.overall_score,-1)<>coalesce((v_score->>'safety_score')::numeric,-1) or coalesce(v_current.determination_confidence,-1)<>v_coverage then update public.sp_catalog_safety_assessment_v1 set is_current=false where product_id=r.id and is_current=true; insert into public.sp_catalog_safety_assessment_v1(product_id,assessment_version,assessment_status,overall_score,determination_confidence,ingredient_snapshot_sha256,warnings,summary,determination_source,is_current,determined_at) values(r.id,'LABEL_SAFETY_V3_RECONCILE',v_status,(v_score->>'safety_score')::numeric,v_coverage,v_snapshot,jsonb_build_array(case when v_status='QUALIFIED' then 'Automatically re-assessed against current published GRIL evidence.' else v_pending::text||' ingredient(s) still lack an applicable published product-scope rule; automated research continues.' end),'Automatic safety reconciliation: score '||coalesce(v_score->>'safety_score','n/a')||'/100; evidence coverage '||v_coverage::text||'%; pending regulatory determinations '||v_pending::text||'.','SYSTEM',true,now()); v_changed:=v_changed+1; end if;
  update public.sp_catalog_pipeline_state_v1 set ingredient_stage=case when v_pending=0 then 'COMPLETE' else 'RESEARCH_PENDING' end,safety_stage=v_status,updated_at=now() where product_id=r.id;
  if v_status='QUALIFIED' then v_qualified:=v_qualified+1; update public.sp_catalog_review_queue_v1 set status='RESOLVED',resolved_at=now(),resolution_notes='Automatically resolved after published GRIL evidence became sufficient.',updated_at=now() where product_id=r.id and review_type='SAFETY_FAILURE' and status in ('OPEN','IN_REVIEW'); update public.sp_catalog_pipeline_state_v1 ps set admin_review_required=exists(select 1 from public.sp_catalog_review_queue_v1 q where q.product_id=r.id and q.status in ('OPEN','IN_REVIEW')),last_error_code=null,last_error_detail=null,updated_at=now() where product_id=r.id; update public.sp_catalog_enrichment_queue_v1 set status='COMPLETED',result=jsonb_build_object('resolved_by','SP-CATALOG-SAFETY-RECONCILE/1.0'),updated_at=now() where product_id=r.id and task_type='SAFETY_REASSESSMENT' and status in ('PENDING','RETRY','IN_PROGRESS');
  elsif r.created_at<now()-interval '6 hours' then if not exists(select 1 from public.sp_catalog_review_queue_v1 where product_id=r.id and review_type='SAFETY_FAILURE' and status in ('OPEN','IN_REVIEW')) then insert into public.sp_catalog_review_queue_v1(product_id,review_type,severity,title,detail,source_context) values(r.id,'SAFETY_FAILURE',case when v_coverage<50 then 'HIGH' else 'NORMAL' end,'Label safety research remains unresolved after automated attempts','Automation continues, but published evidence is still insufficient for a qualified determination.',jsonb_build_object('pending_count',v_pending,'evidence_coverage',v_coverage,'worker','SP-CATALOG-SAFETY-RECONCILE/1.0')); v_escalated:=v_escalated+1; end if; update public.sp_catalog_pipeline_state_v1 set admin_review_required=true,last_error_code='LABEL_RESEARCH_STALLED',last_error_detail='Published regulatory evidence remains incomplete after six hours; automation continues in parallel.',updated_at=now() where product_id=r.id; end if;
 end loop;
 return jsonb_build_object('success',true,'checked',v_checked,'assessments_changed',v_changed,'qualified',v_qualified,'admin_escalations',v_escalated,'automatic_publication',false);
end;$$;
revoke all on function public.sp_catalog_reconcile_label_safety_v1(integer) from public,anon,authenticated;
grant execute on function public.sp_catalog_reconcile_label_safety_v1(integer) to service_role;

create or replace function public.sp_claim_regulatory_web_research_v1(p_limit integer default 3) returns jsonb language plpgsql security definer set search_path='pg_catalog','public','gril','pg_temp' as $$
declare v_rows jsonb; begin
 with picked as (select q.id from public.regulatory_knowledge_queue q where q.current_status in ('REGULATORY_RESEARCH','IDENTITY_REVIEW') and coalesce((q.research_payload->>'web_attempt_count')::int,0)<4 and (q.research_payload->>'last_web_research_at' is null or (q.research_payload->>'last_web_research_at')::timestamptz<now()-interval '20 minutes') order by case q.priority when 'CRITICAL' then 1 when 'HIGH' then 2 when 'NORMAL' then 3 else 4 end,q.last_seen_at desc limit least(greatest(coalesce(p_limit,3),1),10) for update skip locked),
 u as (update public.regulatory_knowledge_queue q set research_payload=coalesce(q.research_payload,'{}'::jsonb)||jsonb_build_object('last_web_research_at',now(),'web_attempt_count',coalesce((q.research_payload->>'web_attempt_count')::int,0)+1,'web_worker_status','IN_PROGRESS'),updated_at=now() from picked where q.id=picked.id returning q.*)
 select coalesce(jsonb_agg(jsonb_build_object('queue_id',u.id,'canonical_name',u.canonical_name,'normalized_canonical_name',u.normalized_canonical_name,'current_status',u.current_status,'priority',u.priority,'inci_name',u.inci_name,'cas_number',u.cas_number,'research_payload',u.research_payload)),'[]'::jsonb) into v_rows from u; return v_rows; end;$$;
revoke all on function public.sp_claim_regulatory_web_research_v1(integer) from public,anon,authenticated;
grant execute on function public.sp_claim_regulatory_web_research_v1(integer) to service_role;

create or replace function public.sp_get_regulatory_official_domains_v1() returns jsonb language sql stable security definer set search_path='pg_catalog','gril','pg_temp' as $$ select coalesce(jsonb_agg(distinct lower(h)),'[]'::jsonb) from gril.source_endpoint e cross join lateral unnest(e.allowed_hosts) h where e.is_active=true and h is not null and h<>''; $$;
revoke all on function public.sp_get_regulatory_official_domains_v1() from public,anon,authenticated;
grant execute on function public.sp_get_regulatory_official_domains_v1() to service_role;

create or replace function public.sp_complete_regulatory_web_research_v1(p_queue_id bigint,p_evidence jsonb,p_worker_version text default 'SP-REGULATORY-WEB-RESEARCH/1.0') returns jsonb language plpgsql security definer set search_path='pg_catalog','public','gril','extensions','pg_temp' as $$
declare q public.regulatory_knowledge_queue%rowtype; e jsonb; v_url text; v_host text; v_sha text; v_count int:=0; v_attempt int;
begin
 select * into q from public.regulatory_knowledge_queue where id=p_queue_id for update; if q.id is null then raise exception using errcode='22023',message='REGULATORY_QUEUE_ITEM_NOT_FOUND'; end if;
 if jsonb_typeof(coalesce(p_evidence,'[]'::jsonb))='array' then for e in select value from jsonb_array_elements(p_evidence) loop v_url:=btrim(coalesce(e->>'source_url','')); v_host:=lower(split_part(regexp_replace(v_url,'^https://','','i'),'/',1)); if v_url~'^https://' and exists(select 1 from gril.source_endpoint se cross join lateral unnest(se.allowed_hosts) h where se.is_active=true and (v_host=lower(h) or v_host like '%.'||lower(h))) then v_sha:=encode(extensions.digest(v_url||'|'||coalesce(e->>'source_title','')||'|'||coalesce(e->>'evidence_summary',''),'sha256'),'hex'); insert into public.sp_regulatory_research_evidence_v1(queue_id,normalized_canonical_name,authority,jurisdiction,source_url,source_title,evidence_summary,legal_force,publication_date,source_sha256,machine_confidence,evidence_status,worker_version,raw_payload) values(q.id,q.normalized_canonical_name,nullif(e->>'authority',''),nullif(e->>'jurisdiction',''),v_url,nullif(e->>'source_title',''),left(e->>'evidence_summary',5000),nullif(e->>'legal_force',''),case when coalesce(e->>'publication_date','')~'^\d{4}-\d{2}-\d{2}$' then (e->>'publication_date')::date else null end,v_sha,case when coalesce(e->>'confidence','')~'^[0-9]+(\.[0-9]+)?$' then least(greatest((e->>'confidence')::numeric,0),100) else null end,'CANDIDATE',p_worker_version,e) on conflict(queue_id,source_sha256) do nothing; if found then v_count:=v_count+1; end if; end if; end loop; end if;
 v_attempt:=coalesce((q.research_payload->>'web_attempt_count')::int,1); update public.regulatory_knowledge_queue set research_payload=coalesce(research_payload,'{}'::jsonb)||jsonb_build_object('web_worker_status',case when v_count>0 then 'EVIDENCE_FOUND_REVIEW_REQUIRED' when v_attempt>=4 then 'AUTOMATION_EXHAUSTED_REVIEW_REQUIRED' else 'NO_EVIDENCE_RETRY_SCHEDULED' end,'web_evidence_count',coalesce((research_payload->>'web_evidence_count')::int,0)+v_count,'automatic_publication',false,'last_web_research_completed_at',now()),updated_at=now() where id=q.id;
 if (v_count>0 or v_attempt>=4) and not exists(select 1 from public.sp_catalog_review_queue_v1 r where r.product_id is null and r.review_type='INGREDIENT_EVIDENCE' and r.status in ('OPEN','IN_REVIEW') and r.source_context->>'normalized_canonical_name'=q.normalized_canonical_name) then insert into public.sp_catalog_review_queue_v1(product_id,review_type,severity,title,detail,source_context) values(null,'INGREDIENT_EVIDENCE',case when q.priority in ('CRITICAL','HIGH') then 'HIGH' else 'NORMAL' end,case when v_count>0 then 'Authoritative ingredient evidence requires review' else 'Automatic regulatory research requires Admin review' end,case when v_count>0 then 'The automated worker found evidence only on registered official-source domains. It has not published or bound a regulatory rule.' else 'The automatic official-source search exhausted its bounded attempts without sufficient evidence.' end,jsonb_build_object('queue_id',q.id,'normalized_canonical_name',q.normalized_canonical_name,'canonical_name',q.canonical_name,'evidence_count',v_count,'automatic_publication',false)); end if;
 return jsonb_build_object('success',true,'queue_id',q.id,'accepted_evidence',v_count,'attempt',v_attempt,'automatic_publication',false);
end;$$;
revoke all on function public.sp_complete_regulatory_web_research_v1(bigint,jsonb,text) from public,anon,authenticated;
grant execute on function public.sp_complete_regulatory_web_research_v1(bigint,jsonb,text) to service_role;

create or replace function sp_internal.dispatch_edge_worker_v1(p_worker_code text,p_slug text) returns bigint language plpgsql security definer set search_path='pg_catalog','sp_internal','net','pg_temp' as $$ declare v_token text; v_request bigint; begin select token into v_token from sp_internal.worker_secret_v1 where worker_code=p_worker_code; if v_token is null then raise exception 'WORKER_SECRET_NOT_FOUND'; end if; select net.http_post(url=>'https://wmxbdirvlwuagouraobr.supabase.co/functions/v1/'||p_slug,headers=>jsonb_build_object('Content-Type','application/json','x-sp-worker-token',v_token),body=>jsonb_build_object('source','pg_cron','worker_code',p_worker_code),timeout_milliseconds=>55000) into v_request; return v_request; end; $$;
revoke all on function sp_internal.dispatch_edge_worker_v1(text,text) from public,anon,authenticated;

create or replace function public.sp_catalog_safety_reassess_enqueue_trigger_v1() returns trigger language plpgsql security definer set search_path='pg_catalog','public','pg_temp' as $$ begin if new.is_current=true and new.assessment_status<>'QUALIFIED' and exists(select 1 from public.sp_catalog_product_v1 p where p.id=new.product_id and p.source_origin='USER_LABEL') then if not exists(select 1 from public.sp_catalog_enrichment_queue_v1 q where q.product_id=new.product_id and q.task_type='SAFETY_REASSESSMENT' and q.status in ('PENDING','IN_PROGRESS','RETRY')) then insert into public.sp_catalog_enrichment_queue_v1(product_id,task_type,status,priority,max_attempts,payload) values(new.product_id,'SAFETY_REASSESSMENT','PENDING','NORMAL',20,jsonb_build_object('source','SAFETY_ASSESSMENT','assessment_id',new.id,'automatic',true)); end if; end if; return new; end; $$;
revoke all on function public.sp_catalog_safety_reassess_enqueue_trigger_v1() from public,anon,authenticated;
drop trigger if exists sp_catalog_safety_reassess_enqueue_v1 on public.sp_catalog_safety_assessment_v1;
create trigger sp_catalog_safety_reassess_enqueue_v1 after insert on public.sp_catalog_safety_assessment_v1 for each row execute function public.sp_catalog_safety_reassess_enqueue_trigger_v1();

create or replace function public.sp_catalog_admin_audit_overview_v1(p_limit integer default 50) returns jsonb language plpgsql stable set search_path='pg_catalog','public','pg_temp' as $$
declare v_limit integer:=least(greatest(coalesce(p_limit,50),1),200); v_result jsonb;
begin
 if public.sp_web_has_role_v1(auth.uid(),'admin'::public.sp_web_app_role_v1) is not true then raise exception using errcode='42501',message='ADMIN_ACCESS_REQUIRED'; end if;
 select jsonb_build_object('status','READY','contract','SP-CATALOG-ADMIN-AUDIT/1.1','generated_at',now(),'open_review_count',(select count(*) from public.sp_catalog_review_queue_v1 where status in ('OPEN','IN_REVIEW')),'products_requiring_admin_review',(select count(*) from public.sp_catalog_pipeline_state_v1 where admin_review_required=true),'enrichment_queue_summary',coalesce((select jsonb_object_agg(k,s) from (select task_type||':'||status k,count(*) s from public.sp_catalog_enrichment_queue_v1 group by task_type,status) z),'{}'::jsonb),'regulatory_research_pending_count',(select count(*) from public.regulatory_knowledge_queue where current_status in ('IDENTITY_REVIEW','REGULATORY_RESEARCH','SCIENTIFIC_REVIEW')),'regulatory_candidate_evidence_count',(select count(*) from public.sp_regulatory_research_evidence_v1 where evidence_status='CANDIDATE'),'recent_changes',coalesce((select jsonb_agg(to_jsonb(x) order by x.occurred_at desc,x.audit_id desc) from (select * from public.sp_catalog_admin_audit_v1 order by occurred_at desc,audit_id desc limit v_limit) x),'[]'::jsonb),'open_reviews',coalesce((select jsonb_agg(jsonb_build_object('review_id',r.id,'product_id',r.product_id,'product_name',p.product_name,'brand_name',p.brand_name,'review_type',r.review_type,'severity',r.severity,'status',r.status,'title',r.title,'detail',r.detail,'source_context',r.source_context,'opened_at',r.opened_at,'assigned_to',r.assigned_to) order by case r.severity when 'CRITICAL' then 1 when 'HIGH' then 2 when 'NORMAL' then 3 else 4 end,r.opened_at) from (select * from public.sp_catalog_review_queue_v1 where status in ('OPEN','IN_REVIEW') order by opened_at desc limit v_limit) r left join public.sp_catalog_product_v1 p on p.id=r.product_id),'[]'::jsonb),'pipeline_exceptions',coalesce((select jsonb_agg(jsonb_build_object('product_id',ps.product_id,'product_name',p.product_name,'brand_name',p.brand_name,'identity_stage',ps.identity_stage,'domain_stage',ps.domain_stage,'ingredient_stage',ps.ingredient_stage,'safety_stage',ps.safety_stage,'commerce_stage',ps.commerce_stage,'image_stage',ps.image_stage,'admin_review_required',ps.admin_review_required,'last_error_code',ps.last_error_code,'last_error_detail',ps.last_error_detail,'updated_at',ps.updated_at) order by ps.admin_review_required desc,ps.updated_at desc) from (select * from public.sp_catalog_pipeline_state_v1 where admin_review_required=true or last_error_code is not null order by updated_at desc limit v_limit) ps join public.sp_catalog_product_v1 p on p.id=ps.product_id),'[]'::jsonb)) into v_result; return v_result;
end;$$;

-- Backfill existing user-label products idempotently.
do $$ declare x record; begin for x in select id from public.sp_catalog_product_v1 where source_origin='USER_LABEL' and is_active=true loop perform public.sp_catalog_enqueue_default_enrichment_v1(x.id); if exists(select 1 from public.sp_catalog_safety_assessment_v1 s where s.product_id=x.id and s.is_current=true and s.assessment_status<>'QUALIFIED') and not exists(select 1 from public.sp_catalog_enrichment_queue_v1 q where q.product_id=x.id and q.task_type='SAFETY_REASSESSMENT' and q.status in ('PENDING','IN_PROGRESS','RETRY','COMPLETED')) then insert into public.sp_catalog_enrichment_queue_v1(product_id,task_type,status,priority,max_attempts,payload) values(x.id,'SAFETY_REASSESSMENT','PENDING','NORMAL',20,jsonb_build_object('source','BACKFILL','automatic',true)); end if; end loop; end $$;

select cron.unschedule(jobid) from cron.job where jobname in ('sp_catalog_label_safety_reconcile_v1','sp_catalog_web_enrichment_dispatch_v1','sp_regulatory_web_research_dispatch_v1');
select cron.schedule('sp_catalog_label_safety_reconcile_v1','3-59/5 * * * *',$$select public.sp_catalog_reconcile_label_safety_v1(50);$$);
select cron.schedule('sp_catalog_web_enrichment_dispatch_v1','*/10 * * * *',$$select sp_internal.dispatch_edge_worker_v1('CATALOG_WEB_ENRICHMENT','sp-catalog-enrichment-worker-v1');$$);
select cron.schedule('sp_regulatory_web_research_dispatch_v1','5-59/10 * * * *',$$select sp_internal.dispatch_edge_worker_v1('REGULATORY_WEB_RESEARCH','sp-regulatory-research-worker-v1');$$);
