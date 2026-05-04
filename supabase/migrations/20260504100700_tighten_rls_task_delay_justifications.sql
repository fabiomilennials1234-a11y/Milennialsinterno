-- 20260504100700_tighten_rls_task_delay_justifications.sql
-- Apertar RLS: SELECT só próprias linhas; INSERT/UPDATE/DELETE bloqueado.
-- Master vê e age via RPCs SECURITY DEFINER (não passam por RLS).

ALTER TABLE public.task_delay_justifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized roles can view justifications by role" ON public.task_delay_justifications;
DROP POLICY IF EXISTS "CEO can update any justification" ON public.task_delay_justifications;
DROP POLICY IF EXISTS "Users can create own justifications" ON public.task_delay_justifications;
DROP POLICY IF EXISTS "Users can update own justifications" ON public.task_delay_justifications;
DROP POLICY IF EXISTS "Users can view own justifications" ON public.task_delay_justifications;

CREATE POLICY "tdj_select_own"
  ON public.task_delay_justifications
  FOR SELECT
  USING (user_id = auth.uid());

-- Sem INSERT/UPDATE/DELETE policies = bloqueado.
-- Toda escrita via RPCs SECURITY DEFINER.
