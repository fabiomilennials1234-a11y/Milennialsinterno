-- 20260603150000_module_demanda_schema.sql
-- Slice 4 (#80) — Módulo `demanda` (Monolito Modular contrato-only, ADR 0004).
-- Cria o schema dedicado do módulo `demanda`, coexistindo com `public` e `cliente`.
-- PURAMENTE ADITIVO: não toca nenhuma tabela de `public` nesta migration. Zero regressão.
--
-- `demanda` é a "unidade de trabalho do cliente" (CONTEXT.md → "Demanda"): dá nome de
-- primeira classe a algo que hoje vive fragmentado em 5+ tabelas de card por área.
-- Padrão strangler: os cards de domínio existentes apontam para uma demanda via
-- `demanda_id` opcional (migration seguinte); a camada `demanda` unifica a leitura
-- sem fundir as tabelas legadas num big-bang.

CREATE SCHEMA IF NOT EXISTS demanda;

COMMENT ON SCHEMA demanda IS
  'Módulo Demanda — unidade de trabalho do cliente. Monolito Modular contrato-only '
  '(ADR 0004). Escrita só via RPC SECURITY DEFINER do módulo; client_id é uuid solto '
  '(sem FK cross-schema), validado por contrato cliente.existe. Ver CONTEXT.md → Demanda.';

-- O role `authenticator` (PostgREST) precisa de USAGE para o schema ser exponível na API.
-- Escrita direta é revogada por tabela (abaixo).
GRANT USAGE ON SCHEMA demanda TO authenticated, anon, service_role;

-- =============================================================================
-- Tabela `demandas` — entidade nova e fina. client_id é uuid solto (ADR 0004):
-- sem FK cross-schema nem para o shared kernel `cliente`. Integridade por
-- validação atômica na RPC (cliente.existe) + reconciliação (Slice 7).
-- =============================================================================
CREATE TABLE IF NOT EXISTS demanda.demandas (
  id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id  uuid        NOT NULL,                 -- ref por contrato; SEM FK cross-schema
  titulo     text        NOT NULL,
  status     text        NOT NULL DEFAULT 'aberta',
  dominio    text,                                 -- área/domínio da demanda (design|dev|video|...)
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE demanda.demandas IS
  'Demanda: unidade de trabalho atrelada a um cliente (CONTEXT.md). client_id é uuid '
  'solto por contrato (sem FK cross-schema, ADR 0004). Escrita só via RPC do módulo. '
  'Uma demanda pode cruzar áreas; os cards de domínio a referenciam via demanda_id opcional.';

-- Caminho quente: listar demandas de um cliente (do_cliente).
CREATE INDEX IF NOT EXISTS idx_demandas_client
  ON demanda.demandas (client_id);

-- =============================================================================
-- CONTRATO — escrita direta REVOGADA. Só RPC SECURITY DEFINER do módulo escreve.
-- Leitura: damos SELECT a authenticated sob RLS, escopada pela audiência herdada
-- do cliente (cliente.pode_ver_cliente). A RLS delega ao predicado SECURITY
-- DEFINER do kernel — não reentra na policy (owner-run), espelhando client_members.
-- =============================================================================
ALTER TABLE demanda.demandas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON demanda.demandas FROM authenticated;
GRANT SELECT ON demanda.demandas TO authenticated;

DROP POLICY IF EXISTS demandas_select ON demanda.demandas;
CREATE POLICY demandas_select ON demanda.demandas
  FOR SELECT TO authenticated
  USING (
    -- Audiência herdada: quem pode ver o cliente vê as demandas dele (ADR 0005).
    -- pode_ver_cliente = is_admin(A) OR GP-grupo(B) OR e_envolvido(C/C') OR page-grants(D).
    cliente.pode_ver_cliente(client_id, auth.uid())
  );
