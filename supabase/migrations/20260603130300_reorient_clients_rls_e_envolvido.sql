-- 20260603130300_reorient_clients_rls_e_envolvido.sql
-- Slice 2 (#78) — REORIENTAÇÃO DA RLS DE LEITURA DE public.clients. ADR 0005.
-- *** SEG-CRÍTICO / HITL — requer sign-off do fundador antes de virar lei. ***
--
-- Colapso CIRÚRGICO da visibilidade SELECT. A policy antiga unia 4 grupos
-- ortogonais; este colapso troca APENAS o grupo involvement (C)+(C') —
-- (7 assigned_* + client_secondary_managers) — pelo predicado único
-- cliente.e_envolvido. Os outros 3 grupos permanecem LITERALMENTE INTACTOS:
--   (A) is_admin                                  — bypass executivo/GP
--   (B) gestor_projetos + group_id = grupo        — escopo organizacional
--   (D) can_access_page_data(...) x8              — visibilidade ampla por função
--
-- Backup das policies pré-colapso (rollback):
--   docs/superpowers/qa/2026-06-03-rls-backup-pre-slice2-envolvido.sql
--
-- Guard no_literal_role_in_policy.sql: permanece VERDE — is_admin/has_role
-- adjacentes preservados, nenhum literal novo. NÃO toca as policies UPDATE
-- (continuam lendo assigned_* — migram em slice futura).

-- Substitui a policy SELECT principal (involvement -> e_envolvido).
DROP POLICY IF EXISTS clients_select_visao_total ON public.clients;
CREATE POLICY clients_select_visao_total ON public.clients
  FOR SELECT TO authenticated
  USING (
    -- (A) bypass executivo + gestor_projetos — INTACTO
    is_admin(auth.uid())
    -- (B) gestor_projetos vê clientes do SEU grupo — INTACTO
    OR (has_role(auth.uid(), 'gestor_projetos'::user_role)
        AND group_id = get_user_group_id(auth.uid()))
    -- (C)+(C') involvement: 7 assigned_* + secondary -> fonte única client_members
    OR cliente.e_envolvido(id, auth.uid())
    -- (D) page-grant por função — INTACTO (visibilidade ampla por design)
    OR can_access_page_data(auth.uid(), 'cliente-list'::text)
    OR can_access_page_data(auth.uid(), 'gestor-ads'::text)
    OR can_access_page_data(auth.uid(), 'consultor-comercial'::text)
    OR can_access_page_data(auth.uid(), 'gestor-crm'::text)
    OR can_access_page_data(auth.uid(), 'outbound'::text)
    OR can_access_page_data(auth.uid(), 'sucesso-cliente'::text)
    OR can_access_page_data(auth.uid(), 'financeiro'::text)
    OR can_access_page_data(auth.uid(), 'consultor-mktplace'::text)
  );

-- A visibilidade do secondary manager agora vive em client_members (papel
-- 'secondary_manager', backfilled + espelhado), coberta por e_envolvido acima.
-- A policy dedicada legada é redundante -> removida.
DROP POLICY IF EXISTS secondary_manager_can_view_client ON public.clients;
