-- supabase/tests/torque_acompanhamentos_test.sql
-- pgTAP — Slice 5 (#95) — Board de Acompanhamentos (pós-implantação). ADR 0006 §2.
--
-- Prova as INVARIANTES da migração 20260603200000_torque_crm_acompanhamentos.sql
-- (que já rodou no remoto), via INTERFACE PÚBLICA (RPC + gancho), não implementação.
--
-- Invariantes provadas:
--   ESTRUTURA / HARDENING
--     - tabela crm_acompanhamentos existe com RLS ligada;
--     - torque_acomp_mover(uuid,text) existe, SECURITY DEFINER, search_path travado;
--     - índice único parcial (um ativo por cliente) existe.
--   GANCHO (torque_board_pronto cria o acompanhamento ao cair em PRONTOS)
--     - marcar pronto cria EXATAMENTE 1 acompanhamento ativo em 'fazer_follow_up';
--     - o card de implantação PERMANECE em 'pronto' (não some — ADR §2.5);
--     - IDEMPOTÊNCIA: já havendo acompanhamento ativo, um 2º pronto NÃO duplica.
--   MOVER (drag livre)
--     - move para coluna válida (qualquer ordem, sem gate);
--     - coluna inválida -> RAISE (P0001);
--     - acompanhamento inexistente -> RAISE (P0001).
--   AUTORIZAÇÃO (replica policies crm_config_* da #91)
--     - forasteiro -> permission denied (42501) em mover.
--
-- UUID prefix: 'a5000000'. Runner: scripts/sb-pgtap.sh supabase/tests/torque_acompanhamentos_test.sql
BEGIN;

SELECT plan(17);

-- Helper de impersonação (padrão torque_board_*_test.sql).
CREATE OR REPLACE FUNCTION _ta_set(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_user_id,'role','authenticated')::text, true);
END;$$;

-- =============================================================================
-- ESTRUTURA / HARDENING
-- =============================================================================
SELECT has_table('public','crm_acompanhamentos','crm_acompanhamentos existe');
SELECT has_function('public','torque_acomp_mover', ARRAY['uuid','text'],
  'torque_acomp_mover(uuid,text) existe');

SELECT is(
  (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='torque_acomp_mover'),
  true, 'torque_acomp_mover é SECURITY DEFINER');

SELECT ok(
  (SELECT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')
     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='torque_acomp_mover'),
  'torque_acomp_mover trava search_path');

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.crm_acompanhamentos'::regclass),
  'crm_acompanhamentos tem RLS habilitada');

SELECT ok(
  EXISTS (SELECT 1 FROM pg_indexes
          WHERE tablename='crm_acompanhamentos'
            AND indexname='crm_acompanhamentos_um_ativo_por_cliente'),
  'índice único parcial (um ativo por cliente) existe');

-- =============================================================================
-- SEED: 1 admin(ceo), 1 gestor dono, 1 forasteiro, 1 cliente, 1 card pronto-ready.
-- =============================================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT u,'00000000-0000-0000-0000-000000000000'::uuid,u::text||'@m.test',crypt('t',gen_salt('bf')),'authenticated','authenticated',now(),now(),''
FROM (VALUES
  ('a5000000-0000-0000-0000-0000000000a1'::uuid),
  ('a5000000-0000-0000-0000-0000000000d1'::uuid),
  ('a5000000-0000-0000-0000-0000000000f1'::uuid)
) AS t(u)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id,name,email) VALUES
 ('a5000000-0000-0000-0000-0000000000a1'::uuid,'TA Admin','taa1@m.test'),
 ('a5000000-0000-0000-0000-0000000000d1'::uuid,'TA Gestor','tad1@m.test'),
 ('a5000000-0000-0000-0000-0000000000f1'::uuid,'TA Fora','taf1@m.test')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id,role) VALUES
 ('a5000000-0000-0000-0000-0000000000a1'::uuid,'ceo')
ON CONFLICT (user_id,role) DO NOTHING;

INSERT INTO public.clients (id,name) VALUES
 ('a5000000-0000-0000-0000-0000000c1101'::uuid,'TA Client 1')
ON CONFLICT (id) DO NOTHING;

-- Card de implantação em 'apresentacao' com data no PASSADO (gate liberado).
INSERT INTO public.crm_configuracoes
  (id, client_id, gestor_id, produto, current_step, is_finalizado, board_status, checklist, apresentacao_at)
VALUES
  ('a5000000-0000-0000-0000-0000000ca001'::uuid,'a5000000-0000-0000-0000-0000000c1101'::uuid,
   'a5000000-0000-0000-0000-0000000000d1','torque','call_pos_venda',false,'apresentacao','[]'::jsonb,
   '2000-01-01T13:00:00Z'::timestamptz)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- GANCHO — marcar pronto cria o acompanhamento. Impersona o gestor dono.
-- =============================================================================
SELECT _ta_set('a5000000-0000-0000-0000-0000000000d1'::uuid);
SET LOCAL ROLE authenticated;

SELECT lives_ok($$
  SELECT public.torque_board_pronto('a5000000-0000-0000-0000-0000000ca001'::uuid)
$$, 'gestor marca card PRONTO (gate de data liberado)');

RESET ROLE;

SELECT is(
  (SELECT board_status FROM public.crm_configuracoes
     WHERE id='a5000000-0000-0000-0000-0000000ca001'::uuid),
  'pronto', 'card de implantação permanece em PRONTOS (não some — ADR §2.5)');

SELECT is(
  (SELECT count(*)::int FROM public.crm_acompanhamentos
     WHERE client_id='a5000000-0000-0000-0000-0000000c1101'::uuid AND closed_at IS NULL),
  1, 'gancho criou EXATAMENTE 1 acompanhamento ativo');

SELECT is(
  (SELECT coluna FROM public.crm_acompanhamentos
     WHERE client_id='a5000000-0000-0000-0000-0000000c1101'::uuid AND closed_at IS NULL),
  'fazer_follow_up', 'acompanhamento nasce em fazer_follow_up');

-- IDEMPOTÊNCIA: re-marcar pronto (o card já está pronto -> a RPC barra no guard
-- de estado ANTES do gancho; mas mesmo se o gancho rodasse, o índice impede o 2º).
-- Provamos diretamente que um 2º INSERT do gancho não duplica, via re-execução do
-- mesmo INSERT idempotente que o gancho roda.
SELECT lives_ok($$
  INSERT INTO public.crm_acompanhamentos (client_id, gestor_id, coluna)
  VALUES ('a5000000-0000-0000-0000-0000000c1101'::uuid,
          'a5000000-0000-0000-0000-0000000000d1','fazer_follow_up')
  ON CONFLICT (client_id) WHERE (closed_at IS NULL) DO NOTHING
$$, 'gancho idempotente: 2º insert do acompanhamento ativo é no-op');

SELECT is(
  (SELECT count(*)::int FROM public.crm_acompanhamentos
     WHERE client_id='a5000000-0000-0000-0000-0000000c1101'::uuid AND closed_at IS NULL),
  1, 'continua 1 ativo — idempotência preservada (sem card fantasma)');

-- =============================================================================
-- MOVER (drag livre) — impersona o gestor dono.
-- =============================================================================
SELECT _ta_set('a5000000-0000-0000-0000-0000000000d1'::uuid);
SET LOCAL ROLE authenticated;

SELECT lives_ok($$
  SELECT public.torque_acomp_mover(
    (SELECT id FROM public.crm_acompanhamentos
       WHERE client_id='a5000000-0000-0000-0000-0000000c1101'::uuid AND closed_at IS NULL),
    'aguardando_resposta')
$$, 'mover para coluna válida (drag livre, sem gate)');

SELECT is(
  (SELECT coluna FROM public.crm_acompanhamentos
     WHERE client_id='a5000000-0000-0000-0000-0000000c1101'::uuid AND closed_at IS NULL),
  'aguardando_resposta', 'coluna persistida após o mover');

SELECT throws_ok($$
  SELECT public.torque_acomp_mover(
    (SELECT id FROM public.crm_acompanhamentos
       WHERE client_id='a5000000-0000-0000-0000-0000000c1101'::uuid AND closed_at IS NULL),
    'pronto')
$$, 'P0001', NULL, 'coluna inválida (pronto é do board de implantação) -> RAISE');

SELECT throws_ok($$
  SELECT public.torque_acomp_mover('a5000000-0000-0000-0000-000000099999'::uuid, 'fazer_follow_up')
$$, 'P0001', NULL, 'acompanhamento inexistente -> RAISE (referência órfã barrada)');

RESET ROLE;

-- =============================================================================
-- AUTORIZAÇÃO — forasteiro -> permission denied (42501).
-- Captura o id do acompanhamento ANTES de virar forasteiro (a RLS do forasteiro
-- esconde a linha; passamos o id literal para que a RPC chegue no check de auth,
-- não no guard de "não existe").
-- =============================================================================
SELECT set_config('ta.acomp_id',
  (SELECT id::text FROM public.crm_acompanhamentos
     WHERE client_id='a5000000-0000-0000-0000-0000000c1101'::uuid AND closed_at IS NULL),
  false);

SELECT _ta_set('a5000000-0000-0000-0000-0000000000f1'::uuid);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  format($$SELECT public.torque_acomp_mover(%L::uuid, 'fazer_follow_up')$$,
         current_setting('ta.acomp_id')),
  '42501', NULL, 'forasteiro -> permission denied em mover');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
