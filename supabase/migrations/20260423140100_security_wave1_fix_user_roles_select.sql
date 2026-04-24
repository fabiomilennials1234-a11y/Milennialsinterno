-- =====================================================================
-- SECURITY WAVE 1 — #2 user_roles SELECT leakage
-- =====================================================================
-- Data: 2026-04-23
-- Auditoria: docs/superpowers/security/2026-04-23-rls-leakage-audit.md §2.12
--
-- Problema:
--   Policy "Users can view all roles" SELECT com USING(true) roles={authenticated}.
--   Qualquer authenticated lê user_id + role de todos os 25 users —
--   vetor de spearphishing (enumeração de CEO/CTO/gestores).
--
-- Fix:
--   DROP policy aberta. CREATE policy restrita a:
--     - próprio user_roles (user_id = auth.uid())
--     - OR is_admin(auth.uid()) bypass
--
-- Atenção frontend:
--   Múltiplos hooks leem user_roles sem filtro por auth.uid() pra
--   listar gestores/cops. Após este fix, esses hooks RETORNAM VAZIO
--   pra usuários NÃO-admin. Ver relatório wave 1 para lista completa.
--   Bypass is_admin cobre CEO/CTO/gestor_projetos (admins operacionais).
--
-- CEO INSERT/UPDATE/DELETE policies preservadas (is_ceo(auth.uid())).
--
-- Rollback: ver docs/superpowers/qa/2026-04-23-rls-backup-pre-security-wave1.sql
-- =====================================================================

BEGIN;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all roles" ON public.user_roles;

DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own role"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin(auth.uid())
  );

DO $$ BEGIN RAISE NOTICE 'security_wave1 #2 user_roles SELECT fechada'; END $$;

COMMIT;

-- =====================================================================
-- ROLLBACK:
--   DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
--   CREATE POLICY "Users can view all roles"
--     ON public.user_roles FOR SELECT TO authenticated USING (true);
-- =====================================================================
