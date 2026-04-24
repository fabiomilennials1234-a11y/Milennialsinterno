-- =====================================================================
-- SECURITY WAVE 1 — #3 Financeiro (9 tabelas)
-- =====================================================================
-- Data: 2026-04-23
-- Auditoria: docs/superpowers/security/2026-04-23-rls-leakage-audit.md §2.2-§2.5
--
-- Escopo:
--   - mrr_changes              — ALL USING(true)  → admin + financeiro
--   - financeiro_contas_pagar  — 4 policies USING(true) → admin + financeiro
--   - financeiro_contas_receber— 4 policies USING(true) → admin + financeiro
--   - financeiro_active_clients— 4 policies auth.uid() IS NOT NULL → admin + financeiro
--   - financeiro_dre           — SELECT auth.uid() IS NOT NULL → admin + financeiro
--                                (policy ALL correta preservada)
--   - financeiro_produtos      — SELECT auth.uid() IS NOT NULL → idem
--   - financeiro_custos_produto— idem
--   - financeiro_produto_departamentos — idem
--   - financeiro_receita_produto — idem
--
-- Observação: tabelas financeiro não têm group_id; escopo é role-based.
--   is_admin = {ceo, cto, gestor_projetos}. 'financeiro' adicional via has_role.
--
-- Rollback: ver docs/superpowers/qa/2026-04-23-rls-backup-pre-security-wave1.sql
-- =====================================================================

BEGIN;

-- Helper local: macro de check reusável (via CTE impossível em policy; repetimos).
-- predicado: is_admin(uid) OR has_role(uid, 'financeiro')

-- ============================================================
-- mrr_changes
-- ============================================================
ALTER TABLE public.mrr_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.mrr_changes;

DROP POLICY IF EXISTS "mrr_changes_select" ON public.mrr_changes;
CREATE POLICY "mrr_changes_select"
  ON public.mrr_changes FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role));

DROP POLICY IF EXISTS "mrr_changes_insert" ON public.mrr_changes;
CREATE POLICY "mrr_changes_insert"
  ON public.mrr_changes FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role));

DROP POLICY IF EXISTS "mrr_changes_update" ON public.mrr_changes;
CREATE POLICY "mrr_changes_update"
  ON public.mrr_changes FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role));

DROP POLICY IF EXISTS "mrr_changes_delete" ON public.mrr_changes;
CREATE POLICY "mrr_changes_delete"
  ON public.mrr_changes FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role));

-- ============================================================
-- financeiro_contas_pagar
-- ============================================================
ALTER TABLE public.financeiro_contas_pagar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow delete for authenticated users" ON public.financeiro_contas_pagar;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.financeiro_contas_pagar;
DROP POLICY IF EXISTS "Allow read for authenticated users"   ON public.financeiro_contas_pagar;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.financeiro_contas_pagar;

DROP POLICY IF EXISTS "financeiro_contas_pagar_select" ON public.financeiro_contas_pagar;
CREATE POLICY "financeiro_contas_pagar_select"
  ON public.financeiro_contas_pagar FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role));

DROP POLICY IF EXISTS "financeiro_contas_pagar_insert" ON public.financeiro_contas_pagar;
CREATE POLICY "financeiro_contas_pagar_insert"
  ON public.financeiro_contas_pagar FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role));

DROP POLICY IF EXISTS "financeiro_contas_pagar_update" ON public.financeiro_contas_pagar;
CREATE POLICY "financeiro_contas_pagar_update"
  ON public.financeiro_contas_pagar FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role));

DROP POLICY IF EXISTS "financeiro_contas_pagar_delete" ON public.financeiro_contas_pagar;
CREATE POLICY "financeiro_contas_pagar_delete"
  ON public.financeiro_contas_pagar FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role));

-- ============================================================
-- financeiro_contas_receber
-- ============================================================
ALTER TABLE public.financeiro_contas_receber ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow delete for authenticated users" ON public.financeiro_contas_receber;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.financeiro_contas_receber;
DROP POLICY IF EXISTS "Allow read for authenticated users"   ON public.financeiro_contas_receber;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.financeiro_contas_receber;

DROP POLICY IF EXISTS "financeiro_contas_receber_select" ON public.financeiro_contas_receber;
CREATE POLICY "financeiro_contas_receber_select"
  ON public.financeiro_contas_receber FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role));

DROP POLICY IF EXISTS "financeiro_contas_receber_insert" ON public.financeiro_contas_receber;
CREATE POLICY "financeiro_contas_receber_insert"
  ON public.financeiro_contas_receber FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role));

DROP POLICY IF EXISTS "financeiro_contas_receber_update" ON public.financeiro_contas_receber;
CREATE POLICY "financeiro_contas_receber_update"
  ON public.financeiro_contas_receber FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role));

DROP POLICY IF EXISTS "financeiro_contas_receber_delete" ON public.financeiro_contas_receber;
CREATE POLICY "financeiro_contas_receber_delete"
  ON public.financeiro_contas_receber FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role));

-- ============================================================
-- financeiro_active_clients
-- ============================================================
ALTER TABLE public.financeiro_active_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active clients" ON public.financeiro_active_clients;
DROP POLICY IF EXISTS "Authenticated users can delete active clients" ON public.financeiro_active_clients;
DROP POLICY IF EXISTS "Authenticated users can insert active clients" ON public.financeiro_active_clients;
DROP POLICY IF EXISTS "Authenticated users can update active clients" ON public.financeiro_active_clients;

DROP POLICY IF EXISTS "financeiro_active_clients_select" ON public.financeiro_active_clients;
CREATE POLICY "financeiro_active_clients_select"
  ON public.financeiro_active_clients FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role));

DROP POLICY IF EXISTS "financeiro_active_clients_insert" ON public.financeiro_active_clients;
CREATE POLICY "financeiro_active_clients_insert"
  ON public.financeiro_active_clients FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role));

DROP POLICY IF EXISTS "financeiro_active_clients_update" ON public.financeiro_active_clients;
CREATE POLICY "financeiro_active_clients_update"
  ON public.financeiro_active_clients FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role));

DROP POLICY IF EXISTS "financeiro_active_clients_delete" ON public.financeiro_active_clients;
CREATE POLICY "financeiro_active_clients_delete"
  ON public.financeiro_active_clients FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role));

-- ============================================================
-- financeiro_dre - só o SELECT ruim é substituído; o ALL correto preservado
-- ============================================================
ALTER TABLE public.financeiro_dre ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "DRE viewable by authenticated users" ON public.financeiro_dre;

DROP POLICY IF EXISTS "financeiro_dre_select" ON public.financeiro_dre;
CREATE POLICY "financeiro_dre_select"
  ON public.financeiro_dre FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role));
-- NB: "DRE manageable by CEO and financeiro" (ALL) permanece e já cobre SELECT
-- pra esses users. Esta policy adicional é redundante com o USING do ALL,
-- mas fecha o caso "usuário que era coberto pela antiga SELECT permissiva".

-- ============================================================
-- financeiro_produtos
-- ============================================================
ALTER TABLE public.financeiro_produtos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Produtos viewable by authenticated users" ON public.financeiro_produtos;

DROP POLICY IF EXISTS "financeiro_produtos_select" ON public.financeiro_produtos;
CREATE POLICY "financeiro_produtos_select"
  ON public.financeiro_produtos FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role));

-- ============================================================
-- financeiro_custos_produto
-- ============================================================
ALTER TABLE public.financeiro_custos_produto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Custos viewable by authenticated users" ON public.financeiro_custos_produto;

DROP POLICY IF EXISTS "financeiro_custos_produto_select" ON public.financeiro_custos_produto;
CREATE POLICY "financeiro_custos_produto_select"
  ON public.financeiro_custos_produto FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role));

-- ============================================================
-- financeiro_produto_departamentos
-- ============================================================
ALTER TABLE public.financeiro_produto_departamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Departamentos viewable by authenticated users" ON public.financeiro_produto_departamentos;

DROP POLICY IF EXISTS "financeiro_produto_departamentos_select" ON public.financeiro_produto_departamentos;
CREATE POLICY "financeiro_produto_departamentos_select"
  ON public.financeiro_produto_departamentos FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role));

-- ============================================================
-- financeiro_receita_produto
-- ============================================================
ALTER TABLE public.financeiro_receita_produto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Receita viewable by authenticated users" ON public.financeiro_receita_produto;

DROP POLICY IF EXISTS "financeiro_receita_produto_select" ON public.financeiro_receita_produto;
CREATE POLICY "financeiro_receita_produto_select"
  ON public.financeiro_receita_produto FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::public.user_role));

DO $$ BEGIN RAISE NOTICE 'security_wave1 #3 financeiro (9 tabelas) fechado'; END $$;

COMMIT;

-- =====================================================================
-- ROLLBACK: ver docs/superpowers/qa/2026-04-23-rls-backup-pre-security-wave1.sql
-- =====================================================================
