-- 20260603120100_module_cliente_health_revoke.sql
-- Slice 0 (#76) — Monolito Modular contrato-only (ADR 0004).
-- Tabela-marca `cliente.modulo_health`: existe SÓ para provar o padrão de contrato:
--   escrita direta REVOGADA de `authenticated`; só a RPC SECURITY DEFINER do módulo
--   escreve. Descartável — não modela domínio real (a migração de dados é Slice 1+).
-- PURAMENTE ADITIVO.

CREATE TABLE IF NOT EXISTS cliente.modulo_health (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at  timestamptz NOT NULL DEFAULT now(),
  note        text NOT NULL DEFAULT 'skeleton'
);

COMMENT ON TABLE cliente.modulo_health IS
  'Tabela-marca do walking skeleton (#76). Escrita direta revogada de authenticated; '
  'só RPC do módulo escreve. Ver ADR 0004. Descartável.';

-- RLS ligada (red flag imposta: RLS sempre em tabela nova).
ALTER TABLE cliente.modulo_health ENABLE ROW LEVEL SECURITY;

-- Leitura permitida a authenticated (a RPC de leitura existe(...) não depende disso,
-- mas o padrão é: leitura controlada por RLS, escrita só por RPC).
DROP POLICY IF EXISTS modulo_health_select ON cliente.modulo_health;
CREATE POLICY modulo_health_select
  ON cliente.modulo_health
  FOR SELECT
  TO authenticated
  USING (true);

-- ====================================================================
-- CONTRATO: escrita direta REVOGADA. Só a RPC do módulo (SECURITY
-- DEFINER, dona do schema) escreve. Esta é a fronteira do módulo no DB.
-- ====================================================================
REVOKE INSERT, UPDATE, DELETE ON cliente.modulo_health FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON cliente.modulo_health FROM anon;
-- Garante que nenhum GRANT futuro de table-level vaze por default privileges.
REVOKE ALL ON cliente.modulo_health FROM authenticated, anon;
GRANT SELECT ON cliente.modulo_health TO authenticated;
