-- supabase/tests/torque_acomp_checklist_reset_test.sql
-- pgTAP — Slice 6 (#96) — "Tasks em aberto" editável + auto-move + reset semanal.
-- ADR 0006 §2 + HITL #4.
--
-- Prova as INVARIANTES da migração 20260603210000 (que já rodou no remoto), via
-- INTERFACE PÚBLICA (RPC + função de cron), não implementação.
--
-- Invariantes provadas:
--   ESTRUTURA / HARDENING
--     - torque_acomp_checklist_set(uuid,jsonb) existe, SECURITY DEFINER, search_path travado;
--     - _cron_torque_acomp_reset_segunda() existe, SECURITY DEFINER, search_path travado;
--     - job pg_cron 'torque-acomp-reset-segunda' agendado ('0 3 * * 1') e ativo.
--   CHECKLIST + AUTO-MOVE (na escrita, atômico)
--     - card em tasks_em_aberto com checklist NÃO-completo: persiste, NÃO move;
--     - card em tasks_em_aberto com checklist VAZIO: NÃO move (vazio nunca completa);
--     - card em tasks_em_aberto com TODAS marcadas: auto-move -> fazer_follow_up;
--     - card NÃO em tasks_em_aberto (ex: aguardando_resposta) 100% completo: NÃO move
--       (auto-move é one-way e só dessa coluna);
--     - shape inválido -> RAISE (P0001).
--   RESET SEMANAL (idempotente, colunas certas)
--     - move follow_up_feito -> fazer_follow_up;
--     - move aguardando_resposta -> fazer_follow_up;
--     - PRESERVA tasks_em_aberto (intacto);
--     - 2º run no mesmo estado é no-op (idempotência: 0 linhas).
--   AUTORIZAÇÃO
--     - forasteiro -> permission denied (42501) em checklist_set.
--
-- UUID prefix: 'a6000000'. Runner: scripts/sb-pgtap.sh supabase/tests/torque_acomp_checklist_reset_test.sql
BEGIN;

SELECT plan(19);

-- Helper de impersonação (padrão torque_*_test.sql).
CREATE OR REPLACE FUNCTION _tk_set(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_user_id,'role','authenticated')::text, true);
END;$$;

-- =============================================================================
-- ESTRUTURA / HARDENING
-- =============================================================================
SELECT has_function('public','torque_acomp_checklist_set', ARRAY['uuid','jsonb'],
  'torque_acomp_checklist_set(uuid,jsonb) existe');
SELECT has_function('public','_cron_torque_acomp_reset_segunda', ARRAY[]::text[],
  '_cron_torque_acomp_reset_segunda() existe');

SELECT is(
  (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='torque_acomp_checklist_set'),
  true, 'torque_acomp_checklist_set é SECURITY DEFINER');

SELECT ok(
  (SELECT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')
     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='torque_acomp_checklist_set'),
  'torque_acomp_checklist_set trava search_path');

SELECT ok(
  (SELECT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')
     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='_cron_torque_acomp_reset_segunda'),
  '_cron_torque_acomp_reset_segunda trava search_path');

SELECT ok(
  EXISTS (SELECT 1 FROM cron.job
          WHERE jobname='torque-acomp-reset-segunda'
            AND schedule='0 3 * * 1' AND active),
  'job pg_cron torque-acomp-reset-segunda agendado (seg 03:00 UTC = seg 00h SP) e ativo');

-- =============================================================================
-- SEED: 1 ceo, 1 gestor dono, 1 forasteiro, 1 cliente, e acompanhamentos diretos.
-- =============================================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT u,'00000000-0000-0000-0000-000000000000'::uuid,u::text||'@m.test',crypt('t',gen_salt('bf')),'authenticated','authenticated',now(),now(),''
FROM (VALUES
  ('a6000000-0000-0000-0000-0000000000a1'::uuid),
  ('a6000000-0000-0000-0000-0000000000d1'::uuid),
  ('a6000000-0000-0000-0000-0000000000f1'::uuid)
) AS t(u)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id,name,email) VALUES
 ('a6000000-0000-0000-0000-0000000000a1'::uuid,'TK Admin','tka1@m.test'),
 ('a6000000-0000-0000-0000-0000000000d1'::uuid,'TK Gestor','tkd1@m.test'),
 ('a6000000-0000-0000-0000-0000000000f1'::uuid,'TK Fora','tkf1@m.test')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id,role) VALUES
 ('a6000000-0000-0000-0000-0000000000a1'::uuid,'ceo')
ON CONFLICT (user_id,role) DO NOTHING;

-- Um cliente por acompanhamento: o índice único parcial permite só 1 ativo por
-- cliente (closed_at IS NULL). Cada card de teste = seu próprio cliente.
INSERT INTO public.clients (id,name) VALUES
 ('a6000000-0000-0000-0000-0000000c1101'::uuid,'TK Client 1'),
 ('a6000000-0000-0000-0000-0000000c1102'::uuid,'TK Client 2'),
 ('a6000000-0000-0000-0000-0000000c1103'::uuid,'TK Client 3'),
 ('a6000000-0000-0000-0000-0000000c1104'::uuid,'TK Client 4')
ON CONFLICT (id) DO NOTHING;

-- Acompanhamentos do gestor dono (inseridos direto; a criação real vem do gancho #95):
--   ac01 : tasks_em_aberto     (alvo do checklist editável + auto-move)
--   ac02 : follow_up_feito     (alvo do reset)
--   ac03 : aguardando_resposta (alvo do reset + "não-move fora de tasks")
INSERT INTO public.crm_acompanhamentos (id, client_id, gestor_id, coluna, checklist) VALUES
 ('a6000000-0000-0000-0000-00000000ac01'::uuid,'a6000000-0000-0000-0000-0000000c1101'::uuid,
  'a6000000-0000-0000-0000-0000000000d1','tasks_em_aberto','[]'::jsonb),
 ('a6000000-0000-0000-0000-00000000ac02'::uuid,'a6000000-0000-0000-0000-0000000c1102'::uuid,
  'a6000000-0000-0000-0000-0000000000d1','follow_up_feito','[]'::jsonb),
 ('a6000000-0000-0000-0000-00000000ac03'::uuid,'a6000000-0000-0000-0000-0000000c1103'::uuid,
  'a6000000-0000-0000-0000-0000000000d1','aguardando_resposta','[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- CHECKLIST + AUTO-MOVE — impersona o gestor dono.
-- =============================================================================
SELECT _tk_set('a6000000-0000-0000-0000-0000000000d1'::uuid);
SET LOCAL ROLE authenticated;

-- (a) Não-completo em tasks_em_aberto: persiste, NÃO move. Retorna a coluna atual.
SELECT is(
  public.torque_acomp_checklist_set(
    'a6000000-0000-0000-0000-00000000ac01'::uuid,
    '[{"id":"t1","label":"Ligar","done":true},{"id":"t2","label":"Email","done":false}]'::jsonb),
  'tasks_em_aberto', 'checklist parcial em tasks_em_aberto NÃO move (fica tasks_em_aberto)');

-- (b) Vazio: NÃO move (vazio nunca completa). Manda array vazio de volta.
SELECT is(
  public.torque_acomp_checklist_set(
    'a6000000-0000-0000-0000-00000000ac01'::uuid, '[]'::jsonb),
  'tasks_em_aberto', 'checklist VAZIO em tasks_em_aberto NÃO move (vazio nunca completa)');

-- (c) Todas marcadas: auto-move -> fazer_follow_up.
SELECT is(
  public.torque_acomp_checklist_set(
    'a6000000-0000-0000-0000-00000000ac01'::uuid,
    '[{"id":"t1","label":"Ligar","done":true},{"id":"t2","label":"Email","done":true}]'::jsonb),
  'fazer_follow_up', 'checklist 100% completo em tasks_em_aberto AUTO-MOVE -> fazer_follow_up');

SELECT is(
  (SELECT coluna FROM public.crm_acompanhamentos WHERE id='a6000000-0000-0000-0000-00000000ac01'::uuid),
  'fazer_follow_up', 'auto-move persistiu a coluna no banco');

-- (d) Fora de tasks_em_aberto (aguardando_resposta) 100% completo: NÃO move (one-way).
SELECT is(
  public.torque_acomp_checklist_set(
    'a6000000-0000-0000-0000-00000000ac03'::uuid,
    '[{"id":"x","label":"X","done":true}]'::jsonb),
  'aguardando_resposta', 'checklist completo FORA de tasks_em_aberto NÃO move (auto-move one-way)');

-- (e) Shape inválido -> RAISE.
SELECT throws_ok($$
  SELECT public.torque_acomp_checklist_set('a6000000-0000-0000-0000-00000000ac02'::uuid,
    '[{"id":"","label":"sem id","done":true}]'::jsonb)
$$, 'P0001', NULL, 'shape inválido (id vazio) -> RAISE');

RESET ROLE;

-- =============================================================================
-- RESET SEMANAL — função de cron (contexto superuser; chamada direta).
-- Estado neste ponto: ac01=fazer_follow_up, ac02=follow_up_feito,
-- ac03=aguardando_resposta. Repõe um card em tasks_em_aberto p/ provar preservação.
-- =============================================================================
INSERT INTO public.crm_acompanhamentos (id, client_id, gestor_id, coluna, checklist) VALUES
 ('a6000000-0000-0000-0000-00000000ac04'::uuid,'a6000000-0000-0000-0000-0000000c1104'::uuid,
  'a6000000-0000-0000-0000-0000000000d1','tasks_em_aberto',
  '[{"id":"p","label":"Pendência","done":false}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

SELECT is(
  public._cron_torque_acomp_reset_segunda(),
  2, 'reset move EXATAMENTE 2 cards (follow_up_feito + aguardando_resposta)');

SELECT is(
  (SELECT coluna FROM public.crm_acompanhamentos WHERE id='a6000000-0000-0000-0000-00000000ac02'::uuid),
  'fazer_follow_up', 'reset: follow_up_feito -> fazer_follow_up');

SELECT is(
  (SELECT coluna FROM public.crm_acompanhamentos WHERE id='a6000000-0000-0000-0000-00000000ac03'::uuid),
  'fazer_follow_up', 'reset: aguardando_resposta -> fazer_follow_up');

SELECT is(
  (SELECT coluna FROM public.crm_acompanhamentos WHERE id='a6000000-0000-0000-0000-00000000ac04'::uuid),
  'tasks_em_aberto', 'reset PRESERVA tasks_em_aberto (intacto — HITL #4)');

SELECT is(
  (SELECT checklist FROM public.crm_acompanhamentos WHERE id='a6000000-0000-0000-0000-00000000ac04'::uuid),
  '[{"id":"p","label":"Pendência","done":false}]'::jsonb,
  'reset NÃO mexe no checklist de tasks_em_aberto');

-- Idempotência: 2º run no mesmo estado é no-op (0 linhas movidas).
SELECT is(
  public._cron_torque_acomp_reset_segunda(),
  0, 'reset idempotente: 2º run move 0 cards');

-- =============================================================================
-- AUTORIZAÇÃO — forasteiro -> permission denied (42501) em checklist_set.
-- Captura o id ANTES de virar forasteiro (RLS esconde a linha; passamos literal
-- para a RPC chegar no check de auth, não no guard de "não existe").
-- =============================================================================
SELECT _tk_set('a6000000-0000-0000-0000-0000000000f1'::uuid);
SET LOCAL ROLE authenticated;

SELECT throws_ok($$
  SELECT public.torque_acomp_checklist_set('a6000000-0000-0000-0000-00000000ac02'::uuid,
    '[{"id":"z","label":"Z","done":false}]'::jsonb)
$$, '42501', NULL, 'forasteiro -> permission denied em checklist_set');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
