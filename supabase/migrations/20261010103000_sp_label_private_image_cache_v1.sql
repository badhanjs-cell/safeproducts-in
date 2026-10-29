-- SafeProducts only. Private, explicitly opted-in label photo retention.
-- Existing analysis records already persist ingredient lists and earned Safety Scores.
BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('sp-label-evidence-private-v1','sp-label-evidence-private-v1',false,10485760,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE
SET public=false, file_size_limit=10485760,
    allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'];

CREATE TABLE IF NOT EXISTS public.sp_web_label_private_images_v1 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.sp_web_label_analyses_v1(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  image_role text NOT NULL CHECK (image_role IN ('front','ingredients')),
  image_sha256 text NOT NULL CHECK (image_sha256 ~ '^[0-9a-f]{64}$'),
  storage_bucket text NOT NULL DEFAULT 'sp-label-evidence-private-v1'
    CHECK (storage_bucket = 'sp-label-evidence-private-v1'),
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
  byte_count integer NOT NULL CHECK (byte_count > 0 AND byte_count <= 10485760),
  consented_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(analysis_id,owner_id,image_role)
);
CREATE INDEX IF NOT EXISTS sp_web_label_private_images_owner_idx
  ON public.sp_web_label_private_images_v1 (owner_id, created_at DESC);
ALTER TABLE public.sp_web_label_private_images_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sp_web_label_private_images_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.sp_web_label_private_images_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sp_web_label_private_images_v1 TO service_role;

-- Extraction only: on re-check, M1-B MUST run current regulatory resolution
-- and scoring again. Never return a previously calculated Safety Score here.
CREATE OR REPLACE FUNCTION public.sp_web_label_cached_extraction_v1(
  p_image_sha256 text, p_engine_version text
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT jsonb_build_object(
    'detected_ingredients', a.detected_ingredients,
    'product_scope', a.product_scope,
    'declaration_complete', true,
    'uncertain_tokens', '[]'::jsonb,
    'cache_hit', true
  )
  FROM public.sp_web_label_analyses_v1 AS a
  WHERE p_image_sha256 ~ '^[0-9a-f]{64}$'
    AND a.image_sha256 = p_image_sha256
    AND a.engine_version = p_engine_version
    AND p_engine_version = 'M1B_LABEL_SAFETY_V1'
    AND a.safety_score IS NOT NULL
    AND a.evidence_coverage = 100
    AND a.research_pending_count = 0
    AND jsonb_typeof(a.detected_ingredients) = 'array'
    AND jsonb_array_length(a.detected_ingredients) BETWEEN 1 AND 150
  ORDER BY a.analysed_at DESC
  LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION public.sp_web_label_cached_extraction_v1(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sp_web_label_cached_extraction_v1(text,text) TO service_role;

COMMENT ON TABLE public.sp_web_label_private_images_v1 IS
'User-opt-in private source label photos, not public catalog images; analysis/scores remain in the existing qualified ledger. Owner image access via authenticated privileged service only.';
COMMIT;
