-- 20260512300000_client_video_profiles.sql
--
-- Creates client_video_profiles: persistent editing/production info per client
-- for the Editor de Vídeo Client Info Bank feature.
-- 1:1 with clients via UNIQUE on client_id.
--
-- Viewer roles: ceo, cto, gestor_projetos, gestor_ads, outbound, sucesso_cliente, editor_video, design
-- Writer roles: ceo, cto, gestor_projetos, gestor_ads, editor_video

BEGIN;

-- ============================================================================
-- Helper: can_view_video_board
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_view_video_board(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('ceo','cto','gestor_projetos','gestor_ads','outbound','sucesso_cliente','editor_video','design')
  );
$$;

COMMENT ON FUNCTION public.can_view_video_board(uuid) IS
  'True if user has a role that can view the video board and client video profiles.';

REVOKE ALL ON FUNCTION public.can_view_video_board(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_video_board(uuid) TO authenticated;

-- ============================================================================
-- Helper: can_write_video_board
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_write_video_board(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('ceo','cto','gestor_projetos','gestor_ads','editor_video')
  );
$$;

COMMENT ON FUNCTION public.can_write_video_board(uuid) IS
  'True if user has a role that can create/update client video profiles.';

REVOKE ALL ON FUNCTION public.can_write_video_board(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_write_video_board(uuid) TO authenticated;

-- ============================================================================
-- Table
-- ============================================================================
CREATE TABLE public.client_video_profiles (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  editing_style    text,
  video_format     text,
  resolution       text,
  youtube_channel  text,
  tiktok_handle    text,
  instagram_handle text,
  pacing           text,
  music_style      text,
  intro_outro_url  text,
  reference_urls   text,
  brand_assets_url text,
  notes            text,
  created_by       uuid NOT NULL REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_video_profiles_client_id
  ON public.client_video_profiles(client_id);

CREATE INDEX idx_client_video_profiles_created_by
  ON public.client_video_profiles(created_by);

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.client_video_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_video_board_viewers"
  ON public.client_video_profiles
  FOR SELECT
  TO authenticated
  USING (public.can_view_video_board(auth.uid()));

CREATE POLICY "insert_video_board_writers"
  ON public.client_video_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_write_video_board(auth.uid()));

CREATE POLICY "update_video_board_writers"
  ON public.client_video_profiles
  FOR UPDATE
  TO authenticated
  USING (public.can_write_video_board(auth.uid()))
  WITH CHECK (public.can_write_video_board(auth.uid()));

CREATE POLICY "delete_video_profiles_admin"
  ON public.client_video_profiles
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- updated_at trigger
-- ============================================================================
CREATE TRIGGER trg_client_video_profiles_updated_at
  BEFORE UPDATE ON public.client_video_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- RPC: upsert_client_video_profile
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_client_video_profile(
  p_client_id        uuid,
  p_editing_style    text DEFAULT NULL,
  p_video_format     text DEFAULT NULL,
  p_resolution       text DEFAULT NULL,
  p_youtube_channel  text DEFAULT NULL,
  p_tiktok_handle    text DEFAULT NULL,
  p_instagram_handle text DEFAULT NULL,
  p_pacing           text DEFAULT NULL,
  p_music_style      text DEFAULT NULL,
  p_intro_outro_url  text DEFAULT NULL,
  p_reference_urls   text DEFAULT NULL,
  p_brand_assets_url text DEFAULT NULL,
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

  -- Role guard
  IF NOT public.can_write_video_board(v_caller) THEN
    RAISE EXCEPTION 'not authorized — requires video board write access' USING ERRCODE = '42501';
  END IF;

  -- Validate client exists
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client_id) THEN
    RAISE EXCEPTION 'client not found' USING ERRCODE = 'P0001';
  END IF;

  -- Upsert
  INSERT INTO public.client_video_profiles (
    client_id,
    editing_style,
    video_format,
    resolution,
    youtube_channel,
    tiktok_handle,
    instagram_handle,
    pacing,
    music_style,
    intro_outro_url,
    reference_urls,
    brand_assets_url,
    notes,
    created_by
  ) VALUES (
    p_client_id,
    p_editing_style,
    p_video_format,
    p_resolution,
    p_youtube_channel,
    p_tiktok_handle,
    p_instagram_handle,
    p_pacing,
    p_music_style,
    p_intro_outro_url,
    p_reference_urls,
    p_brand_assets_url,
    p_notes,
    v_caller
  )
  ON CONFLICT (client_id) DO UPDATE SET
    editing_style    = COALESCE(EXCLUDED.editing_style, client_video_profiles.editing_style),
    video_format     = COALESCE(EXCLUDED.video_format, client_video_profiles.video_format),
    resolution       = COALESCE(EXCLUDED.resolution, client_video_profiles.resolution),
    youtube_channel  = COALESCE(EXCLUDED.youtube_channel, client_video_profiles.youtube_channel),
    tiktok_handle    = COALESCE(EXCLUDED.tiktok_handle, client_video_profiles.tiktok_handle),
    instagram_handle = COALESCE(EXCLUDED.instagram_handle, client_video_profiles.instagram_handle),
    pacing           = COALESCE(EXCLUDED.pacing, client_video_profiles.pacing),
    music_style      = COALESCE(EXCLUDED.music_style, client_video_profiles.music_style),
    intro_outro_url  = COALESCE(EXCLUDED.intro_outro_url, client_video_profiles.intro_outro_url),
    reference_urls   = COALESCE(EXCLUDED.reference_urls, client_video_profiles.reference_urls),
    brand_assets_url = COALESCE(EXCLUDED.brand_assets_url, client_video_profiles.brand_assets_url),
    notes            = COALESCE(EXCLUDED.notes, client_video_profiles.notes),
    updated_at       = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END
$$;

REVOKE ALL ON FUNCTION public.upsert_client_video_profile(uuid, text, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_client_video_profile(uuid, text, text, text, text, text, text, text, text, text, text, text, text) TO authenticated;

COMMIT;
