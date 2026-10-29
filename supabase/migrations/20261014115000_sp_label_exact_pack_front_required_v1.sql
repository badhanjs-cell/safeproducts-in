-- Require successful private storage of the product front before publishing its exact-pack screening cache.
BEGIN;
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
 JOIN public.sp_web_label_front_asset_v1 f ON f.scan_id=s.id AND f.front_sha256=s.front_sha256
 WHERE p.is_active=true AND nullif(btrim(p.pack_size_text),'') IS NOT NULL
  AND length(btrim(p_query)) BETWEEN 5 AND 200
  AND p_profile IN ('ALL','Children','Pregnant Women','Seniors')
  AND s.profile_used=p_profile AND s.score_status IN ('QUALIFIED','PROVISIONAL')
  AND regexp_replace(lower(p_query),'[^a-z0-9]+','','g')=
      regexp_replace(lower(concat_ws(' ',p.brand_name,p.product_name,p.variant_name,p.pack_size_text)),'[^a-z0-9]+','','g')
 ORDER BY CASE s.score_status WHEN 'QUALIFIED' THEN 0 ELSE 1 END,s.created_at DESC
 LIMIT 1
$fn$;
COMMIT;
