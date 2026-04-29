-- 20260430130000_visao_total_rh_financeiro_non_sensitive.sql
--
-- Visao TOTAL via page_grant em RH e Financeiro NAO-sensiveis.
--
-- Tabelas RH abertas (via 'rh' page_slug):
--   rh_tarefas, rh_atividades, rh_comentarios, rh_justificativas,
--   rh_vagas, rh_vaga_briefings, rh_vaga_plataformas
--
-- Tabela Financeiro aberta (via 'financeiro' page_slug):
--   financeiro_kanban_tasks
--
-- Tabelas SENSIVEIS NAO ABERTAS (preservadas com policies originais):
--   - rh_candidatos (LGPD/PII — exige role default rh OU slug sensivel proprio)
--   - tabelas de folha/salario/comissoes (a auditar em fase futura)
--
-- Operacao (INSERT/UPDATE/DELETE) NAO muda.

BEGIN;

-- ── RH ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS rh_tarefas_select ON public.rh_tarefas;
CREATE POLICY rh_tarefas_select_visao_total
  ON public.rh_tarefas FOR SELECT TO authenticated
  USING (public.can_access_page_data(auth.uid(), 'rh'));

DROP POLICY IF EXISTS rh_atividades_select ON public.rh_atividades;
CREATE POLICY rh_atividades_select_visao_total
  ON public.rh_atividades FOR SELECT TO authenticated
  USING (public.can_access_page_data(auth.uid(), 'rh'));

DROP POLICY IF EXISTS rh_comentarios_select ON public.rh_comentarios;
CREATE POLICY rh_comentarios_select_visao_total
  ON public.rh_comentarios FOR SELECT TO authenticated
  USING (public.can_access_page_data(auth.uid(), 'rh'));

DROP POLICY IF EXISTS rh_justificativas_select ON public.rh_justificativas;
CREATE POLICY rh_justificativas_select_visao_total
  ON public.rh_justificativas FOR SELECT TO authenticated
  USING (public.can_access_page_data(auth.uid(), 'rh'));

DROP POLICY IF EXISTS rh_vagas_select ON public.rh_vagas;
CREATE POLICY rh_vagas_select_visao_total
  ON public.rh_vagas FOR SELECT TO authenticated
  USING (public.can_access_page_data(auth.uid(), 'rh'));

DROP POLICY IF EXISTS rh_vaga_briefings_select ON public.rh_vaga_briefings;
CREATE POLICY rh_vaga_briefings_select_visao_total
  ON public.rh_vaga_briefings FOR SELECT TO authenticated
  USING (public.can_access_page_data(auth.uid(), 'rh'));

DROP POLICY IF EXISTS rh_vaga_plataformas_select ON public.rh_vaga_plataformas;
CREATE POLICY rh_vaga_plataformas_select_visao_total
  ON public.rh_vaga_plataformas FOR SELECT TO authenticated
  USING (public.can_access_page_data(auth.uid(), 'rh'));

-- ── Financeiro ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS financeiro_kanban_tasks_select ON public.financeiro_kanban_tasks;
CREATE POLICY financeiro_kanban_tasks_select_visao_total
  ON public.financeiro_kanban_tasks FOR SELECT TO authenticated
  USING (public.can_access_page_data(auth.uid(), 'financeiro'));

-- rh_candidatos NAO MUDA. Permanece restrito a role rh + admins.

COMMIT;
