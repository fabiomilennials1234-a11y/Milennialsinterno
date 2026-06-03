-- supabase/tests/modules/reconciliacao/varrer_orfaos_test.sql
-- pgTAP — Slice 7 (#82) — Reconciliação: backstop de integridade do contrato-only.
-- ADR 0004 parcela (b): sem FK cross-schema, um job periódico varre as refs uuid
-- soltas, quarentena os órfãos e alerta. Esta é a rede de segurança, não a 1a linha.
--
-- Prova o CONTRATO da reconciliação via a interface pública (varrer_orfaos + view),
-- não a implementação:
--   ESTRUTURA
--     - schema reconciliacao existe; tabela quarentena existe (origem_*, ref_*,
--       detectado_em, resolvido_em); função varrer_orfaos() SECURITY DEFINER;
--       view quarentena_aberta existe.
--   DETECÇÃO — semeia 1 órfão de cada categoria, roda varrer_orfaos(), asserta que
--     cada um entrou em quarentena (aberto):
--       (1) demanda.demandas.client_id -> public.clients
--       (2) public.kanban_cards.demanda_id (nullable) -> demanda.demandas
--       (3) presenca.atuacao_intervalos.demanda_id -> demanda.demandas
--       (4) presenca.atuacao_intervalos.client_id -> public.clients
--       (5) cliente.client_members.client_id -> public.clients
--       (6) cliente.client_members.user_id -> auth.users
--   SEM FALSO-POSITIVO — refs VÁLIDAS (e kanban com demanda_id NULL) NÃO entram.
--   IDEMPOTÊNCIA — rodar 2x não duplica o mesmo órfão aberto.
--   AUTO-RESOLUÇÃO — sumido o órfão (origem deletada), nova varredura marca resolvido_em.
--   VIEW ADMIN — só admin/executivo lê (escopo via helper, sem literal de role).
--
-- Runner: scripts/sb-pgtap.sh supabase/tests/modules/reconciliacao/varrer_orfaos_test.sql
-- Transporte: Management API /database/query (UMA query string; SEM meta-comandos psql).
-- UUID prefix: 'c7000000' (reconciliacao namespace; evita colisão com ca/de/e0/b3).
-- Tudo em BEGIN..ROLLBACK: NENHUM órfão/quarentena demo persiste em prod (#82 é AFK).
BEGIN;

SELECT plan(27);

-- Helper de impersonação (padrão atuacao_intervalos_test.sql / card_universal_test.sql).
CREATE OR REPLACE FUNCTION _rc_set(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_user_id,'role','authenticated')::text, true);
END;$$;

-- =============================================================================
-- ESTRUTURA
-- =============================================================================
SELECT has_schema('reconciliacao', 'schema reconciliacao existe (cross-cutting, ADR 0004 parcela b)');
SELECT has_table('reconciliacao','quarentena', 'reconciliacao.quarentena existe');
SELECT has_column('reconciliacao','quarentena','origem_schema', 'tem origem_schema');
SELECT has_column('reconciliacao','quarentena','origem_tabela', 'tem origem_tabela');
SELECT has_column('reconciliacao','quarentena','origem_id', 'tem origem_id (text: cobre uuid e PK composta)');
SELECT has_column('reconciliacao','quarentena','ref_tipo', 'tem ref_tipo');
SELECT has_column('reconciliacao','quarentena','ref_id_orfao', 'tem ref_id_orfao');
SELECT has_column('reconciliacao','quarentena','detectado_em', 'tem detectado_em');
SELECT has_column('reconciliacao','quarentena','resolvido_em', 'tem resolvido_em (NULL = aberto)');
SELECT has_function('reconciliacao','varrer_orfaos', ARRAY[]::text[],
  'reconciliacao.varrer_orfaos() existe');
SELECT is(
  (SELECT p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='reconciliacao' AND p.proname='varrer_orfaos'),
  true, 'varrer_orfaos() é SECURITY DEFINER (hardening ADR 0004)');
SELECT has_view('reconciliacao','quarentena_aberta', 'view reconciliacao.quarentena_aberta existe');

-- =============================================================================
-- SEED
--   Cliente VÁLIDO + user VÁLIDO + demanda VÁLIDA -> não devem gerar órfão.
--   1 órfão de CADA categoria, com ids determinísticos no namespace c7.
-- =============================================================================
-- user válido (admin/ceo p/ testar a view também) + user válido comum.
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT u,'00000000-0000-0000-0000-000000000000'::uuid,u::text||'@rc.test',crypt('t',gen_salt('bf')),'authenticated','authenticated',now(),now(),''
FROM (VALUES
  ('c7000000-0000-0000-0000-0000000000a1'::uuid),  -- admin (ceo)
  ('c7000000-0000-0000-0000-0000000000b0'::uuid),  -- estranho (não-admin)
  ('c7000000-0000-0000-0000-000000000099'::uuid)   -- user válido p/ membership válida
) AS t(u)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id,name,email) VALUES
 ('c7000000-0000-0000-0000-0000000000a1'::uuid,'RC Admin','a1@rc.test'),
 ('c7000000-0000-0000-0000-0000000000b0'::uuid,'RC Estranho','b0@rc.test'),
 ('c7000000-0000-0000-0000-000000000099'::uuid,'RC ValidUser','99@rc.test')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id,role) VALUES
 ('c7000000-0000-0000-0000-0000000000a1'::uuid,'ceo')
ON CONFLICT (user_id,role) DO NOTHING;

-- Cliente VÁLIDO e demanda VÁLIDA (controles negativos — NÃO podem virar órfão).
INSERT INTO public.clients (id,name) VALUES
 ('c7000000-0000-0000-0000-0000000c1100'::uuid,'RC Client OK')
ON CONFLICT (id) DO NOTHING;
INSERT INTO demanda.demandas (id, client_id, titulo, dominio) VALUES
 ('c7000000-0000-0000-0000-00000000d100'::uuid,
  'c7000000-0000-0000-0000-0000000c1100'::uuid, 'RC Demanda OK', 'design')
ON CONFLICT (id) DO NOTHING;
-- membership VÁLIDA (cliente OK + user OK) — controle negativo.
INSERT INTO cliente.client_members (client_id, user_id, papel_no_cliente) VALUES
 ('c7000000-0000-0000-0000-0000000c1100'::uuid,
  'c7000000-0000-0000-0000-000000000099'::uuid, 'ads_manager')
ON CONFLICT DO NOTHING;
-- kanban_cards: board_id/column_id são FK NOT NULL p/ kanban_boards/kanban_columns;
-- reusa um par válido existente via subselect (não hardcoda uuid; tudo some no ROLLBACK).
-- kanban_cards com demanda_id NULL (controle negativo — nullable não é órfão).
INSERT INTO public.kanban_cards (id, board_id, column_id, title, demanda_id)
SELECT 'c7000000-0000-0000-0000-00000000ca00'::uuid, kc.board_id, kc.id, 'RC kanban NULL', NULL
FROM public.kanban_columns kc LIMIT 1
ON CONFLICT (id) DO NOTHING;
-- kanban_cards apontando p/ demanda VÁLIDA (controle negativo).
INSERT INTO public.kanban_cards (id, board_id, column_id, title, demanda_id)
SELECT 'c7000000-0000-0000-0000-00000000ca01'::uuid, kc.board_id, kc.id, 'RC kanban OK',
       'c7000000-0000-0000-0000-00000000d100'::uuid
FROM public.kanban_columns kc LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- ÓRFÃOS — ids 'bad' que não existem nos alvos.
-- (1) demanda.demandas.client_id órfão
INSERT INTO demanda.demandas (id, client_id, titulo, dominio) VALUES
 ('c7000000-0000-0000-0000-00000000d999'::uuid,
  'c7000000-0000-0000-0000-0000000bad00'::uuid, 'RC Demanda ORFA', 'dev')
ON CONFLICT (id) DO NOTHING;
-- (2) kanban_cards.demanda_id órfão (NOT NULL, inexistente)
INSERT INTO public.kanban_cards (id, board_id, column_id, title, demanda_id)
SELECT 'c7000000-0000-0000-0000-00000000ca99'::uuid, kc.board_id, kc.id, 'RC kanban ORFA',
       'c7000000-0000-0000-0000-0000000bad11'::uuid
FROM public.kanban_columns kc LIMIT 1
ON CONFLICT (id) DO NOTHING;
-- (3)+(4) presenca.atuacao_intervalos: demanda_id E client_id órfãos.
INSERT INTO presenca.atuacao_intervalos (id, client_id, demanda_id, user_id, inicio, fim) VALUES
 ('c7000000-0000-0000-0000-0000000a1999'::uuid,
  'c7000000-0000-0000-0000-0000000bad22'::uuid,
  'c7000000-0000-0000-0000-0000000bad33'::uuid,
  'c7000000-0000-0000-0000-000000000099'::uuid,
  now() - interval '10 min', now() - interval '2 min')
ON CONFLICT (id) DO NOTHING;
-- (5)+(6) cliente.client_members: client_id E user_id órfãos.
INSERT INTO cliente.client_members (client_id, user_id, papel_no_cliente) VALUES
 ('c7000000-0000-0000-0000-0000000bad44'::uuid,
  'c7000000-0000-0000-0000-0000000bad55'::uuid, 'crm')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- DETECÇÃO — roda a varredura e checa cada categoria (fora de RLS, como owner).
-- =============================================================================
SELECT lives_ok($$ SELECT reconciliacao.varrer_orfaos() $$,
  'varrer_orfaos() executa sem erro');

SELECT is(
  (SELECT count(*)::int FROM reconciliacao.quarentena
     WHERE origem_schema='demanda' AND origem_tabela='demandas' AND ref_tipo='client'
       AND ref_id_orfao='c7000000-0000-0000-0000-0000000bad00'::uuid AND resolvido_em IS NULL),
  1, '(1) demanda.demandas.client_id órfão entra em quarentena');

SELECT is(
  (SELECT count(*)::int FROM reconciliacao.quarentena
     WHERE origem_schema='public' AND origem_tabela='kanban_cards' AND ref_tipo='demanda'
       AND ref_id_orfao='c7000000-0000-0000-0000-0000000bad11'::uuid AND resolvido_em IS NULL),
  1, '(2) kanban_cards.demanda_id órfão (NOT NULL) entra em quarentena');

SELECT is(
  (SELECT count(*)::int FROM reconciliacao.quarentena
     WHERE origem_schema='presenca' AND origem_tabela='atuacao_intervalos' AND ref_tipo='demanda'
       AND ref_id_orfao='c7000000-0000-0000-0000-0000000bad33'::uuid AND resolvido_em IS NULL),
  1, '(3) atuacao_intervalos.demanda_id órfão entra em quarentena');

SELECT is(
  (SELECT count(*)::int FROM reconciliacao.quarentena
     WHERE origem_schema='presenca' AND origem_tabela='atuacao_intervalos' AND ref_tipo='client'
       AND ref_id_orfao='c7000000-0000-0000-0000-0000000bad22'::uuid AND resolvido_em IS NULL),
  1, '(4) atuacao_intervalos.client_id órfão entra em quarentena');

SELECT is(
  (SELECT count(*)::int FROM reconciliacao.quarentena
     WHERE origem_schema='cliente' AND origem_tabela='client_members' AND ref_tipo='client'
       AND ref_id_orfao='c7000000-0000-0000-0000-0000000bad44'::uuid AND resolvido_em IS NULL),
  1, '(5) client_members.client_id órfão entra em quarentena');

SELECT is(
  (SELECT count(*)::int FROM reconciliacao.quarentena
     WHERE origem_schema='cliente' AND origem_tabela='client_members' AND ref_tipo='user'
       AND ref_id_orfao='c7000000-0000-0000-0000-0000000bad55'::uuid AND resolvido_em IS NULL),
  1, '(6) client_members.user_id órfão entra em quarentena');

-- =============================================================================
-- SEM FALSO-POSITIVO — refs VÁLIDAS e kanban demanda_id NULL NÃO entram.
-- =============================================================================
SELECT is(
  (SELECT count(*)::int FROM reconciliacao.quarentena
     WHERE ref_id_orfao IN (
       'c7000000-0000-0000-0000-0000000c1100'::uuid,  -- cliente válido
       'c7000000-0000-0000-0000-00000000d100'::uuid,  -- demanda válida
       'c7000000-0000-0000-0000-000000000099'::uuid)),-- user válido
  0, 'refs VÁLIDAS NÃO entram em quarentena (zero falso-positivo)');

SELECT is(
  (SELECT count(*)::int FROM reconciliacao.quarentena
     WHERE origem_id = 'c7000000-0000-0000-0000-00000000ca00'),  -- kanban demanda_id NULL
  0, 'kanban_cards.demanda_id NULL NÃO é tratado como órfão (nullable)');

-- =============================================================================
-- IDEMPOTÊNCIA — rodar de novo não duplica o mesmo órfão aberto.
-- =============================================================================
SELECT lives_ok($$ SELECT reconciliacao.varrer_orfaos() $$,
  'varrer_orfaos() roda 2a vez sem erro');
SELECT is(
  (SELECT count(*)::int FROM reconciliacao.quarentena
     WHERE origem_schema='demanda' AND origem_tabela='demandas' AND ref_tipo='client'
       AND ref_id_orfao='c7000000-0000-0000-0000-0000000bad00'::uuid AND resolvido_em IS NULL),
  1, 'idempotência: 2a varredura NÃO duplica o mesmo órfão aberto');

-- =============================================================================
-- AUTO-RESOLUÇÃO — sumido o órfão (origem deletada), nova varredura resolve.
--   Deleta a demanda órfã (1); roda; a linha de quarentena dela vira resolvida.
-- =============================================================================
DELETE FROM demanda.demandas WHERE id='c7000000-0000-0000-0000-00000000d999'::uuid;
SELECT lives_ok($$ SELECT reconciliacao.varrer_orfaos() $$,
  'varrer_orfaos() roda após sumir a origem do órfão (1)');
SELECT is(
  (SELECT count(*)::int FROM reconciliacao.quarentena
     WHERE origem_schema='demanda' AND origem_tabela='demandas' AND ref_tipo='client'
       AND ref_id_orfao='c7000000-0000-0000-0000-0000000bad00'::uuid AND resolvido_em IS NOT NULL),
  1, 'auto-resolução: órfão que sumiu recebe resolvido_em (histórico preservado)');

-- =============================================================================
-- VIEW ADMIN — escopo via helper (sem literal de role).
--   admin/ceo enxerga a quarentena aberta; estranho (não-admin) NÃO.
-- =============================================================================
SELECT _rc_set('c7000000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;
SELECT ok(
  (SELECT count(*) FROM reconciliacao.quarentena_aberta) > 0,
  'admin/executivo enxerga reconciliacao.quarentena_aberta');
RESET ROLE;

SELECT _rc_set('c7000000-0000-0000-0000-0000000000b0'::uuid);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM reconciliacao.quarentena_aberta),
  0, 'estranho (não-admin) NÃO enxerga a quarentena (escopo admin/executivo)');
RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
