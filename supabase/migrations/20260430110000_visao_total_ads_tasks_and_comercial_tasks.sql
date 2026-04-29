-- 20260430110000_visao_total_ads_tasks_and_comercial_tasks.sql
--
-- Visao TOTAL via page_grant em tabelas de tarefa.
-- Substitui filtros role-based hardcoded por can_access_page_data + filtro
-- de assignment como caminho complementar (assignment continua relevante
-- para o dono natural; grant explicito abre tudo).
--
-- Tabelas:
--   - ads_tasks                 (page_slug 'gestor-ads')
--   - ads_task_comments         (herda de ads_tasks)
--   - ads_task_delay_justifications  (page_slug 'gestor-ads')
--   - ads_task_delay_notifications   (page_slug 'gestor-ads')
--   - comercial_tasks           (page_slug 'consultor-comercial')
--
-- Operacao (INSERT/UPDATE/DELETE) NAO muda — visao != operacao.

BEGIN;

-- ── ads_tasks ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own tasks" ON public.ads_tasks;
DROP POLICY IF EXISTS "Authorized roles can view all ads tasks for monitoring" ON public.ads_tasks;

CREATE POLICY ads_tasks_select_visao_total
  ON public.ads_tasks FOR SELECT TO authenticated
  USING (
    ads_manager_id = auth.uid()
    OR public.can_access_page_data(auth.uid(), 'gestor-ads')
  );

-- ── ads_task_comments ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view comments on tasks they can access" ON public.ads_task_comments;

CREATE POLICY ads_task_comments_select_visao_total
  ON public.ads_task_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ads_tasks t
      WHERE t.id = ads_task_comments.task_id
        AND (
          t.ads_manager_id = auth.uid()
          OR public.can_access_page_data(auth.uid(), 'gestor-ads')
        )
    )
  );

-- ── ads_task_delay_justifications ──────────────────────────────────────

DROP POLICY IF EXISTS "Authorized roles can view justifications by role" ON public.ads_task_delay_justifications;
DROP POLICY IF EXISTS "CEO can view all justifications" ON public.ads_task_delay_justifications;
DROP POLICY IF EXISTS "Usuários veem suas próprias justificativas" ON public.ads_task_delay_justifications;

CREATE POLICY ads_task_delay_justifications_select_visao_total
  ON public.ads_task_delay_justifications FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.can_access_page_data(auth.uid(), 'gestor-ads')
  );

-- ── ads_task_delay_notifications ──────────────────────────────────────

DROP POLICY IF EXISTS "Notificações de atraso visíveis para cargos específicos" ON public.ads_task_delay_notifications;

CREATE POLICY ads_task_delay_notifications_select_visao_total
  ON public.ads_task_delay_notifications FOR SELECT TO authenticated
  USING (
    public.can_access_page_data(auth.uid(), 'gestor-ads')
  );

-- ── comercial_tasks ─────────────────────────────────────────────────────
-- Decisao: role default consultor_comercial mantem assignment (own).
-- Page_grant explicito abre tudo. Outros admins (executive/admin/gestor_projetos)
-- ja passam via can_access_page_data (is_admin embutido).

DROP POLICY IF EXISTS comercial_tasks_select ON public.comercial_tasks;

CREATE POLICY comercial_tasks_select_visao_total
  ON public.comercial_tasks FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.can_access_page_data(auth.uid(), 'consultor-comercial')
  );

COMMIT;
