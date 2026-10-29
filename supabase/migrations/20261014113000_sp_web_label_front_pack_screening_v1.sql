-- SafeProducts label v2: scanned front only, explicit pack identity, provisional-vs-qualified scores.
-- Private user photo is not exposed through search; ingredient photo bytes are never stored.
BEGIN;
CREATE TABLE IF NOT EXISTS public.sp_web_label_pack_scan_v1 (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null unique references public.sp_m1b_run_v1(id),
 owner_id uuid not null,
 product_id uuid not null references public.sp_catalog_product_v1(id),
 front_sha256 text not null check(front_sha256 ~ '^[0-9a-f]{64}$'),
 ingredient_sha256 text not null check(ingredient_sha256 ~ '^[0-9a-f]{64}$'),
 profile_used text not null check(profile_used in ('ALL','Children','Pregnant Women','Seniors')),
 score_status text not null check(score_status in ('QUALIFIED','PROVISIONAL','UNDETERMINED')),
 screening_score numeric check(screening_score between 0 and 100),
 evidence_coverage numeric check(evidence_coverage between 0 and 100),
 engine_version text not null default 'M1B_LABEL_SAFETY_V2',
 score_policy_version text,
 detected_ingredients jsonb not null default '[]'::jsonb check(jsonb_typeof(detected_ingredients)='array'),
 ingredient_breakdown jsonb not null default '[]'::jsonb check(jsonb_typeof(ingredient_breakdown)='array'),
 warnings jsonb not null default '[]'::jsonb check(jsonb_typeof(warnings)='array'),
 created_at timestamptz not null default now(),
 check(front_sha256 <> ingredient_sha256),
 check ((score_status='UNDETERMINED' and screening_score is null) or
        (score_status<>'UNDETERMINED' and screening_score is not null)),
 check (score_status<>'QUALIFIED' or evidence_coverage=100)
);
CREATE INDEX IF NOT EXISTS sp_web_label_pack_scan_product_idx
 ON public.sp_web_label_pack_scan_v1(product_id,profile_used,created_at DESC);
CREATE TABLE IF NOT EXISTS public.sp_web_label_front_asset_v1 (
 scan_id uuid primary key references public.sp_web_label_pack_scan_v1(id) on delete cascade,
 owner_id uuid not null,
 front_sha256 text not null check(front_sha256 ~ '^[0-9a-f]{64}$'),
 storage_bucket text not null default 'sp-label-evidence-private-v1' check(storage_bucket='sp-label-evidence-private-v1'),
 storage_path text not null unique,
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),
 byte_count integer not null check(byte_count between 1 and 10485760),
 created_at timestamptz not null default now()
);
ALTER TABLE public.sp_web_label_pack_scan_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sp_web_label_front_asset_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sp_web_label_pack_scan_v1 FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sp_web_label_front_asset_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.sp_web_label_pack_scan_v1 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.sp_web_label_front_asset_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.sp_web_label_pack_scan_v1 TO service_role;
GRANT SELECT,INSERT ON public.sp_web_label_front_asset_v1 TO service_role;
-- A service-only RPC ties the score to an actual M1-B run + exact canonical identity.
CREATE OR REPLACE FUNCTION public.sp_web_label_record_pack_scan_v1(
 p_run_id uuid,p_owner_id uuid,p_front_sha256 text,p_ingredient_sha256 text,
 p_profile text,p_status text,p_score numeric,p_coverage numeric,
 p_ingredients jsonb,p_breakdown jsonb,p_warnings jsonb,p_policy text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
DECLARE v_id uuid;v_product_id uuid;
BEGIN
 IF p_owner_id IS NULL OR p_run_id IS NULL OR p_front_sha256 !~ '^[a-f0-9]{64}$'
  OR p_ingredient_sha256 !~ '^[a-f0-9]{64}$' OR p_front_sha256=p_ingredient_sha256
  THEN RAISE EXCEPTION 'INVALID_LABEL_PROVENANCE' USING errcode='22023'; END IF;
 IF p_status NOT IN ('QUALIFIED','PROVISIONAL','UNDETERMINED')
  OR p_profile NOT IN ('ALL','Children','Pregnant Women','Seniors')
  OR p_coverage IS NULL OR p_coverage<0 OR p_coverage>100
  OR (p_status='QUALIFIED' AND p_coverage<>100)
  OR (p_status='UNDETERMINED' AND p_score IS NOT NULL)
  OR (p_status<>'UNDETERMINED' AND (p_score IS NULL OR p_score<0 OR p_score>100))
  OR jsonb_typeof(p_ingredients)<>'array' OR jsonb_array_length(p_ingredients)>150
  OR jsonb_typeof(p_breakdown)<>'array' OR jsonb_typeof(p_warnings)<>'array'
  THEN RAISE EXCEPTION 'INVALID_LABEL_SCORE_EVIDENCE' USING errcode='22023'; END IF;
 SELECT product_id INTO v_product_id FROM public.sp_m1b_run_v1
  WHERE id=p_run_id AND context='CHECK_MY_LABEL';
 IF v_product_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.sp_catalog_product_image_v1
   WHERE product_id=v_product_id AND image_role='FRONT_LABEL' AND image_sha256=p_front_sha256)
  OR NOT EXISTS (
  SELECT 1 FROM public.sp_catalog_product_image_v1
   WHERE product_id=v_product_id AND image_role='INGREDIENT_LABEL' AND image_sha256=p_ingredient_sha256)
  THEN RAISE EXCEPTION 'LABEL_SOURCE_PAIR_NOT_REGISTERED' USING errcode='22023'; END IF;
 INSERT INTO public.sp_web_label_pack_scan_v1(
  run_id,owner_id,product_id,front_sha256,ingredient_sha256,profile_used,score_status,
  screening_score,evidence_coverage,detected_ingredients,ingredient_breakdown,warnings,score_policy_version
 ) VALUES (p_run_id,p_owner_id,v_product_id,p_front_sha256,p_ingredient_sha256,p_profile,p_status,
  p_score,p_coverage,p_ingredients,p_breakdown,p_warnings,p_policy)
 ON CONFLICT(run_id) DO NOTHING RETURNING id INTO v_id;
 IF v_id IS NULL THEN
  SELECT id INTO v_id FROM public.sp_web_label_pack_scan_v1
   WHERE run_id=p_run_id AND owner_id=p_owner_id AND product_id=v_product_id;
 END IF;
 RETURN v_id;
END $fn$;
REVOKE ALL ON FUNCTION public.sp_web_label_record_pack_scan_v1(uuid,uuid,text,text,text,text,numeric,numeric,jsonb,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sp_web_label_record_pack_scan_v1(uuid,uuid,text,text,text,text,numeric,numeric,jsonb,jsonb,jsonb,text) TO service_role;
-- Public search results require an exact full product+variant+pack identity match.
-- Scan owner IDs, source image hashes, storage paths and user photos are never exposed.
CREATE OR REPLACE FUNCTION public.sp_web_label_exact_pack_search_v1(p_query text,p_profile text DEFAULT 'ALL')
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
 SELECT jsonb_build_object(
 'product_id',p.id,'product_fingerprint',p.product_fingerprint,'brand_name',p.brand_name,
 'product_name',p.product_name,'variant_name',p.variant_name,'pack_size_text',p.pack_size_text,
 'pack_normalized_key',p.pack_normalized_key,'category',p.category,
 'score_status',s.score_status,'screening_score',s.screening_score,
 'score_policy_version',s.score_policy_version,'evidence_coverage',s.evidence_coverage,
 'warnings',s.warnings,'source','USER_LABEL_EXACT_PACK')
 FROM public.sp_catalog_product_v1 p
 JOIN public.sp_web_label_pack_scan_v1 s on s.product_id=p.id
 WHERE p.is_active=true AND nullif(btrim(p.pack_size_text),'') IS NOT NULL
  AND length(btrim(p_query)) BETWEEN 5 AND 200
  AND p_profile IN ('ALL','Children','Pregnant Women','Seniors')
  AND s.profile_used=p_profile AND s.score_status IN ('QUALIFIED','PROVISIONAL')
  AND regexp_replace(lower(p_query),'[^a-z0-9]+','','g')=
      regexp_replace(lower(concat_ws(' ',p.brand_name,p.product_name,p.variant_name,p.pack_size_text)),'[^a-z0-9]+','','g')
 ORDER BY CASE s.score_status WHEN 'QUALIFIED' THEN 0 ELSE 1 END,s.created_at DESC
 LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION public.sp_web_label_exact_pack_search_v1(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sp_web_label_exact_pack_search_v1(text,text) TO anon,authenticated,service_role;
COMMENT ON FUNCTION public.sp_web_label_exact_pack_search_v1(text,text) IS
'Exact identity + exact pack consumer lookup. Never exposes user image, owner or hashes. Provisional screening is not SAFETY_QUALIFIED.';
COMMIT;
