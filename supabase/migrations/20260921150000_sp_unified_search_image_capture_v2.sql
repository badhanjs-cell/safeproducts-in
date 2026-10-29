-- SafeProducts Unified Search v2 — opportunistic display image persistence.
-- Images are presentation assets only; absence never affects safety or display eligibility.

alter table public.sp_catalog_product_image_v1
  add column if not exists exact_product_match boolean not null default false;

alter table public.sp_catalog_product_image_v1
  drop constraint if exists sp_catalog_product_image_v1_image_role_check;

alter table public.sp_catalog_product_image_v1
  add constraint sp_catalog_product_image_v1_image_role_check
  check (image_role = any (array['FRONT_LABEL'::text,'INGREDIENT_LABEL'::text,'CATALOG_PRIMARY'::text,'CATALOG_ALT'::text,'DISPLAY'::text,'OTHER'::text]));

create or replace function public.sp_us2_upsert_display_image_v1(
  p_product_id uuid,
  p_image jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $function$
declare
  v_source_kind text := upper(coalesce(nullif(btrim(p_image->>'source_kind'), ''), 'SEARCH_DISCOVERY'));
  v_source_url text := nullif(btrim(p_image->>'source_url'), '');
  v_image_url text := nullif(btrim(p_image->>'image_url'), '');
  v_width integer;
  v_height integer;
  v_id uuid;
begin
  if p_product_id is null then
    raise exception using errcode='22023', message='PRODUCT_ID_REQUIRED';
  end if;
  if coalesce((p_image->>'exact_product_match')::boolean, false) is not true then
    raise exception using errcode='22023', message='EXACT_PRODUCT_IMAGE_REQUIRED';
  end if;
  if v_source_url is null or v_source_url !~ '^https://' or v_image_url is null or v_image_url !~ '^https://' then
    raise exception using errcode='22023', message='HTTPS_IMAGE_PROVENANCE_REQUIRED';
  end if;
  if v_source_kind not in ('OFFICIAL_BRAND','OFFICIAL_SHOPIFY','TRUSTED_RETAILER','MARKETPLACE','OPEN_DATABASE','SEARCH_DISCOVERY') then
    raise exception using errcode='22023', message='IMAGE_SOURCE_KIND_INVALID';
  end if;

  begin v_width := nullif(p_image->>'width_px','')::integer; exception when others then v_width := null; end;
  begin v_height := nullif(p_image->>'height_px','')::integer; exception when others then v_height := null; end;
  if v_width is not null and v_width <= 0 then v_width := null; end if;
  if v_height is not null and v_height <= 0 then v_height := null; end if;

  perform set_config('sp.catalog_audit_reason','US2_DISPLAY_IMAGE_CAPTURE',true);

  update public.sp_catalog_product_image_v1
     set is_primary_display=false, updated_at=now()
   where product_id=p_product_id and is_primary_display=true;

  insert into public.sp_catalog_product_image_v1(
    product_id,image_role,source_kind,source_url,image_url,width_px,height_px,
    market_country_code,is_primary_display,identity_evidence,ingredient_evidence,
    verified,exact_product_match,retrieved_at,notes
  )
  select p_product_id,'DISPLAY',v_source_kind,v_source_url,v_image_url,v_width,v_height,
         coalesce(p.market_country_code,'IN'),true,true,false,
         v_source_kind in ('OFFICIAL_BRAND','OFFICIAL_SHOPIFY','TRUSTED_RETAILER'),true,now(),
         'Unified Search v2 opportunistic display image; presentation only and never Safety Score evidence.'
    from public.sp_catalog_product_v1 p
   where p.id=p_product_id
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
      from public.sp_catalog_product_image_v1
     where product_id=p_product_id and image_url=v_image_url and source_url=v_source_url
     order by retrieved_at desc
     limit 1;
    if v_id is not null then
      update public.sp_catalog_product_image_v1
         set image_role='DISPLAY', width_px=coalesce(v_width,width_px), height_px=coalesce(v_height,height_px),
             is_primary_display=true, exact_product_match=true, retrieved_at=now(), updated_at=now()
       where id=v_id;
    end if;
  end if;

  return jsonb_build_object('success',v_id is not null,'image_id',v_id,'exact_product_match',true);
end;
$function$;

revoke all on function public.sp_us2_upsert_display_image_v1(uuid,jsonb) from public;
revoke all on function public.sp_us2_upsert_display_image_v1(uuid,jsonb) from anon;
revoke all on function public.sp_us2_upsert_display_image_v1(uuid,jsonb) from authenticated;
grant execute on function public.sp_us2_upsert_display_image_v1(uuid,jsonb) to service_role;
