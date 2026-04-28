-- =====================================================================
-- SECURITY WAVE 1 — #1 P0 BLOQUEADOR: financeiro_kanban_tasks
-- =====================================================================
-- Data: 2026-04-23
-- Auditoria: docs/superpowers/security/2026-04-23-rls-leakage-audit.md §2.1
-- Backup: docs/superpowers/qa/2026-04-23-rls-backup-pre-security-wave1.sql
--
-- Problema:
--   Policy "Allow all operations for authenticated users" com roles={public},
--   USING(true), WITH CHECK(true). Grants anon incluem INSERT.
--   PoC confirmado: anon POST /rest/v1/financeiro_kanban_tasks → HTTP 201.
--
-- Fix:
--   Dropar policy permissiva. Criar 2 policies (SELECT + WRITE/ALL) escopadas
--   a is_admin OR has_role('financeiro'). Restrict roles={authenticated}.
--
-- Rollback: ver docs/superpowers/qa/2026-04-23-rls-backup-pre-security-wave1.sql
-- =====================================================================

BEGIN;

-- Guard: garante RLS ativo (idempotente).
ALTER TABLE public.financeiro_kanban_tasks ENABLE ROW LEVEL SECURITY;

-- DROP policy permissiva.
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.financeiro_kanban_tasks;

-- SELECT: admin OR financeiro.
DROP POLICY IF EXISTS "financeiro_kanban_tasks_select" ON public.financeiro_kanban_tasks;
CREATE POLICY "financeiro_kanban_tasks_select"
  ON public.financeiro_kanban_tasks
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'financeiro'::public.user_role)
  );

-- INSERT: admin OR financeiro.
DROP POLICY IF EXISTS "financeiro_kanban_tasks_insert" ON public.financeiro_kanban_tasks;
CREATE POLICY "financeiro_kanban_tasks_insert"
  ON public.financeiro_kanban_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'financeiro'::public.user_role)
  );

-- UPDATE: admin OR financeiro (USING + WITH CHECK simétricos).
DROP POLICY IF EXISTS "financeiro_kanban_tasks_update" ON public.financeiro_kanban_tasks;
CREATE POLICY "financeiro_kanban_tasks_update"
  ON public.financeiro_kanban_tasks
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'financeiro'::public.user_role)
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'financeiro'::public.user_role)
  );

-- DELETE: admin OR financeiro.
DROP POLICY IF EXISTS "financeiro_kanban_tasks_delete" ON public.financeiro_kanban_tasks;
CREATE POLICY "financeiro_kanban_tasks_delete"
  ON public.financeiro_kanban_tasks
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'financeiro'::public.user_role)
  );

DO $$ BEGIN RAISE NOTICE 'security_wave1 #1 financeiro_kanban_tasks: anon-writable fechado'; END $$;

COMMIT;

-- =====================================================================
-- ROLLBACK (emergência):
--   DROP POLICY IF EXISTS "financeiro_kanban_tasks_select" ON public.financeiro_kanban_tasks;
--   DROP POLICY IF EXISTS "financeiro_kanban_tasks_insert" ON public.financeiro_kanban_tasks;
--   DROP POLICY IF EXISTS "financeiro_kanban_tasks_update" ON public.financeiro_kanban_tasks;
--   DROP POLICY IF EXISTS "financeiro_kanban_tasks_delete" ON public.financeiro_kanban_tasks;
--   CREATE POLICY "Allow all operations for authenticated users"
--     ON public.financeiro_kanban_tasks FOR ALL TO public
--     USING (true) WITH CHECK (true);
-- =====================================================================
