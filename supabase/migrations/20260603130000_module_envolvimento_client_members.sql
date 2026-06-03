-- 20260603130000_module_envolvimento_client_members.sql
-- Slice 2 (#78) — Envolvido como fonte única. ADR 0005 + ADR 0004.
--
-- Cria cliente.client_members (a fonte única de envolvimento) e o predicado
-- cliente.e_envolvido. PURAMENTE ADITIVO — não toca public.clients nem a RLS
-- ainda (a reorientação da RLS é migration separada, sob sign-off HITL).
--
-- ADR 0004: zero FK cross-schema; client_id/user_id são uuid soltos.
-- Integridade por validação atômica na RPC de membership + reconciliação (Slice 7).

-- =============================================================================
-- Tabela — fonte única de Envolvido. PK composta permite múltiplos papéis por
-- (cliente, pessoa) — ex.: gestor_ads que também é secondary_manager.
-- =============================================================================
CREATE TABLE IF NOT EXISTS cliente.client_members (
  client_id        uuid        NOT NULL,
  user_id          uuid        NOT NULL,
  papel_no_cliente text        NOT NULL,
  entrou_em        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, user_id, papel_no_cliente)
);

COMMENT ON TABLE cliente.client_members IS
  'Fonte única de Envolvido (ADR 0005). client_id/user_id são uuid soltos por '
  'contrato (sem FK cross-schema, ADR 0004). papel_no_cliente: ads_manager | '
  'comercial | crm | rh | outbound_manager | sucesso_cliente | mktplace | '
  'secondary_manager. Colapsa os 7 assigned_* + client_secondary_managers.';

-- Índice para o caminho quente do predicado e do "clientes_de(user)".
CREATE INDEX IF NOT EXISTS idx_client_members_user
  ON cliente.client_members (user_id);

-- =============================================================================
-- PREDICADO — involvement puro (C)+(C') do ADR 0005. NÃO inclui (A)/(B)/(D).
-- Definido ANTES da policy que o referencia.
-- =============================================================================
CREATE OR REPLACE FUNCTION cliente.e_envolvido(p_client_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''  -- hardening: nunca depender do search_path do chamador
AS $$
  SELECT EXISTS (
    SELECT 1 FROM cliente.client_members m
    WHERE m.client_id = p_client_id
      AND m.user_id   = p_user_id
  );
$$;

COMMENT ON FUNCTION cliente.e_envolvido(uuid, uuid) IS
  'Contrato do módulo: predicado de involvement (ADR 0005). true sse existe '
  'linha em cliente.client_members para (client,user). A RLS de cliente delega '
  'a ESTE predicado a parcela involvement-por-assignment; bypass executivo, '
  'escopo-grupo do GP e page-grant permanecem FORA dele (não são envolvimento).';

REVOKE ALL ON FUNCTION cliente.e_envolvido(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cliente.e_envolvido(uuid, uuid) TO authenticated, service_role;

-- =============================================================================
-- CONTRATO — escrita direta REVOGADA. Só RPC SECURITY DEFINER do módulo escreve.
-- =============================================================================
ALTER TABLE cliente.client_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cliente.client_members FROM authenticated;
-- Leitura: o predicado e_envolvido (SECURITY DEFINER) é o caminho; mas damos
-- SELECT a authenticated sob RLS para a UI listar membros via o módulo. A RLS
-- garante que só Envolvido/admin leem (definida abaixo).
GRANT SELECT ON cliente.client_members TO authenticated;

-- RLS de leitura: vê quem é Envolvido daquele cliente, ou admin. Sem literal de
-- role. Recursão? Não: a policy chama e_envolvido que lê a MESMA tabela —
-- e_envolvido é SECURITY DEFINER e roda como owner, então não reentra na policy.
-- Confirmado por teste.
DROP POLICY IF EXISTS client_members_select ON cliente.client_members;
CREATE POLICY client_members_select ON cliente.client_members
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR cliente.e_envolvido(client_id, auth.uid())
  );
