-- 20260603260000_module_cliente_pode_ver_gp_group_scoped.sql
-- #87 — GP (gestor_projetos) vê SÓ os clientes do PRÓPRIO GRUPO.
-- DECISÃO DO FUNDADOR: restringir (o escopo-grupo do GP era ilusório porque o GP
-- entrava no bypass total via is_admin). ADR 0005 §3.
--
-- Mudança CIRÚRGICA — SÓ a visibilidade de cliente (cliente.pode_ver_cliente).
-- NÃO altera public.is_admin (governa criar/editar/deletar admin — fora de escopo),
-- NÃO altera public.can_access_page_data / has_page_access (governam acesso a
-- páginas de outras features). A correção vive INTEIRA no predicado pode_ver_cliente.
--
-- Taxonomia ADR 0005 (4 grupos ortogonais):
--   (A) bypass total            — ANTES is_admin (ceo/cto/GP); AGORA is_executive (ceo/cto).
--   (B) GP-grupo                — has_role(GP) AND client.group_id = group_id do GP. ANTES
--                                 redundante (is_admin já abria tudo); AGORA EFETIVO p/ GP.
--   (C)+(C') envolvimento       — cliente.e_envolvido. INTACTO (vale p/ qualquer um, GP incluso).
--   (D) page-grant              — can_access_page_data(...). INTACTO p/ não-GP.
--
-- ARMADILHA RESOLVIDA (consequência de 2ª ordem que o brief não previu):
--   can_access_page_data() e has_page_access() têm short-circuit interno
--   `IF is_admin(user) THEN RETURN true`. Como is_admin INCLUI GP, trocar só (A)
--   NÃO restringiria o GP — ele continuaria vendo TUDO via (D). Por isso (D) é
--   reescrito assim: para um caller GP-não-executivo, (D) exige um GRANT DIRETO
--   real em user_page_grants (sem o auto-pass admin); para qualquer outro caller,
--   (D) permanece exatamente como hoje (can_access_page_data, com role-fallback).
--   Não tocamos as funções globais — só como pode_ver_cliente as consome.
--
-- Idempotente: CREATE OR REPLACE. Reexecutável. Sem literal de role (só helpers
-- canônicos is_executive/has_role/e_envolvido/can_access_page_data) → guard
-- no_literal_role_in_policy permanece verde.

CREATE OR REPLACE FUNCTION cliente.pode_ver_cliente(p_client_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    -- (A) bypass total: SÓ executivo (ceo/cto). GP NÃO entra mais aqui (#87).
    public.is_executive(p_user_id)

    -- (B) escopo-grupo do GP: agora EFETIVO. GP vê cliente cujo group_id bate com
    --     o group_id do próprio GP. NULL-safe: se o GP não tem grupo, ou o cliente
    --     não tem grupo, NÃO casa (NULL = não vê — fail-closed).
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = p_client_id
        AND public.has_role(p_user_id, 'gestor_projetos'::public.user_role)
        AND c.group_id IS NOT NULL
        AND c.group_id = public.get_user_group_id(p_user_id)
    )

    -- (C)+(C') involvement: quem ATENDE o cliente (vale p/ qualquer papel, GP incluso).
    OR cliente.e_envolvido(p_client_id, p_user_id)

    -- (D) page-grant. Para um GP (is_admin mas NÃO executivo), can_access_page_data
    --     daria TRUE por causa do short-circuit admin interno → reabriria visão total.
    --     Por isso: se o caller é GP-não-executivo, (D) exige GRANT DIRETO real
    --     (user_page_grants, sem auto-pass admin). Caso contrário, (D) = comportamento
    --     atual (can_access_page_data, com role-fallback INTACTO p/ sucesso_cliente etc.).
    OR (
      CASE
        WHEN public.is_admin(p_user_id) AND NOT public.is_executive(p_user_id) THEN
          -- caller é exatamente um GP: só grant DIRETO conta (neutraliza o admin-bypass).
          EXISTS (
            SELECT 1 FROM public.user_page_grants g
            WHERE g.user_id = p_user_id
              AND g.page_slug IN (
                'cliente-list','gestor-ads','consultor-comercial','gestor-crm',
                'outbound','sucesso-cliente','financeiro','consultor-mktplace'
              )
              AND g.revoked_at IS NULL
              AND (g.expires_at IS NULL OR g.expires_at > now())
          )
        ELSE
          -- não-GP: page-grants exatamente como hoje (ADR 0005 §3, lista preservada).
          public.can_access_page_data(p_user_id, 'cliente-list')
          OR public.can_access_page_data(p_user_id, 'gestor-ads')
          OR public.can_access_page_data(p_user_id, 'consultor-comercial')
          OR public.can_access_page_data(p_user_id, 'gestor-crm')
          OR public.can_access_page_data(p_user_id, 'outbound')
          OR public.can_access_page_data(p_user_id, 'sucesso-cliente')
          OR public.can_access_page_data(p_user_id, 'financeiro')
          OR public.can_access_page_data(p_user_id, 'consultor-mktplace')
      END
    );
$$;

COMMENT ON FUNCTION cliente.pode_ver_cliente(uuid, uuid) IS
  'Contrato/predicado: quem pode VER um cliente (ADR 0005, #87). Fonte ÚNICA da '
  'visibilidade do cliente. (A) bypass = is_executive (ceo/cto) — GP NÃO tem mais '
  'bypass total; (B) GP vê só clientes do PRÓPRIO grupo (efetivo); (C)+(C'') '
  'e_envolvido; (D) page-grants — para GP exige grant DIRETO (neutraliza o '
  'short-circuit admin de can_access_page_data), para não-GP permanece como antes. '
  'NÃO altera is_admin nem can_access_page_data globais.';

REVOKE ALL ON FUNCTION cliente.pode_ver_cliente(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cliente.pode_ver_cliente(uuid, uuid) TO authenticated, service_role;

-- =============================================================================
-- Reorienta a RLS SELECT da TABELA-BASE public.clients para DELEGAR ao predicado
-- único cliente.pode_ver_cliente — elimina a cópia inline (que ainda tinha o
-- bypass is_admin p/ GP). Sem isso, o GP continuaria vendo TODOS os clientes na
-- leitura da tabela-base (lista de clientes, dropdowns) — o caminho mais usado.
-- ADR 0005: "um único dono da definição de visibilidade do cliente". As policies
-- de UPDATE/INSERT NÃO são tocadas (governam escrita; migram em slice futura).
--
-- Guard no_literal_role_in_policy: a policy passa a NÃO ter literal de role (só
-- chama a função) — permanece verde.
-- =============================================================================
DROP POLICY IF EXISTS "clients_select_visao_total" ON public.clients;
CREATE POLICY "clients_select_visao_total" ON public.clients
  FOR SELECT
  TO authenticated
  USING (cliente.pode_ver_cliente(id, auth.uid()));
