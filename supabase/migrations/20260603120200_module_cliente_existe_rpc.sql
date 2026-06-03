-- 20260603120200_module_cliente_existe_rpc.sql
-- Slice 0 (#76) — Monolito Modular contrato-only (ADR 0004).
-- RPC-contrato `cliente.existe(uuid)`: predicado de existência de cliente.
-- Interface pública do módulo `cliente` no banco — os contratos dos outros
-- módulos chamam isto ANTES de inserir (validação atômica anti-órfão), já que
-- não há FK cross-schema. É leitura (este é o exemplo trivial da Slice 0; a RPC
-- de escrita real do kernel vem na Slice 1+).
-- PURAMENTE ADITIVO.

CREATE OR REPLACE FUNCTION cliente.existe(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''  -- hardening: nunca depender do search_path do chamador
AS $$
  -- Schema-qualify tudo. Na Slice 0 o kernel lê o legado public.clients;
  -- na migração do kernel (Slice 1+) a fonte vira cliente.clients sem mudar
  -- a assinatura do contrato.
  SELECT EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = p_client_id
  );
$$;

COMMENT ON FUNCTION cliente.existe(uuid) IS
  'Contrato do módulo cliente: predicado de existência. Chamado por outros '
  'módulos antes de inserir referência uuid solta (anti-órfão). Ver ADR 0004.';

-- Só `authenticated` chama o contrato; revoga o EXECUTE default de PUBLIC.
REVOKE ALL ON FUNCTION cliente.existe(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cliente.existe(uuid) TO authenticated, service_role;
