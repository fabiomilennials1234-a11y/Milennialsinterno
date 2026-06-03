-- supabase/tests/torque_board_checklist_test.sql
-- pgTAP — Slice 3 (#93) — Checklist editável + auto-move do Board Torque CRM. ADR 0006.
--
-- Prova as INVARIANTES da RPC torque_board_checklist_set (migração
-- 20260603180000), via INTERFACE PÚBLICA (a RPC), não implementação.
--
-- Invariantes provadas:
--   ESTRUTURA / HARDENING
--     - torque_board_checklist_set(uuid,jsonb) existe, SECURITY DEFINER, search_path travado;
--   ESCRITA DO CHECKLIST
--     - persiste o array inteiro recebido (replace);
--     - shape inválido -> RAISE (defesa além do CHECK de array);
--     - card inexistente -> RAISE (anti-órfão);
--   AUTO-MOVE (espelha boardImplantacao.onChecklistComplete + checklist.isComplete)
--     - card em 'tier' + checklist 100% -> auto-move 'apresentacao' (RETURNs 'apresentacao');
--     - card em 'tier' + checklist parcial -> permanece 'tier';
--     - card em 'tier' + checklist VAZIO -> permanece 'tier' (vazio não completa);
--     - ONE-WAY: card em 'apresentacao' com item DESMARCADO -> NÃO volta pra 'tier';
--     - idempotente: card em 'apresentacao' com checklist completo -> fica 'apresentacao';
--   AUTORIZAÇÃO (replica policies crm_config_* da #91)
--     - forasteiro (sem grant, não-gestor) -> permission denied (42501).
--
-- UUID prefix: 'b3000000'. Runner: scripts/sb-pgtap.sh supabase/tests/torque_board_checklist_test.sql
BEGIN;

SELECT plan(13);

-- Helper de impersonação (padrão torque_board_rpc_test.sql).
CREATE OR REPLACE FUNCTION _tbc_set(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_user_id,'role','authenticated')::text, true);
END;$$;

-- =============================================================================
-- ESTRUTURA / HARDENING
-- =============================================================================
SELECT has_function('public','torque_board_checklist_set', ARRAY['uuid','jsonb'],
  'torque_board_checklist_set(uuid,jsonb) existe');

SELECT is(
  (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='torque_board_checklist_set'),
  true, 'torque_board_checklist_set é SECURITY DEFINER');

SELECT ok(
  (SELECT EXISTS (
      SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='torque_board_checklist_set'),
  'torque_board_checklist_set trava search_path (hardening SECURITY DEFINER)');

-- =============================================================================
-- SEED: admin (ceo), gestor dono do card, forasteiro, cliente.
-- =============================================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT u,'00000000-0000-0000-0000-000000000000'::uuid,u::text||'@m.test',crypt('t',gen_salt('bf')),'authenticated','authenticated',now(),now(),''
FROM (VALUES
  ('b3000000-0000-0000-0000-0000000000a1'::uuid),  -- admin/ceo
  ('b3000000-0000-0000-0000-0000000000d1'::uuid),  -- gestor dono do card
  ('b3000000-0000-0000-0000-0000000000f1'::uuid)   -- forasteiro
) AS t(u)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id,name,email) VALUES
 ('b3000000-0000-0000-0000-0000000000a1'::uuid,'TBC Admin','tbca1@m.test'),
 ('b3000000-0000-0000-0000-0000000000d1'::uuid,'TBC Gestor','tbcd1@m.test'),
 ('b3000000-0000-0000-0000-0000000000f1'::uuid,'TBC Fora','tbcf1@m.test')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id,role) VALUES
 ('b3000000-0000-0000-0000-0000000000a1'::uuid,'ceo')
ON CONFLICT (user_id,role) DO NOTHING;

INSERT INTO public.clients (id,name) VALUES
 ('b3000000-0000-0000-0000-0000000c1100'::uuid,'TBC Client')
ON CONFLICT (id) DO NOTHING;

-- Card alvo em 'tier' (a coluna de trabalho). Inserido cru no seed (DDL do teste).
INSERT INTO public.crm_configuracoes
  (id, client_id, gestor_id, produto, current_step, is_finalizado, board_status, checklist)
VALUES
  ('b3000000-0000-0000-0000-00000000c0d1'::uuid,
   'b3000000-0000-0000-0000-0000000c1100'::uuid,
   'b3000000-0000-0000-0000-0000000000d1', 'torque', 'receber_briefing', false,
   'tier', '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- Como admin (autorizado).
-- =============================================================================
SELECT _tbc_set('b3000000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;

-- ESCRITA: persiste o array (parcial) e NÃO move (em tier mas incompleto).
SELECT is(
  public.torque_board_checklist_set(
    'b3000000-0000-0000-0000-00000000c0d1'::uuid,
    '[{"id":"a","label":"A","done":true},{"id":"b","label":"B","done":false}]'::jsonb),
  'tier', 'tier + checklist parcial -> permanece tier (RETURN)');

SELECT is(
  (SELECT jsonb_array_length(checklist) FROM public.crm_configuracoes
     WHERE id='b3000000-0000-0000-0000-00000000c0d1'::uuid),
  2, 'replace: persiste o array inteiro recebido');

-- VAZIO em tier -> não move.
SELECT is(
  public.torque_board_checklist_set(
    'b3000000-0000-0000-0000-00000000c0d1'::uuid, '[]'::jsonb),
  'tier', 'tier + checklist vazio -> permanece tier (vazio não completa)');

-- AUTO-MOVE: tier + 100% -> apresentacao.
SELECT is(
  public.torque_board_checklist_set(
    'b3000000-0000-0000-0000-00000000c0d1'::uuid,
    '[{"id":"a","label":"A","done":true},{"id":"b","label":"B","done":true}]'::jsonb),
  'apresentacao', 'tier + checklist 100% -> auto-move apresentacao');

SELECT is(
  (SELECT board_status FROM public.crm_configuracoes
     WHERE id='b3000000-0000-0000-0000-00000000c0d1'::uuid),
  'apresentacao', 'auto-move persistiu board_status=apresentacao');

-- ONE-WAY: já em apresentacao, desmarca item -> NÃO volta pra tier.
SELECT is(
  public.torque_board_checklist_set(
    'b3000000-0000-0000-0000-00000000c0d1'::uuid,
    '[{"id":"a","label":"A","done":true},{"id":"b","label":"B","done":false}]'::jsonb),
  'apresentacao', 'apresentacao + item desmarcado -> NÃO rebaixa (one-way)');

-- Idempotente: apresentacao + 100% -> fica apresentacao.
SELECT is(
  public.torque_board_checklist_set(
    'b3000000-0000-0000-0000-00000000c0d1'::uuid,
    '[{"id":"a","label":"A","done":true},{"id":"b","label":"B","done":true}]'::jsonb),
  'apresentacao', 'apresentacao + 100% -> idempotente (fica apresentacao)');

-- Shape inválido -> RAISE.
SELECT throws_ok($$
  SELECT public.torque_board_checklist_set(
    'b3000000-0000-0000-0000-00000000c0d1'::uuid,
    '[{"id":"a","done":true}]'::jsonb)
$$, 'P0001', NULL, 'shape inválido (sem label) -> RAISE');

-- Card inexistente -> RAISE (anti-órfão).
SELECT throws_ok($$
  SELECT public.torque_board_checklist_set(
    'b3000000-0000-0000-0000-00000000dead'::uuid, '[]'::jsonb)
$$, 'P0001', NULL, 'card inexistente -> RAISE (anti-órfão)');

-- =============================================================================
-- AUTORIZAÇÃO — forasteiro (sem grant, não-gestor) -> permission denied.
-- =============================================================================
RESET ROLE;
SELECT _tbc_set('b3000000-0000-0000-0000-0000000000f1'::uuid);
SET LOCAL ROLE authenticated;

SELECT throws_ok($$
  SELECT public.torque_board_checklist_set(
    'b3000000-0000-0000-0000-00000000c0d1'::uuid, '[]'::jsonb)
$$, '42501', NULL, 'forasteiro (sem grant, não-gestor) -> permission denied');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
