-- M1-B strict regulatory safety gate.
-- A numeric score is emitted only when every currently qualified ingredient has
-- applicable regulatory evidence. Price and image are never inputs to this gate.

create or replace function public.sp_m1b_score_qualified_product_v1(
  p_run_id uuid,
  p_product_id uuid,
  p_profile text default 'ALL'
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','extensions','pg_temp'
as $$
declare
  v_run public.sp_m1b_run_v1%rowtype;
  v_product public.sp_catalog_product_v1%rowtype;
  v_profile text := upper(btrim(coalesce(p_profile,'ALL')));
  v_scope text;
  v_total integer := 0;
  v_resolved integer := 0;
  v_breakdown jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_res jsonb;
  v_item record;
  v_snapshot text;
  v_reg_snapshot text;
  v_score_all jsonb;
  v_score_child jsonb;
  v_score_preg jsonb;
  v_score_senior jsonb;
  v_overall numeric;
  v_child numeric;
  v_preg numeric;
  v_senior numeric;
  v_profile_score numeric;
  v_coverage numeric := 0;
  v_current public.sp_catalog_safety_assessment_v1%rowtype;
  v_assessment_id uuid;
  v_recommendation text;
begin
  if v_profile not in ('ALL','CHILDREN','PREGNANT','SENIORS') then
    raise exception using errcode='22023', message='M1B_PROFILE_INVALID';
  end if;

  select * into v_run from public.sp_m1b_run_v1 where id=p_run_id;
  if v_run.id is null then
    raise exception using errcode='22023', message='M1B_RUN_NOT_FOUND';
  end if;
  if v_run.product_id is distinct from p_product_id then
    raise exception using errcode='22023', message='M1B_RUN_PRODUCT_MISMATCH';
  end if;
  if v_run.final_ingredient_status is distinct from 'QUALIFIED' then
    return jsonb_build_object(
      'success',true,'score_available',false,'assessment_status','INSUFFICIENT_EVIDENCE',
      'reason','INGREDIENTS_NOT_QUALIFIED','safety_score',null,'profile_score',null
    );
  end if;

  select * into v_product from public.sp_catalog_product_v1 where id=p_product_id and is_active=true;
  if v_product.id is null then
    raise exception using errcode='22023', message='M1B_PRODUCT_NOT_FOUND';
  end if;

  v_scope := case
    when lower(coalesce(v_product.category,'')) ~ '(supplement|nutraceutical|vitamin|mineral|protein|probiotic|prebiotic)' then 'SUPPLEMENT_ORAL'
    when lower(coalesce(v_product.category,'')) ~ '(food|beverage|dietary|nutrition|infant formula)' then 'FOOD_BEVERAGE'
    when lower(coalesce(v_product.category,'')) ~ '(cosmetic|skin|hair|personal care|beauty|sunscreen|baby care|oral care|deodorant|shampoo|soap|body wash|face wash|cream|lotion)' then 'COSMETIC_TOPICAL'
    else 'UNKNOWN'
  end;

  select count(*),
         encode(extensions.digest(coalesce(string_agg(normalized_name,'|' order by ingredient_sequence,id),''),'sha256'),'hex')
    into v_total,v_snapshot
  from public.sp_catalog_product_ingredient_v1
  where product_id=p_product_id and qualification_status='QUALIFIED';

  if v_total=0 then
    return jsonb_build_object(
      'success',true,'score_available',false,'assessment_status','INSUFFICIENT_EVIDENCE',
      'reason','QUALIFIED_INGREDIENT_ROWS_MISSING','safety_score',null,'profile_score',null,
      'product_scope',v_scope
    );
  end if;

  for v_item in
    select id,ingredient_sequence,display_name,normalized_name,confidence
    from public.sp_catalog_product_ingredient_v1
    where product_id=p_product_id and qualification_status='QUALIFIED'
    order by ingredient_sequence,id
  loop
    if char_length(coalesce(v_item.display_name,'')) > 200 then
      v_res := jsonb_build_object(
        'input_name',v_item.display_name,'canonical_name',v_item.display_name,
        'regulatory_applicable',false,'status','unknown','product_scope',v_scope,
        'match_basis','NAME_TOO_LONG'
      );
    else
      v_res := public.sp_web_resolve_label_ingredient_v2(v_item.display_name,v_scope);
    end if;

    if coalesce((v_res->>'regulatory_applicable')::boolean,false)
       and lower(coalesce(v_res->>'status','')) in ('permitted','restricted','prohibited') then
      v_resolved := v_resolved + 1;
    end if;

    if nullif(btrim(coalesce(v_res->>'labeling_warnings','')),'') is not null then
      v_warnings := v_warnings || jsonb_build_array(v_res->>'labeling_warnings');
    end if;

    v_breakdown := v_breakdown || jsonb_build_array(jsonb_build_object(
      'name',v_item.display_name,
      'canonical_name',v_res->>'canonical_name',
      'status',coalesce(v_res->>'status','unknown'),
      'category',v_res->>'category',
      'risk_score',v_res->'risk_score',
      'restriction_status_raw',v_res->>'restriction_status_raw',
      'regulatory_found',coalesce((v_res->>'regulatory_found')::boolean,false),
      'regulatory_applicable',coalesce((v_res->>'regulatory_applicable')::boolean,false),
      'identity_verified',coalesce((v_res->>'identity_verified')::boolean,false),
      'gril_identity_id',v_res->'gril_identity_id',
      'agency',v_res->>'agency',
      'match_basis',v_res->>'match_basis'
    ));
  end loop;

  v_coverage := round((100.0*v_resolved/greatest(v_total,1))::numeric,2);
  v_reg_snapshot := encode(extensions.digest(v_breakdown::text,'sha256'),'hex');

  if v_scope='UNKNOWN' or v_resolved<>v_total then
    perform set_config('sp.catalog_audit_reason','M1B_STRICT_SAFETY_INSUFFICIENT_REGULATORY_EVIDENCE',true);
    select * into v_current
    from public.sp_catalog_safety_assessment_v1
    where product_id=p_product_id and is_current=true
    order by determined_at desc limit 1;

    if v_current.id is null
       or v_current.assessment_version<>'M1B_STRICT_REGULATORY_V1'
       or v_current.assessment_status<>'INSUFFICIENT_EVIDENCE'
       or v_current.ingredient_snapshot_sha256 is distinct from v_snapshot
       or coalesce(v_current.determination_confidence,-1)<>v_coverage then
      update public.sp_catalog_safety_assessment_v1
         set is_current=false
       where product_id=p_product_id and is_current=true;
      insert into public.sp_catalog_safety_assessment_v1(
        product_id,assessment_version,assessment_status,overall_score,child_score,pregnancy_score,senior_score,
        determination_confidence,ingredient_snapshot_sha256,regulatory_snapshot_ref,warnings,summary,
        determination_source,is_current,determined_at,expires_at
      ) values (
        p_product_id,'M1B_STRICT_REGULATORY_V1','INSUFFICIENT_EVIDENCE',null,null,null,null,
        v_coverage,v_snapshot,v_reg_snapshot,
        jsonb_build_array('Safety Score withheld until every qualified ingredient has applicable regulatory evidence.'),
        format('M1-B strict gate withheld scoring: %s/%s ingredients have applicable regulatory evidence in scope %s.',v_resolved,v_total,v_scope),
        'SYSTEM',true,now(),now()+interval '24 hours'
      ) returning id into v_assessment_id;
    else
      v_assessment_id := v_current.id;
    end if;

    insert into public.sp_catalog_pipeline_state_v1(product_id,ingredient_stage,safety_stage,last_error_code,last_error_detail)
    values(p_product_id,'QUALIFIED','INSUFFICIENT_EVIDENCE','REGULATORY_EVIDENCE_INCOMPLETE',
           format('%s/%s qualified ingredients have applicable regulatory evidence.',v_resolved,v_total))
    on conflict(product_id) do update
      set ingredient_stage='QUALIFIED',safety_stage='INSUFFICIENT_EVIDENCE',
          last_error_code='REGULATORY_EVIDENCE_INCOMPLETE',
          last_error_detail=excluded.last_error_detail,updated_at=now();

    return jsonb_build_object(
      'success',true,'score_available',false,'assessment_status','INSUFFICIENT_EVIDENCE',
      'reason',case when v_scope='UNKNOWN' then 'PRODUCT_SCOPE_NOT_SUPPORTED' else 'REGULATORY_EVIDENCE_INCOMPLETE' end,
      'safety_score',null,'profile_score',null,'child_score',null,'pregnancy_score',null,'senior_score',null,
      'ingredient_count',v_total,'regulatory_resolved_count',v_resolved,'evidence_coverage',v_coverage,
      'product_scope',v_scope,'assessment_id',v_assessment_id,'warnings',v_warnings
    );
  end if;

  v_score_all := public.sp_web_score_label_safety_v1(v_breakdown,v_scope,'ALL');
  v_score_child := public.sp_web_score_label_safety_v1(v_breakdown,v_scope,'Children');
  v_score_preg := public.sp_web_score_label_safety_v1(v_breakdown,v_scope,'Pregnant Women');
  v_score_senior := public.sp_web_score_label_safety_v1(v_breakdown,v_scope,'Seniors');

  begin v_overall := nullif(v_score_all->>'safety_score','')::numeric; exception when others then v_overall:=null; end;
  begin v_child := nullif(v_score_child->>'safety_score','')::numeric; exception when others then v_child:=null; end;
  begin v_preg := nullif(v_score_preg->>'safety_score','')::numeric; exception when others then v_preg:=null; end;
  begin v_senior := nullif(v_score_senior->>'safety_score','')::numeric; exception when others then v_senior:=null; end;

  if v_overall is null or v_child is null or v_preg is null or v_senior is null then
    return jsonb_build_object(
      'success',true,'score_available',false,'assessment_status','INSUFFICIENT_EVIDENCE',
      'reason','STRICT_SCORER_DID_NOT_RETURN_COMPLETE_SCORES','safety_score',null,'profile_score',null,
      'ingredient_count',v_total,'regulatory_resolved_count',v_resolved,'evidence_coverage',v_coverage,'product_scope',v_scope
    );
  end if;

  v_profile_score := case v_profile
    when 'CHILDREN' then v_child
    when 'PREGNANT' then v_preg
    when 'SENIORS' then v_senior
    else v_overall
  end;
  v_recommendation := case when v_profile_score<55 then 'avoid' when v_profile_score<75 then 'caution' else 'acceptable' end;

  perform set_config('sp.catalog_audit_reason','M1B_STRICT_SAFETY_QUALIFICATION',true);
  select * into v_current
  from public.sp_catalog_safety_assessment_v1
  where product_id=p_product_id and is_current=true
  order by determined_at desc limit 1;

  if v_current.id is null
     or v_current.assessment_version<>'M1B_STRICT_REGULATORY_V1'
     or v_current.assessment_status<>'QUALIFIED'
     or v_current.ingredient_snapshot_sha256 is distinct from v_snapshot
     or v_current.regulatory_snapshot_ref is distinct from v_reg_snapshot
     or coalesce(v_current.overall_score,-1)<>v_overall
     or coalesce(v_current.child_score,-1)<>v_child
     or coalesce(v_current.pregnancy_score,-1)<>v_preg
     or coalesce(v_current.senior_score,-1)<>v_senior then
    update public.sp_catalog_safety_assessment_v1
       set is_current=false
     where product_id=p_product_id and is_current=true;
    insert into public.sp_catalog_safety_assessment_v1(
      product_id,assessment_version,assessment_status,overall_score,child_score,pregnancy_score,senior_score,
      determination_confidence,ingredient_snapshot_sha256,regulatory_snapshot_ref,warnings,summary,
      determination_source,is_current,determined_at,expires_at
    ) values (
      p_product_id,'M1B_STRICT_REGULATORY_V1','QUALIFIED',v_overall,v_child,v_preg,v_senior,
      100,v_snapshot,v_reg_snapshot,v_warnings,
      format('M1-B strict safety qualification: all %s qualified ingredients have applicable regulatory evidence in scope %s.',v_total,v_scope),
      'SYSTEM',true,now(),now()+interval '24 hours'
    ) returning id into v_assessment_id;
  else
    v_assessment_id := v_current.id;
  end if;

  insert into public.sp_catalog_pipeline_state_v1(product_id,ingredient_stage,safety_stage,last_error_code,last_error_detail)
  values(p_product_id,'QUALIFIED','QUALIFIED',null,null)
  on conflict(product_id) do update
    set ingredient_stage='QUALIFIED',safety_stage='QUALIFIED',last_error_code=null,last_error_detail=null,updated_at=now();

  return jsonb_build_object(
    'success',true,'score_available',true,'assessment_status','QUALIFIED','reason','STRICT_FULL_REGULATORY_COVERAGE',
    'safety_score',v_overall,'profile_score',v_profile_score,'child_score',v_child,'pregnancy_score',v_preg,'senior_score',v_senior,
    'ingredient_count',v_total,'regulatory_resolved_count',v_resolved,'evidence_coverage',100,
    'product_scope',v_scope,'assessment_id',v_assessment_id,'assessment_version','M1B_STRICT_REGULATORY_V1',
    'warnings',v_warnings,'recommendation_class',v_recommendation,'regulatory_snapshot_ref',v_reg_snapshot
  );
end;
$$;

revoke all on function public.sp_m1b_score_qualified_product_v1(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.sp_m1b_score_qualified_product_v1(uuid,uuid,text) to service_role;

-- Extend the read-only candidate adapter with only fresh strict-qualified cache.
create or replace function public.sp_m1b_search_catalog_candidates_v1(
  p_query text,
  p_category text default 'ALL',
  p_limit integer default 10
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','extensions','pg_temp'
set statement_timeout to '5s'
as $$
declare
  v_query text:=lower(btrim(coalesce(p_query,'')));
  v_category text:=upper(btrim(coalesce(p_category,'ALL')));
  v_limit integer:=least(greatest(coalesce(p_limit,10),1),10);
  v_rows jsonb;
begin
  if v_query='' or length(v_query)>200 then
    raise exception using errcode='22023',message='M1B_SEARCH_QUERY_INVALID';
  end if;

  select coalesce(jsonb_agg(x.card order by x.rank_score desc,x.product_name),'[]'::jsonb)
    into v_rows
  from (
    select p.product_name,
      (case when lower(p.product_name)=v_query then 100 else 0 end +
       case when lower(p.brand_name||' '||p.product_name)=v_query then 80 else 0 end +
       case when lower(p.product_name) like '%'||v_query||'%' then 40 else 0 end +
       case when lower(p.brand_name||' '||p.product_name) like '%'||v_query||'%' then 30 else 0 end +
       case when lower(coalesce(p.category,'')) like '%'||v_query||'%' then 10 else 0 end) as rank_score,
      jsonb_build_object(
        'product_id',p.id,
        'product_fingerprint',p.product_fingerprint,
        'brand_name',p.brand_name,
        'product_name',p.product_name,
        'variant_name',p.variant_name,
        'pack_size_text',p.pack_size_text,
        'category',p.category,
        'market_country_code',p.market_country_code,
        'gtin',p.gtin,
        'identity_status',p.identity_status,
        'offer',case when o.id is null then null else jsonb_build_object(
          'platform_name',o.platform_name,'merchant_name',o.merchant_name,'source_url',o.source_url,
          'affiliate_url',o.affiliate_url,'price',o.price,'currency',o.currency,'list_price',o.list_price,
          'availability_status',o.availability_status,'image_url',coalesce(o.image_url,i.image_url),
          'verified',o.verified,'retrieved_at',o.retrieved_at
        ) end,
        'image_url',coalesce(i.image_url,o.image_url),
        'strict_safety',case when s.id is null then null else jsonb_build_object(
          'assessment_id',s.id,'assessment_version',s.assessment_version,'assessment_status',s.assessment_status,
          'safety_score',s.overall_score,'child_score',s.child_score,'pregnancy_score',s.pregnancy_score,
          'senior_score',s.senior_score,'determination_confidence',s.determination_confidence,
          'ingredient_snapshot_sha256',s.ingredient_snapshot_sha256,'regulatory_snapshot_ref',s.regulatory_snapshot_ref,
          'warnings',s.warnings,'summary',s.summary,'expires_at',s.expires_at
        ) end
      ) as card
    from public.sp_catalog_product_v1 p
    left join lateral (
      select co.* from public.sp_catalog_commerce_offer_v1 co
      where co.product_id=p.id and co.verified=true and co.price is not null and co.price>0
        and upper(co.currency)='INR' and co.source_url~'^https://'
        and co.availability_status not in ('OUT_OF_STOCK','DISCONTINUED')
      order by co.retrieved_at desc,co.offer_confidence desc nulls last limit 1
    ) o on true
    left join lateral (
      select pi.* from public.sp_catalog_product_image_v1 pi
      where pi.product_id=p.id and pi.verified=true and pi.image_url~'^https://'
      order by pi.is_primary_display desc,pi.retrieved_at desc nulls last limit 1
    ) i on true
    left join lateral (
      select sa.*
      from public.sp_catalog_safety_assessment_v1 sa
      where sa.product_id=p.id and sa.is_current=true
        and sa.assessment_status='QUALIFIED'
        and sa.assessment_version='M1B_STRICT_REGULATORY_V1'
        and sa.expires_at>now()
        and sa.ingredient_snapshot_sha256=(
          select encode(extensions.digest(coalesce(string_agg(pi2.normalized_name,'|' order by pi2.ingredient_sequence,pi2.id),''),'sha256'),'hex')
          from public.sp_catalog_product_ingredient_v1 pi2
          where pi2.product_id=p.id and pi2.qualification_status='QUALIFIED'
        )
      order by sa.determined_at desc limit 1
    ) s on true
    where p.is_active=true and p.market_country_code='IN' and p.identity_status='VERIFIED' and o.id is not null
      and (v_category in ('','ALL') or upper(coalesce(p.category,''))=v_category)
      and (lower(p.product_name) like '%'||v_query||'%' or lower(p.brand_name||' '||p.product_name) like '%'||v_query||'%'
           or lower(coalesce(p.category,'')) like '%'||v_query||'%')
    order by rank_score desc,p.product_name
    limit v_limit
  ) x;

  return jsonb_build_object('success',true,'query',v_query,'candidate_count',jsonb_array_length(v_rows),'candidates',v_rows);
end;
$$;

revoke all on function public.sp_m1b_search_catalog_candidates_v1(text,text,integer) from public,anon,authenticated;
grant execute on function public.sp_m1b_search_catalog_candidates_v1(text,text,integer) to service_role;
