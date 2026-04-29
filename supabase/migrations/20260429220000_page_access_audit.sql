-- 20260429220000_page_access_audit.sql
--
-- P2: Painel de auditoria de acessos a páginas.
--
-- Estrutura:
--   - public.page_access_audit: log append-only de cada acesso autorizado.
--     Campos: id, user_id, page_slug, user_role, grant_source, accessed_at.
--   - RPC log_page_access(_page_slug): registra acesso. Idempotente por
--     (user_id, page_slug, granted_by_role) na mesma janela de 5 minutos
--     para evitar inflar a tabela com refresh/navegação.
--   - RPC get_page_access_audit(...): leitura paginada com filtros para a
--     página /admin/auditoria. Apenas admins podem chamar.

BEGIN;

-- ── Tabela ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.page_access_audit (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_slug     text NOT NULL,
  user_role     text NOT NULL,
  grant_source  text NOT NULL CHECK (grant_source IN ('role_default','page_grant','admin_bypass')),
  accessed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS page_access_audit_user_accessed_idx
  ON public.page_access_audit (user_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS page_access_audit_page_accessed_idx
  ON public.page_access_audit (page_slug, accessed_at DESC);

ALTER TABLE public.page_access_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS page_access_audit_admin_select ON public.page_access_audit;
CREATE POLICY page_access_audit_admin_select
  ON public.page_access_audit FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS page_access_audit_self_insert ON public.page_access_audit;
CREATE POLICY page_access_audit_self_insert
  ON public.page_access_audit FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ── RPC: log_page_access ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_page_access(_page_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_role text;
  v_source text;
  v_recent_exists boolean;
BEGIN
  IF v_user IS NULL OR _page_slug IS NULL OR length(trim(_page_slug)) = 0 THEN
    RETURN;
  END IF;

  SELECT role::text INTO v_role
  FROM public.user_roles
  WHERE user_id = v_user
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN;
  END IF;

  -- Determina origem do grant.
  IF public.is_admin(v_user) THEN
    v_source := 'admin_bypass';
  ELSIF EXISTS (
    SELECT 1 FROM public.user_page_grants
    WHERE user_id = v_user AND page_slug = _page_slug
  ) THEN
    v_source := 'page_grant';
  ELSE
    v_source := 'role_default';
  END IF;

  -- Dedup: se já houver registro identico nos últimos 5 min, pula.
  SELECT EXISTS (
    SELECT 1 FROM public.page_access_audit
    WHERE user_id = v_user
      AND page_slug = _page_slug
      AND user_role = v_role
      AND accessed_at > now() - interval '5 minutes'
  ) INTO v_recent_exists;

  IF v_recent_exists THEN
    RETURN;
  END IF;

  INSERT INTO public.page_access_audit (user_id, page_slug, user_role, grant_source)
  VALUES (v_user, _page_slug, v_role, v_source);
END;
$$;

REVOKE ALL ON FUNCTION public.log_page_access(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_page_access(text) TO authenticated;

COMMENT ON FUNCTION public.log_page_access(text) IS
  'Registra acesso autorizado a página. Idempotente em janela de 5 min.';

-- ── RPC: get_page_access_audit ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_page_access_audit(
  _user_id uuid DEFAULT NULL,
  _page_slug text DEFAULT NULL,
  _since timestamptz DEFAULT NULL,
  _limit int DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_payload jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  WITH rows AS (
    SELECT
      a.id,
      a.user_id,
      p.name AS user_name,
      a.user_role,
      a.page_slug,
      a.grant_source,
      a.accessed_at
    FROM public.page_access_audit a
    LEFT JOIN public.profiles p ON p.user_id = a.user_id
    WHERE (_user_id IS NULL OR a.user_id = _user_id)
      AND (_page_slug IS NULL OR a.page_slug = _page_slug)
      AND (_since IS NULL OR a.accessed_at >= _since)
    ORDER BY a.accessed_at DESC
    LIMIT GREATEST(LEAST(_limit, 1000), 1)
  )
  SELECT jsonb_build_object(
    'rows', COALESCE(jsonb_agg(jsonb_build_object(
      'id',           id,
      'user_id',      user_id,
      'user_name',    user_name,
      'user_role',    user_role,
      'page_slug',    page_slug,
      'grant_source', grant_source,
      'accessed_at',  accessed_at
    )), '[]'::jsonb),
    'total', (SELECT count(*) FROM rows)
  )
  INTO v_payload
  FROM rows;

  RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.get_page_access_audit(uuid, text, timestamptz, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_page_access_audit(uuid, text, timestamptz, int) TO authenticated;

COMMENT ON FUNCTION public.get_page_access_audit(uuid, text, timestamptz, int) IS
  'Lista paginada de acessos auditados. Apenas admins.';

COMMIT;
