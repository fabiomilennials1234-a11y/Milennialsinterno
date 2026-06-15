-- supabase/tests/torque_board_gerar_5arg_ads_owner_authz_test.sql
-- pgTAP — REGRESSÃO da assinatura de 5 args de public.torque_board_gerar (Funil A/B).
--
-- BUG (corrigido em 20260615140000): a versão de 5 args introduzida em
-- 20260609120000 (Funil A/B) chamava _torque_board_pode_escrever(p_gestor_id,
-- v_caller) — SÓ 2 ARGS — sobrescrevendo a versão correta de 20260605140000 que
-- passava p_client_id (3 args). Sem o 3º arg, _client_id cai no DEFAULT NULL e o
-- ramo `_ads_owns_client(_client_id, _caller)` NUNCA avalia. Resultado: o gestor
-- de ADS dono do cliente (assigned_ads_manager = caller), que NÃO é admin, NÃO
-- tem has_page_access('gestor-crm') e NÃO é o gestor_id do card, recebia 42501
-- ao brifar — bug de PRODUÇÃO.
--
-- Este teste FALHARIA contra a versão buggada de 20260609120000 (o primeiro
-- lives_ok abaixo viraria throws 42501) e PASSA com o fix de 20260615140000.
-- Testa pela INTERFACE PÚBLICA (a RPC de 5 args), exercitando explicitamente o
-- param p_funil, que é a assinatura que regrediu.
--
-- Matriz de _torque_board_pode_escrever via torque_board_gerar(5 args):
--   ads_dono (assigned_ads_manager=caller, NÃO admin, SEM page-grant, NÃO gestor_id)  -> CONSEGUE  [era o bug]
--   ads_fora (não dono, sem outro vínculo)                                            -> 42501
--   admin (ceo)                                                                       -> CONSEGUE
--   gestor_id do card == caller                                                       -> CONSEGUE
--   has_page_access('gestor-crm')                                                     -> CONSEGUE
--
-- QUIRK: clients.assigned_ads_manager é UUID — compara = caller direto, SEM ::text.
-- UUID prefix: 'b1000000'. Runner: supabase db test (local) — pgTAP não roda no
-- remoto via Management API.
BEGIN;

SELECT plan(8);

CREATE OR REPLACE FUNCTION _tg5_set(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_user_id,'role','authenticated')::text, true);
END;$$;

-- =============================================================================
-- ESTRUTURA — a RPC de 5 args existe e chama o predicado com 3 args (o fix).
-- =============================================================================
SELECT has_function('public','torque_board_gerar',
  ARRAY['uuid','text','text','jsonb','text'],
  'torque_board_gerar(uuid,text,text,jsonb,text) existe (assinatura Funil A/B de 5 args)');

-- Prova estrutural do fix: o corpo passa p_client_id ao predicado (3 args).
-- Guarda contra a regressão exata de 20260609120000 (chamada de 2 args).
SELECT ok(
  pg_get_functiondef('public.torque_board_gerar(uuid,text,text,jsonb,text)'::regprocedure)
    LIKE '%_torque_board_pode_escrever(p_gestor_id, v_caller, p_client_id)%',
  'fix: torque_board_gerar passa p_client_id ao predicado (3 args, ramo ads ativo)');

-- =============================================================================
-- SEED
--   ceo          : admin (não-regressão)
--   ads_dono     : gestor_ads, carteira = client_alvo (caso do bug)
--   ads_fora     : gestor_ads, carteira = OUTRO cliente
--   gcrm_card    : usuário cujo id é o gestor_id do card (ramo gestor_id==caller)
--   client_alvo  : assigned_ads_manager = ads_dono
-- =============================================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT u,'00000000-0000-0000-0000-000000000000'::uuid,u::text||'@m.test',crypt('t',gen_salt('bf')),'authenticated','authenticated',now(),now(),''
FROM (VALUES
  ('b1000000-0000-0000-0000-0000000000a1'::uuid),  -- ceo/admin
  ('b1000000-0000-0000-0000-0000000000a2'::uuid),  -- ads_dono
  ('b1000000-0000-0000-0000-0000000000a3'::uuid),  -- ads_fora
  ('b1000000-0000-0000-0000-0000000000c1'::uuid),  -- gestor_id do card
  ('b1000000-0000-0000-0000-0000000000d1'::uuid)   -- page-grant 'gestor-crm', sem ser dono
) AS t(u)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id,name,email) VALUES
 ('b1000000-0000-0000-0000-0000000000a1'::uuid,'TG5 Ceo','tg5a1@m.test'),
 ('b1000000-0000-0000-0000-0000000000a2'::uuid,'TG5 AdsDono','tg5a2@m.test'),
 ('b1000000-0000-0000-0000-0000000000a3'::uuid,'TG5 AdsFora','tg5a3@m.test'),
 ('b1000000-0000-0000-0000-0000000000c1'::uuid,'TG5 GestorCard','tg5c1@m.test'),
 ('b1000000-0000-0000-0000-0000000000d1'::uuid,'TG5 PageGrant','tg5d1@m.test')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id,role) VALUES
 ('b1000000-0000-0000-0000-0000000000a1'::uuid,'ceo'),
 ('b1000000-0000-0000-0000-0000000000a2'::uuid,'gestor_ads'),
 ('b1000000-0000-0000-0000-0000000000a3'::uuid,'gestor_ads'),
 ('b1000000-0000-0000-0000-0000000000c1'::uuid,'gestor_crm'),
 ('b1000000-0000-0000-0000-0000000000d1'::uuid,'gestor_ads')  -- papel sem poder; autoriza SÓ via page-grant
ON CONFLICT (user_id,role) DO NOTHING;

-- page-grant 'gestor-crm' para o persona d1 (não dono de nenhum cliente).
INSERT INTO public.user_page_grants (user_id, page_slug, source, granted_by)
VALUES ('b1000000-0000-0000-0000-0000000000d1'::uuid,'gestor-crm','direct',
        'b1000000-0000-0000-0000-0000000000a1'::uuid)
ON CONFLICT DO NOTHING;

INSERT INTO public.clients (id,name,assigned_ads_manager) VALUES
 ('b1000000-0000-0000-0000-0000000c1100'::uuid,'TG5 Client Alvo', 'b1000000-0000-0000-0000-0000000000a2'::uuid),
 ('b1000000-0000-0000-0000-0000000c2200'::uuid,'TG5 Client Outro','b1000000-0000-0000-0000-0000000000a3'::uuid)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- CASO DO BUG — ads_dono na própria carteira, via assinatura de 5 args COM p_funil.
-- NÃO é admin, SEM page-grant gestor-crm, gestor_id do card != caller.
-- Só o ramo _ads_owns_client autoriza. Contra a versão buggada (2 args) este
-- lives_ok viraria throws 42501.
-- =============================================================================
SELECT _tg5_set('b1000000-0000-0000-0000-0000000000a2'::uuid);
SET LOCAL ROLE authenticated;

SELECT lives_ok($$
  SELECT public.torque_board_gerar(
    'b1000000-0000-0000-0000-0000000c1100'::uuid,
    'b1000000-0000-0000-0000-0000000000c1',   -- gestor_id do card != caller (ads)
    'torque', '{}'::jsonb, 'A')                -- 5 args, exercita p_funil
$$, 'BUG FIX: ads_dono gera card na carteira via RPC de 5 args (ramo ads ativo)');

-- O funil foi gravado atomicamente (prova que o caminho de escrita rodou inteiro).
RESET ROLE;
SELECT is(
  (SELECT funil FROM public.clients WHERE id='b1000000-0000-0000-0000-0000000c1100'::uuid),
  'A', 'fix: clients.funil gravado atomicamente pela RPC autorizada');

-- =============================================================================
-- SEGURANÇA — ads_fora no cliente alheio, via 5 args -> 42501. Sem vazamento.
-- =============================================================================
SELECT _tg5_set('b1000000-0000-0000-0000-0000000000a3'::uuid);
SET LOCAL ROLE authenticated;

SELECT throws_ok($$
  SELECT public.torque_board_gerar(
    'b1000000-0000-0000-0000-0000000c1100'::uuid,
    'b1000000-0000-0000-0000-0000000000c1','automation','{}'::jsonb,'B')
$$, '42501', NULL,
  'SEGURANÇA: ads_fora no cliente alheio (5 args) -> permission denied (42501)');

-- =============================================================================
-- NÃO-REGRESSÃO — admin (ceo) e gestor_id-do-card seguem autorizados.
-- =============================================================================
RESET ROLE;
SELECT _tg5_set('b1000000-0000-0000-0000-0000000000a1'::uuid);  -- ceo/admin
SET LOCAL ROLE authenticated;
SELECT lives_ok($$
  SELECT public.torque_board_gerar(
    'b1000000-0000-0000-0000-0000000c2200'::uuid,
    'b1000000-0000-0000-0000-0000000000c1','automation','{}'::jsonb,'A')
$$, 'NÃO-REGRESSÃO: admin gera em qualquer cliente (5 args)');

RESET ROLE;
SELECT _tg5_set('b1000000-0000-0000-0000-0000000000c1'::uuid);  -- gestor_id == caller
SET LOCAL ROLE authenticated;
SELECT lives_ok($$
  SELECT public.torque_board_gerar(
    'b1000000-0000-0000-0000-0000000c2200'::uuid,
    'b1000000-0000-0000-0000-0000000000c1','copilot','{}'::jsonb,'B')
$$, 'NÃO-REGRESSÃO: gestor_id do card == caller autoriza (ramo gestor_id, 5 args)');

RESET ROLE;
SELECT _tg5_set('b1000000-0000-0000-0000-0000000000d1'::uuid);  -- page-grant 'gestor-crm', não dono
SET LOCAL ROLE authenticated;
SELECT lives_ok($$
  SELECT public.torque_board_gerar(
    'b1000000-0000-0000-0000-0000000c1100'::uuid,
    'b1000000-0000-0000-0000-0000000000c1','torque','{}'::jsonb,'A')
$$, 'NÃO-REGRESSÃO: has_page_access(gestor-crm) autoriza (ramo page-grant, 5 args)');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
