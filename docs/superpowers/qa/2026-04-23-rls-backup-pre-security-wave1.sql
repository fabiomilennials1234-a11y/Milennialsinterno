-- ============================================================================
-- BACKUP RLS POLICIES — Pre Security Wave 1
-- ============================================================================
-- Gerado: 2026-04-23
-- Projeto: semhnpwxptfgqxhkoqsk (PROD)
-- Fonte: pg_policies em PROD (Management API)
-- Propósito: rollback reconstruível das policies que serão DROP/REPLACE
--            nas migrations security wave 1 (20260423140xxx_*).
--
-- ORDEM DE USO EM EMERGÊNCIA:
--   1. Aplicar DROP POLICY IF EXISTS em cada nova policy criada pela wave 1
--      (ver seção "Rollback" ao final de cada migration).
--   2. Re-criar policies ORIGINAIS a partir deste arquivo (seções abaixo).
--   3. Validar RLS status via `SELECT relname, relrowsecurity FROM pg_class...`.
--
-- AVISO: policies abaixo são EXATAMENTE as que estavam em PROD antes da wave.
-- Não "melhoram" nada — só reestabelecem o estado anterior.
-- ============================================================================

BEGIN;

-- ==== financeiro_kanban_tasks =================================================
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.financeiro_kanban_tasks;
CREATE POLICY "Allow all operations for authenticated users"
  ON public.financeiro_kanban_tasks
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- ==== user_roles ==============================================================
-- CEO can create/update/delete são corretas e ficam intactas. Só SELECT era permissiva.
DROP POLICY IF EXISTS "Users can view all roles" ON public.user_roles;
CREATE POLICY "Users can view all roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (true);

-- ==== mrr_changes =============================================================
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.mrr_changes;
CREATE POLICY "Allow all for authenticated users"
  ON public.mrr_changes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ==== financeiro_contas_pagar ================================================
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON public.financeiro_contas_pagar;
CREATE POLICY "Allow delete for authenticated users"
  ON public.financeiro_contas_pagar FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.financeiro_contas_pagar;
CREATE POLICY "Allow insert for authenticated users"
  ON public.financeiro_contas_pagar FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.financeiro_contas_pagar;
CREATE POLICY "Allow read for authenticated users"
  ON public.financeiro_contas_pagar FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.financeiro_contas_pagar;
CREATE POLICY "Allow update for authenticated users"
  ON public.financeiro_contas_pagar FOR UPDATE TO authenticated USING (true);

-- ==== financeiro_contas_receber ==============================================
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON public.financeiro_contas_receber;
CREATE POLICY "Allow delete for authenticated users"
  ON public.financeiro_contas_receber FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.financeiro_contas_receber;
CREATE POLICY "Allow insert for authenticated users"
  ON public.financeiro_contas_receber FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.financeiro_contas_receber;
CREATE POLICY "Allow read for authenticated users"
  ON public.financeiro_contas_receber FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.financeiro_contas_receber;
CREATE POLICY "Allow update for authenticated users"
  ON public.financeiro_contas_receber FOR UPDATE TO authenticated USING (true);

-- ==== financeiro_active_clients ==============================================
DROP POLICY IF EXISTS "Anyone can view active clients" ON public.financeiro_active_clients;
CREATE POLICY "Anyone can view active clients"
  ON public.financeiro_active_clients FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete active clients" ON public.financeiro_active_clients;
CREATE POLICY "Authenticated users can delete active clients"
  ON public.financeiro_active_clients FOR DELETE TO public USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert active clients" ON public.financeiro_active_clients;
CREATE POLICY "Authenticated users can insert active clients"
  ON public.financeiro_active_clients FOR INSERT TO public WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update active clients" ON public.financeiro_active_clients;
CREATE POLICY "Authenticated users can update active clients"
  ON public.financeiro_active_clients FOR UPDATE TO public USING (auth.uid() IS NOT NULL);

-- ==== financeiro_dre ==========================================================
-- "DRE manageable by CEO and financeiro" é correta; preservada.
-- Remover "DRE viewable by authenticated users" que abre a qualquer logado.
DROP POLICY IF EXISTS "DRE viewable by authenticated users" ON public.financeiro_dre;
CREATE POLICY "DRE viewable by authenticated users"
  ON public.financeiro_dre FOR SELECT TO public USING (auth.uid() IS NOT NULL);

-- ==== financeiro_produtos =====================================================
DROP POLICY IF EXISTS "Produtos viewable by authenticated users" ON public.financeiro_produtos;
CREATE POLICY "Produtos viewable by authenticated users"
  ON public.financeiro_produtos FOR SELECT TO public USING (auth.uid() IS NOT NULL);

-- ==== financeiro_custos_produto ==============================================
DROP POLICY IF EXISTS "Custos viewable by authenticated users" ON public.financeiro_custos_produto;
CREATE POLICY "Custos viewable by authenticated users"
  ON public.financeiro_custos_produto FOR SELECT TO public USING (auth.uid() IS NOT NULL);

-- ==== financeiro_produto_departamentos ======================================
DROP POLICY IF EXISTS "Departamentos viewable by authenticated users" ON public.financeiro_produto_departamentos;
CREATE POLICY "Departamentos viewable by authenticated users"
  ON public.financeiro_produto_departamentos FOR SELECT TO public USING (auth.uid() IS NOT NULL);

-- ==== financeiro_receita_produto =============================================
DROP POLICY IF EXISTS "Receita viewable by authenticated users" ON public.financeiro_receita_produto;
CREATE POLICY "Receita viewable by authenticated users"
  ON public.financeiro_receita_produto FOR SELECT TO public USING (auth.uid() IS NOT NULL);

-- ==== rh_vagas ================================================================
DROP POLICY IF EXISTS "Authenticated users can delete rh_vagas" ON public.rh_vagas;
CREATE POLICY "Authenticated users can delete rh_vagas"
  ON public.rh_vagas FOR DELETE TO public USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert rh_vagas" ON public.rh_vagas;
CREATE POLICY "Authenticated users can insert rh_vagas"
  ON public.rh_vagas FOR INSERT TO public WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update rh_vagas" ON public.rh_vagas;
CREATE POLICY "Authenticated users can update rh_vagas"
  ON public.rh_vagas FOR UPDATE TO public USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view rh_vagas" ON public.rh_vagas;
CREATE POLICY "Users can view rh_vagas"
  ON public.rh_vagas FOR SELECT TO public USING (true);

-- ==== rh_candidatos ===========================================================
DROP POLICY IF EXISTS "Authenticated users can delete rh_candidatos" ON public.rh_candidatos;
CREATE POLICY "Authenticated users can delete rh_candidatos"
  ON public.rh_candidatos FOR DELETE TO public USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert rh_candidatos" ON public.rh_candidatos;
CREATE POLICY "Authenticated users can insert rh_candidatos"
  ON public.rh_candidatos FOR INSERT TO public WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update rh_candidatos" ON public.rh_candidatos;
CREATE POLICY "Authenticated users can update rh_candidatos"
  ON public.rh_candidatos FOR UPDATE TO public USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view rh_candidatos" ON public.rh_candidatos;
CREATE POLICY "Users can view rh_candidatos"
  ON public.rh_candidatos FOR SELECT TO public USING (true);

-- ==== rh_vaga_briefings ======================================================
DROP POLICY IF EXISTS "Authenticated users can delete rh_vaga_briefings" ON public.rh_vaga_briefings;
CREATE POLICY "Authenticated users can delete rh_vaga_briefings"
  ON public.rh_vaga_briefings FOR DELETE TO public USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert rh_vaga_briefings" ON public.rh_vaga_briefings;
CREATE POLICY "Authenticated users can insert rh_vaga_briefings"
  ON public.rh_vaga_briefings FOR INSERT TO public WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update rh_vaga_briefings" ON public.rh_vaga_briefings;
CREATE POLICY "Authenticated users can update rh_vaga_briefings"
  ON public.rh_vaga_briefings FOR UPDATE TO public USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view rh_vaga_briefings" ON public.rh_vaga_briefings;
CREATE POLICY "Users can view rh_vaga_briefings"
  ON public.rh_vaga_briefings FOR SELECT TO public USING (true);

-- ==== rh_atividades ===========================================================
DROP POLICY IF EXISTS "Authenticated users can insert rh_atividades" ON public.rh_atividades;
CREATE POLICY "Authenticated users can insert rh_atividades"
  ON public.rh_atividades FOR INSERT TO public WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view rh_atividades" ON public.rh_atividades;
CREATE POLICY "Users can view rh_atividades"
  ON public.rh_atividades FOR SELECT TO public USING (true);

-- ==== rh_comentarios ==========================================================
DROP POLICY IF EXISTS "Authenticated users can insert rh_comentarios" ON public.rh_comentarios;
CREATE POLICY "Authenticated users can insert rh_comentarios"
  ON public.rh_comentarios FOR INSERT TO public WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view rh_comentarios" ON public.rh_comentarios;
CREATE POLICY "Users can view rh_comentarios"
  ON public.rh_comentarios FOR SELECT TO public USING (true);

-- ==== rh_justificativas =======================================================
DROP POLICY IF EXISTS "Authenticated users can insert rh_justificativas" ON public.rh_justificativas;
CREATE POLICY "Authenticated users can insert rh_justificativas"
  ON public.rh_justificativas FOR INSERT TO public WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view rh_justificativas" ON public.rh_justificativas;
CREATE POLICY "Users can view rh_justificativas"
  ON public.rh_justificativas FOR SELECT TO public USING (true);

-- ==== rh_tarefas ==============================================================
DROP POLICY IF EXISTS "Allow authenticated users to delete rh_tarefas" ON public.rh_tarefas;
CREATE POLICY "Allow authenticated users to delete rh_tarefas"
  ON public.rh_tarefas FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert rh_tarefas" ON public.rh_tarefas;
CREATE POLICY "Allow authenticated users to insert rh_tarefas"
  ON public.rh_tarefas FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update rh_tarefas" ON public.rh_tarefas;
CREATE POLICY "Allow authenticated users to update rh_tarefas"
  ON public.rh_tarefas FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to view rh_tarefas" ON public.rh_tarefas;
CREATE POLICY "Allow authenticated users to view rh_tarefas"
  ON public.rh_tarefas FOR SELECT TO authenticated USING (true);

-- ==== rh_vaga_plataformas =====================================================
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON public.rh_vaga_plataformas;
CREATE POLICY "Allow delete for authenticated users"
  ON public.rh_vaga_plataformas FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.rh_vaga_plataformas;
CREATE POLICY "Allow insert for authenticated users"
  ON public.rh_vaga_plataformas FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.rh_vaga_plataformas;
CREATE POLICY "Allow read access for authenticated users"
  ON public.rh_vaga_plataformas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.rh_vaga_plataformas;
CREATE POLICY "Allow update for authenticated users"
  ON public.rh_vaga_plataformas FOR UPDATE TO authenticated USING (true);

-- ==== card_activities =========================================================
-- INSERT original (gated) preserved unchanged.
DROP POLICY IF EXISTS "Users can view activities" ON public.card_activities;
CREATE POLICY "Users can view activities"
  ON public.card_activities FOR SELECT TO authenticated USING (true);

-- ==== card_attachments ========================================================
-- INSERT/DELETE originais (gated) preserved. Só SELECT era permissivo.
DROP POLICY IF EXISTS "card_attachments_select" ON public.card_attachments;
CREATE POLICY "card_attachments_select"
  ON public.card_attachments FOR SELECT TO authenticated USING (true);

-- ==== card_comments ===========================================================
-- INSERT/DELETE originais (gated) preserved.
DROP POLICY IF EXISTS "Users can view comments" ON public.card_comments;
CREATE POLICY "Users can view comments"
  ON public.card_comments FOR SELECT TO authenticated USING (true);

COMMIT;

-- ============================================================================
-- FIM DO BACKUP
-- ============================================================================
