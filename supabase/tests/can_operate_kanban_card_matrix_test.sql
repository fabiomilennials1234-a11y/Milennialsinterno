-- supabase/tests/can_operate_kanban_card_matrix_test.sql
--
-- pgTAP regression: matriz canonica de operacao de kanban por papel.
--
-- Cobre regressao em can_operate_kanban_card. Setup:
--   - 16 users (1 por role no enum user_role).
--   - 14 boards (1 por page_slug + 1 NULL fallback).
--   - allowed_roles inclui todos os papeis para garantir can_view_board=true.
--     Assim o gate efetivo testado e a matriz de can_operate_kanban_card.
--
-- Asserts cobrem:
--   - admin bypass (ceo, cto, gestor_projetos)
--   - matriz por page_slug (5 especializados, 6 funcionais, 2 operacionais)
--   - fail-closed para boards sem page_slug (apenas admins operam)
--   - edge cases: user/board NULL, action vazia, user inexistente
--
-- Migrations guardadas:
--   - 20260428220000_centralize_kanban_action_permissions.sql
--   - 20260429120000_extend_kanban_action_matrix_remaining_boards.sql
--   - 20260429130000_assign_page_slug_internal_boards_and_extend_action_matrix.sql

BEGIN;

SELECT plan(53);

-- ── Setup: 16 usuarios, 1 por role ────────────────────────────────────────
-- UUIDs usam to_hex(idx) para casar com asserts (UUID e hex, nao decimal).
-- Trigger handle_new_user / equivalente cria role default 'design' ao inserir
-- profile; o passo seguinte limpa essa role default e atribui a explicita.

INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT
  ('aaaaaaaa-0000-0000-0000-' || lpad(to_hex(idx), 12, '0'))::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  role || '-matrix@test.local',
  crypt('x', gen_salt('bf')),
  'authenticated', 'authenticated', now(), now(), ''
FROM (VALUES
  (1, 'ceo'), (2, 'cto'), (3, 'gestor_projetos'),
  (4, 'gestor_ads'), (5, 'sucesso_cliente'),
  (6, 'design'), (7, 'editor_video'), (8, 'devs'),
  (9, 'atrizes_gravacao'), (10, 'produtora'),
  (11, 'gestor_crm'), (12, 'consultor_comercial'),
  (13, 'consultor_mktplace'), (14, 'financeiro'),
  (15, 'rh'), (16, 'outbound')
) AS t(idx, role)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email)
SELECT
  ('aaaaaaaa-0000-0000-0000-' || lpad(to_hex(idx), 12, '0'))::uuid,
  upper(role) || ' Matrix',
  role || '-matrix@test.local'
FROM (VALUES
  (1, 'ceo'), (2, 'cto'), (3, 'gestor_projetos'),
  (4, 'gestor_ads'), (5, 'sucesso_cliente'),
  (6, 'design'), (7, 'editor_video'), (8, 'devs'),
  (9, 'atrizes_gravacao'), (10, 'produtora'),
  (11, 'gestor_crm'), (12, 'consultor_comercial'),
  (13, 'consultor_mktplace'), (14, 'financeiro'),
  (15, 'rh'), (16, 'outbound')
) AS t(idx, role)
ON CONFLICT (user_id) DO NOTHING;

-- Limpa role default criada por trigger (handle_new_user-style).
DELETE FROM public.user_roles
 WHERE user_id IN (
   SELECT ('aaaaaaaa-0000-0000-0000-' || lpad(to_hex(idx), 12, '0'))::uuid
   FROM generate_series(1, 16) AS idx
 );

INSERT INTO public.user_roles (user_id, role)
SELECT
  ('aaaaaaaa-0000-0000-0000-' || lpad(to_hex(idx), 12, '0'))::uuid,
  role::public.user_role
FROM (VALUES
  (1, 'ceo'), (2, 'cto'), (3, 'gestor_projetos'),
  (4, 'gestor_ads'), (5, 'sucesso_cliente'),
  (6, 'design'), (7, 'editor_video'), (8, 'devs'),
  (9, 'atrizes_gravacao'), (10, 'produtora'),
  (11, 'gestor_crm'), (12, 'consultor_comercial'),
  (13, 'consultor_mktplace'), (14, 'financeiro'),
  (15, 'rh'), (16, 'outbound')
) AS t(idx, role)
ON CONFLICT (user_id, role) DO NOTHING;

-- ── Setup: 14 boards (1 por page_slug + 1 NULL) ───────────────────────────
-- allowed_roles inclui todos os papeis para can_view_board=true.

INSERT INTO public.kanban_boards (id, name, slug, page_slug, allowed_roles)
VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'TST design',              'tst-design',              'design',              ARRAY['ceo','cto','gestor_projetos','gestor_ads','sucesso_cliente','design','editor_video','devs','atrizes_gravacao','produtora','gestor_crm','consultor_comercial','consultor_mktplace','financeiro','rh','outbound']),
  ('bbbbbbbb-0000-0000-0000-000000000002'::uuid, 'TST editor-video',        'tst-editor-video',        'editor-video',        ARRAY['ceo','cto','gestor_projetos','gestor_ads','sucesso_cliente','design','editor_video','devs','atrizes_gravacao','produtora','gestor_crm','consultor_comercial','consultor_mktplace','financeiro','rh','outbound']),
  ('bbbbbbbb-0000-0000-0000-000000000003'::uuid, 'TST devs',                'tst-devs',                'devs',                ARRAY['ceo','cto','gestor_projetos','gestor_ads','sucesso_cliente','design','editor_video','devs','atrizes_gravacao','produtora','gestor_crm','consultor_comercial','consultor_mktplace','financeiro','rh','outbound']),
  ('bbbbbbbb-0000-0000-0000-000000000004'::uuid, 'TST atrizes',             'tst-atrizes',             'atrizes-gravacao',    ARRAY['ceo','cto','gestor_projetos','gestor_ads','sucesso_cliente','design','editor_video','devs','atrizes_gravacao','produtora','gestor_crm','consultor_comercial','consultor_mktplace','financeiro','rh','outbound']),
  ('bbbbbbbb-0000-0000-0000-000000000005'::uuid, 'TST produtora',           'tst-produtora',           'produtora',           ARRAY['ceo','cto','gestor_projetos','gestor_ads','sucesso_cliente','design','editor_video','devs','atrizes_gravacao','produtora','gestor_crm','consultor_comercial','consultor_mktplace','financeiro','rh','outbound']),
  ('bbbbbbbb-0000-0000-0000-000000000006'::uuid, 'TST rh',                  'tst-rh',                  'rh',                  ARRAY['ceo','cto','gestor_projetos','gestor_ads','sucesso_cliente','design','editor_video','devs','atrizes_gravacao','produtora','gestor_crm','consultor_comercial','consultor_mktplace','financeiro','rh','outbound']),
  ('bbbbbbbb-0000-0000-0000-000000000007'::uuid, 'TST financeiro',          'tst-financeiro',          'financeiro',          ARRAY['ceo','cto','gestor_projetos','gestor_ads','sucesso_cliente','design','editor_video','devs','atrizes_gravacao','produtora','gestor_crm','consultor_comercial','consultor_mktplace','financeiro','rh','outbound']),
  ('bbbbbbbb-0000-0000-0000-000000000008'::uuid, 'TST gestor-crm',          'tst-gestor-crm',          'gestor-crm',          ARRAY['ceo','cto','gestor_projetos','gestor_ads','sucesso_cliente','design','editor_video','devs','atrizes_gravacao','produtora','gestor_crm','consultor_comercial','consultor_mktplace','financeiro','rh','outbound']),
  ('bbbbbbbb-0000-0000-0000-000000000009'::uuid, 'TST consultor-comercial', 'tst-consultor-comercial', 'consultor-comercial', ARRAY['ceo','cto','gestor_projetos','gestor_ads','sucesso_cliente','design','editor_video','devs','atrizes_gravacao','produtora','gestor_crm','consultor_comercial','consultor_mktplace','financeiro','rh','outbound']),
  ('bbbbbbbb-0000-0000-0000-00000000000a'::uuid, 'TST consultor-mktplace',  'tst-consultor-mktplace',  'consultor-mktplace',  ARRAY['ceo','cto','gestor_projetos','gestor_ads','sucesso_cliente','design','editor_video','devs','atrizes_gravacao','produtora','gestor_crm','consultor_comercial','consultor_mktplace','financeiro','rh','outbound']),
  ('bbbbbbbb-0000-0000-0000-00000000000b'::uuid, 'TST gestor-ads',          'tst-gestor-ads',          'gestor-ads',          ARRAY['ceo','cto','gestor_projetos','gestor_ads','sucesso_cliente','design','editor_video','devs','atrizes_gravacao','produtora','gestor_crm','consultor_comercial','consultor_mktplace','financeiro','rh','outbound']),
  ('bbbbbbbb-0000-0000-0000-00000000000c'::uuid, 'TST cadastro-clientes',   'tst-cadastro-clientes',   'cadastro-clientes',   ARRAY['ceo','cto','gestor_projetos','gestor_ads','sucesso_cliente','design','editor_video','devs','atrizes_gravacao','produtora','gestor_crm','consultor_comercial','consultor_mktplace','financeiro','rh','outbound']),
  ('bbbbbbbb-0000-0000-0000-00000000000d'::uuid, 'TST outbound',            'tst-outbound',            'outbound',            ARRAY['ceo','cto','gestor_projetos','gestor_ads','sucesso_cliente','design','editor_video','devs','atrizes_gravacao','produtora','gestor_crm','consultor_comercial','consultor_mktplace','financeiro','rh','outbound']),
  ('bbbbbbbb-0000-0000-0000-00000000000e'::uuid, 'TST null-slug',           'tst-null-slug',           NULL,                  ARRAY['ceo','cto','gestor_projetos','gestor_ads','sucesso_cliente','design','editor_video','devs','atrizes_gravacao','produtora','gestor_crm','consultor_comercial','consultor_mktplace','financeiro','rh','outbound']);

-- UUID legend:
-- users:  ceo=01, cto=02, gp=03, ads=04, sc=05, design=06, video=07, devs=08,
--         atrizes=09, produtora=0a, crm=0b, comercial=0c, mktplace=0d,
--         financ=0e, rh=0f, outbound=10
-- boards: design=01, video=02, devs=03, atrizes=04, produtora=05, rh=06,
--         financ=07, crm=08, comercial=09, mktplace=0a, gestor-ads=0b,
--         cadastro=0c, outbound=0d, null=0e

-- ====================================================================
-- ADMIN BYPASS — ceo/cto/gestor_projetos operam tudo (4 testes)
-- ====================================================================

SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'create'),        'ceo cria em design');
SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'bbbbbbbb-0000-0000-0000-000000000007'::uuid, 'archive'),       'cto arquiva em financeiro');
SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000003'::uuid, 'bbbbbbbb-0000-0000-0000-00000000000a'::uuid, 'edit_briefing'), 'gestor_projetos edita briefing em consultor-mktplace');
SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'bbbbbbbb-0000-0000-0000-00000000000e'::uuid, 'delete'),        'ceo deleta em board sem page_slug');

-- ====================================================================
-- DESIGN — gestor_ads, design, sucesso_cliente (5 testes)
-- ====================================================================

SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000004'::uuid, 'bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'create'),  'gestor_ads cria em design');
SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000006'::uuid, 'bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'create'),  'design cria em design');
SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000005'::uuid, 'bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'archive'), 'sucesso_cliente arquiva em design');
SELECT ok(NOT public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000008'::uuid, 'bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'create'), 'devs NAO cria em design');
SELECT ok(NOT public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000007'::uuid, 'bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'move'),   'editor_video NAO move em design');

-- ====================================================================
-- EDITOR-VIDEO — gestor_ads, editor_video, sucesso_cliente (3 testes)
-- ====================================================================

SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000007'::uuid, 'bbbbbbbb-0000-0000-0000-000000000002'::uuid, 'create'),  'editor_video cria em editor-video');
SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000004'::uuid, 'bbbbbbbb-0000-0000-0000-000000000002'::uuid, 'archive'), 'gestor_ads arquiva em editor-video');
SELECT ok(NOT public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000006'::uuid, 'bbbbbbbb-0000-0000-0000-000000000002'::uuid, 'create'), 'design NAO cria em editor-video');

-- ====================================================================
-- DEVS — gestor_ads, devs, sucesso_cliente (2 testes)
-- ====================================================================

SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000008'::uuid, 'bbbbbbbb-0000-0000-0000-000000000003'::uuid, 'create'),     'devs cria em devs');
SELECT ok(NOT public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-00000000000a'::uuid, 'bbbbbbbb-0000-0000-0000-000000000003'::uuid, 'create'), 'produtora NAO cria em devs');

-- ====================================================================
-- ATRIZES-GRAVACAO — gestor_ads, atrizes_gravacao, sucesso_cliente (2 testes)
-- ====================================================================

SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000009'::uuid, 'bbbbbbbb-0000-0000-0000-000000000004'::uuid, 'create'),     'atrizes_gravacao cria em atrizes-gravacao');
SELECT ok(NOT public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000008'::uuid, 'bbbbbbbb-0000-0000-0000-000000000004'::uuid, 'create'), 'devs NAO cria em atrizes-gravacao');

-- ====================================================================
-- PRODUTORA — gestor_ads, produtora, sucesso_cliente; +editor_video em create/move (7 testes)
-- ====================================================================

SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-00000000000a'::uuid, 'bbbbbbbb-0000-0000-0000-000000000005'::uuid, 'create'),         'produtora cria em produtora');
SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000007'::uuid, 'bbbbbbbb-0000-0000-0000-000000000005'::uuid, 'create'),         'editor_video cria em produtora');
SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000007'::uuid, 'bbbbbbbb-0000-0000-0000-000000000005'::uuid, 'move'),           'editor_video move em produtora');
SELECT ok(NOT public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000007'::uuid, 'bbbbbbbb-0000-0000-0000-000000000005'::uuid, 'archive'),       'editor_video NAO arquiva em produtora');
SELECT ok(NOT public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000007'::uuid, 'bbbbbbbb-0000-0000-0000-000000000005'::uuid, 'edit_briefing'), 'editor_video NAO edita briefing em produtora');
SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-00000000000a'::uuid, 'bbbbbbbb-0000-0000-0000-000000000005'::uuid, 'archive'),        'produtora arquiva em produtora');
SELECT ok(NOT public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000006'::uuid, 'bbbbbbbb-0000-0000-0000-000000000005'::uuid, 'create'),     'design NAO cria em produtora');

-- ====================================================================
-- RH — rh, sucesso_cliente (3 testes)
-- ====================================================================

SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-00000000000f'::uuid, 'bbbbbbbb-0000-0000-0000-000000000006'::uuid, 'create'),     'rh cria em rh');
SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000005'::uuid, 'bbbbbbbb-0000-0000-0000-000000000006'::uuid, 'archive'),    'sucesso_cliente arquiva em rh');
SELECT ok(NOT public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000004'::uuid, 'bbbbbbbb-0000-0000-0000-000000000006'::uuid, 'create'), 'gestor_ads NAO cria em rh');

-- ====================================================================
-- FINANCEIRO — financeiro (3 testes)
-- ====================================================================

SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-00000000000e'::uuid, 'bbbbbbbb-0000-0000-0000-000000000007'::uuid, 'create'),     'financeiro cria em financeiro');
SELECT ok(NOT public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000005'::uuid, 'bbbbbbbb-0000-0000-0000-000000000007'::uuid, 'create'), 'sucesso_cliente NAO cria em financeiro');
SELECT ok(NOT public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000004'::uuid, 'bbbbbbbb-0000-0000-0000-000000000007'::uuid, 'move'),   'gestor_ads NAO move em financeiro');

-- ====================================================================
-- GESTOR-CRM — gestor_crm, sucesso_cliente (3 testes)
-- ====================================================================

SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-00000000000b'::uuid, 'bbbbbbbb-0000-0000-0000-000000000008'::uuid, 'create'),     'gestor_crm cria em gestor-crm');
SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000005'::uuid, 'bbbbbbbb-0000-0000-0000-000000000008'::uuid, 'create'),     'sucesso_cliente cria em gestor-crm');
SELECT ok(NOT public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000004'::uuid, 'bbbbbbbb-0000-0000-0000-000000000008'::uuid, 'create'), 'gestor_ads NAO cria em gestor-crm');

-- ====================================================================
-- CONSULTOR-COMERCIAL — consultor_comercial, sucesso_cliente (3 testes)
-- ====================================================================

SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-00000000000c'::uuid, 'bbbbbbbb-0000-0000-0000-000000000009'::uuid, 'create'),     'consultor_comercial cria em consultor-comercial');
SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000005'::uuid, 'bbbbbbbb-0000-0000-0000-000000000009'::uuid, 'archive'),    'sucesso_cliente arquiva em consultor-comercial');
SELECT ok(NOT public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000004'::uuid, 'bbbbbbbb-0000-0000-0000-000000000009'::uuid, 'create'), 'gestor_ads NAO cria em consultor-comercial');

-- ====================================================================
-- CONSULTOR-MKTPLACE — consultor_mktplace (2 testes)
-- ====================================================================

SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-00000000000d'::uuid, 'bbbbbbbb-0000-0000-0000-00000000000a'::uuid, 'create'),     'consultor_mktplace cria em consultor-mktplace');
SELECT ok(NOT public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000005'::uuid, 'bbbbbbbb-0000-0000-0000-00000000000a'::uuid, 'create'), 'sucesso_cliente NAO cria em consultor-mktplace');

-- ====================================================================
-- OUTBOUND — outbound, sucesso_cliente (3 testes)
-- ====================================================================

SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000010'::uuid, 'bbbbbbbb-0000-0000-0000-00000000000d'::uuid, 'create'),     'outbound cria em outbound');
SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000005'::uuid, 'bbbbbbbb-0000-0000-0000-00000000000d'::uuid, 'archive'),    'sucesso_cliente arquiva em outbound');
SELECT ok(NOT public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000004'::uuid, 'bbbbbbbb-0000-0000-0000-00000000000d'::uuid, 'create'), 'gestor_ads NAO cria em outbound');

-- ====================================================================
-- GESTOR-ADS — gestor_ads, sucesso_cliente (4 testes)
-- ====================================================================

SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000004'::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b'::uuid, 'create'),     'gestor_ads cria em gestor-ads');
SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000005'::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b'::uuid, 'create'),     'sucesso_cliente cria em gestor-ads');
SELECT ok(NOT public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000006'::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b'::uuid, 'create'), 'design NAO cria em gestor-ads');
SELECT ok(NOT public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-00000000000a'::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b'::uuid, 'archive'), 'produtora NAO arquiva em gestor-ads');

-- ====================================================================
-- CADASTRO-CLIENTES — sucesso_cliente (3 testes)
-- ====================================================================

SELECT ok(public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000005'::uuid, 'bbbbbbbb-0000-0000-0000-00000000000c'::uuid, 'create'),     'sucesso_cliente cria em cadastro-clientes');
SELECT ok(NOT public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000004'::uuid, 'bbbbbbbb-0000-0000-0000-00000000000c'::uuid, 'create'), 'gestor_ads NAO cria em cadastro-clientes');
SELECT ok(NOT public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-00000000000c'::uuid, 'bbbbbbbb-0000-0000-0000-00000000000c'::uuid, 'create'), 'consultor_comercial NAO cria em cadastro-clientes');

-- ====================================================================
-- NULL page_slug — fail-closed: apenas admins operam (2 testes)
-- ====================================================================

SELECT ok(NOT public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000004'::uuid, 'bbbbbbbb-0000-0000-0000-00000000000e'::uuid, 'create'),  'gestor_ads NAO opera board sem page_slug (fail-closed)');
SELECT ok(NOT public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000006'::uuid, 'bbbbbbbb-0000-0000-0000-00000000000e'::uuid, 'archive'), 'design NAO opera board sem page_slug (fail-closed)');

-- ====================================================================
-- EDGE CASES (4 testes)
-- ====================================================================

SELECT ok(NOT public.can_operate_kanban_card('00000000-0000-0000-0000-deadbeef0001'::uuid, 'bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'create'), 'user inexistente NAO opera');
SELECT ok(NOT public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000004'::uuid, 'bbbbbbbb-0000-0000-0000-000000000001'::uuid, ''),       'action vazia retorna false');
SELECT ok(NOT public.can_operate_kanban_card('aaaaaaaa-0000-0000-0000-000000000004'::uuid, NULL, 'create'),                                          'board_id null retorna false');
SELECT ok(NOT public.can_operate_kanban_card(NULL, 'bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'create'),                                          'user_id null retorna false');

SELECT * FROM finish();

ROLLBACK;
