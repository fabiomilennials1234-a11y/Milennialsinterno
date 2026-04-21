-- 20260420230000_tool_credentials.sql
--
-- Cria public.tool_credentials — tabela de credenciais de ferramentas externas
-- (Make, Cursos, etc.) consumidas pelas Ferramenta*Section.tsx do app.
--
-- Substitui hardcode de login/senha que estavam no bundle (vide audit
-- docs/superpowers/security/2026-04-20-credential-exposure-audit.md).
--
-- NÃO inclui valores das credenciais — seed roda via
-- supabase/backfills/20260420_tool_credentials_seed.sh com env vars.
--
-- Visibilidade controlada por coluna visible_to_roles (text[]) + RLS.
-- CRUD só admin. SELECT: admin OU user tem role listado em visible_to_roles.

BEGIN;

CREATE TABLE IF NOT EXISTS public.tool_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_name text NOT NULL,
  credential_type text NOT NULL CHECK (credential_type IN ('password','token','api_key','login')),
  credential_value text NOT NULL,  -- em claro; migração futura usa pgsodium/vault
  label text,
  visible_to_roles text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (tool_name, credential_type)
);

COMMENT ON TABLE public.tool_credentials IS
  'Credenciais de ferramentas externas consumidas por seções de Ferramentas no app. RLS por role em visible_to_roles. Substitui hardcode em Ferramenta*Section.tsx (audit 2026-04-20).';

COMMENT ON COLUMN public.tool_credentials.credential_value IS
  'Valor em claro. Migração futura: pgsodium/Vault. Nunca expor a anon.';

COMMENT ON COLUMN public.tool_credentials.visible_to_roles IS
  'Array de roles (text) que enxergam a credencial. Ex: ARRAY[''ceo'',''outbound'']. Admin sempre vê.';

CREATE INDEX IF NOT EXISTS idx_tool_credentials_lookup
  ON public.tool_credentials(tool_name, credential_type)
  WHERE is_active = true;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tool_credentials_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  -- Se valor rotacionou, marca rotated_at
  IF NEW.credential_value IS DISTINCT FROM OLD.credential_value THEN
    NEW.rotated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_tool_credentials_updated_at ON public.tool_credentials;
CREATE TRIGGER trigger_tool_credentials_updated_at
  BEFORE UPDATE ON public.tool_credentials
  FOR EACH ROW EXECUTE FUNCTION public.tool_credentials_updated_at();

ALTER TABLE public.tool_credentials ENABLE ROW LEVEL SECURITY;

-- SELECT: user tem role que está em visible_to_roles, OU é admin.
-- is_active = true obrigatório — credenciais desabilitadas não aparecem.
DROP POLICY IF EXISTS tool_credentials_select ON public.tool_credentials;
CREATE POLICY tool_credentials_select ON public.tool_credentials
  FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role::text = ANY (visible_to_roles)
      )
    )
  );

-- INSERT/UPDATE/DELETE: só admin.
DROP POLICY IF EXISTS tool_credentials_insert_admin ON public.tool_credentials;
CREATE POLICY tool_credentials_insert_admin ON public.tool_credentials
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS tool_credentials_update_admin ON public.tool_credentials;
CREATE POLICY tool_credentials_update_admin ON public.tool_credentials
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS tool_credentials_delete_admin ON public.tool_credentials;
CREATE POLICY tool_credentials_delete_admin ON public.tool_credentials
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

COMMIT;
