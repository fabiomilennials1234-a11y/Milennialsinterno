-- 20260511120000_client_design_profiles.sql
--
-- Creates client_design_profiles: persistent brand/identity info per client
-- for the Designer Client Info Bank feature.
-- 1:1 with clients via UNIQUE on client_id.
--
-- Viewer roles: ceo, cto, gestor_projetos, gestor_ads, outbound, sucesso_cliente, devs, design
-- Writer roles: ceo, cto, gestor_projetos, gestor_ads, design

BEGIN;

-- ============================================================================
-- Helper: can_view_design_board
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_view_design_board(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('ceo','cto','gestor_projetos','gestor_ads','outbound','sucesso_cliente','devs','design')
  );
$$;

COMMENT ON FUNCTION public.can_view_design_board(uuid) IS
  'True if user has a role that can view the design board and client design profiles.';

REVOKE ALL ON FUNCTION public.can_view_design_board(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_design_board(uuid) TO authenticated;

-- ============================================================================
-- Helper: can_write_design_board
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_write_design_board(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('ceo','cto','gestor_projetos','gestor_ads','design')
  );
$$;

COMMENT ON FUNCTION public.can_write_design_board(uuid) IS
  'True if user has a role that can create/update client design profiles.';

REVOKE ALL ON FUNCTION public.can_write_design_board(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_write_design_board(uuid) TO authenticated;

-- ============================================================================
-- Table
-- ============================================================================
CREATE TABLE public.client_design_profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  brand_colors     text,
  typography       text,
  visual_style     text,
  brand_manual_url text,
  logo_url         text,
  instagram_handle text,
  website_url      text,
  notes            text,
  created_by  uuid NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Index on client_id (covered by UNIQUE but explicit for clarity in policy lookups)
CREATE INDEX idx_client_design_profiles_client_id
  ON public.client_design_profiles(client_id);

CREATE INDEX idx_client_design_profiles_created_by
  ON public.client_design_profiles(created_by);

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.client_design_profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: design board viewers
CREATE POLICY "select_design_board_viewers"
  ON public.client_design_profiles
  FOR SELECT
  TO authenticated
  USING (public.can_view_design_board(auth.uid()));

-- INSERT: design board writers
CREATE POLICY "insert_design_board_writers"
  ON public.client_design_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_write_design_board(auth.uid()));

-- UPDATE: design board writers
CREATE POLICY "update_design_board_writers"
  ON public.client_design_profiles
  FOR UPDATE
  TO authenticated
  USING (public.can_write_design_board(auth.uid()))
  WITH CHECK (public.can_write_design_board(auth.uid()));

-- DELETE: only admins (ceo/cto/gestor_projetos)
CREATE POLICY "delete_design_profiles_admin"
  ON public.client_design_profiles
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- updated_at trigger
-- ============================================================================
CREATE TRIGGER trg_client_design_profiles_updated_at
  BEFORE UPDATE ON public.client_design_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- RPC: upsert_client_design_profile
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_client_design_profile(
  p_client_id       uuid,
  p_brand_colors    text DEFAULT NULL,
  p_typography      text DEFAULT NULL,
  p_visual_style    text DEFAULT NULL,
  p_brand_manual_url text DEFAULT NULL,
  p_logo_url        text DEFAULT NULL,
  p_instagram_handle text DEFAULT NULL,
  p_website_url     text DEFAULT NULL,
  p_notes           text DEFAULT NULL
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
  IF NOT public.can_write_design_board(v_caller) THEN
    RAISE EXCEPTION 'not authorized — requires design board write access' USING ERRCODE = '42501';
  END IF;

  -- Validate client exists
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client_id) THEN
    RAISE EXCEPTION 'client not found' USING ERRCODE = 'P0001';
  END IF;

  -- Upsert
  INSERT INTO public.client_design_profiles (
    client_id,
    brand_colors,
    typography,
    visual_style,
    brand_manual_url,
    logo_url,
    instagram_handle,
    website_url,
    notes,
    created_by
  ) VALUES (
    p_client_id,
    p_brand_colors,
    p_typography,
    p_visual_style,
    p_brand_manual_url,
    p_logo_url,
    p_instagram_handle,
    p_website_url,
    p_notes,
    v_caller
  )
  ON CONFLICT (client_id) DO UPDATE SET
    brand_colors     = COALESCE(EXCLUDED.brand_colors, client_design_profiles.brand_colors),
    typography       = COALESCE(EXCLUDED.typography, client_design_profiles.typography),
    visual_style     = COALESCE(EXCLUDED.visual_style, client_design_profiles.visual_style),
    brand_manual_url = COALESCE(EXCLUDED.brand_manual_url, client_design_profiles.brand_manual_url),
    logo_url         = COALESCE(EXCLUDED.logo_url, client_design_profiles.logo_url),
    instagram_handle = COALESCE(EXCLUDED.instagram_handle, client_design_profiles.instagram_handle),
    website_url      = COALESCE(EXCLUDED.website_url, client_design_profiles.website_url),
    notes            = COALESCE(EXCLUDED.notes, client_design_profiles.notes),
    updated_at       = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END
$$;

REVOKE ALL ON FUNCTION public.upsert_client_design_profile(uuid, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_client_design_profile(uuid, text, text, text, text, text, text, text, text) TO authenticated;

COMMIT;
