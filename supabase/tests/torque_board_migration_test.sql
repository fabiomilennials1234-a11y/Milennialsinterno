-- supabase/tests/torque_board_migration_test.sql
-- pgTAP — Slice 1 (#91) — Fundação do Board Torque CRM. ADR 0006.
--
-- Prova as INVARIANTES da migração 20260603160000_torque_crm_board_foundation.sql
-- (que já rodou no remoto). Foco: NÃO-PERDA DE PROGRESSO no achatamento
-- current_step → checklist, e o rename v8→torque.
--
-- Invariantes provadas (via interface pública: as funções da migração):
--   ESTRUTURA
--     - crm_configuracoes tem board_status, checklist, apresentacao_at;
--     - CHECK de produto aceita 'torque' e REJEITA 'v8';
--     - CHECK de board_status restringe ao domínio fechado;
--     - torque_step_to_checklist é IMMUTABLE.
--   PROGRESSO (torque_step_to_checklist)
--     - prefixo done = índice do current_step + 1 (conta exata);
--     - primeiro step → 1 done; último step → todos done;
--     - step inválido → 0 done (não inventa progresso);
--     - shape de cada item = {id,label,done} na ordem do tier;
--     - 'torque' herda a state-machine do ex-v8 (12 steps).
--   RENAME
--     - nenhuma linha viva permanece com produto 'v8' após a migração.
--
-- Runner: scripts/sb-pgtap.sh supabase/tests/torque_board_migration_test.sql
BEGIN;

SELECT plan(17);

-- =============================================================================
-- ESTRUTURA
-- =============================================================================
SELECT has_column('public','crm_configuracoes','board_status',
  'crm_configuracoes.board_status existe');
SELECT has_column('public','crm_configuracoes','checklist',
  'crm_configuracoes.checklist existe');
SELECT has_column('public','crm_configuracoes','apresentacao_at',
  'crm_configuracoes.apresentacao_at existe');

SELECT col_type_is('public','crm_configuracoes','checklist','jsonb',
  'checklist é jsonb');
SELECT col_type_is('public','crm_configuracoes','apresentacao_at','timestamp with time zone',
  'apresentacao_at é timestamptz');

SELECT is(
  (SELECT provolatile FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='torque_step_to_checklist'),
  'i', 'torque_step_to_checklist é IMMUTABLE (determinística)');

-- CHECK de produto: 'torque' aceito, 'v8' rejeitado.
SELECT lives_ok($$
  INSERT INTO public.clients (id,name) VALUES
    ('cb000000-0000-0000-0000-0000000c1100'::uuid,'TB Client') ON CONFLICT DO NOTHING;
  INSERT INTO public.crm_configuracoes (client_id,gestor_id,produto,current_step,checklist)
  VALUES ('cb000000-0000-0000-0000-0000000c1100'::uuid,'cb000000-0000-0000-0000-0000000000a1',
          'torque','estruturar_funil','[]'::jsonb)
$$, 'produto torque aceito pelo CHECK');

SELECT throws_ok($$
  INSERT INTO public.crm_configuracoes (client_id,gestor_id,produto,current_step,checklist)
  VALUES ('cb000000-0000-0000-0000-0000000c1100'::uuid,'cb000000-0000-0000-0000-0000000000a1',
          'v8','estruturar_funil','[]'::jsonb)
$$, '23514', NULL, 'produto v8 REJEITADO pelo CHECK (tier renomeado)');

SELECT throws_ok($$
  INSERT INTO public.crm_configuracoes (client_id,gestor_id,produto,current_step,checklist,board_status)
  VALUES ('cb000000-0000-0000-0000-0000000c1100'::uuid,'cb000000-0000-0000-0000-0000000000a2',
          'automation','receber_briefing','[]'::jsonb,'coluna_invalida')
$$, '23514', NULL, 'board_status fora do domínio REJEITADO pelo CHECK');

-- =============================================================================
-- PROGRESSO — torque_step_to_checklist (núcleo determinístico da migração)
-- =============================================================================
-- Prefixo done: 4º step do automation (índice 3) → exatamente 4 done.
SELECT is(
  (SELECT count(*)::int FROM jsonb_array_elements(
     public.torque_step_to_checklist('automation','configurar_boas_vindas')) e
   WHERE (e->>'done')::boolean),
  4, 'automation @ 4º step → exatamente 4 itens done (prefixo preservado)');

-- Comprimento = nº de steps do tier (12 torque, 16 automation, 12 copilot).
SELECT is(
  (SELECT jsonb_array_length(public.torque_step_to_checklist('torque','receber_briefing'))),
  12, 'torque herda 12 steps do ex-v8');
SELECT is(
  (SELECT jsonb_array_length(public.torque_step_to_checklist('automation','receber_briefing'))),
  16, 'automation tem 16 steps');

-- Primeiro step → 1 done.
SELECT is(
  (SELECT count(*)::int FROM jsonb_array_elements(
     public.torque_step_to_checklist('copilot','receber_briefing')) e
   WHERE (e->>'done')::boolean),
  1, 'primeiro step → 1 done');

-- Último step → todos done (card pronto para apresentação).
SELECT is(
  (SELECT bool_and((e->>'done')::boolean) FROM jsonb_array_elements(
     public.torque_step_to_checklist('copilot','call_pos_venda')) e),
  true, 'último step → todos done');

-- Step inválido → 0 done (não inventa progresso).
SELECT is(
  (SELECT count(*)::int FROM jsonb_array_elements(
     public.torque_step_to_checklist('torque','step_inexistente')) e
   WHERE (e->>'done')::boolean),
  0, 'step inválido → 0 done (não inventa progresso)');

-- Shape do item: 1º item do torque = receber_briefing com label e done bool.
SELECT is(
  (SELECT (e->>'id') || '|' || (e->>'label') || '|' || (e->>'done')
   FROM jsonb_array_elements(public.torque_step_to_checklist('torque','receber_briefing')) e
   LIMIT 1),
  'receber_briefing|Receber briefing do treinador comercial|true',
  'item tem shape {id,label,done} com label humano correto');

-- =============================================================================
-- RENAME — nenhum vivo com produto 'v8'
-- =============================================================================
SELECT is(
  (SELECT count(*)::int FROM public.crm_configuracoes WHERE produto = 'v8'),
  0, 'nenhuma linha viva permanece com produto v8 (rename completo)');

SELECT * FROM finish();

ROLLBACK;
