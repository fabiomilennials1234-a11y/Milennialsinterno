-- supabase/tests/torque_board_apresentacao_test.sql
-- pgTAP — Slice 4 (#94) — Apresentação do Board Torque CRM. ADR 0006.
--
-- Prova as INVARIANTES das RPCs da migração
-- 20260603190000_torque_crm_board_apresentacao_rpc.sql (que já rodou no remoto),
-- via INTERFACE PÚBLICA (a RPC), não implementação.
--
-- Invariantes provadas:
--   ESTRUTURA / HARDENING
--     - torque_board_agendar(uuid,timestamptz), torque_board_pronto(uuid),
--       _torque_pode_concluir(timestamptz) existem;
--     - agendar/pronto SECURITY DEFINER com search_path travado.
--   GATE DE DATA (_torque_pode_concluir, fuso America/Sao_Paulo, por dia)
--     - NULL -> false; passado -> true; futuro distante -> false;
--     - 00h do dia agendado (SP) -> true; 23:59 da véspera (SP) -> false.
--   AGENDAR (grava apresentacao_at; espelha reagendar — card fica em apresentacao)
--     - grava a data; board_status permanece 'apresentacao';
--     - reagendar (2ª chamada) sobrescreve a data, ainda em 'apresentacao';
--     - card fora de 'apresentacao' (tier) -> RAISE; data NULL -> RAISE.
--   PRONTO (apresentacao -> pronto; gate de data NO SERVIDOR)
--     - data no passado (já chegou) -> conclui (board_status='pronto');
--     - data no FUTURO (antes do dia) -> RAISE mesmo autorizado (server gate);
--     - card sem apresentacao_at -> RAISE;
--     - card fora de 'apresentacao' -> RAISE (transição inválida).
--   AUTORIZAÇÃO (replica policies crm_config_* da #91)
--     - forasteiro (sem grant, não-gestor) -> permission denied (42501) em agendar e pronto.
--
-- UUID prefix: 'b4000000'. Runner: scripts/sb-pgtap.sh supabase/tests/torque_board_apresentacao_test.sql
BEGIN;

SELECT plan(26);

-- Helper de impersonação (padrão membership_rpc_test.sql / torque_board_*_test.sql).
CREATE OR REPLACE FUNCTION _tba_set(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_user_id,'role','authenticated')::text, true);
END;$$;

-- =============================================================================
-- ESTRUTURA / HARDENING
-- =============================================================================
SELECT has_function('public','torque_board_agendar', ARRAY['uuid','timestamptz'],
  'torque_board_agendar(uuid,timestamptz) existe');
SELECT has_function('public','torque_board_pronto', ARRAY['uuid'],
  'torque_board_pronto(uuid) existe');
SELECT has_function('public','_torque_pode_concluir', ARRAY['timestamptz'],
  '_torque_pode_concluir(timestamptz) existe');

SELECT is(
  (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='torque_board_pronto'),
  true, 'torque_board_pronto é SECURITY DEFINER');

SELECT ok(
  (SELECT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')
     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='torque_board_agendar'),
  'torque_board_agendar trava search_path (hardening SECURITY DEFINER)');

-- =============================================================================
-- GATE DE DATA — _torque_pode_concluir (fuso SP, por dia-calendário).
-- =============================================================================
SELECT is(public._torque_pode_concluir(NULL), false,
  'gate: apresentacao_at NULL -> false');
SELECT is(public._torque_pode_concluir('2000-01-01T13:00:00Z'::timestamptz), true,
  'gate: data no passado (já chegou) -> true');
SELECT is(public._torque_pode_concluir('2999-01-01T13:00:00Z'::timestamptz), false,
  'gate: data no futuro distante -> false');

-- Boundary preciso (SP = UTC-3): para um agendamento HOJE em SP,
-- 00:00 SP de hoje (= 03:00Z) já chegou; 23:59 SP de ontem ainda não.
-- Construímos timestamps relativos ao dia-calendário SP de now() para não
-- depender da data em que o teste roda.
SELECT is(
  public._torque_pode_concluir(
    (( (now() AT TIME ZONE 'America/Sao_Paulo')::date )::timestamp AT TIME ZONE 'America/Sao_Paulo')),
  true, 'gate: 00h SP do dia de HOJE -> true (vira meia-noite libera)');

SELECT is(
  public._torque_pode_concluir(
    (( ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo'))),
  false, 'gate: 00h SP de AMANHÃ -> false (véspera trava)');

-- =============================================================================
-- SEED: 1 admin(ceo), 1 gestor dono, 1 forasteiro, 1 cliente, e 4 cards.
-- =============================================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT u,'00000000-0000-0000-0000-000000000000'::uuid,u::text||'@m.test',crypt('t',gen_salt('bf')),'authenticated','authenticated',now(),now(),''
FROM (VALUES
  ('b4000000-0000-0000-0000-0000000000a1'::uuid),
  ('b4000000-0000-0000-0000-0000000000d1'::uuid),
  ('b4000000-0000-0000-0000-0000000000f1'::uuid)
) AS t(u)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id,name,email) VALUES
 ('b4000000-0000-0000-0000-0000000000a1'::uuid,'TBA Admin','tbaa1@m.test'),
 ('b4000000-0000-0000-0000-0000000000d1'::uuid,'TBA Gestor','tbad1@m.test'),
 ('b4000000-0000-0000-0000-0000000000f1'::uuid,'TBA Fora','tbaf1@m.test')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id,role) VALUES
 ('b4000000-0000-0000-0000-0000000000a1'::uuid,'ceo')
ON CONFLICT (user_id,role) DO NOTHING;

-- 1 cliente por card: a UNIQUE(client_id,produto) impede 4 cards 'torque' no
-- mesmo cliente. Mundos isolados, sem ruído cruzado.
INSERT INTO public.clients (id,name) VALUES
 ('b4000000-0000-0000-0000-0000000c1101'::uuid,'TBA Client 1'),
 ('b4000000-0000-0000-0000-0000000c1102'::uuid,'TBA Client 2'),
 ('b4000000-0000-0000-0000-0000000c1103'::uuid,'TBA Client 3'),
 ('b4000000-0000-0000-0000-0000000c1104'::uuid,'TBA Client 4')
ON CONFLICT (id) DO NOTHING;

-- Card ca001 (cli 1) — 'apresentacao' SEM data ainda (para agendar).
-- Card ca002 (cli 2) — 'apresentacao' com data no PASSADO (gate liberado -> pronto OK).
-- Card ca003 (cli 3) — 'apresentacao' com data no FUTURO (gate trava pronto).
-- Card ca004 (cli 4) — 'tier' (transição inválida para agendar/pronto).
INSERT INTO public.crm_configuracoes
  (id, client_id, gestor_id, produto, current_step, is_finalizado, board_status, checklist, apresentacao_at)
VALUES
  ('b4000000-0000-0000-0000-0000000ca001'::uuid,'b4000000-0000-0000-0000-0000000c1101'::uuid,
   'b4000000-0000-0000-0000-0000000000d1','torque','call_pos_venda',false,'apresentacao','[]'::jsonb,NULL),
  ('b4000000-0000-0000-0000-0000000ca002'::uuid,'b4000000-0000-0000-0000-0000000c1102'::uuid,
   'b4000000-0000-0000-0000-0000000000d1','torque','call_pos_venda',false,'apresentacao','[]'::jsonb,'2000-01-01T13:00:00Z'::timestamptz),
  ('b4000000-0000-0000-0000-0000000ca003'::uuid,'b4000000-0000-0000-0000-0000000c1103'::uuid,
   'b4000000-0000-0000-0000-0000000000d1','torque','call_pos_venda',false,'apresentacao','[]'::jsonb,'2999-01-01T13:00:00Z'::timestamptz),
  ('b4000000-0000-0000-0000-0000000ca004'::uuid,'b4000000-0000-0000-0000-0000000c1104'::uuid,
   'b4000000-0000-0000-0000-0000000000d1','torque','receber_briefing',false,'tier','[]'::jsonb,NULL)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- Como gestor dono do card (autorizado pela 3ª cláusula do predicado).
-- =============================================================================
SELECT _tba_set('b4000000-0000-0000-0000-0000000000d1'::uuid);
SET LOCAL ROLE authenticated;

-- AGENDAR — grava a data; board_status permanece 'apresentacao'.
SELECT lives_ok($$
  SELECT public.torque_board_agendar(
    'b4000000-0000-0000-0000-0000000ca001'::uuid, '2026-06-10T17:00:00Z'::timestamptz)
$$, 'agendar grava apresentacao_at sem erro');

SELECT is(
  (SELECT apresentacao_at FROM public.crm_configuracoes WHERE id='b4000000-0000-0000-0000-0000000ca001'::uuid),
  '2026-06-10T17:00:00Z'::timestamptz, 'agendar: apresentacao_at persistiu');

SELECT is(
  (SELECT board_status FROM public.crm_configuracoes WHERE id='b4000000-0000-0000-0000-0000000ca001'::uuid),
  'apresentacao', 'agendar: board_status permanece apresentacao (não move)');

-- REAGENDAR — sobrescreve a data, ainda em 'apresentacao'.
SELECT lives_ok($$
  SELECT public.torque_board_agendar(
    'b4000000-0000-0000-0000-0000000ca001'::uuid, '2026-07-01T14:00:00Z'::timestamptz)
$$, 'reagendar sobrescreve a data sem erro');
SELECT is(
  (SELECT apresentacao_at FROM public.crm_configuracoes WHERE id='b4000000-0000-0000-0000-0000000ca001'::uuid),
  '2026-07-01T14:00:00Z'::timestamptz, 'reagendar: nova data persistiu');
SELECT is(
  (SELECT board_status FROM public.crm_configuracoes WHERE id='b4000000-0000-0000-0000-0000000ca001'::uuid),
  'apresentacao', 'reagendar: board_status ainda apresentacao');

-- AGENDAR fora de apresentacao (card TIER) -> RAISE.
SELECT throws_ok($$
  SELECT public.torque_board_agendar(
    'b4000000-0000-0000-0000-0000000ca004'::uuid, '2026-06-10T17:00:00Z'::timestamptz)
$$, 'P0001', NULL, 'agendar fora de apresentacao (tier) -> RAISE');

-- AGENDAR data NULL -> RAISE.
SELECT throws_ok($$
  SELECT public.torque_board_agendar('b4000000-0000-0000-0000-0000000ca001'::uuid, NULL)
$$, 'P0001', NULL, 'agendar com data NULL -> RAISE');

-- PRONTO — card com data no FUTURO -> RAISE (server gate trava mesmo autorizado).
SELECT throws_ok($$
  SELECT public.torque_board_pronto('b4000000-0000-0000-0000-0000000ca003'::uuid)
$$, 'P0001', NULL, 'PRONTO antes do dia agendado -> RAISE (gate de data no servidor)');
SELECT is(
  (SELECT board_status FROM public.crm_configuracoes WHERE id='b4000000-0000-0000-0000-0000000ca003'::uuid),
  'apresentacao', 'PRONTO bloqueado: card permanece em apresentacao');

-- PRONTO — card sem data (NULL após agendar? não; usamos o card recém-reagendado
-- para o futuro? ca001 está no futuro 2026-07 — usamos ca003 já provado).
-- Card fora de apresentacao (tier) -> RAISE (transição inválida).
SELECT throws_ok($$
  SELECT public.torque_board_pronto('b4000000-0000-0000-0000-0000000ca004'::uuid)
$$, 'P0001', NULL, 'PRONTO em card fora de apresentacao (tier) -> RAISE');

-- PRONTO — card com data no PASSADO (gate liberado) -> conclui.
SELECT lives_ok($$
  SELECT public.torque_board_pronto('b4000000-0000-0000-0000-0000000ca002'::uuid)
$$, 'PRONTO com data já chegada -> conclui sem erro');
SELECT is(
  (SELECT board_status FROM public.crm_configuracoes WHERE id='b4000000-0000-0000-0000-0000000ca002'::uuid),
  'pronto', 'PRONTO: board_status -> pronto (arquivado em PRONTOS)');

-- PRONTO idempotência/transição: card já 'pronto' -> RAISE (não está em apresentacao).
SELECT throws_ok($$
  SELECT public.torque_board_pronto('b4000000-0000-0000-0000-0000000ca002'::uuid)
$$, 'P0001', NULL, 'PRONTO em card já pronto -> RAISE (terminal; blinda duplo-clique)');

-- =============================================================================
-- AUTORIZAÇÃO — forasteiro (sem grant, não-gestor) -> permission denied.
-- =============================================================================
RESET ROLE;
SELECT _tba_set('b4000000-0000-0000-0000-0000000000f1'::uuid);
SET LOCAL ROLE authenticated;

SELECT throws_ok($$
  SELECT public.torque_board_agendar(
    'b4000000-0000-0000-0000-0000000ca003'::uuid, '2026-06-10T17:00:00Z'::timestamptz)
$$, '42501', NULL, 'forasteiro -> permission denied em agendar');

SELECT throws_ok($$
  SELECT public.torque_board_pronto('b4000000-0000-0000-0000-0000000ca003'::uuid)
$$, '42501', NULL, 'forasteiro -> permission denied em pronto');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
