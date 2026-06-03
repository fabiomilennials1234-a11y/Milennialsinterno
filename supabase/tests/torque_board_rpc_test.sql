-- supabase/tests/torque_board_rpc_test.sql
-- pgTAP — Slice 2 (#92) — Interações do Board Torque CRM. ADR 0006.
--
-- Prova as INVARIANTES das RPCs da migração 20260603170000_torque_crm_board_rpc.sql
-- (que já rodou no remoto), via INTERFACE PÚBLICA (a RPC), não implementação.
--
-- Invariantes provadas:
--   ESTRUTURA / HARDENING
--     - torque_board_gerar(uuid,text,text,jsonb) e torque_board_comecar(uuid) existem;
--     - ambas SECURITY DEFINER com search_path travado a '';
--   GERAR (card nasce em A FAZER)
--     - card novo nasce com board_status='a_fazer' (ADR 0006), step inicial do tier;
--     - idempotente por UNIQUE(client_id,produto): 2ª chamada devolve o MESMO id,
--       sem reverter um card que já saiu de A FAZER (não-perda de progresso);
--     - produto inválido -> RAISE; cliente inexistente -> RAISE (anti-órfão).
--   COMECAR (a_fazer -> tier; espelha boardImplantacao.comecar)
--     - promove a_fazer -> tier;
--     - card que NÃO está em a_fazer -> RAISE (transição inválida; guard duplo-clique);
--     - card inexistente -> RAISE (anti-órfão).
--   AUTORIZAÇÃO (replica policies crm_config_* da #91)
--     - usuário sem grant e que não é o gestor do card -> permission denied (42501).
--
-- UUID prefix: 'b2000000'. Runner: scripts/sb-pgtap.sh supabase/tests/torque_board_rpc_test.sql
BEGIN;

SELECT plan(16);

-- Helper de impersonação (padrão membership_rpc_test.sql).
CREATE OR REPLACE FUNCTION _tb_set(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_user_id,'role','authenticated')::text, true);
END;$$;

-- =============================================================================
-- ESTRUTURA / HARDENING
-- =============================================================================
SELECT has_function('public','torque_board_gerar', ARRAY['uuid','text','text','jsonb'],
  'torque_board_gerar(uuid,text,text,jsonb) existe');
SELECT has_function('public','torque_board_comecar', ARRAY['uuid'],
  'torque_board_comecar(uuid) existe');

SELECT is(
  (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='torque_board_comecar'),
  true, 'torque_board_comecar é SECURITY DEFINER');

SELECT ok(
  (SELECT EXISTS (
      SELECT 1 FROM unnest(p.proconfig) c
       WHERE c LIKE 'search_path=%')
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='torque_board_gerar'),
  'torque_board_gerar trava search_path (hardening SECURITY DEFINER)');

-- =============================================================================
-- SEED: 1 admin (ceo), 1 gestor_crm dono de card, 1 forasteiro, 1 cliente.
-- =============================================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT u,'00000000-0000-0000-0000-000000000000'::uuid,u::text||'@m.test',crypt('t',gen_salt('bf')),'authenticated','authenticated',now(),now(),''
FROM (VALUES
  ('b2000000-0000-0000-0000-0000000000a1'::uuid),  -- admin/ceo
  ('b2000000-0000-0000-0000-0000000000d1'::uuid),  -- gestor dono do card
  ('b2000000-0000-0000-0000-0000000000f1'::uuid)   -- forasteiro
) AS t(u)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id,name,email) VALUES
 ('b2000000-0000-0000-0000-0000000000a1'::uuid,'TB Admin','tba1@m.test'),
 ('b2000000-0000-0000-0000-0000000000d1'::uuid,'TB Gestor','tbd1@m.test'),
 ('b2000000-0000-0000-0000-0000000000f1'::uuid,'TB Fora','tbf1@m.test')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id,role) VALUES
 ('b2000000-0000-0000-0000-0000000000a1'::uuid,'ceo')
ON CONFLICT (user_id,role) DO NOTHING;

INSERT INTO public.clients (id,name) VALUES
 ('b2000000-0000-0000-0000-0000000c1100'::uuid,'TB Client')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- GERAR — card nasce em A FAZER. Como admin (autorizado).
-- =============================================================================
SELECT _tb_set('b2000000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;

-- Cria o card e guarda o id num temp.
CREATE TEMP TABLE _tb_card ON COMMIT DROP AS
  SELECT public.torque_board_gerar(
    'b2000000-0000-0000-0000-0000000c1100'::uuid,
    'b2000000-0000-0000-0000-0000000000d1',  -- gestor_id (dono)
    'torque', '{}'::jsonb
  ) AS id;

SELECT is(
  (SELECT board_status FROM public.crm_configuracoes c
     WHERE c.id = (SELECT id FROM _tb_card)),
  'a_fazer', 'gerar: card NOVO nasce em A FAZER (board_status=a_fazer)');

SELECT is(
  (SELECT current_step FROM public.crm_configuracoes c
     WHERE c.id = (SELECT id FROM _tb_card)),
  'receber_briefing', 'gerar: card nasce no primeiro step do tier torque');

-- Idempotência: 2ª chamada devolve o MESMO id.
SELECT is(
  public.torque_board_gerar(
    'b2000000-0000-0000-0000-0000000c1100'::uuid,
    'b2000000-0000-0000-0000-0000000000d1','torque','{}'::jsonb),
  (SELECT id FROM _tb_card),
  'gerar: idempotente por UNIQUE(client_id,produto) — devolve o mesmo id');

-- Produto inválido -> RAISE.
SELECT throws_ok($$
  SELECT public.torque_board_gerar(
    'b2000000-0000-0000-0000-0000000c1100'::uuid,
    'b2000000-0000-0000-0000-0000000000d1','v8','{}'::jsonb)
$$, 'P0001', NULL, 'gerar: produto inválido (v8) -> RAISE');

-- Cliente inexistente -> RAISE (anti-órfão).
SELECT throws_ok($$
  SELECT public.torque_board_gerar(
    'b2000000-0000-0000-0000-00000000dead'::uuid,
    'b2000000-0000-0000-0000-0000000000d1','torque','{}'::jsonb)
$$, 'P0001', NULL, 'gerar: cliente inexistente -> RAISE (anti-órfão)');

-- =============================================================================
-- COMECAR — a_fazer -> tier.
-- =============================================================================
SELECT lives_ok($$
  SELECT public.torque_board_comecar((SELECT id FROM _tb_card))
$$, 'comecar: promove a_fazer -> tier sem erro');

SELECT is(
  (SELECT board_status FROM public.crm_configuracoes c
     WHERE c.id = (SELECT id FROM _tb_card)),
  'tier', 'comecar: board_status virou tier');

-- Segunda chamada (já em tier) -> RAISE (transição inválida; guard duplo-clique).
SELECT throws_ok($$
  SELECT public.torque_board_comecar((SELECT id FROM _tb_card))
$$, 'P0001', NULL, 'comecar: card fora de a_fazer -> RAISE (transição inválida)');

-- Idempotência de gerar NÃO reverte o card que já saiu de A FAZER.
SELECT is(
  (SELECT board_status FROM public.crm_configuracoes c WHERE c.id = (
     SELECT public.torque_board_gerar(
       'b2000000-0000-0000-0000-0000000c1100'::uuid,
       'b2000000-0000-0000-0000-0000000000d1','torque','{}'::jsonb))),
  'tier', 'gerar idempotente NÃO reverte board_status de card já iniciado');

-- Card inexistente -> RAISE (anti-órfão).
SELECT throws_ok($$
  SELECT public.torque_board_comecar('b2000000-0000-0000-0000-00000000dead'::uuid)
$$, 'P0001', NULL, 'comecar: card inexistente -> RAISE (anti-órfão)');

-- =============================================================================
-- AUTORIZAÇÃO — forasteiro (sem grant, não é o gestor) -> permission denied.
-- Cria um card "alvo" como admin, depois tenta mexer como forasteiro.
-- =============================================================================
RESET ROLE;
SELECT _tb_set('b2000000-0000-0000-0000-0000000000f1'::uuid);
SET LOCAL ROLE authenticated;

SELECT throws_ok($$
  SELECT public.torque_board_comecar((SELECT id FROM _tb_card))
$$, '42501', NULL, 'comecar: forasteiro (sem grant, não-gestor) -> permission denied');

SELECT throws_ok($$
  SELECT public.torque_board_gerar(
    'b2000000-0000-0000-0000-0000000c1100'::uuid,
    'b2000000-0000-0000-0000-0000000000d1','automation','{}'::jsonb)
$$, '42501', NULL, 'gerar: forasteiro -> permission denied (autoriza p/ gestor alheio)');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
