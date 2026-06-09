-- supabase/tests/funil_ab_clients_rpc_test.sql
-- pgTAP — ADR 0010 — Funil A/B. Prova as INVARIANTES da coluna clients.funil e da
-- escrita atômica via RPC torque_board_gerar(p_funil).
--
-- INVARIANTES PROVADAS (via interface, sem expor implementação):
--   1. CHECK: clients.funil só aceita NULL | 'A' | 'B' (DB barra valor inválido).
--   2. ESCRITA ATÔMICA: torque_board_gerar(p_funil:='A') grava clients.funil='A'
--      E cria o card na MESMA chamada (uma transação).
--   3. DEFESA EM PROFUNDIDADE: RPC rejeita p_funil fora de A|B (não delega só ao CHECK).
--   4. NULL não apaga: gerar de novo com p_funil:=NULL preserva o funil já gravado.
--   5. AUTORIZAÇÃO (segurança): quem NÃO pode escrever (sem gestor-crm, não admin,
--      não é o gestor do card) é BARRADO (42501) — funil NÃO é escrito.
--   6. LEITURA escopada: clients.funil herda a RLS de SELECT de clients
--      (pode_ver_cliente) — quem vê o cliente vê o funil; quem não vê, nem a linha.
--
-- UUID prefix: 'f0100000'. Runner: scripts/sb-pgtap.sh supabase/tests/funil_ab_clients_rpc_test.sql
BEGIN;

SELECT plan(11);

CREATE OR REPLACE FUNCTION _fab_set(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_user_id,'role','authenticated')::text, true);
END;$$;

-- =============================================================================
-- SEED
--   ads_writer : age como o ADS que gera a tarefa — tem page grant 'gestor-crm'
--                (= autorização de escrita do funil, ADR §6).
--   gcrm       : gestor_crm (gestor_id dos cards).
--   intruso    : SEM grant, NÃO admin, NÃO é gestor do card — não pode escrever.
--   ads_dono   : carteira = client_alvo.
--   nobody     : authenticated SEM papel/grant/envolvimento — pode_ver_cliente=FALSE.
--                (gestor_ads vê QUALQUER cliente via page-data 'gestor-ads' — não
--                 serve pra provar escopo de leitura; por isso usamos nobody.)
-- =============================================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT u,'00000000-0000-0000-0000-000000000000'::uuid,u::text||'@m.test',crypt('t',gen_salt('bf')),'authenticated','authenticated',now(),now(),''
FROM (VALUES
  ('f0100000-0000-0000-0000-0000000000a1'::uuid),  -- ads_writer
  ('f0100000-0000-0000-0000-0000000000c1'::uuid),  -- gestor_crm
  ('f0100000-0000-0000-0000-0000000000e1'::uuid),  -- intruso
  ('f0100000-0000-0000-0000-0000000000a2'::uuid),  -- ads_dono
  ('f0100000-0000-0000-0000-0000000000b0'::uuid)   -- nobody (sem papel/grant)
) AS t(u)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id,name,email) VALUES
 ('f0100000-0000-0000-0000-0000000000a1'::uuid,'FAB AdsWriter','faba1@m.test'),
 ('f0100000-0000-0000-0000-0000000000c1'::uuid,'FAB GestorCrm','fabc1@m.test'),
 ('f0100000-0000-0000-0000-0000000000e1'::uuid,'FAB Intruso','fabe1@m.test'),
 ('f0100000-0000-0000-0000-0000000000a2'::uuid,'FAB AdsDono','faba2@m.test'),
 ('f0100000-0000-0000-0000-0000000000b0'::uuid,'FAB Nobody','fabb0@m.test')
ON CONFLICT (user_id) DO NOTHING;

-- nobody NÃO recebe papel nenhum (pode_ver_cliente fail-closed). intruso é
-- gestor_ads (vê clientes, mas não pode ESCREVER funil — sem grant gestor-crm).
INSERT INTO public.user_roles (user_id,role) VALUES
 ('f0100000-0000-0000-0000-0000000000a1'::uuid,'gestor_ads'),
 ('f0100000-0000-0000-0000-0000000000c1'::uuid,'gestor_crm'),
 ('f0100000-0000-0000-0000-0000000000e1'::uuid,'gestor_ads'),
 ('f0100000-0000-0000-0000-0000000000a2'::uuid,'gestor_ads')
ON CONFLICT (user_id,role) DO NOTHING;

-- ads_writer recebe o grant de página gestor-crm = pode gerar a tarefa do CRM (e o funil).
INSERT INTO public.user_page_grants (user_id, page_slug, source, granted_by)
VALUES ('f0100000-0000-0000-0000-0000000000a1'::uuid, 'gestor-crm', 'direct',
        'f0100000-0000-0000-0000-0000000000c1'::uuid)
ON CONFLICT DO NOTHING;

INSERT INTO public.clients (id,name,assigned_ads_manager) VALUES
 ('f0100000-0000-0000-0000-0000000c1100'::uuid,'FAB Alvo',  'f0100000-0000-0000-0000-0000000000a2'::uuid),
 ('f0100000-0000-0000-0000-0000000c2200'::uuid,'FAB Outro', 'f0100000-0000-0000-0000-0000000000a3'::uuid)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 1. CHECK clients_funil_check — DB barra valor fora de A|B.
-- =============================================================================
SELECT throws_ok($$
  UPDATE public.clients SET funil='Z' WHERE id='f0100000-0000-0000-0000-0000000c1100'::uuid
$$, '23514', NULL, 'CHECK: clients.funil rejeita valor fora de A|B (constraint 23514)');

SELECT lives_ok($$
  UPDATE public.clients SET funil=NULL WHERE id='f0100000-0000-0000-0000-0000000c1100'::uuid
$$, 'CHECK: clients.funil aceita NULL (nullable até a geração)');

-- =============================================================================
-- 2 + 3 + 4. ESCRITA ATÔMICA via RPC, sob a role do ads_writer (autorizado).
-- =============================================================================
SELECT _fab_set('f0100000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;

-- 3. Defesa em profundidade: RPC rejeita funil inválido (antes de tocar o DB).
SELECT throws_ok($$
  SELECT public.torque_board_gerar(
    'f0100000-0000-0000-0000-0000000c1100'::uuid,
    'f0100000-0000-0000-0000-0000000000c1', 'torque', '{}'::jsonb, 'X')
$$, 'P0001', NULL, 'RPC rejeita p_funil inválido (defesa em profundidade, não só CHECK)');

-- 2. Geração com funil='A' → grava clients.funil E cria o card, atômico.
SELECT lives_ok($$
  SELECT public.torque_board_gerar(
    'f0100000-0000-0000-0000-0000000c1100'::uuid,
    'f0100000-0000-0000-0000-0000000000c1', 'torque', '{}'::jsonb, 'A')
$$, 'RPC: ads autorizado gera card com funil A (escrita atômica não levanta)');

RESET ROLE;  -- ler o resultado sem RLS (runner) pra provar o efeito da escrita
SELECT is(
  (SELECT funil FROM public.clients WHERE id='f0100000-0000-0000-0000-0000000c1100'::uuid),
  'A', 'ESCRITA ATÔMICA: clients.funil = A após a geração');

SELECT is(
  (SELECT count(*)::int FROM public.crm_configuracoes
     WHERE client_id='f0100000-0000-0000-0000-0000000c1100'::uuid AND produto='torque'),
  1, 'ESCRITA ATÔMICA: o card foi criado na MESMA chamada que gravou o funil');

-- 4. Re-gerar com p_funil NULL não apaga o funil já gravado.
SELECT _fab_set('f0100000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$
  SELECT public.torque_board_gerar(
    'f0100000-0000-0000-0000-0000000c1100'::uuid,
    'f0100000-0000-0000-0000-0000000000c1', 'torque', '{}'::jsonb, NULL)
$$, 'RPC: re-gerar com p_funil NULL é idempotente (não levanta)');

RESET ROLE;
SELECT is(
  (SELECT funil FROM public.clients WHERE id='f0100000-0000-0000-0000-0000000c1100'::uuid),
  'A', 'NULL não apaga: clients.funil permanece A após re-geração sem funil');

-- =============================================================================
-- 5. AUTORIZAÇÃO — intruso (sem grant, não admin, não é o gestor) é BARRADO.
--    funil do client_outro permanece NULL (escrita não vazou).
-- =============================================================================
SELECT _fab_set('f0100000-0000-0000-0000-0000000000e1'::uuid);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$
  SELECT public.torque_board_gerar(
    'f0100000-0000-0000-0000-0000000c2200'::uuid,
    'f0100000-0000-0000-0000-0000000000c1', 'torque', '{}'::jsonb, 'B')
$$, '42501', NULL, 'SEGURANÇA: intruso (sem gestor-crm) é barrado ao gravar funil (42501)');

RESET ROLE;
SELECT is(
  (SELECT funil FROM public.clients WHERE id='f0100000-0000-0000-0000-0000000c2200'::uuid),
  NULL, 'SEGURANÇA: funil do cliente NÃO foi escrito pelo intruso (permanece NULL)');

-- =============================================================================
-- 6. LEITURA escopada — funil herda a RLS de SELECT de clients (pode_ver_cliente).
--    nobody (sem papel/grant/envolvimento) NÃO vê o cliente — logo nem o funil.
--    (Prova que a coluna funil não tem caminho de leitura próprio; herda a policy.)
-- =============================================================================
SELECT _fab_set('f0100000-0000-0000-0000-0000000000b0'::uuid);  -- nobody
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM public.clients WHERE id='f0100000-0000-0000-0000-0000000c1100'::uuid),
  0, 'LEITURA: usuário sem acesso NÃO enxerga o cliente (funil invisível junto da linha)');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
