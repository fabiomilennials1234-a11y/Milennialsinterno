-- 20260512310000_client_dev_profiles.sql
--
-- Creates client_dev_profiles: persistent frontend/dev info per client
-- for the Desenvolvedor Client Info Bank feature.
-- 1:1 with clients via UNIQUE on client_id.
--
-- Viewer roles: ceo, cto, gestor_projetos, gestor_ads, outbound, sucesso_cliente, devs, design
-- Writer roles: ceo, cto, gestor_projetos, gestor_ads, devs

BEGIN;

-- ============================================================================
-- Helper: can_view_devs_board
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_view_devs_board(_user_id uuid)
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

COMMENT ON FUNCTION public.can_view_devs_board(uuid) IS
  'True if user has a role that can view the devs board and client dev profiles.';

REVOKE ALL ON FUNCTION public.can_view_devs_board(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_devs_board(uuid) TO authenticated;

-- ============================================================================
-- Helper: can_write_devs_board
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_write_devs_board(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('ceo','cto','gestor_projetos','gestor_ads','devs')
  );
$$;

COMMENT ON FUNCTION public.can_write_devs_board(uuid) IS
  'True if user has a role that can create/update client dev profiles.';

REVOKE ALL ON FUNCTION public.can_write_devs_board(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_write_devs_board(uuid) TO authenticated;

-- ============================================================================
-- Table
-- ============================================================================
CREATE TABLE public.client_dev_profiles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  frontend_stack    text,
  css_framework     text,
  cms_platform      text,
  hosting_provider  text,
  domain            text,
  staging_url       text,
  repository_url    text,
  figma_url         text,
  analytics_id      text,
  api_docs_url      text,
  deploy_notes      text,
  notes             text,
  created_by        uuid NOT NULL REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_dev_profiles_client_id
  ON public.client_dev_profiles(client_id);

CREATE INDEX idx_client_dev_profiles_created_by
  ON public.client_dev_profiles(created_by);

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.client_dev_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_devs_board_viewers"
  ON public.client_dev_profiles
  FOR SELECT
  TO authenticated
  USING (public.can_view_devs_board(auth.uid()));

CREATE POLICY "insert_devs_board_writers"
  ON public.client_dev_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_write_devs_board(auth.uid()));

CREATE POLICY "update_devs_board_writers"
  ON public.client_dev_profiles
  FOR UPDATE
  TO authenticated
  USING (public.can_write_devs_board(auth.uid()))
  WITH CHECK (public.can_write_devs_board(auth.uid()));

CREATE POLICY "delete_dev_profiles_admin"
  ON public.client_dev_profiles
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- updated_at trigger
-- ============================================================================
CREATE TRIGGER trg_client_dev_profiles_updated_at
  BEFORE UPDATE ON public.client_dev_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- RPC: upsert_client_dev_profile
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_client_dev_profile(
  p_client_id        uuid,
  p_frontend_stack   text DEFAULT NULL,
  p_css_framework    text DEFAULT NULL,
  p_cms_platform     text DEFAULT NULL,
  p_hosting_provider text DEFAULT NULL,
  p_domain           text DEFAULT NULL,
  p_staging_url      text DEFAULT NULL,
  p_repository_url   text DEFAULT NULL,
  p_figma_url        text DEFAULT NULL,
  p_analytics_id     text DEFAULT NULL,
  p_api_docs_url     text DEFAULT NULL,
  p_deploy_notes     text DEFAULT NULL,
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
  IF NOT public.can_write_devs_board(v_caller) THEN
    RAISE EXCEPTION 'not authorized — requires devs board write access' USING ERRCODE = '42501';
  END IF;

  -- Validate client exists
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client_id) THEN
    RAISE EXCEPTION 'client not found' USING ERRCODE = 'P0001';
  END IF;

  -- Upsert
  INSERT INTO public.client_dev_profiles (
    client_id,
    frontend_stack,
    css_framework,
    cms_platform,
    hosting_provider,
    domain,
    staging_url,
    repository_url,
    figma_url,
    analytics_id,
    api_docs_url,
    deploy_notes,
    notes,
    created_by
  ) VALUES (
    p_client_id,
    p_frontend_stack,
    p_css_framework,
    p_cms_platform,
    p_hosting_provider,
    p_domain,
    p_staging_url,
    p_repository_url,
    p_figma_url,
    p_analytics_id,
    p_api_docs_url,
    p_deploy_notes,
    p_notes,
    v_caller
  )
  ON CONFLICT (client_id) DO UPDATE SET
    frontend_stack   = COALESCE(EXCLUDED.frontend_stack, client_dev_profiles.frontend_stack),
    css_framework    = COALESCE(EXCLUDED.css_framework, client_dev_profiles.css_framework),
    cms_platform     = COALESCE(EXCLUDED.cms_platform, client_dev_profiles.cms_platform),
    hosting_provider = COALESCE(EXCLUDED.hosting_provider, client_dev_profiles.hosting_provider),
    domain           = COALESCE(EXCLUDED.domain, client_dev_profiles.domain),
    staging_url      = COALESCE(EXCLUDED.staging_url, client_dev_profiles.staging_url),
    repository_url   = COALESCE(EXCLUDED.repository_url, client_dev_profiles.repository_url),
    figma_url        = COALESCE(EXCLUDED.figma_url, client_dev_profiles.figma_url),
    analytics_id     = COALESCE(EXCLUDED.analytics_id, client_dev_profiles.analytics_id),
    api_docs_url     = COALESCE(EXCLUDED.api_docs_url, client_dev_profiles.api_docs_url),
    deploy_notes     = COALESCE(EXCLUDED.deploy_notes, client_dev_profiles.deploy_notes),
    notes            = COALESCE(EXCLUDED.notes, client_dev_profiles.notes),
    updated_at       = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END
$$;

REVOKE ALL ON FUNCTION public.upsert_client_dev_profile(uuid, text, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_client_dev_profile(uuid, text, text, text, text, text, text, text, text, text, text, text, text) TO authenticated;

COMMIT;
