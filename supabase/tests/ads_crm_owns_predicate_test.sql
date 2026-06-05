-- supabase/tests/ads_crm_owns_predicate_test.sql
-- pgTAP — Slice 1 (#136) — Gestor de ads gera/atribui tarefa de CRM escopado à carteira.
-- PRD #135, ADR 0006.
--
-- Prova as INVARIANTES da migração que introduz o predicado único
-- public._ads_owns_client(_client_id uuid, _caller uuid) e o costura em:
--   - _torque_board_pode_escrever (usado por torque_board_gerar / torque_board_comecar)
--   - assign_crm_gestor
-- Testa via INTERFACE PÚBLICA (a RPC / o predicado), não implementação.
--
-- Invariante de segurança central: um gestor_ads SÓ gera/atribui tarefa de CRM
-- para clientes da SUA carteira (clients.assigned_ads_manager = auth.uid()).
-- Cliente de OUTRO ads = permission denied (42501). Zero vazamento de carteira.
--
-- QUIRK confirmado no remoto: clients.assigned_ads_manager é UUID (não text),
-- então a comparação é assigned_ads_manager = _caller (uuid=uuid), SEM ::text.
-- (O quirk ::text do CLAUDE.md vale para assigned_mktplace, que é text.)
--
-- HARDENING: _ads_owns_client STABLE + search_path travado a '';
--            assign_crm_gestor migrado para search_path '' (estava em 'public').
--
-- UUID prefix: 'a5000000'. Runner: scripts/sb-pgtap.sh supabase/tests/ads_crm_owns_predicate_test.sql
BEGIN;

SELECT plan(19);

-- Helper de impersonação (padrão torque_board_rpc_test.sql / membership_rpc_test.sql).
CREATE OR REPLACE FUNCTION _ao_set(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_user_id,'role','authenticated')::text, true);
END;$$;

-- =============================================================================
-- ESTRUTURA / HARDENING
-- =============================================================================
SELECT has_function('public','_ads_owns_client', ARRAY['uuid','uuid'],
  '_ads_owns_client(uuid,uuid) existe (predicado único de ownership de ads)');

SELECT is(
  (SELECT provolatile FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='_ads_owns_client'),
  's', '_ads_owns_client é STABLE (provolatile=s)');

SELECT ok(
  (SELECT EXISTS (
      SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='_ads_owns_client'),
  '_ads_owns_client trava search_path (hardening)');

-- assign_crm_gestor agora endurecido: search_path travado a '' (não 'public').
SELECT ok(
  (SELECT 'search_path=""' = ANY(p.proconfig)
     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='assign_crm_gestor'),
  'assign_crm_gestor: search_path travado a '''' (hardening SECURITY DEFINER)');

-- =============================================================================
-- SEED
--   ads_dono     : gestor_ads, carteira = client_alvo
--   ads_fora     : gestor_ads, carteira = OUTRO cliente
--   gcrm_dono    : gestor_crm alvo da atribuição (papel válido p/ assign)
--   ceo          : admin (não-regressão)
--   client_alvo  : assigned_ads_manager = ads_dono
--   client_outro : assigned_ads_manager = ads_fora
-- =============================================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT u,'00000000-0000-0000-0000-000000000000'::uuid,u::text||'@m.test',crypt('t',gen_salt('bf')),'authenticated','authenticated',now(),now(),''
FROM (VALUES
  ('a5000000-0000-0000-0000-0000000000a1'::uuid),  -- ceo/admin
  ('a5000000-0000-0000-0000-0000000000a2'::uuid),  -- ads_dono
  ('a5000000-0000-0000-0000-0000000000a3'::uuid),  -- ads_fora
  ('a5000000-0000-0000-0000-0000000000c1'::uuid)   -- gestor_crm alvo
) AS t(u)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id,name,email) VALUES
 ('a5000000-0000-0000-0000-0000000000a1'::uuid,'AO Ceo','aoa1@m.test'),
 ('a5000000-0000-0000-0000-0000000000a2'::uuid,'AO AdsDono','aoa2@m.test'),
 ('a5000000-0000-0000-0000-0000000000a3'::uuid,'AO AdsFora','aoa3@m.test'),
 ('a5000000-0000-0000-0000-0000000000c1'::uuid,'AO GestorCrm','aoc1@m.test')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id,role) VALUES
 ('a5000000-0000-0000-0000-0000000000a1'::uuid,'ceo'),
 ('a5000000-0000-0000-0000-0000000000a2'::uuid,'gestor_ads'),
 ('a5000000-0000-0000-0000-0000000000a3'::uuid,'gestor_ads'),
 ('a5000000-0000-0000-0000-0000000000c1'::uuid,'gestor_crm')
ON CONFLICT (user_id,role) DO NOTHING;

INSERT INTO public.clients (id,name,assigned_ads_manager) VALUES
 ('a5000000-0000-0000-0000-0000000c1100'::uuid,'AO Client Alvo',  'a5000000-0000-0000-0000-0000000000a2'::uuid),
 ('a5000000-0000-0000-0000-0000000c2200'::uuid,'AO Client Outro', 'a5000000-0000-0000-0000-0000000000a3'::uuid)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- PREDICADO PURO — _ads_owns_client reflete a carteira.
-- =============================================================================
SELECT ok(
  public._ads_owns_client(
    'a5000000-0000-0000-0000-0000000c1100'::uuid,
    'a5000000-0000-0000-0000-0000000000a2'::uuid),
  '_ads_owns_client: ads_dono possui client_alvo (TRUE)');

SELECT ok(
  NOT public._ads_owns_client(
    'a5000000-0000-0000-0000-0000000c1100'::uuid,
    'a5000000-0000-0000-0000-0000000000a3'::uuid),
  '_ads_owns_client: ads_fora NÃO possui client_alvo (FALSE)');

SELECT ok(
  NOT public._ads_owns_client(
    'a5000000-0000-0000-0000-00000000dead'::uuid,
    'a5000000-0000-0000-0000-0000000000a2'::uuid),
  '_ads_owns_client: cliente inexistente -> FALSE (não levanta)');

-- =============================================================================
-- GERAR / COMECAR — ads_dono na própria carteira (autorizado pelo ramo ads).
-- ads_dono NÃO é admin, NÃO tem page_access gestor-crm, NÃO é gestor_id do card.
-- Só passa pelo ramo _ads_owns_client. Prova que o ramo novo habilita o ads.
-- =============================================================================
SELECT _ao_set('a5000000-0000-0000-0000-0000000000a2'::uuid);
SET LOCAL ROLE authenticated;

CREATE TEMP TABLE _ao_card ON COMMIT DROP AS
  SELECT public.torque_board_gerar(
    'a5000000-0000-0000-0000-0000000c1100'::uuid,
    'a5000000-0000-0000-0000-0000000000c1',  -- gestor_id do card = gestor_crm (não o ads)
    'torque', '{}'::jsonb
  ) AS id;

-- O card foi criado/movido pelo ads_dono via RPC (escrita autorizada pelo ramo
-- ads). A LEITURA do board sob a role do ads ainda não é liberada no slice #136
-- (chega no #137, RLS SELECT). Então o estado é verificado com RESET ROLE (o
-- contexto do runner, sem RLS) — aqui prova-se a ESCRITA/autorização, não a
-- leitura. _ao_set_owner() reimpersona o ads_dono em seguida.
RESET ROLE;
SELECT is(
  (SELECT board_status FROM public.crm_configuracoes c
     WHERE c.id = (SELECT id FROM _ao_card)),
  'a_fazer', 'gerar: ads_dono cria card na carteira -> nasce em A FAZER');

SELECT _ao_set('a5000000-0000-0000-0000-0000000000a2'::uuid);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$
  SELECT public.torque_board_comecar((SELECT id FROM _ao_card))
$$, 'comecar: ads_dono promove o card da sua carteira (resolve client_id do card)');

RESET ROLE;
SELECT is(
  (SELECT board_status FROM public.crm_configuracoes c
     WHERE c.id = (SELECT id FROM _ao_card)),
  'tier', 'comecar: card da carteira do ads_dono virou tier');

SELECT _ao_set('a5000000-0000-0000-0000-0000000000a2'::uuid);
SET LOCAL ROLE authenticated;

-- assign_crm_gestor — ads_dono atribui gestor_crm ao cliente da SUA carteira.
SELECT lives_ok($$
  SELECT public.assign_crm_gestor(
    'a5000000-0000-0000-0000-0000000c1100'::uuid,
    'a5000000-0000-0000-0000-0000000000c1'::uuid)
$$, 'assign: ads_dono atribui gestor_crm ao cliente da sua carteira');

SELECT is(
  (SELECT assigned_crm::text FROM public.clients
     WHERE id='a5000000-0000-0000-0000-0000000c1100'::uuid),
  'a5000000-0000-0000-0000-0000000000c1',
  'assign: assigned_crm gravado para o cliente do ads_dono');

-- =============================================================================
-- SEGURANÇA — ads_fora tenta mexer no cliente do ads_dono (carteira alheia).
-- DEVE falhar com 42501 em TODOS os caminhos. Zero vazamento.
-- =============================================================================
RESET ROLE;
SELECT _ao_set('a5000000-0000-0000-0000-0000000000a3'::uuid);
SET LOCAL ROLE authenticated;

SELECT throws_ok($$
  SELECT public.torque_board_gerar(
    'a5000000-0000-0000-0000-0000000c1100'::uuid,
    'a5000000-0000-0000-0000-0000000000c1','automation','{}'::jsonb)
$$, '42501', NULL,
  'SEGURANÇA gerar: ads_fora no cliente alheio -> permission denied (42501)');

SELECT throws_ok($$
  SELECT public.torque_board_comecar((SELECT id FROM _ao_card))
$$, '42501', NULL,
  'SEGURANÇA comecar: ads_fora no card alheio -> permission denied (42501)');

SELECT throws_ok($$
  SELECT public.assign_crm_gestor(
    'a5000000-0000-0000-0000-0000000c1100'::uuid,
    'a5000000-0000-0000-0000-0000000000c1'::uuid)
$$, '42501', NULL,
  'SEGURANÇA assign: ads_fora no cliente alheio -> permission denied (42501)');

-- Sanidade: ads_fora NA SUA carteira (client_outro) consegue gerar — confirma
-- que o bloqueio é por OWNERSHIP, não por papel ads bloqueado em geral.
SELECT lives_ok($$
  SELECT public.torque_board_gerar(
    'a5000000-0000-0000-0000-0000000c2200'::uuid,
    'a5000000-0000-0000-0000-0000000000c1','torque','{}'::jsonb)
$$, 'SEGURANÇA: ads_fora gera na PRÓPRIA carteira (ownership, não papel)');

-- =============================================================================
-- NÃO-REGRESSÃO — ceo/admin e gestor_crm seguem funcionando.
-- =============================================================================
RESET ROLE;
SELECT _ao_set('a5000000-0000-0000-0000-0000000000a1'::uuid);  -- ceo
SET LOCAL ROLE authenticated;

SELECT lives_ok($$
  SELECT public.torque_board_gerar(
    'a5000000-0000-0000-0000-0000000c2200'::uuid,
    'a5000000-0000-0000-0000-0000000000c1','automation','{}'::jsonb)
$$, 'NÃO-REGRESSÃO: ceo gera card em qualquer cliente');

SELECT lives_ok($$
  SELECT public.assign_crm_gestor(
    'a5000000-0000-0000-0000-0000000c2200'::uuid,
    'a5000000-0000-0000-0000-0000000000c1'::uuid)
$$, 'NÃO-REGRESSÃO: ceo atribui gestor_crm em qualquer cliente');

RESET ROLE;
SELECT _ao_set('a5000000-0000-0000-0000-0000000000c1'::uuid);  -- gestor_crm
SET LOCAL ROLE authenticated;

-- gestor_crm autoriza via has_role(gestor_crm) em assign_crm_gestor (sem state
-- machine de transição — evita falso-negativo do guard a_fazer->tier).
SELECT lives_ok($$
  SELECT public.assign_crm_gestor(
    'a5000000-0000-0000-0000-0000000c2200'::uuid,
    'a5000000-0000-0000-0000-0000000000c1'::uuid)
$$, 'NÃO-REGRESSÃO: gestor_crm atribui (papel gestor_crm preservado em assign)');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
