-- supabase/tests/modules/demanda/demanda_rpc_test.sql
-- pgTAP — Slice 4 (#80) — Contrato do módulo `demanda`. ADR 0004 + 0005.
--
-- Prova o CONTRATO (interface pública do módulo) e seus invariantes, via a
-- interface pública (as RPCs), não a implementação:
--   ESTRUTURA
--     - schema demanda existe; demanda.demandas existe;
--     - criar / vincular_card / do_cliente existem e são SECURITY DEFINER;
--     - kanban_cards.demanda_id existe (link strangler).
--   CONTRATO criar — anti-órfão + autorização + escrita
--     - criar para cliente INEXISTENTE faz RAISE (anti-órfão atômico, ADR 0004);
--     - criar por NÃO-autorizado (não pode_ver_cliente) faz RAISE (42501);
--     - criar por envolvido grava a demanda e retorna id;
--   CONTRATO vincular_card — anti-órfão duplo + persistência
--     - vincular a demanda inexistente faz RAISE;
--     - vincular card existente persiste kanban_cards.demanda_id;
--   CONTRATO do_cliente — audiência herdada (ADR 0005)
--     - envolvido lista as demandas do cliente;
--     - admin lista (bypass A);
--     - estranho (não pode_ver_cliente) recebe VAZIO (não erro);
--   CONTRATO escrita direta REVOGADA
--     - INSERT direto em demanda.demandas por authenticated FALHA (só RPC escreve).
--
-- Runner: scripts/sb-pgtap.sh supabase/tests/modules/demanda/demanda_rpc_test.sql
-- UUID prefix: 'de000000' (demanda namespace; evita colisão com ca/a2/e0).
BEGIN;

SELECT plan(19);

-- Helper de impersonação (padrão card_universal_test.sql / membership_rpc_test.sql).
CREATE OR REPLACE FUNCTION _dm_set(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_user_id,'role','authenticated')::text, true);
END;$$;

-- =============================================================================
-- ESTRUTURA
-- =============================================================================
SELECT has_schema('demanda', 'schema demanda existe (módulo, ADR 0004)');
SELECT has_table('demanda','demandas', 'demanda.demandas existe');
SELECT has_function('demanda','criar', ARRAY['uuid','text','text'],
  'demanda.criar(uuid,text,text) existe');
SELECT has_function('demanda','vincular_card', ARRAY['uuid','uuid'],
  'demanda.vincular_card(uuid,uuid) existe');
SELECT has_function('demanda','do_cliente', ARRAY['uuid'],
  'demanda.do_cliente(uuid) existe');
SELECT has_column('public','kanban_cards','demanda_id',
  'public.kanban_cards.demanda_id existe (link strangler)');
SELECT is(
  (SELECT bool_and(prosecdef) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='demanda' AND p.proname IN ('criar','vincular_card','do_cliente')),
  true, 'RPCs do contrato demanda são SECURITY DEFINER (hardening ADR 0004)');

-- =============================================================================
-- SEED — 1 admin(ceo), 1 cliente, 1 envolvido, 1 estranho.
-- =============================================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT u,'00000000-0000-0000-0000-000000000000'::uuid,u::text||'@dm.test',crypt('t',gen_salt('bf')),'authenticated','authenticated',now(),now(),''
FROM (VALUES
  ('de000000-0000-0000-0000-0000000000a1'::uuid),  -- admin (ceo)
  ('de000000-0000-0000-0000-0000000000e1'::uuid),  -- envolvido
  ('de000000-0000-0000-0000-0000000000b0'::uuid)   -- estranho (só role design do trigger)
) AS t(u)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id,name,email) VALUES
 ('de000000-0000-0000-0000-0000000000a1'::uuid,'DM Admin','a1@dm.test'),
 ('de000000-0000-0000-0000-0000000000e1'::uuid,'DM Envolvido','e1@dm.test'),
 ('de000000-0000-0000-0000-0000000000b0'::uuid,'DM Estranho','b0@dm.test')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id,role) VALUES
 ('de000000-0000-0000-0000-0000000000a1'::uuid,'ceo')
ON CONFLICT (user_id,role) DO NOTHING;

INSERT INTO public.clients (id,name) VALUES
 ('de000000-0000-0000-0000-0000000c1100'::uuid,'DM Client')
ON CONFLICT (id) DO NOTHING;

-- Envolvido em DM Client (caminho C — involvement).
INSERT INTO cliente.client_members (client_id, user_id, papel_no_cliente)
VALUES ('de000000-0000-0000-0000-0000000c1100'::uuid,
        'de000000-0000-0000-0000-0000000000e1'::uuid, 'ads_manager')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- CONTRATO criar — anti-órfão (cliente inexistente -> RAISE). Como admin.
-- =============================================================================
SELECT _dm_set('de000000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT demanda.criar('de000000-0000-0000-0000-0000000bad00'::uuid, 'Landing X', 'design') $$,
  'P0001', NULL,
  'criar para cliente inexistente faz RAISE (anti-órfão atômico via cliente.existe)');
RESET ROLE;

-- =============================================================================
-- CONTRATO criar — autorização: estranho (não pode_ver_cliente) -> RAISE 42501.
-- =============================================================================
SELECT _dm_set('de000000-0000-0000-0000-0000000000b0'::uuid);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT demanda.criar('de000000-0000-0000-0000-0000000c1100'::uuid, 'Landing X', 'design') $$,
  '42501', NULL,
  'criar por não-autorizado (não pode_ver_cliente) faz RAISE (autorização do contrato)');
RESET ROLE;

-- =============================================================================
-- CONTRATO criar — envolvido cria e recebe id; a demanda persiste.
-- =============================================================================
SELECT _dm_set('de000000-0000-0000-0000-0000000000e1'::uuid);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ SELECT demanda.criar('de000000-0000-0000-0000-0000000c1100'::uuid, '  Landing do Cliente  ', 'design') $$,
  'criar por envolvido executa (autorizado por pode_ver_cliente)');
RESET ROLE;

-- A demanda foi gravada (verifica fora de RLS, como owner do teste).
SELECT is(
  (SELECT count(*)::int FROM demanda.demandas
    WHERE client_id='de000000-0000-0000-0000-0000000c1100'::uuid AND dominio='design'),
  1, 'criar persiste a demanda em demanda.demandas');
SELECT is(
  (SELECT titulo FROM demanda.demandas
    WHERE client_id='de000000-0000-0000-0000-0000000c1100'::uuid AND dominio='design'),
  'Landing do Cliente', 'criar normaliza o titulo (btrim)');

-- =============================================================================
-- CONTRATO vincular_card — anti-órfão (demanda inexistente -> RAISE).
-- =============================================================================
SELECT _dm_set('de000000-0000-0000-0000-0000000000e1'::uuid);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT demanda.vincular_card('de000000-0000-0000-0000-0000000bad11'::uuid,
                                  'de000000-0000-0000-0000-0000000bad22'::uuid) $$,
  'P0001', NULL,
  'vincular_card para demanda inexistente faz RAISE (anti-órfão)');
RESET ROLE;

-- =============================================================================
-- CONTRATO vincular_card — persiste kanban_cards.demanda_id.
-- Seed de um kanban board/column/card mínimo (como owner do teste, fora de RLS).
-- =============================================================================
INSERT INTO public.kanban_boards (id, name, slug) VALUES
 ('de000000-0000-0000-0000-00000000b0a1'::uuid, 'DM Board', 'dm-board-de000000')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kanban_columns (id, board_id, title) VALUES
 ('de000000-0000-0000-0000-00000000c0a1'::uuid, 'de000000-0000-0000-0000-00000000b0a1'::uuid, 'A Fazer')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kanban_cards (id, column_id, board_id, title, client_id) VALUES
 ('de000000-0000-0000-0000-00000000ca01'::uuid,
  'de000000-0000-0000-0000-00000000c0a1'::uuid,
  'de000000-0000-0000-0000-00000000b0a1'::uuid,
  'DM Card', 'de000000-0000-0000-0000-0000000c1100'::uuid)
ON CONFLICT (id) DO NOTHING;

-- Vincula o card à demanda criada antes (lookup pelo cliente+dominio).
SELECT _dm_set('de000000-0000-0000-0000-0000000000e1'::uuid);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ SELECT demanda.vincular_card(
       (SELECT id FROM demanda.demandas
         WHERE client_id='de000000-0000-0000-0000-0000000c1100'::uuid AND dominio='design' LIMIT 1),
       'de000000-0000-0000-0000-00000000ca01'::uuid) $$,
  'vincular_card por autorizado executa');
RESET ROLE;

SELECT is(
  (SELECT demanda_id IS NOT NULL FROM public.kanban_cards
    WHERE id='de000000-0000-0000-0000-00000000ca01'::uuid),
  true, 'vincular_card persiste kanban_cards.demanda_id');

-- =============================================================================
-- CONTRATO do_cliente — audiência herdada (ADR 0005).
-- =============================================================================
-- Envolvido lista as demandas do cliente.
SELECT _dm_set('de000000-0000-0000-0000-0000000000e1'::uuid);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM demanda.do_cliente('de000000-0000-0000-0000-0000000c1100'::uuid)),
  1, 'envolvido lista as demandas do cliente (do_cliente)');
RESET ROLE;

-- Admin lista (bypass A).
SELECT _dm_set('de000000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM demanda.do_cliente('de000000-0000-0000-0000-0000000c1100'::uuid)),
  1, 'admin lista as demandas do cliente (bypass A)');
RESET ROLE;

-- Estranho (não pode_ver_cliente) recebe VAZIO (não erro) — semântica 200+vazio.
SELECT _dm_set('de000000-0000-0000-0000-0000000000b0'::uuid);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM demanda.do_cliente('de000000-0000-0000-0000-0000000c1100'::uuid)),
  0, 'estranho recebe VAZIO de do_cliente (gate de audiência herdada)');
RESET ROLE;

-- =============================================================================
-- CONTRATO — escrita direta REVOGADA (só a RPC escreve).
-- =============================================================================
SELECT _dm_set('de000000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ INSERT INTO demanda.demandas (client_id, titulo)
     VALUES ('de000000-0000-0000-0000-0000000c1100'::uuid, 'bypass direto') $$,
  '42501', NULL,
  'INSERT direto em demanda.demandas por authenticated FALHA (escrita revogada, só RPC)');
RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
