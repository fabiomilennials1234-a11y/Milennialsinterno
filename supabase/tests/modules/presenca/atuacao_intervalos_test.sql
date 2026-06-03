-- supabase/tests/modules/presenca/atuacao_intervalos_test.sql
-- pgTAP — Slice 6 (#83) — Contrato do módulo `presenca`: Tempo-na-demanda.
-- ADR 0004 (contrato-only) + ADR 0005 (pode_ver_cliente) + ADR 0007 (presença viva).
--
-- Prova o CONTRATO de persistência do intervalo FECHADO de Atuação e a leitura do
-- Tempo-na-demanda, via a interface pública (as RPCs), não a implementação:
--   ESTRUTURA
--     - schema presenca existe; presenca.atuacao_intervalos existe (id, demanda_id,
--       user_id, client_id, inicio, fim); RPCs SECURITY DEFINER.
--   CONTRATO registrar_intervalo — anti-órfão + autorização + escrita
--     - registrar para demanda INEXISTENTE faz RAISE (anti-órfão atômico, ADR 0004);
--     - registrar por NÃO-autorizado (não pode_ver_cliente) faz RAISE (42501);
--     - registrar com fim<=inicio faz RAISE (intervalo inválido);
--     - registrar por envolvido grava o intervalo (user_id = caller, client_id da demanda).
--   CONTRATO tempo_na_demanda — soma + audiência herdada (ADR 0005)
--     - soma os intervalos disjuntos (número honesto de "há quanto tempo");
--     - envolvido lê; admin lê (bypass A); estranho recebe 0 (não erro);
--   CONTRATO escrita direta REVOGADA
--     - INSERT direto em presenca.atuacao_intervalos por authenticated FALHA (só RPC).
--   RLS SELECT — audiência herdada / isolamento cross-cliente
--     - envolvido vê as linhas do seu cliente; estranho NÃO vê (isolamento LGPD).
--
-- Runner: scripts/sb-pgtap.sh supabase/tests/modules/presenca/atuacao_intervalos_test.sql
-- Transporte: Management API /database/query (UMA query string; SEM meta-comandos
-- psql como \gset — toda referência ao id da demanda é por subselect/temp table).
-- UUID prefix: 'b3000000' (presenca namespace; evita colisão com ca/de/e0).
BEGIN;

SELECT plan(23);

-- Helper de impersonação (padrão demanda_rpc_test.sql / card_universal_test.sql).
CREATE OR REPLACE FUNCTION _pr_set(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_user_id,'role','authenticated')::text, true);
END;$$;

-- =============================================================================
-- ESTRUTURA
-- =============================================================================
SELECT has_schema('presenca', 'schema presenca existe (módulo, ADR 0004)');
SELECT has_table('presenca','atuacao_intervalos', 'presenca.atuacao_intervalos existe');
SELECT has_column('presenca','atuacao_intervalos','demanda_id', 'tem demanda_id');
SELECT has_column('presenca','atuacao_intervalos','user_id', 'tem user_id');
SELECT has_column('presenca','atuacao_intervalos','client_id', 'tem client_id (desnormalizado p/ RLS local)');
SELECT has_column('presenca','atuacao_intervalos','inicio', 'tem inicio');
SELECT has_column('presenca','atuacao_intervalos','fim', 'tem fim');
SELECT has_function('presenca','registrar_intervalo', ARRAY['uuid','timestamptz','timestamptz'],
  'presenca.registrar_intervalo(uuid,timestamptz,timestamptz) existe');
SELECT has_function('presenca','tempo_na_demanda', ARRAY['uuid','interval'],
  'presenca.tempo_na_demanda(uuid,interval) existe');
SELECT is(
  (SELECT bool_and(prosecdef) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='presenca' AND p.proname IN ('registrar_intervalo','tempo_na_demanda')),
  true, 'RPCs do contrato presenca são SECURITY DEFINER (hardening ADR 0004)');

-- =============================================================================
-- SEED — 1 admin(ceo), 1 cliente + demanda, 1 envolvido, 1 estranho.
-- =============================================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT u,'00000000-0000-0000-0000-000000000000'::uuid,u::text||'@pr.test',crypt('t',gen_salt('bf')),'authenticated','authenticated',now(),now(),''
FROM (VALUES
  ('b3000000-0000-0000-0000-0000000000a1'::uuid),  -- admin (ceo)
  ('b3000000-0000-0000-0000-0000000000e1'::uuid),  -- envolvido
  ('b3000000-0000-0000-0000-0000000000b0'::uuid)   -- estranho
) AS t(u)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id,name,email) VALUES
 ('b3000000-0000-0000-0000-0000000000a1'::uuid,'PR Admin','a1@pr.test'),
 ('b3000000-0000-0000-0000-0000000000e1'::uuid,'PR Envolvido','e1@pr.test'),
 ('b3000000-0000-0000-0000-0000000000b0'::uuid,'PR Estranho','b0@pr.test')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id,role) VALUES
 ('b3000000-0000-0000-0000-0000000000a1'::uuid,'ceo')
ON CONFLICT (user_id,role) DO NOTHING;

INSERT INTO public.clients (id,name) VALUES
 ('b3000000-0000-0000-0000-0000000c1100'::uuid,'PR Client')
ON CONFLICT (id) DO NOTHING;

-- Envolvido em PR Client (caminho C — involvement).
INSERT INTO cliente.client_members (client_id, user_id, papel_no_cliente)
VALUES ('b3000000-0000-0000-0000-0000000c1100'::uuid,
        'b3000000-0000-0000-0000-0000000000e1'::uuid, 'ads_manager')
ON CONFLICT DO NOTHING;

-- Demanda do cliente com id DETERMINÍSTICO (insert direto como owner do teste, fora
-- de RLS — não usa a RPC para não depender de capturar retorno entre statements).
INSERT INTO demanda.demandas (id, client_id, titulo, dominio)
VALUES ('b3000000-0000-0000-0000-00000000d100'::uuid,
        'b3000000-0000-0000-0000-0000000c1100'::uuid, 'PR Demanda', 'design')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- CONTRATO registrar_intervalo — anti-órfão (demanda inexistente -> RAISE).
-- =============================================================================
SELECT _pr_set('b3000000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT presenca.registrar_intervalo(
       'b3000000-0000-0000-0000-0000000bad00'::uuid,
       now() - interval '10 min', now()) $$,
  'P0001', NULL,
  'registrar_intervalo para demanda inexistente faz RAISE (anti-órfão atômico, ADR 0004)');
RESET ROLE;

-- =============================================================================
-- CONTRATO registrar_intervalo — autorização: estranho -> RAISE 42501.
-- =============================================================================
SELECT _pr_set('b3000000-0000-0000-0000-0000000000b0'::uuid);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT presenca.registrar_intervalo('b3000000-0000-0000-0000-00000000d100'::uuid,
       now() - interval '5 min', now()) $$,
  '42501', NULL,
  'registrar_intervalo por não-autorizado (não pode_ver_cliente) faz RAISE (autorização)');
RESET ROLE;

-- =============================================================================
-- CONTRATO registrar_intervalo — intervalo inválido (fim<=inicio) -> RAISE.
-- =============================================================================
SELECT _pr_set('b3000000-0000-0000-0000-0000000000e1'::uuid);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT presenca.registrar_intervalo('b3000000-0000-0000-0000-00000000d100'::uuid,
       now(), now() - interval '1 min') $$,
  'P0001', NULL,
  'registrar_intervalo com fim<=inicio faz RAISE (intervalo inválido)');
RESET ROLE;

-- =============================================================================
-- CONTRATO registrar_intervalo — envolvido grava 2 intervalos DISJUNTOS.
--   intervalo A: [-30min, -20min] = 10 min ; intervalo B: [-10min, -2min] = 8 min.
--   Soma esperada = 18 min = 1080 s.
-- =============================================================================
SELECT _pr_set('b3000000-0000-0000-0000-0000000000e1'::uuid);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ SELECT presenca.registrar_intervalo('b3000000-0000-0000-0000-00000000d100'::uuid,
       now() - interval '30 min', now() - interval '20 min') $$,
  'registrar_intervalo A por envolvido executa (autorizado por pode_ver_cliente)');
SELECT lives_ok(
  $$ SELECT presenca.registrar_intervalo('b3000000-0000-0000-0000-00000000d100'::uuid,
       now() - interval '10 min', now() - interval '2 min') $$,
  'registrar_intervalo B por envolvido executa');
RESET ROLE;

-- O intervalo foi gravado com user_id = caller e client_id da demanda (verifica fora de RLS).
SELECT is(
  (SELECT count(*)::int FROM presenca.atuacao_intervalos
    WHERE demanda_id = 'b3000000-0000-0000-0000-00000000d100'::uuid
      AND user_id = 'b3000000-0000-0000-0000-0000000000e1'::uuid),
  2, 'registrar_intervalo grava user_id = caller (não aceita forjar)');
SELECT is(
  (SELECT bool_and(client_id = 'b3000000-0000-0000-0000-0000000c1100'::uuid)
     FROM presenca.atuacao_intervalos WHERE demanda_id = 'b3000000-0000-0000-0000-00000000d100'::uuid),
  true, 'registrar_intervalo desnormaliza client_id da demanda (para a RLS local)');

-- =============================================================================
-- CONTRATO tempo_na_demanda — soma dos intervalos disjuntos = 1080 s.
-- =============================================================================
SELECT _pr_set('b3000000-0000-0000-0000-0000000000e1'::uuid);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT extract(epoch FROM presenca.tempo_na_demanda('b3000000-0000-0000-0000-00000000d100'::uuid, NULL))::int),
  1080, 'tempo_na_demanda soma os intervalos disjuntos (10min + 8min = 18min)');
RESET ROLE;

-- Admin lê (bypass A).
SELECT _pr_set('b3000000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT extract(epoch FROM presenca.tempo_na_demanda('b3000000-0000-0000-0000-00000000d100'::uuid, NULL))::int),
  1080, 'admin lê tempo_na_demanda (bypass A)');
RESET ROLE;

-- Estranho recebe 0 (gate de audiência herdada; não erro).
SELECT _pr_set('b3000000-0000-0000-0000-0000000000b0'::uuid);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT COALESCE(extract(epoch FROM presenca.tempo_na_demanda('b3000000-0000-0000-0000-00000000d100'::uuid, NULL)),0)::int),
  0, 'estranho recebe 0 de tempo_na_demanda (gate de audiência herdada)');
RESET ROLE;

-- =============================================================================
-- RLS SELECT — audiência herdada / isolamento cross-cliente.
-- =============================================================================
SELECT _pr_set('b3000000-0000-0000-0000-0000000000e1'::uuid);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM presenca.atuacao_intervalos
     WHERE demanda_id = 'b3000000-0000-0000-0000-00000000d100'::uuid),
  2, 'envolvido vê as linhas de intervalo do seu cliente (RLS pode_ver_cliente)');
RESET ROLE;

SELECT _pr_set('b3000000-0000-0000-0000-0000000000b0'::uuid);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM presenca.atuacao_intervalos
     WHERE demanda_id = 'b3000000-0000-0000-0000-00000000d100'::uuid),
  0, 'estranho NÃO vê linhas de intervalo (isolamento cross-cliente, LGPD)');
RESET ROLE;

-- =============================================================================
-- CONTRATO — escrita direta REVOGADA (só a RPC escreve).
-- =============================================================================
SELECT _pr_set('b3000000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ INSERT INTO presenca.atuacao_intervalos (client_id, demanda_id, user_id, inicio, fim)
     VALUES ('b3000000-0000-0000-0000-0000000c1100'::uuid,
             'b3000000-0000-0000-0000-00000000d100'::uuid,
             'b3000000-0000-0000-0000-0000000000a1'::uuid, now()-interval '1 min', now()) $$,
  '42501', NULL,
  'INSERT direto em presenca.atuacao_intervalos por authenticated FALHA (escrita revogada, só RPC)');
RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
