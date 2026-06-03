-- 20260603240000_module_reconciliacao_quarentena.sql
-- Slice 7 (#82) — Reconciliação: backstop de integridade do Monolito Modular
-- contrato-only (ADR 0004, parcela b).
--
-- Sem FK cross-schema (ADR 0004), referências uuid soltas podem ficar órfãs se a
-- app falhar entre a validação atômica da RPC e o commit, ou se um caminho não-RPC
-- (migração, superuser, bug futuro) escrever. As RPCs validam atomicamente (caminho
-- feliz NÃO gera órfão); ESTA slice entrega a rede de segurança PERIÓDICA que detecta
-- o que escapou, quarentena e alerta. É o backstop, não a 1a linha.
--
-- ONDE VIVE: schema próprio `reconciliacao` — CROSS-CUTTING. Não pertence a nenhum
-- módulo de domínio (lê public.clients, public.kanban_cards, auth.users,
-- demanda.demandas, presenca.atuacao_intervalos, cliente.client_members). É a
-- infraestrutura do contrato — o vigia da integridade que os módulos abdicaram ao
-- recusar FK. A leitura multi-schema direta da varredura é a ÚNICA exceção consciente
-- à regra "não leia tabela de outro módulo": ela não é negócio de módulo, é o reconciler.
--
-- PURAMENTE ADITIVO: não toca nenhuma tabela existente. Zero regressão.
-- NÃO adiciona FK (a reconciliação é o SUBSTITUTO da FK, não a reintrodução).

BEGIN;

CREATE SCHEMA IF NOT EXISTS reconciliacao;

COMMENT ON SCHEMA reconciliacao IS
  'Reconciliação (cross-cutting) — backstop de integridade do Monolito Modular '
  'contrato-only (ADR 0004, parcela b). Varre refs uuid soltas, quarentena órfãos '
  'e alerta. NÃO é módulo de domínio; é a rede de segurança da ausência de FK.';

-- authenticator (PostgREST) precisa de USAGE só p/ a view admin resolver via base;
-- a tabela/função NÃO são expostas no PostgREST (sem UI — consumo admin via SQL).
GRANT USAGE ON SCHEMA reconciliacao TO authenticated, service_role;

-- =============================================================================
-- Tabela `quarentena` — uma linha por (origem, ref órfã) detectada.
--   origem_id é TEXT para cobrir tanto PK uuid (demandas/kanban/intervalos) quanto
--   a PK COMPOSTA de client_members serializada (client_id|user_id|papel).
--   resolvido_em NULL = órfão ainda aberto; preenchido quando a origem some ou a
--   ref reaparece (auto-resolução; histórico preservado p/ auditoria — não deleta).
-- =============================================================================
CREATE TABLE IF NOT EXISTS reconciliacao.quarentena (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  origem_schema text        NOT NULL,   -- 'demanda' | 'public' | 'presenca' | 'cliente'
  origem_tabela text        NOT NULL,   -- 'demandas' | 'kanban_cards' | 'atuacao_intervalos' | 'client_members'
  origem_id     text        NOT NULL,   -- PK da linha origem (uuid ou PK composta serializada)
  ref_tipo      text        NOT NULL,   -- 'client' | 'demanda' | 'user'
  ref_id_orfao  uuid        NOT NULL,   -- o uuid que NÃO existe no alvo
  detectado_em  timestamptz NOT NULL DEFAULT now(),
  resolvido_em  timestamptz             -- NULL = aberto
);

COMMENT ON TABLE reconciliacao.quarentena IS
  'Órfãos detectados pela varredura (ADR 0004, parcela b). resolvido_em NULL = aberto. '
  'origem_id TEXT cobre PK uuid e PK composta (client_members) serializada. '
  'Auto-resolução marca resolvido_em quando o órfão some (não deleta — auditoria).';

-- IDEMPOTÊNCIA: um único órfão ABERTO por (origem + ref). Rodar a varredura N vezes
-- não duplica — ON CONFLICT DO NOTHING contra este índice. O predicado parcial
-- (WHERE resolvido_em IS NULL) permite re-quarentenar se o mesmo órfão ressurgir
-- depois de resolvido (novo episódio = nova linha).
CREATE UNIQUE INDEX IF NOT EXISTS uq_quarentena_aberta
  ON reconciliacao.quarentena (origem_schema, origem_tabela, origem_id, ref_tipo, ref_id_orfao)
  WHERE resolvido_em IS NULL;

-- Caminho quente da view admin e da auto-resolução: varrer abertos.
CREATE INDEX IF NOT EXISTS idx_quarentena_abertos
  ON reconciliacao.quarentena (detectado_em)
  WHERE resolvido_em IS NULL;

-- =============================================================================
-- CONTRATO — escrita direta REVOGADA. Só a função varrer_orfaos() (SECURITY
-- DEFINER, owner) escreve. authenticated nunca insere/atualiza a quarentena.
-- Leitura: SELECT a authenticated SOB RLS escopada a admin/executivo (a view
-- admin resolve por baixo). Sem literal de role (helpers is_admin/is_executive).
-- =============================================================================
ALTER TABLE reconciliacao.quarentena ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON reconciliacao.quarentena FROM authenticated;
GRANT SELECT ON reconciliacao.quarentena TO authenticated;

DROP POLICY IF EXISTS quarentena_select ON reconciliacao.quarentena;
CREATE POLICY quarentena_select ON reconciliacao.quarentena
  FOR SELECT TO authenticated
  USING (
    -- Escopo cúpula: integridade do sistema é assunto de admin/executivo, não de
    -- usuário comum. Sem literal de role (delega aos helpers donos — guard
    -- no_literal_role_in_policy). is_executive cobre ceo/cto/gestor_projetos.
    public.is_admin((SELECT auth.uid())) OR public.is_executive((SELECT auth.uid()))
  );

COMMENT ON POLICY quarentena_select ON reconciliacao.quarentena IS
  'Slice 7 (#82): quarentena de integridade visível só a admin/executivo. Sem '
  'literal de role (helpers is_admin/is_executive). Escrita revogada — só varrer_orfaos.';

-- =============================================================================
-- VIEW admin mínima — quarentena AINDA aberta, read-only. security_invoker para
-- herdar a RLS da tabela base (a view NÃO bypassa a policy de cúpula).
-- =============================================================================
CREATE OR REPLACE VIEW reconciliacao.quarentena_aberta
  WITH (security_invoker = true) AS
  SELECT id, origem_schema, origem_tabela, origem_id, ref_tipo, ref_id_orfao, detectado_em
  FROM reconciliacao.quarentena
  WHERE resolvido_em IS NULL
  ORDER BY detectado_em DESC;

COMMENT ON VIEW reconciliacao.quarentena_aberta IS
  'Slice 7 (#82): órfãos abertos, read-only. security_invoker → herda a RLS de '
  'cúpula (admin/executivo) da tabela base. Consumo admin (SQL/dashboard).';

GRANT SELECT ON reconciliacao.quarentena_aberta TO authenticated;

COMMIT;
