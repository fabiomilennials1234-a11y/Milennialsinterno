-- 20260423140000_fix_clients_rls_scope_consultor_comercial.sql
--
-- Fix RLS leak: consultor_comercial podia ler TODOS os clientes via policy sem
-- filtro (apenas has_role(..., 'consultor_comercial')). O escopo real ("so os
-- seus") existia somente em filtros de frontend, quebrando o modelo de seguranca
-- do projeto (RLS e a autoridade, nao o frontend).
--
-- Fix: policy escopada por assigned_comercial = auth.uid(). Admin mantem acesso
-- global via policies proprias (Admin can update/view clients, CEO, etc.),
-- entao removemos o `is_admin(...)` redundante desta policy pra manter a
-- semantica focada ("scope policy" vs "admin policy"). O leak era exclusivo da
-- clausula `OR has_role(...)` sem filtro.
--
-- Cross-consultor: leak analogo ao incidente de RC4 no kanban (ver
-- 20260423130000_fix_rls_leakage_kanban_remove_permissive_policies.sql).
-- Aprovado pelo agente Seguranca em 2026-04-23.
--
-- Followup P1: aplicar mesmo padrao em financeiro/sucesso_cliente/outbound,
-- onde auditoria identificou leaks analogos (policies `can view all clients`
-- sem filtro de escopo).

DROP POLICY IF EXISTS "Consultor Comercial can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Consultor Comercial can view assigned clients" ON public.clients;

CREATE POLICY "Consultor Comercial can view assigned clients" ON public.clients
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'consultor_comercial'::user_role)
    AND assigned_comercial = auth.uid()
  );

COMMENT ON POLICY "Consultor Comercial can view assigned clients" ON public.clients IS
  'Scope: apenas clientes onde o consultor eh o assigned_comercial. Admin/CEO/Gestor Projetos/Financeiro/Sucesso/Outbound tem policies proprias independentes.';
