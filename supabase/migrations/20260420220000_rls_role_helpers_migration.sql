-- 20260420220000_rls_role_helpers_migration.sql
--
-- Wave 1 Track A.3 — Migração massiva de policies RLS que usavam literal
-- de role (`'ceo'`, `'gestor_projetos'`, `has_role(uid, 'X')` solo) sem
-- cobertura via helper is_admin/is_executive. Cada policy vira:
--   * EXISTS(... role = ANY(ARRAY['ceo', X, Y, ...]))
--       -> is_admin(auth.uid()) OR has_role(..., 'X') OR has_role(..., 'Y')
--         (ceo colapsa em is_admin; demais viram has_role)
--   * EXISTS(... role = 'ceo') solo
--       -> is_executive(auth.uid()) OR is_admin(auth.uid())
--   * has_role(..., 'X') isolado
--       -> is_admin(auth.uid()) OR has_role(..., 'X')
--
-- Exclui 11 policies já corrigidas em 20260420190000 (financeiro_tasks,
-- financeiro_client_onboarding, ads_tasks parciais).
--
-- Referência: docs/wiki/00-Arquitetura/Auditoria RLS Literal Role 2026-04-20.md
-- Semântica preservada. Admin ganha bypass adicional — nenhum role
-- funcional perde acesso. Todas as policies criadas com TO authenticated
-- explícito (defesa contra invocação anônima via PostgREST).

BEGIN;

-- ===========================================================================
-- BLOCO 1 — CRITICOS — fluxo principal cliente (clients/invoices/sales/cs_action_plans)
-- (17 policies)
-- ===========================================================================

-- client_invoices / Financeiro pode atualizar faturamentos (UPDATE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['financeiro'::user_role, 'gestor_projetos'::user_role, 'ceo'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "Financeiro pode atualizar faturamentos" ON public.client_invoices;
CREATE POLICY "Financeiro pode atualizar faturamentos" ON public.client_invoices
  FOR UPDATE TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- client_invoices / Financeiro pode criar faturamentos (INSERT)
-- OLD CHECK: (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['financeiro'::user_role, 'gestor_projetos'::user_role, 'ceo'::user_role])))))
-- NEW CHECK: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "Financeiro pode criar faturamentos" ON public.client_invoices;
CREATE POLICY "Financeiro pode criar faturamentos" ON public.client_invoices
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- client_invoices / Financeiro pode deletar faturamentos (DELETE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['financeiro'::user_role, 'gestor_projetos'::user_role, 'ceo'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "Financeiro pode deletar faturamentos" ON public.client_invoices;
CREATE POLICY "Financeiro pode deletar faturamentos" ON public.client_invoices
  FOR DELETE TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- client_invoices / Financeiro pode ver faturamentos (SELECT)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['financeiro'::user_role, 'gestor_projetos'::user_role, 'ceo'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "Financeiro pode ver faturamentos" ON public.client_invoices;
CREATE POLICY "Financeiro pode ver faturamentos" ON public.client_invoices
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- client_sales / Authorized roles can insert sales (INSERT)
-- OLD CHECK: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'financeiro'::user_role, 'consultor_comercial'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW CHECK: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'consultor_comercial'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "Authorized roles can insert sales" ON public.client_sales;
CREATE POLICY "Authorized roles can insert sales" ON public.client_sales
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'consultor_comercial'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- client_sales / Authorized roles can view all sales (SELECT)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'financeiro'::user_role, 'consultor_comercial'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'consultor_comercial'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "Authorized roles can view all sales" ON public.client_sales;
CREATE POLICY "Authorized roles can view all sales" ON public.client_sales
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'consultor_comercial'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- clients / Ads Manager can update assigned clients (UPDATE)
-- OLD USING: ((EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'gestor_ads'::user_role)))) AND (assigned_ads_manager = auth.uid()))
-- NEW USING: ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_ads'::user_role)) AND (assigned_ads_manager = auth.uid()))
-- OLD CHECK: ((EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'gestor_ads'::user_role)))) AND (assigned_ads_manager = auth.uid()))
-- NEW CHECK: ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_ads'::user_role)) AND (assigned_ads_manager = auth.uid()))
DROP POLICY IF EXISTS "Ads Manager can update assigned clients" ON public.clients;
CREATE POLICY "Ads Manager can update assigned clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_ads'::user_role)) AND (assigned_ads_manager = auth.uid())))
  WITH CHECK (((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_ads'::user_role)) AND (assigned_ads_manager = auth.uid())));

-- clients / Consultor Comercial can view all clients (SELECT)
-- OLD USING: has_role(auth.uid(), 'consultor_comercial'::user_role)
-- NEW USING: (public.is_admin(auth.uid()) OR has_role(auth.uid(), 'consultor_comercial'::user_role))
DROP POLICY IF EXISTS "Consultor Comercial can view all clients" ON public.clients;
CREATE POLICY "Consultor Comercial can view all clients" ON public.clients
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR has_role(auth.uid(), 'consultor_comercial'::user_role)));

-- clients / Financeiro can update clients for churn workflow (UPDATE)
-- OLD USING: has_role(auth.uid(), 'financeiro'::user_role)
-- NEW USING: (public.is_admin(auth.uid()) OR has_role(auth.uid(), 'financeiro'::user_role))
DROP POLICY IF EXISTS "Financeiro can update clients for churn workflow" ON public.clients;
CREATE POLICY "Financeiro can update clients for churn workflow" ON public.clients
  FOR UPDATE TO authenticated
  USING ((public.is_admin(auth.uid()) OR has_role(auth.uid(), 'financeiro'::user_role)));

-- clients / Financeiro can view all clients (SELECT)
-- OLD USING: has_role(auth.uid(), 'financeiro'::user_role)
-- NEW USING: (public.is_admin(auth.uid()) OR has_role(auth.uid(), 'financeiro'::user_role))
DROP POLICY IF EXISTS "Financeiro can view all clients" ON public.clients;
CREATE POLICY "Financeiro can view all clients" ON public.clients
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR has_role(auth.uid(), 'financeiro'::user_role)));

-- clients / Gestor de Projetos can view clients in their group (SELECT)
-- OLD USING: (has_role(auth.uid(), 'gestor_projetos'::user_role) AND (group_id = get_user_group_id(auth.uid())))
-- NEW USING: (public.is_admin(auth.uid()) OR ((has_role(auth.uid(), 'gestor_projetos'::user_role) AND (group_id = get_user_group_id(auth.uid())))))
DROP POLICY IF EXISTS "Gestor de Projetos can view clients in their group" ON public.clients;
CREATE POLICY "Gestor de Projetos can view clients in their group" ON public.clients
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR ((has_role(auth.uid(), 'gestor_projetos'::user_role) AND (group_id = get_user_group_id(auth.uid()))))));

-- clients / Outbound can view all clients (SELECT)
-- OLD USING: has_role(auth.uid(), 'outbound'::user_role)
-- NEW USING: (public.is_admin(auth.uid()) OR has_role(auth.uid(), 'outbound'::user_role))
DROP POLICY IF EXISTS "Outbound can view all clients" ON public.clients;
CREATE POLICY "Outbound can view all clients" ON public.clients
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR has_role(auth.uid(), 'outbound'::user_role)));

-- clients / Sucesso do Cliente can update clients for CX validation (UPDATE)
-- OLD USING: has_role(auth.uid(), 'sucesso_cliente'::user_role)
-- NEW USING: (public.is_admin(auth.uid()) OR has_role(auth.uid(), 'sucesso_cliente'::user_role))
-- OLD CHECK: has_role(auth.uid(), 'sucesso_cliente'::user_role)
-- NEW CHECK: (public.is_admin(auth.uid()) OR has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "Sucesso do Cliente can update clients for CX validation" ON public.clients;
CREATE POLICY "Sucesso do Cliente can update clients for CX validation" ON public.clients
  FOR UPDATE TO authenticated
  USING ((public.is_admin(auth.uid()) OR has_role(auth.uid(), 'sucesso_cliente'::user_role)))
  WITH CHECK ((public.is_admin(auth.uid()) OR has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- clients / Sucesso do Cliente can view all clients (SELECT)
-- OLD USING: has_role(auth.uid(), 'sucesso_cliente'::user_role)
-- NEW USING: (public.is_admin(auth.uid()) OR has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "Sucesso do Cliente can view all clients" ON public.clients;
CREATE POLICY "Sucesso do Cliente can view all clients" ON public.clients
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- cs_action_plans / CS and CEO can create action plans (INSERT)
-- OLD CHECK: (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['ceo'::user_role, 'sucesso_cliente'::user_role, 'gestor_projetos'::user_role])))))
-- NEW CHECK: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "CS and CEO can create action plans" ON public.cs_action_plans;
CREATE POLICY "CS and CEO can create action plans" ON public.cs_action_plans
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- cs_action_plans / CS and CEO can delete action plans (DELETE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['ceo'::user_role, 'sucesso_cliente'::user_role, 'gestor_projetos'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "CS and CEO can delete action plans" ON public.cs_action_plans;
CREATE POLICY "CS and CEO can delete action plans" ON public.cs_action_plans
  FOR DELETE TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- cs_action_plans / CS and CEO can update action plans (UPDATE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['ceo'::user_role, 'sucesso_cliente'::user_role, 'gestor_projetos'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "CS and CEO can update action plans" ON public.cs_action_plans;
CREATE POLICY "CS and CEO can update action plans" ON public.cs_action_plans
  FOR UPDATE TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- ===========================================================================
-- BLOCO 2 — CRITICOS — briefings de departamento (atrizes/design/dev/produtora/video)
-- (15 policies)
-- ===========================================================================

-- atrizes_briefings / atrizes_briefings_delete (DELETE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'atrizes_gravacao'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'atrizes_gravacao'::user_role))
DROP POLICY IF EXISTS "atrizes_briefings_delete" ON public.atrizes_briefings;
CREATE POLICY "atrizes_briefings_delete" ON public.atrizes_briefings
  FOR DELETE TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'atrizes_gravacao'::user_role)));

-- atrizes_briefings / atrizes_briefings_insert (INSERT)
-- OLD CHECK: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'atrizes_gravacao'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW CHECK: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'atrizes_gravacao'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "atrizes_briefings_insert" ON public.atrizes_briefings;
CREATE POLICY "atrizes_briefings_insert" ON public.atrizes_briefings
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'atrizes_gravacao'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- atrizes_briefings / atrizes_briefings_update (UPDATE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'atrizes_gravacao'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'atrizes_gravacao'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "atrizes_briefings_update" ON public.atrizes_briefings;
CREATE POLICY "atrizes_briefings_update" ON public.atrizes_briefings
  FOR UPDATE TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'atrizes_gravacao'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- design_briefings / design_briefings_delete (DELETE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'design'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'design'::user_role))
DROP POLICY IF EXISTS "design_briefings_delete" ON public.design_briefings;
CREATE POLICY "design_briefings_delete" ON public.design_briefings
  FOR DELETE TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'design'::user_role)));

-- design_briefings / design_briefings_insert (INSERT)
-- OLD CHECK: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'design'::user_role])))))
-- NEW CHECK: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'design'::user_role))
DROP POLICY IF EXISTS "design_briefings_insert" ON public.design_briefings;
CREATE POLICY "design_briefings_insert" ON public.design_briefings
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'design'::user_role)));

-- design_briefings / design_briefings_update (UPDATE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'design'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'design'::user_role))
DROP POLICY IF EXISTS "design_briefings_update" ON public.design_briefings;
CREATE POLICY "design_briefings_update" ON public.design_briefings
  FOR UPDATE TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'design'::user_role)));

-- dev_briefings / dev_briefings_delete (DELETE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'devs'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'devs'::user_role))
DROP POLICY IF EXISTS "dev_briefings_delete" ON public.dev_briefings;
CREATE POLICY "dev_briefings_delete" ON public.dev_briefings
  FOR DELETE TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'devs'::user_role)));

-- dev_briefings / dev_briefings_insert (INSERT)
-- OLD CHECK: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'devs'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW CHECK: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'devs'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "dev_briefings_insert" ON public.dev_briefings;
CREATE POLICY "dev_briefings_insert" ON public.dev_briefings
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'devs'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- dev_briefings / dev_briefings_update (UPDATE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'devs'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'devs'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "dev_briefings_update" ON public.dev_briefings;
CREATE POLICY "dev_briefings_update" ON public.dev_briefings
  FOR UPDATE TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'devs'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- produtora_briefings / produtora_briefings_delete (DELETE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'produtora'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'produtora'::user_role))
DROP POLICY IF EXISTS "produtora_briefings_delete" ON public.produtora_briefings;
CREATE POLICY "produtora_briefings_delete" ON public.produtora_briefings
  FOR DELETE TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'produtora'::user_role)));

-- produtora_briefings / produtora_briefings_insert (INSERT)
-- OLD CHECK: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'produtora'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW CHECK: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'produtora'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "produtora_briefings_insert" ON public.produtora_briefings;
CREATE POLICY "produtora_briefings_insert" ON public.produtora_briefings
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'produtora'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- produtora_briefings / produtora_briefings_update (UPDATE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'produtora'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'produtora'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "produtora_briefings_update" ON public.produtora_briefings;
CREATE POLICY "produtora_briefings_update" ON public.produtora_briefings
  FOR UPDATE TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'produtora'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- video_briefings / video_briefings_delete (DELETE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'editor_video'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'editor_video'::user_role))
DROP POLICY IF EXISTS "video_briefings_delete" ON public.video_briefings;
CREATE POLICY "video_briefings_delete" ON public.video_briefings
  FOR DELETE TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'editor_video'::user_role)));

-- video_briefings / video_briefings_insert (INSERT)
-- OLD CHECK: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'editor_video'::user_role])))))
-- NEW CHECK: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'editor_video'::user_role))
DROP POLICY IF EXISTS "video_briefings_insert" ON public.video_briefings;
CREATE POLICY "video_briefings_insert" ON public.video_briefings
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'editor_video'::user_role)));

-- video_briefings / video_briefings_update (UPDATE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'editor_video'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'editor_video'::user_role))
DROP POLICY IF EXISTS "video_briefings_update" ON public.video_briefings;
CREATE POLICY "video_briefings_update" ON public.video_briefings
  FOR UPDATE TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'editor_video'::user_role)));

-- ===========================================================================
-- BLOCO 3 — CRITICOS — kanban tasks (comercial_tasks, ads_tasks, ads_task_comments)
-- (4 policies)
-- ===========================================================================

-- ads_task_comments / Users can view comments on tasks they can access (SELECT)
-- OLD USING: (EXISTS ( SELECT 1 FROM ads_tasks t WHERE ((t.id = ads_task_comments.task_id) AND ((t.ads_manager_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'sucesso_cliente'::user_role])))))))))
-- NEW USING: (EXISTS ( SELECT 1 FROM ads_tasks t WHERE ((t.id = ads_task_comments.task_id) AND ((t.ads_manager_id = auth.uid()) OR (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))))))
DROP POLICY IF EXISTS "Users can view comments on tasks they can access" ON public.ads_task_comments;
CREATE POLICY "Users can view comments on tasks they can access" ON public.ads_task_comments
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM ads_tasks t
  WHERE ((t.id = ads_task_comments.task_id) AND ((t.ads_manager_id = auth.uid()) OR (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)))))));

-- ads_tasks / Authorized roles can view all ads tasks for monitoring (SELECT)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "Authorized roles can view all ads tasks for monitoring" ON public.ads_tasks;
CREATE POLICY "Authorized roles can view all ads tasks for monitoring" ON public.ads_tasks
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- comercial_tasks / comercial_tasks_delete (DELETE)
-- OLD USING: ((user_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'ceo'::user_role)))))
-- NEW USING: ((user_id = auth.uid()) OR (public.is_executive(auth.uid()) OR public.is_admin(auth.uid())))
DROP POLICY IF EXISTS "comercial_tasks_delete" ON public.comercial_tasks;
CREATE POLICY "comercial_tasks_delete" ON public.comercial_tasks
  FOR DELETE TO authenticated
  USING (((user_id = auth.uid()) OR (public.is_executive(auth.uid()) OR public.is_admin(auth.uid()))));

-- comercial_tasks / comercial_tasks_select (SELECT)
-- OLD USING: ((user_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role]))))))
-- NEW USING: ((user_id = auth.uid()) OR (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)))
DROP POLICY IF EXISTS "comercial_tasks_select" ON public.comercial_tasks;
CREATE POLICY "comercial_tasks_select" ON public.comercial_tasks
  FOR SELECT TO authenticated
  USING (((user_id = auth.uid()) OR (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))));

-- ===========================================================================
-- BLOCO 4 — ALTOS — kanban anexos (card_attachments)
-- (2 policies)
-- ===========================================================================

-- card_attachments / card_attachments_delete (DELETE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'devs'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'devs'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "card_attachments_delete" ON public.card_attachments;
CREATE POLICY "card_attachments_delete" ON public.card_attachments
  FOR DELETE TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'devs'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- card_attachments / card_attachments_insert (INSERT)
-- OLD CHECK: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'devs'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW CHECK: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'devs'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "card_attachments_insert" ON public.card_attachments;
CREATE POLICY "card_attachments_insert" ON public.card_attachments
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'devs'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- ===========================================================================
-- BLOCO 5 — ALTOS — notificações/justificativas/completion (ads/design/dev/produtora/video/task)
-- (33 policies)
-- ===========================================================================

-- ads_task_delay_justifications / Authorized roles can view justifications by role (SELECT)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['gestor_ads'::user_role, 'sucesso_cliente'::user_role, 'gestor_projetos'::user_role, 'ceo'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "Authorized roles can view justifications by role" ON public.ads_task_delay_justifications;
CREATE POLICY "Authorized roles can view justifications by role" ON public.ads_task_delay_justifications
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- ads_task_delay_justifications / CEO can view all justifications (SELECT)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'ceo'::user_role))))
-- NEW USING: (public.is_executive(auth.uid()) OR public.is_admin(auth.uid()))
DROP POLICY IF EXISTS "CEO can view all justifications" ON public.ads_task_delay_justifications;
CREATE POLICY "CEO can view all justifications" ON public.ads_task_delay_justifications
  FOR SELECT TO authenticated
  USING ((public.is_executive(auth.uid()) OR public.is_admin(auth.uid())));

-- ads_task_delay_justifications / Only CEO can archive justifications (UPDATE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'ceo'::user_role))))
-- NEW USING: (public.is_executive(auth.uid()) OR public.is_admin(auth.uid()))
-- OLD CHECK: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'ceo'::user_role))))
-- NEW CHECK: (public.is_executive(auth.uid()) OR public.is_admin(auth.uid()))
DROP POLICY IF EXISTS "Only CEO can archive justifications" ON public.ads_task_delay_justifications;
CREATE POLICY "Only CEO can archive justifications" ON public.ads_task_delay_justifications
  FOR UPDATE TO authenticated
  USING ((public.is_executive(auth.uid()) OR public.is_admin(auth.uid())))
  WITH CHECK ((public.is_executive(auth.uid()) OR public.is_admin(auth.uid())));

-- ads_task_delay_notifications / Admins podem deletar notificações (DELETE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "Admins podem deletar notificações" ON public.ads_task_delay_notifications;
CREATE POLICY "Admins podem deletar notificações" ON public.ads_task_delay_notifications
  FOR DELETE TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- ads_task_delay_notifications / Notificações de atraso visíveis para cargos específicos (SELECT)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['gestor_ads'::user_role, 'sucesso_cliente'::user_role, 'gestor_projetos'::user_role, 'ceo'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "Notificações de atraso visíveis para cargos específicos" ON public.ads_task_delay_notifications;
CREATE POLICY "Notificações de atraso visíveis para cargos específicos" ON public.ads_task_delay_notifications
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- ads_task_delay_notifications / Usuários autenticados podem inserir notificações (INSERT)
-- OLD CHECK: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['gestor_ads'::user_role, 'sucesso_cliente'::user_role, 'gestor_projetos'::user_role, 'ceo'::user_role])))))
-- NEW CHECK: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "Usuários autenticados podem inserir notificações" ON public.ads_task_delay_notifications;
CREATE POLICY "Usuários autenticados podem inserir notificações" ON public.ads_task_delay_notifications
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- churn_notifications / Authorized roles can insert churn notifications (INSERT)
-- OLD CHECK: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['financeiro'::user_role, 'gestor_projetos'::user_role, 'ceo'::user_role])))))
-- NEW CHECK: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "Authorized roles can insert churn notifications" ON public.churn_notifications;
CREATE POLICY "Authorized roles can insert churn notifications" ON public.churn_notifications
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- churn_notifications / Users with specific roles can view churn notifications (SELECT)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_ads'::user_role, 'gestor_projetos'::user_role, 'sucesso_cliente'::user_role, 'financeiro'::user_role, 'consultor_comercial'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'consultor_comercial'::user_role))
DROP POLICY IF EXISTS "Users with specific roles can view churn notifications" ON public.churn_notifications;
CREATE POLICY "Users with specific roles can view churn notifications" ON public.churn_notifications
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'consultor_comercial'::user_role)));

-- design_completion_notifications / System can insert notifications (INSERT)
-- OLD CHECK: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'design'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW CHECK: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'design'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "System can insert notifications" ON public.design_completion_notifications;
CREATE POLICY "System can insert notifications" ON public.design_completion_notifications
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'design'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- design_delay_justifications / Authorized roles can view justifications (SELECT)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'design'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'design'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "Authorized roles can view justifications" ON public.design_delay_justifications;
CREATE POLICY "Authorized roles can view justifications" ON public.design_delay_justifications
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'design'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- design_delay_justifications / CEO can archive justifications (UPDATE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'ceo'::user_role))))
-- NEW USING: (public.is_executive(auth.uid()) OR public.is_admin(auth.uid()))
DROP POLICY IF EXISTS "CEO can archive justifications" ON public.design_delay_justifications;
CREATE POLICY "CEO can archive justifications" ON public.design_delay_justifications
  FOR UPDATE TO authenticated
  USING ((public.is_executive(auth.uid()) OR public.is_admin(auth.uid())));

-- design_delay_notifications / Admins can delete notifications (DELETE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "Admins can delete notifications" ON public.design_delay_notifications;
CREATE POLICY "Admins can delete notifications" ON public.design_delay_notifications
  FOR DELETE TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- design_delay_notifications / Authorized roles can view notifications (SELECT)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'design'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'design'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "Authorized roles can view notifications" ON public.design_delay_notifications;
CREATE POLICY "Authorized roles can view notifications" ON public.design_delay_notifications
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'design'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- design_delay_notifications / System can insert notifications (INSERT)
-- OLD CHECK: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'design'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW CHECK: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'design'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "System can insert notifications" ON public.design_delay_notifications;
CREATE POLICY "System can insert notifications" ON public.design_delay_notifications
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'design'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- dev_completion_notifications / dev_completion_notifications_insert (INSERT)
-- OLD CHECK: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'devs'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW CHECK: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'devs'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "dev_completion_notifications_insert" ON public.dev_completion_notifications;
CREATE POLICY "dev_completion_notifications_insert" ON public.dev_completion_notifications
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'devs'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- dev_delay_justifications / dev_delay_justifications_select (SELECT)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'devs'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'devs'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "dev_delay_justifications_select" ON public.dev_delay_justifications;
CREATE POLICY "dev_delay_justifications_select" ON public.dev_delay_justifications
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'devs'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- dev_delay_justifications / dev_delay_justifications_update (UPDATE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'ceo'::user_role))))
-- NEW USING: (public.is_executive(auth.uid()) OR public.is_admin(auth.uid()))
DROP POLICY IF EXISTS "dev_delay_justifications_update" ON public.dev_delay_justifications;
CREATE POLICY "dev_delay_justifications_update" ON public.dev_delay_justifications
  FOR UPDATE TO authenticated
  USING ((public.is_executive(auth.uid()) OR public.is_admin(auth.uid())));

-- dev_delay_notifications / dev_delay_notifications_delete (DELETE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "dev_delay_notifications_delete" ON public.dev_delay_notifications;
CREATE POLICY "dev_delay_notifications_delete" ON public.dev_delay_notifications
  FOR DELETE TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- dev_delay_notifications / dev_delay_notifications_insert (INSERT)
-- OLD CHECK: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'devs'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW CHECK: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'devs'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "dev_delay_notifications_insert" ON public.dev_delay_notifications;
CREATE POLICY "dev_delay_notifications_insert" ON public.dev_delay_notifications
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'devs'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- dev_delay_notifications / dev_delay_notifications_select (SELECT)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'devs'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'devs'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "dev_delay_notifications_select" ON public.dev_delay_notifications;
CREATE POLICY "dev_delay_notifications_select" ON public.dev_delay_notifications
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'devs'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- produtora_delay_justifications / produtora_delay_justifications_select (SELECT)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'produtora'::user_role, 'sucesso_cliente'::user_role, 'editor_video'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'produtora'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role) OR public.has_role(auth.uid(), 'editor_video'::user_role))
DROP POLICY IF EXISTS "produtora_delay_justifications_select" ON public.produtora_delay_justifications;
CREATE POLICY "produtora_delay_justifications_select" ON public.produtora_delay_justifications
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'produtora'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role) OR public.has_role(auth.uid(), 'editor_video'::user_role)));

-- produtora_delay_justifications / produtora_delay_justifications_update (UPDATE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'ceo'::user_role))))
-- NEW USING: (public.is_executive(auth.uid()) OR public.is_admin(auth.uid()))
DROP POLICY IF EXISTS "produtora_delay_justifications_update" ON public.produtora_delay_justifications;
CREATE POLICY "produtora_delay_justifications_update" ON public.produtora_delay_justifications
  FOR UPDATE TO authenticated
  USING ((public.is_executive(auth.uid()) OR public.is_admin(auth.uid())));

-- produtora_delay_notifications / produtora_delay_notifications_delete (DELETE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "produtora_delay_notifications_delete" ON public.produtora_delay_notifications;
CREATE POLICY "produtora_delay_notifications_delete" ON public.produtora_delay_notifications
  FOR DELETE TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- produtora_delay_notifications / produtora_delay_notifications_insert (INSERT)
-- OLD CHECK: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'produtora'::user_role, 'sucesso_cliente'::user_role, 'editor_video'::user_role])))))
-- NEW CHECK: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'produtora'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role) OR public.has_role(auth.uid(), 'editor_video'::user_role))
DROP POLICY IF EXISTS "produtora_delay_notifications_insert" ON public.produtora_delay_notifications;
CREATE POLICY "produtora_delay_notifications_insert" ON public.produtora_delay_notifications
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'produtora'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role) OR public.has_role(auth.uid(), 'editor_video'::user_role)));

-- produtora_delay_notifications / produtora_delay_notifications_select (SELECT)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'produtora'::user_role, 'sucesso_cliente'::user_role, 'editor_video'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'produtora'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role) OR public.has_role(auth.uid(), 'editor_video'::user_role))
DROP POLICY IF EXISTS "produtora_delay_notifications_select" ON public.produtora_delay_notifications;
CREATE POLICY "produtora_delay_notifications_select" ON public.produtora_delay_notifications
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'produtora'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role) OR public.has_role(auth.uid(), 'editor_video'::user_role)));

-- task_delay_justifications / Authorized roles can view justifications by role (SELECT)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['gestor_ads'::user_role, 'sucesso_cliente'::user_role, 'gestor_projetos'::user_role, 'ceo'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "Authorized roles can view justifications by role" ON public.task_delay_justifications;
CREATE POLICY "Authorized roles can view justifications by role" ON public.task_delay_justifications
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- task_delay_justifications / CEO can update any justification (UPDATE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'ceo'::user_role))))
-- NEW USING: (public.is_executive(auth.uid()) OR public.is_admin(auth.uid()))
DROP POLICY IF EXISTS "CEO can update any justification" ON public.task_delay_justifications;
CREATE POLICY "CEO can update any justification" ON public.task_delay_justifications
  FOR UPDATE TO authenticated
  USING ((public.is_executive(auth.uid()) OR public.is_admin(auth.uid())));

-- video_completion_notifications / System can insert video completion notifications (INSERT)
-- OLD CHECK: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'editor_video'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW CHECK: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'editor_video'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "System can insert video completion notifications" ON public.video_completion_notifications;
CREATE POLICY "System can insert video completion notifications" ON public.video_completion_notifications
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'editor_video'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- video_delay_justifications / Authorized roles can view video justifications (SELECT)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'editor_video'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'editor_video'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "Authorized roles can view video justifications" ON public.video_delay_justifications;
CREATE POLICY "Authorized roles can view video justifications" ON public.video_delay_justifications
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'editor_video'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- video_delay_justifications / CEO can archive video justifications (UPDATE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'ceo'::user_role))))
-- NEW USING: (public.is_executive(auth.uid()) OR public.is_admin(auth.uid()))
DROP POLICY IF EXISTS "CEO can archive video justifications" ON public.video_delay_justifications;
CREATE POLICY "CEO can archive video justifications" ON public.video_delay_justifications
  FOR UPDATE TO authenticated
  USING ((public.is_executive(auth.uid()) OR public.is_admin(auth.uid())));

-- video_delay_notifications / Admins can delete video delay notifications (DELETE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "Admins can delete video delay notifications" ON public.video_delay_notifications;
CREATE POLICY "Admins can delete video delay notifications" ON public.video_delay_notifications
  FOR DELETE TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- video_delay_notifications / Authorized roles can view video delay notifications (SELECT)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'editor_video'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'editor_video'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "Authorized roles can view video delay notifications" ON public.video_delay_notifications;
CREATE POLICY "Authorized roles can view video delay notifications" ON public.video_delay_notifications
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'editor_video'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- video_delay_notifications / System can insert video delay notifications (INSERT)
-- OLD CHECK: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'editor_video'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW CHECK: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'editor_video'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "System can insert video delay notifications" ON public.video_delay_notifications;
CREATE POLICY "System can insert video delay notifications" ON public.video_delay_notifications
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'editor_video'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- ===========================================================================
-- BLOCO 6 — ALTOS — comercial (notifications, justificativas, documentação, tracking)
-- (9 policies)
-- ===========================================================================

-- comercial_client_documentation / CEO pode ver todas documentações comercial (SELECT)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'ceo'::user_role))))
-- NEW USING: (public.is_executive(auth.uid()) OR public.is_admin(auth.uid()))
DROP POLICY IF EXISTS "CEO pode ver todas documentações comercial" ON public.comercial_client_documentation;
CREATE POLICY "CEO pode ver todas documentações comercial" ON public.comercial_client_documentation
  FOR SELECT TO authenticated
  USING ((public.is_executive(auth.uid()) OR public.is_admin(auth.uid())));

-- comercial_client_documentation / Gestor Projetos pode ver todas doc comercial (SELECT)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'gestor_projetos'::user_role))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "Gestor Projetos pode ver todas doc comercial" ON public.comercial_client_documentation;
CREATE POLICY "Gestor Projetos pode ver todas doc comercial" ON public.comercial_client_documentation
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- comercial_daily_documentation / comercial_doc_select (SELECT)
-- OLD USING: ((user_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role]))))))
-- NEW USING: ((user_id = auth.uid()) OR (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)))
DROP POLICY IF EXISTS "comercial_doc_select" ON public.comercial_daily_documentation;
CREATE POLICY "comercial_doc_select" ON public.comercial_daily_documentation
  FOR SELECT TO authenticated
  USING (((user_id = auth.uid()) OR (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))));

-- comercial_delay_justifications / comercial_just_select (SELECT)
-- OLD USING: ((user_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'sucesso_cliente'::user_role]))))))
-- NEW USING: ((user_id = auth.uid()) OR (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)))
DROP POLICY IF EXISTS "comercial_just_select" ON public.comercial_delay_justifications;
CREATE POLICY "comercial_just_select" ON public.comercial_delay_justifications
  FOR SELECT TO authenticated
  USING (((user_id = auth.uid()) OR (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))));

-- comercial_delay_justifications / comercial_just_update (UPDATE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'ceo'::user_role))))
-- NEW USING: (public.is_executive(auth.uid()) OR public.is_admin(auth.uid()))
DROP POLICY IF EXISTS "comercial_just_update" ON public.comercial_delay_justifications;
CREATE POLICY "comercial_just_update" ON public.comercial_delay_justifications
  FOR UPDATE TO authenticated
  USING ((public.is_executive(auth.uid()) OR public.is_admin(auth.uid())));

-- comercial_delay_notifications / comercial_delay_notif_delete (DELETE)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "comercial_delay_notif_delete" ON public.comercial_delay_notifications;
CREATE POLICY "comercial_delay_notif_delete" ON public.comercial_delay_notifications
  FOR DELETE TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- comercial_delay_notifications / comercial_delay_notif_insert (INSERT)
-- OLD CHECK: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'consultor_comercial'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW CHECK: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'consultor_comercial'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "comercial_delay_notif_insert" ON public.comercial_delay_notifications;
CREATE POLICY "comercial_delay_notif_insert" ON public.comercial_delay_notifications
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'consultor_comercial'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- comercial_delay_notifications / comercial_delay_notif_select (SELECT)
-- OLD USING: ((user_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'sucesso_cliente'::user_role]))))))
-- NEW USING: ((user_id = auth.uid()) OR (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)))
DROP POLICY IF EXISTS "comercial_delay_notif_select" ON public.comercial_delay_notifications;
CREATE POLICY "comercial_delay_notif_select" ON public.comercial_delay_notifications
  FOR SELECT TO authenticated
  USING (((user_id = auth.uid()) OR (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))));

-- comercial_tracking / comercial_tracking_select (SELECT)
-- OLD USING: ((comercial_user_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role]))))))
-- NEW USING: ((comercial_user_id = auth.uid()) OR (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)))
DROP POLICY IF EXISTS "comercial_tracking_select" ON public.comercial_tracking;
CREATE POLICY "comercial_tracking_select" ON public.comercial_tracking
  FOR SELECT TO authenticated
  USING (((comercial_user_id = auth.uid()) OR (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))));

-- ===========================================================================
-- BLOCO 7 — MEDIOS — financeiro DRE e comissões
-- (6 policies)
-- ===========================================================================

-- commission_records / System can insert commissions (INSERT)
-- OLD CHECK: (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'financeiro'::user_role, 'consultor_comercial'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW CHECK: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'consultor_comercial'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "System can insert commissions" ON public.commission_records;
CREATE POLICY "System can insert commissions" ON public.commission_records
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'gestor_ads'::user_role) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'consultor_comercial'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- financeiro_custos_produto / Custos manageable by CEO and financeiro (ALL)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['ceo'::user_role, 'financeiro'::user_role, 'gestor_projetos'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "Custos manageable by CEO and financeiro" ON public.financeiro_custos_produto;
CREATE POLICY "Custos manageable by CEO and financeiro" ON public.financeiro_custos_produto
  FOR ALL TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- financeiro_dre / DRE manageable by CEO and financeiro (ALL)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['ceo'::user_role, 'financeiro'::user_role, 'gestor_projetos'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "DRE manageable by CEO and financeiro" ON public.financeiro_dre;
CREATE POLICY "DRE manageable by CEO and financeiro" ON public.financeiro_dre
  FOR ALL TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- financeiro_produto_departamentos / Departamentos manageable by CEO and financeiro (ALL)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['ceo'::user_role, 'financeiro'::user_role, 'gestor_projetos'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "Departamentos manageable by CEO and financeiro" ON public.financeiro_produto_departamentos;
CREATE POLICY "Departamentos manageable by CEO and financeiro" ON public.financeiro_produto_departamentos
  FOR ALL TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- financeiro_produtos / Produtos manageable by CEO and financeiro (ALL)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['ceo'::user_role, 'financeiro'::user_role, 'gestor_projetos'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "Produtos manageable by CEO and financeiro" ON public.financeiro_produtos;
CREATE POLICY "Produtos manageable by CEO and financeiro" ON public.financeiro_produtos
  FOR ALL TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- financeiro_receita_produto / Receita manageable by CEO and financeiro (ALL)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['ceo'::user_role, 'financeiro'::user_role, 'gestor_projetos'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "Receita manageable by CEO and financeiro" ON public.financeiro_receita_produto;
CREATE POLICY "Receita manageable by CEO and financeiro" ON public.financeiro_receita_produto
  FOR ALL TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- ===========================================================================
-- BLOCO 8 — MEDIOS — CS auxiliares + NPS + daily tracking
-- (7 policies)
-- ===========================================================================

-- client_daily_tracking / Sucesso do Cliente can view all tracking (SELECT)
-- OLD USING: has_role(auth.uid(), 'sucesso_cliente'::user_role)
-- NEW USING: (public.is_admin(auth.uid()) OR has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "Sucesso do Cliente can view all tracking" ON public.client_daily_tracking;
CREATE POLICY "Sucesso do Cliente can view all tracking" ON public.client_daily_tracking
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- cs_action_manuals / Authorized roles can manage CS action manuals (ALL)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "Authorized roles can manage CS action manuals" ON public.cs_action_manuals;
CREATE POLICY "Authorized roles can manage CS action manuals" ON public.cs_action_manuals
  FOR ALL TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- cs_action_plan_tasks / CS and CEO can manage action plan tasks (ALL)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['ceo'::user_role, 'sucesso_cliente'::user_role, 'gestor_projetos'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role))
DROP POLICY IF EXISTS "CS and CEO can manage action plan tasks" ON public.cs_action_plan_tasks;
CREATE POLICY "CS and CEO can manage action plan tasks" ON public.cs_action_plan_tasks
  FOR ALL TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)));

-- cs_contact_history / Authorized roles can manage CS contact history (ALL)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "Authorized roles can manage CS contact history" ON public.cs_contact_history;
CREATE POLICY "Authorized roles can manage CS contact history" ON public.cs_contact_history
  FOR ALL TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- cs_insights / Authorized roles can manage CS insights (ALL)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "Authorized roles can manage CS insights" ON public.cs_insights;
CREATE POLICY "Authorized roles can manage CS insights" ON public.cs_insights
  FOR ALL TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'gestor_projetos'::user_role) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- nps_responses / CEO and CS can view responses (SELECT)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['ceo'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "CEO and CS can view responses" ON public.nps_responses;
CREATE POLICY "CEO and CS can view responses" ON public.nps_responses
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- nps_surveys / CEO and CS can manage surveys (ALL)
-- OLD USING: (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['ceo'::user_role, 'sucesso_cliente'::user_role])))))
-- NEW USING: (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "CEO and CS can manage surveys" ON public.nps_surveys;
CREATE POLICY "CEO and CS can manage surveys" ON public.nps_surveys
  FOR ALL TO authenticated
  USING ((public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- ===========================================================================
-- BLOCO 9 — MEDIOS — profiles (visão cross-role)
-- (10 policies)
-- ===========================================================================

-- profiles / Consultor Comercial can view all profiles (SELECT)
-- OLD USING: has_role(auth.uid(), 'consultor_comercial'::user_role)
-- NEW USING: (public.is_admin(auth.uid()) OR has_role(auth.uid(), 'consultor_comercial'::user_role))
DROP POLICY IF EXISTS "Consultor Comercial can view all profiles" ON public.profiles;
CREATE POLICY "Consultor Comercial can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR has_role(auth.uid(), 'consultor_comercial'::user_role)));

-- profiles / Design can view all profiles (SELECT)
-- OLD USING: has_role(auth.uid(), 'design'::user_role)
-- NEW USING: (public.is_admin(auth.uid()) OR has_role(auth.uid(), 'design'::user_role))
DROP POLICY IF EXISTS "Design can view all profiles" ON public.profiles;
CREATE POLICY "Design can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR has_role(auth.uid(), 'design'::user_role)));

-- profiles / Devs can view all profiles (SELECT)
-- OLD USING: has_role(auth.uid(), 'devs'::user_role)
-- NEW USING: (public.is_admin(auth.uid()) OR has_role(auth.uid(), 'devs'::user_role))
DROP POLICY IF EXISTS "Devs can view all profiles" ON public.profiles;
CREATE POLICY "Devs can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR has_role(auth.uid(), 'devs'::user_role)));

-- profiles / Editor Video can view all profiles (SELECT)
-- OLD USING: has_role(auth.uid(), 'editor_video'::user_role)
-- NEW USING: (public.is_admin(auth.uid()) OR has_role(auth.uid(), 'editor_video'::user_role))
DROP POLICY IF EXISTS "Editor Video can view all profiles" ON public.profiles;
CREATE POLICY "Editor Video can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR has_role(auth.uid(), 'editor_video'::user_role)));

-- profiles / Financeiro can view all profiles (SELECT)
-- OLD USING: has_role(auth.uid(), 'financeiro'::user_role)
-- NEW USING: (public.is_admin(auth.uid()) OR has_role(auth.uid(), 'financeiro'::user_role))
DROP POLICY IF EXISTS "Financeiro can view all profiles" ON public.profiles;
CREATE POLICY "Financeiro can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR has_role(auth.uid(), 'financeiro'::user_role)));

-- profiles / Gestor CRM can view all profiles (SELECT)
-- OLD USING: has_role(auth.uid(), 'gestor_crm'::user_role)
-- NEW USING: (public.is_admin(auth.uid()) OR has_role(auth.uid(), 'gestor_crm'::user_role))
DROP POLICY IF EXISTS "Gestor CRM can view all profiles" ON public.profiles;
CREATE POLICY "Gestor CRM can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR has_role(auth.uid(), 'gestor_crm'::user_role)));

-- profiles / Gestor de Ads can view all profiles (SELECT)
-- OLD USING: has_role(auth.uid(), 'gestor_ads'::user_role)
-- NEW USING: (public.is_admin(auth.uid()) OR has_role(auth.uid(), 'gestor_ads'::user_role))
DROP POLICY IF EXISTS "Gestor de Ads can view all profiles" ON public.profiles;
CREATE POLICY "Gestor de Ads can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR has_role(auth.uid(), 'gestor_ads'::user_role)));

-- profiles / Outbound can view all profiles (SELECT)
-- OLD USING: has_role(auth.uid(), 'outbound'::user_role)
-- NEW USING: (public.is_admin(auth.uid()) OR has_role(auth.uid(), 'outbound'::user_role))
DROP POLICY IF EXISTS "Outbound can view all profiles" ON public.profiles;
CREATE POLICY "Outbound can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR has_role(auth.uid(), 'outbound'::user_role)));

-- profiles / RH can view all profiles (SELECT)
-- OLD USING: has_role(auth.uid(), 'rh'::user_role)
-- NEW USING: (public.is_admin(auth.uid()) OR has_role(auth.uid(), 'rh'::user_role))
DROP POLICY IF EXISTS "RH can view all profiles" ON public.profiles;
CREATE POLICY "RH can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR has_role(auth.uid(), 'rh'::user_role)));

-- profiles / Sucesso do Cliente can view all profiles (SELECT)
-- OLD USING: has_role(auth.uid(), 'sucesso_cliente'::user_role)
-- NEW USING: (public.is_admin(auth.uid()) OR has_role(auth.uid(), 'sucesso_cliente'::user_role))
DROP POLICY IF EXISTS "Sucesso do Cliente can view all profiles" ON public.profiles;
CREATE POLICY "Sucesso do Cliente can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) OR has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- ===========================================================================
-- VALIDAÇÃO INLINE (RAISE NOTICE com contagem de literais remanescentes)
-- ===========================================================================
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (qual::text ~ '''(ceo|cto|gestor_projetos|financeiro|gestor_ads|consultor_comercial|outbound|rh|design|devs|editor_video|atrizes_gravacao|produtora|gestor_crm|sucesso_cliente|consultor_mktplace)''::user_role'
         OR with_check::text ~ '''(ceo|cto|gestor_projetos|financeiro|gestor_ads|consultor_comercial|outbound|rh|design|devs|editor_video|atrizes_gravacao|produtora|gestor_crm|sucesso_cliente|consultor_mktplace)''::user_role')
    AND (COALESCE(qual::text, '') !~ 'is_admin|is_executive|is_ceo'
         AND COALESCE(with_check::text, '') !~ 'is_admin|is_executive|is_ceo');
  RAISE NOTICE 'RLS literal-role-sem-helper remanescentes: %', v_count;
END$$;

COMMIT;
