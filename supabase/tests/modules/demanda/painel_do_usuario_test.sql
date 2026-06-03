-- supabase/tests/modules/demanda/painel_do_usuario_test.sql
-- pgTAP — Slice 8 (#84) — Contrato de AGREGAÇÃO do módulo `demanda`: a vista de
-- pássaro "Monday". ADR 0004 (contrato-only) + ADR 0005 (pode_ver_cliente).
--
-- Prova o CONTRATO de `demanda.painel_do_usuario()` — a RPC que devolve, numa só
-- query, TODAS as demandas de TODOS os clientes que o caller pode ver (cross-
-- cliente), com nome do cliente e Tempo-na-demanda acumulado por demanda. É o
-- caminho de leitura do board agregado (evita N+1: 1 query no lugar de 1 por
-- cliente). Tudo pela interface pública (a RPC), não a implementação:
--   ESTRUTURA
--     - demanda.painel_do_usuario() existe, é SECURITY DEFINER, RETURNS TABLE
--       com (demanda_id, client_id, client_nome, titulo, status, dominio,
--       created_at, tempo_segundos).
--   AUDIÊNCIA / ISOLAMENTO cross-cliente (ADR 0005 — risco LGPD do board)
--     - envolvido em A vê SÓ as demandas de A; NÃO vê as de B (isolamento);
--     - admin (bypass A) vê as demandas de A e de B;
--     - estranho (não pode_ver_cliente de ninguém) recebe VAZIO (não erro).
--   AGREGAÇÃO de tempo
--     - tempo_segundos = SOMA dos intervalos de atuação da demanda;
--     - demanda SEM intervalo aparece com tempo_segundos = 0 (LEFT JOIN, não some).
--   PROJEÇÃO
--     - client_nome vem de public.clients (a RPC resolve o nome — o board não
--       faz N lookups de cliente).
--
-- Runner: scripts/sb-pgtap.sh supabase/tests/modules/demanda/painel_do_usuario_test.sql
-- Transporte: Management API /database/query (UMA query string; SEM meta-comandos
-- psql; toda referência a id é por literal/subselect).
-- UUID prefix: '8a' (Slice 8 namespace; evita colisão com a2/b3/b6/ca/d0/de/e0).
BEGIN;

SELECT plan(14);

-- Helper de impersonação (padrão demanda_rpc_test.sql / atuacao_intervalos_test.sql).
CREATE OR REPLACE FUNCTION _pu_set(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_user_id,'role','authenticated')::text, true);
END;$$;

-- =============================================================================
-- ESTRUTURA
-- =============================================================================
SELECT has_function('demanda','painel_do_usuario', ARRAY[]::text[],
  'demanda.painel_do_usuario() existe (RPC de agregação cross-cliente)');
SELECT is(
  (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='demanda' AND p.proname='painel_do_usuario'),
  true, 'painel_do_usuario é SECURITY DEFINER (hardening ADR 0004)');

-- =============================================================================
-- SEED — 1 admin(ceo), 2 clientes (A, B) com 1 demanda cada, 1 envolvido só em A,
--        1 estranho. Demanda de A recebe um intervalo de 600s; B fica sem tempo.
-- =============================================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT u,'00000000-0000-0000-0000-000000000000'::uuid,u::text||'@pu.test',crypt('t',gen_salt('bf')),'authenticated','authenticated',now(),now(),''
FROM (VALUES
  ('8a000000-0000-0000-0000-0000000000a1'::uuid),  -- admin (ceo)
  ('8a000000-0000-0000-0000-0000000000e1'::uuid),  -- envolvido só em A
  ('8a000000-0000-0000-0000-0000000000b0'::uuid)   -- estranho
) AS t(u)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id,name,email) VALUES
 ('8a000000-0000-0000-0000-0000000000a1'::uuid,'PU Admin','a1@pu.test'),
 ('8a000000-0000-0000-0000-0000000000e1'::uuid,'PU Envolvido','e1@pu.test'),
 ('8a000000-0000-0000-0000-0000000000b0'::uuid,'PU Estranho','b0@pu.test')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id,role) VALUES
 ('8a000000-0000-0000-0000-0000000000a1'::uuid,'ceo')
ON CONFLICT (user_id,role) DO NOTHING;

-- Dois clientes distintos. Nome conhecido p/ provar a projeção client_nome.
INSERT INTO public.clients (id,name) VALUES
 ('8a000000-0000-0000-0000-0000000c11a0'::uuid,'PU Client A'),
 ('8a000000-0000-0000-0000-0000000c11b0'::uuid,'PU Client B')
ON CONFLICT (id) DO NOTHING;

-- Envolvido SÓ no cliente A (caminho C — involvement). Não vê B.
INSERT INTO cliente.client_members (client_id, user_id, papel_no_cliente)
VALUES ('8a000000-0000-0000-0000-0000000c11a0'::uuid,
        '8a000000-0000-0000-0000-0000000000e1'::uuid, 'ads_manager')
ON CONFLICT DO NOTHING;

-- Uma demanda em cada cliente. Seed direto pelo OWNER do teste (sem impersonar):
-- a escrita direta em demanda.demandas é REVOGADA para authenticated (contrato-only,
-- ADR 0004) — quem semeia o fixture é o role dono que roda o teste, não um caller.
INSERT INTO demanda.demandas (id, client_id, titulo, status, dominio)
VALUES
 ('8a000000-0000-0000-0000-00000000da00'::uuid,'8a000000-0000-0000-0000-0000000c11a0'::uuid,'Demanda A','aberta','design'),
 ('8a000000-0000-0000-0000-00000000da01'::uuid,'8a000000-0000-0000-0000-0000000c11b0'::uuid,'Demanda B','aberta','dev')
ON CONFLICT (id) DO NOTHING;

-- Tempo SÓ na demanda de A: dois intervalos disjuntos = 600s. B fica sem tempo.
INSERT INTO presenca.atuacao_intervalos (client_id, demanda_id, user_id, inicio, fim)
VALUES
 ('8a000000-0000-0000-0000-0000000c11a0'::uuid,'8a000000-0000-0000-0000-00000000da00'::uuid,
  '8a000000-0000-0000-0000-0000000000e1'::uuid, now() - interval '20 min', now() - interval '15 min'),  -- 300s
 ('8a000000-0000-0000-0000-0000000c11a0'::uuid,'8a000000-0000-0000-0000-00000000da00'::uuid,
  '8a000000-0000-0000-0000-0000000000e1'::uuid, now() - interval '10 min', now() - interval '5 min');   -- 300s

-- =============================================================================
-- AUDIÊNCIA / ISOLAMENTO — envolvido em A vê SÓ A.
-- =============================================================================
SELECT _pu_set('8a000000-0000-0000-0000-0000000000e1'::uuid);

SELECT is(
  (SELECT count(*)::int FROM demanda.painel_do_usuario()
     WHERE client_id = '8a000000-0000-0000-0000-0000000c11a0'::uuid),
  1, 'envolvido em A vê a demanda de A');

SELECT is(
  (SELECT count(*)::int FROM demanda.painel_do_usuario()
     WHERE client_id = '8a000000-0000-0000-0000-0000000c11b0'::uuid),
  0, 'envolvido em A NÃO vê a demanda de B (isolamento cross-cliente, LGPD)');

SELECT is(
  (SELECT count(DISTINCT client_id)::int FROM demanda.painel_do_usuario()),
  1, 'envolvido em A vê exatamente 1 cliente (só os que pode_ver_cliente)');

-- =============================================================================
-- AGREGAÇÃO de tempo (visão do envolvido em A).
-- =============================================================================
SELECT is(
  (SELECT tempo_segundos FROM demanda.painel_do_usuario()
     WHERE demanda_id = '8a000000-0000-0000-0000-00000000da00'::uuid),
  600::bigint, 'tempo_segundos = soma dos intervalos da demanda A (300+300=600)');

-- =============================================================================
-- PROJEÇÃO — client_nome resolvido pela RPC (board não faz N lookups).
-- =============================================================================
SELECT is(
  (SELECT client_nome FROM demanda.painel_do_usuario()
     WHERE demanda_id = '8a000000-0000-0000-0000-00000000da00'::uuid),
  'PU Client A', 'painel resolve client_nome de public.clients (projeção)');

SELECT is(
  (SELECT titulo FROM demanda.painel_do_usuario()
     WHERE demanda_id = '8a000000-0000-0000-0000-00000000da00'::uuid),
  'Demanda A', 'painel devolve o título da demanda');

SELECT is(
  (SELECT dominio FROM demanda.painel_do_usuario()
     WHERE demanda_id = '8a000000-0000-0000-0000-00000000da00'::uuid),
  'design', 'painel devolve o domínio da demanda');

-- =============================================================================
-- AUDIÊNCIA — admin (bypass A) vê A e B.
-- =============================================================================
SELECT _pu_set('8a000000-0000-0000-0000-0000000000a1'::uuid);

SELECT is(
  (SELECT count(*)::int FROM demanda.painel_do_usuario()
     WHERE client_id = '8a000000-0000-0000-0000-0000000c11a0'::uuid),
  1, 'admin vê a demanda de A (bypass A)');

SELECT is(
  (SELECT count(*)::int FROM demanda.painel_do_usuario()
     WHERE client_id = '8a000000-0000-0000-0000-0000000c11b0'::uuid),
  1, 'admin vê a demanda de B (bypass A)');

-- LEFT JOIN: demanda de B não tem intervalo -> tempo_segundos = 0 (não some).
SELECT is(
  (SELECT tempo_segundos FROM demanda.painel_do_usuario()
     WHERE demanda_id = '8a000000-0000-0000-0000-00000000da01'::uuid),
  0::bigint, 'demanda sem intervalo aparece com tempo_segundos = 0 (LEFT JOIN)');

-- =============================================================================
-- AUDIÊNCIA — estranho recebe VAZIO (não erro). Semântica 200+vazio (#80).
-- =============================================================================
SELECT _pu_set('8a000000-0000-0000-0000-0000000000b0'::uuid);

SELECT is(
  (SELECT count(*)::int FROM demanda.painel_do_usuario()),
  0, 'estranho (não pode_ver_cliente de ninguém) recebe VAZIO (não erro)');

-- =============================================================================
-- ESCRITA — a RPC é READ-ONLY (STABLE); não há caminho de escrita novo aqui.
-- (Cobre que a agregação não introduz mutação; a escrita é criar/vincular #80.)
-- =============================================================================
SELECT is(
  (SELECT provolatile FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='demanda' AND p.proname='painel_do_usuario'),
  's', 'painel_do_usuario é STABLE (leitura; não muta estado)');

SELECT * FROM finish();
ROLLBACK;
