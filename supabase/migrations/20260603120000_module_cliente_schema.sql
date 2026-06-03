-- 20260603120000_module_cliente_schema.sql
-- Slice 0 (#76) — Monolito Modular contrato-only (ADR 0004).
-- Cria o schema dedicado do módulo `cliente`, coexistindo com `public` (legado intacto).
-- PURAMENTE ADITIVO: não toca nenhuma tabela de `public`. Zero regressão.
--
-- Este é o primeiro schema de módulo do estrangulamento (strangler). Os demais
-- (`demanda`, `presenca`, …) virão nas fatias seguintes pelo mesmo padrão.

CREATE SCHEMA IF NOT EXISTS cliente;

COMMENT ON SCHEMA cliente IS
  'Módulo Cliente (shared kernel) — Monolito Modular contrato-only. Ver ADR 0004. '
  'Escrita só via RPC SECURITY DEFINER do módulo; sem FK cross-schema.';

-- O role `authenticator` (PostgREST) precisa de USAGE para que o schema seja
-- exponível na API. Escrita direta é revogada por tabela (ver migration de health).
GRANT USAGE ON SCHEMA cliente TO authenticated, anon, service_role;
