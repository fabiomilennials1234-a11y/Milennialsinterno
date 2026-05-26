-- 20260526100000_client_info_bank.sql
--
-- Creates client_info_bank: unified client information bank replacing
-- the 3 separate profile tables (design, dev, video).
-- 1:1 with clients via UNIQUE on client_id.
-- Any authenticated user can read/write. Admin-only delete.
--
-- Also migrates existing data from client_design_profiles,
-- client_dev_profiles, and client_video_profiles.

BEGIN;

-- ============================================================================
-- Table
-- ============================================================================
CREATE TABLE public.client_info_bank (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,

  -- Marca
  brand_colors     text,
  typography       text,
  visual_style     text,
  brand_manual_url text,
  logo_url         text,

  -- Presenca Digital
  website_url      text,
  instagram_handle text,
  youtube_channel  text,
  tiktok_handle    text,
  domain           text,

  -- Video
  editing_style    text,
  video_formats    text,

  -- Dev
  cms_platform     text,
  figma_url        text,

  -- Geral
  notes            text,

  -- Control
  created_by       uuid NOT NULL REFERENCES auth.users(id),
  updated_by       uuid NOT NULL REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_info_bank_client_id
  ON public.client_info_bank(client_id);

CREATE INDEX idx_client_info_bank_created_by
  ON public.client_info_bank(created_by);

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.client_info_bank ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user
CREATE POLICY "select_client_info_bank_authenticated"
  ON public.client_info_bank
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: any authenticated user
CREATE POLICY "insert_client_info_bank_authenticated"
  ON public.client_info_bank
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: any authenticated user
CREATE POLICY "update_client_info_bank_authenticated"
  ON public.client_info_bank
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: admin only (ceo, cto, gestor_projetos)
CREATE POLICY "delete_client_info_bank_admin"
  ON public.client_info_bank
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- updated_at trigger (reuse existing function)
-- ============================================================================
CREATE TRIGGER trg_client_info_bank_updated_at
  BEFORE UPDATE ON public.client_info_bank
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- RPC: upsert_client_info_bank
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_client_info_bank(
  p_client_id        uuid,
  p_brand_colors     text DEFAULT NULL,
  p_typography       text DEFAULT NULL,
  p_visual_style     text DEFAULT NULL,
  p_brand_manual_url text DEFAULT NULL,
  p_logo_url         text DEFAULT NULL,
  p_website_url      text DEFAULT NULL,
  p_instagram_handle text DEFAULT NULL,
  p_youtube_channel  text DEFAULT NULL,
  p_tiktok_handle    text DEFAULT NULL,
  p_domain           text DEFAULT NULL,
  p_editing_style    text DEFAULT NULL,
  p_video_formats    text DEFAULT NULL,
  p_cms_platform     text DEFAULT NULL,
  p_figma_url        text DEFAULT NULL,
  p_notes            text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_id uuid;
BEGIN
  -- Auth guard
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  -- Validate client exists
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client_id) THEN
    RAISE EXCEPTION 'client not found' USING ERRCODE = 'P0001';
  END IF;

  -- Upsert
  INSERT INTO public.client_info_bank (
    client_id,
    brand_colors, typography, visual_style, brand_manual_url, logo_url,
    website_url, instagram_handle, youtube_channel, tiktok_handle, domain,
    editing_style, video_formats,
    cms_platform, figma_url,
    notes,
    created_by, updated_by
  ) VALUES (
    p_client_id,
    p_brand_colors, p_typography, p_visual_style, p_brand_manual_url, p_logo_url,
    p_website_url, p_instagram_handle, p_youtube_channel, p_tiktok_handle, p_domain,
    p_editing_style, p_video_formats,
    p_cms_platform, p_figma_url,
    p_notes,
    v_caller, v_caller
  )
  ON CONFLICT (client_id) DO UPDATE SET
    brand_colors     = COALESCE(EXCLUDED.brand_colors, client_info_bank.brand_colors),
    typography       = COALESCE(EXCLUDED.typography, client_info_bank.typography),
    visual_style     = COALESCE(EXCLUDED.visual_style, client_info_bank.visual_style),
    brand_manual_url = COALESCE(EXCLUDED.brand_manual_url, client_info_bank.brand_manual_url),
    logo_url         = COALESCE(EXCLUDED.logo_url, client_info_bank.logo_url),
    website_url      = COALESCE(EXCLUDED.website_url, client_info_bank.website_url),
    instagram_handle = COALESCE(EXCLUDED.instagram_handle, client_info_bank.instagram_handle),
    youtube_channel  = COALESCE(EXCLUDED.youtube_channel, client_info_bank.youtube_channel),
    tiktok_handle    = COALESCE(EXCLUDED.tiktok_handle, client_info_bank.tiktok_handle),
    domain           = COALESCE(EXCLUDED.domain, client_info_bank.domain),
    editing_style    = COALESCE(EXCLUDED.editing_style, client_info_bank.editing_style),
    video_formats    = COALESCE(EXCLUDED.video_formats, client_info_bank.video_formats),
    cms_platform     = COALESCE(EXCLUDED.cms_platform, client_info_bank.cms_platform),
    figma_url        = COALESCE(EXCLUDED.figma_url, client_info_bank.figma_url),
    notes            = COALESCE(EXCLUDED.notes, client_info_bank.notes),
    updated_by       = v_caller,
    updated_at       = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END
$$;

REVOKE ALL ON FUNCTION public.upsert_client_info_bank(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_client_info_bank(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) TO authenticated;

-- ============================================================================
-- Data migration from legacy profile tables
-- ============================================================================
-- Strategy:
--   1. Collect all client_ids that have ANY profile
--   2. For each, merge fields. Exclusive fields copy directly.
--   3. Duplicate fields (instagram_handle, website_url, notes): pick from
--      the profile with the most recent updated_at
--   4. created_at = earliest, updated_at = latest across all profiles
--   5. created_by/updated_by = from the most recently updated profile
-- ============================================================================

INSERT INTO public.client_info_bank (
  client_id,
  -- Marca (from design)
  brand_colors, typography, visual_style, brand_manual_url, logo_url,
  -- Presenca Digital (merged)
  website_url, instagram_handle, youtube_channel, tiktok_handle, domain,
  -- Video (from video)
  editing_style, video_formats,
  -- Dev (from dev)
  cms_platform, figma_url,
  -- Geral (merged)
  notes,
  -- Control
  created_by, updated_by, created_at, updated_at
)
SELECT
  all_clients.client_id,

  -- Marca: exclusively from design
  dp.brand_colors,
  dp.typography,
  dp.visual_style,
  dp.brand_manual_url,
  dp.logo_url,

  -- website_url: exclusively from design (dev has domain, not website_url)
  dp.website_url,

  -- instagram_handle: design + video have it. Pick most recent.
  CASE
    WHEN dp.instagram_handle IS NOT NULL AND vp.instagram_handle IS NOT NULL THEN
      CASE WHEN COALESCE(dp.updated_at, '1970-01-01'::timestamptz) >= COALESCE(vp.updated_at, '1970-01-01'::timestamptz)
           THEN dp.instagram_handle ELSE vp.instagram_handle END
    WHEN dp.instagram_handle IS NOT NULL THEN dp.instagram_handle
    WHEN vp.instagram_handle IS NOT NULL THEN vp.instagram_handle
    ELSE NULL
  END,

  -- youtube_channel: exclusively from video
  vp.youtube_channel,

  -- tiktok_handle: exclusively from video
  vp.tiktok_handle,

  -- domain: exclusively from dev
  devp.domain,

  -- editing_style: exclusively from video
  vp.editing_style,

  -- video_formats: from video.video_format (singular → plural field name)
  vp.video_format,

  -- cms_platform: exclusively from dev
  devp.cms_platform,

  -- figma_url: exclusively from dev
  devp.figma_url,

  -- notes: all 3 have it. Pick from most recently updated profile.
  CASE
    WHEN COALESCE(dp.updated_at, '1970-01-01'::timestamptz) >= COALESCE(vp.updated_at, '1970-01-01'::timestamptz)
     AND COALESCE(dp.updated_at, '1970-01-01'::timestamptz) >= COALESCE(devp.updated_at, '1970-01-01'::timestamptz)
      THEN dp.notes
    WHEN COALESCE(vp.updated_at, '1970-01-01'::timestamptz) >= COALESCE(devp.updated_at, '1970-01-01'::timestamptz)
      THEN vp.notes
    ELSE devp.notes
  END,

  -- created_by: from most recently updated profile
  CASE
    WHEN COALESCE(dp.updated_at, '1970-01-01'::timestamptz) >= COALESCE(vp.updated_at, '1970-01-01'::timestamptz)
     AND COALESCE(dp.updated_at, '1970-01-01'::timestamptz) >= COALESCE(devp.updated_at, '1970-01-01'::timestamptz)
      THEN dp.created_by
    WHEN COALESCE(vp.updated_at, '1970-01-01'::timestamptz) >= COALESCE(devp.updated_at, '1970-01-01'::timestamptz)
      THEN vp.created_by
    ELSE devp.created_by
  END,

  -- updated_by: same as created_by source (legacy tables don't have updated_by)
  CASE
    WHEN COALESCE(dp.updated_at, '1970-01-01'::timestamptz) >= COALESCE(vp.updated_at, '1970-01-01'::timestamptz)
     AND COALESCE(dp.updated_at, '1970-01-01'::timestamptz) >= COALESCE(devp.updated_at, '1970-01-01'::timestamptz)
      THEN dp.created_by
    WHEN COALESCE(vp.updated_at, '1970-01-01'::timestamptz) >= COALESCE(devp.updated_at, '1970-01-01'::timestamptz)
      THEN vp.created_by
    ELSE devp.created_by
  END,

  -- created_at: earliest across all profiles
  LEAST(
    COALESCE(dp.created_at, 'infinity'::timestamptz),
    COALESCE(vp.created_at, 'infinity'::timestamptz),
    COALESCE(devp.created_at, 'infinity'::timestamptz)
  ),

  -- updated_at: latest across all profiles
  GREATEST(
    COALESCE(dp.updated_at, '-infinity'::timestamptz),
    COALESCE(vp.updated_at, '-infinity'::timestamptz),
    COALESCE(devp.updated_at, '-infinity'::timestamptz)
  )

FROM (
  SELECT client_id FROM public.client_design_profiles
  UNION
  SELECT client_id FROM public.client_video_profiles
  UNION
  SELECT client_id FROM public.client_dev_profiles
) all_clients
LEFT JOIN public.client_design_profiles dp ON dp.client_id = all_clients.client_id
LEFT JOIN public.client_video_profiles vp ON vp.client_id = all_clients.client_id
LEFT JOIN public.client_dev_profiles devp ON devp.client_id = all_clients.client_id
ON CONFLICT (client_id) DO NOTHING;

-- ============================================================================
-- Deprecation comments on legacy tables
-- ============================================================================
COMMENT ON TABLE public.client_design_profiles IS 'DEPRECATED: Use client_info_bank. Will be removed in a future migration.';
COMMENT ON TABLE public.client_video_profiles IS 'DEPRECATED: Use client_info_bank. Will be removed in a future migration.';
COMMENT ON TABLE public.client_dev_profiles IS 'DEPRECATED: Use client_info_bank. Will be removed in a future migration.';

COMMIT;
