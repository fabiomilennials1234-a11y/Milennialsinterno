-- supabase/tests/can_view_card_production_boards_test.sql
--
-- pgTAP regression: gestor_ads (com page_grant editor-video) cria card em
-- board global de producao sem client_id e CONSEGUE ver depois.
--
-- Guarda contra reintroducao da regra "card global precisa de client_id"
-- em can_view_card para boards de producao.
--
-- Migration guardada: 20260430090000_can_view_card_skip_client_filter_for_production_boards.sql

BEGIN;

SELECT plan(12);

-- Setup: 1 user gestor_ads, 1 user editor_video, 1 user devs.
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES
  ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'cvc-ads@test.local',     crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('cccccccc-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'cvc-editor@test.local',  crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('cccccccc-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'cvc-devs@test.local',    crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email)
VALUES
  ('cccccccc-0000-0000-0000-000000000001', 'CVC Ads',    'cvc-ads@test.local'),
  ('cccccccc-0000-0000-0000-000000000002', 'CVC Editor', 'cvc-editor@test.local'),
  ('cccccccc-0000-0000-0000-000000000003', 'CVC Devs',   'cvc-devs@test.local')
ON CONFLICT (user_id) DO NOTHING;

DELETE FROM public.user_roles WHERE user_id IN (
  'cccccccc-0000-0000-0000-000000000001',
  'cccccccc-0000-0000-0000-000000000002',
  'cccccccc-0000-0000-0000-000000000003'
);

INSERT INTO public.user_roles (user_id, role)
VALUES
  ('cccccccc-0000-0000-0000-000000000001', 'gestor_ads'::public.user_role),
  ('cccccccc-0000-0000-0000-000000000002', 'editor_video'::public.user_role),
  ('cccccccc-0000-0000-0000-000000000003', 'devs'::public.user_role);

-- Setup boards globais de producao com allowed_roles cobrindo todos os papeis.
INSERT INTO public.kanban_boards (id, name, slug, page_slug, allowed_roles)
VALUES
  ('dddddddd-0000-0000-0000-000000000001'::uuid, 'TST CVC editor-video',     'tst-cvc-editor-video',     'editor-video',     ARRAY['ceo','cto','gestor_projetos','gestor_ads','sucesso_cliente','design','editor_video','devs','atrizes_gravacao','produtora','gestor_crm','consultor_comercial','consultor_mktplace','financeiro','rh','outbound']),
  ('dddddddd-0000-0000-0000-000000000002'::uuid, 'TST CVC design',           'tst-cvc-design',           'design',           ARRAY['ceo','cto','gestor_projetos','gestor_ads','sucesso_cliente','design','editor_video','devs','atrizes_gravacao','produtora','gestor_crm','consultor_comercial','consultor_mktplace','financeiro','rh','outbound']),
  ('dddddddd-0000-0000-0000-000000000003'::uuid, 'TST CVC devs',             'tst-cvc-devs',             'devs',             ARRAY['ceo','cto','gestor_projetos','gestor_ads','sucesso_cliente','design','editor_video','devs','atrizes_gravacao','produtora','gestor_crm','consultor_comercial','consultor_mktplace','financeiro','rh','outbound']);

-- Coluna pra cada board.
INSERT INTO public.kanban_columns (id, board_id, title, position, color)
VALUES
  ('eeeeeeee-0000-0000-0000-000000000001'::uuid, 'dddddddd-0000-0000-0000-000000000001'::uuid, 'A FAZER', 0, 'primary'),
  ('eeeeeeee-0000-0000-0000-000000000002'::uuid, 'dddddddd-0000-0000-0000-000000000002'::uuid, 'A FAZER', 0, 'primary'),
  ('eeeeeeee-0000-0000-0000-000000000003'::uuid, 'dddddddd-0000-0000-0000-000000000003'::uuid, 'A FAZER', 0, 'primary');

-- Cards SEM client_id, criados por gestor_ads.
INSERT INTO public.kanban_cards (id, board_id, column_id, title, status, card_type, created_by)
VALUES
  ('ffffffff-0000-0000-0000-000000000001'::uuid, 'dddddddd-0000-0000-0000-000000000001'::uuid, 'eeeeeeee-0000-0000-0000-000000000001'::uuid, 'TST card editor-video', 'a_fazer', 'video',  'cccccccc-0000-0000-0000-000000000001'::uuid),
  ('ffffffff-0000-0000-0000-000000000002'::uuid, 'dddddddd-0000-0000-0000-000000000002'::uuid, 'eeeeeeee-0000-0000-0000-000000000002'::uuid, 'TST card design',       'a_fazer', 'design', 'cccccccc-0000-0000-0000-000000000001'::uuid),
  ('ffffffff-0000-0000-0000-000000000003'::uuid, 'dddddddd-0000-0000-0000-000000000003'::uuid, 'eeeeeeee-0000-0000-0000-000000000003'::uuid, 'TST card devs',         'a_fazer', 'dev',    'cccccccc-0000-0000-0000-000000000001'::uuid);

-- ====================================================================
-- gestor_ads (criador) ve cards em todos 3 boards de producao
-- ====================================================================
SELECT ok(public.can_view_card('cccccccc-0000-0000-0000-000000000001'::uuid, 'ffffffff-0000-0000-0000-000000000001'::uuid), 'gestor_ads ve card editor-video que ele criou');
SELECT ok(public.can_view_card('cccccccc-0000-0000-0000-000000000001'::uuid, 'ffffffff-0000-0000-0000-000000000002'::uuid), 'gestor_ads ve card design que ele criou');
SELECT ok(public.can_view_card('cccccccc-0000-0000-0000-000000000001'::uuid, 'ffffffff-0000-0000-0000-000000000003'::uuid), 'gestor_ads ve card devs que ele criou');

-- ====================================================================
-- editor_video (owner natural do board) ve card editor-video
-- ====================================================================
SELECT ok(public.can_view_card('cccccccc-0000-0000-0000-000000000002'::uuid, 'ffffffff-0000-0000-0000-000000000001'::uuid), 'editor_video ve card editor-video');

-- ====================================================================
-- editor_video tambem ve card design (page_grant declarado em ROLE_PAGE_MATRIX? NAO — bloqueia)
-- ====================================================================
-- Editor_video em ROLE_PAGE_MATRIX nao tem grant pra design.
-- Espera-se false (a menos que can_view_board permita por allowed_roles).
-- Aqui allowed_roles cobre editor_video, entao can_view_board=true.
-- can_view_card delega ao can_view_board pra board global de producao.
-- Logo editor_video VE.
SELECT ok(public.can_view_card('cccccccc-0000-0000-0000-000000000002'::uuid, 'ffffffff-0000-0000-0000-000000000002'::uuid), 'editor_video ve card design (allowed_roles permite)');

-- ====================================================================
-- devs (owner natural devs) ve card devs
-- ====================================================================
SELECT ok(public.can_view_card('cccccccc-0000-0000-0000-000000000003'::uuid, 'ffffffff-0000-0000-0000-000000000003'::uuid), 'devs ve card devs');

-- ====================================================================
-- can_view_card propaga ao can_view_board mesmo sem client_id
-- ====================================================================
SELECT ok(public.can_view_board('cccccccc-0000-0000-0000-000000000001'::uuid, 'dddddddd-0000-0000-0000-000000000001'::uuid), 'gestor_ads ve board editor-video');
SELECT ok(public.can_view_board('cccccccc-0000-0000-0000-000000000001'::uuid, 'dddddddd-0000-0000-0000-000000000002'::uuid), 'gestor_ads ve board design');
SELECT ok(public.can_view_board('cccccccc-0000-0000-0000-000000000001'::uuid, 'dddddddd-0000-0000-0000-000000000003'::uuid), 'gestor_ads ve board devs');

-- ====================================================================
-- Edge cases
-- ====================================================================
SELECT ok(NOT public.can_view_card('cccccccc-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-deadbeef0001'::uuid), 'card inexistente retorna false');
SELECT ok(NOT public.can_view_card('00000000-0000-0000-0000-deadbeef0099'::uuid, 'ffffffff-0000-0000-0000-000000000001'::uuid), 'user inexistente retorna false');

-- ====================================================================
-- admin (CEO) bypass funciona
-- ====================================================================
SELECT ok(
  public.can_view_card(
    (SELECT user_id FROM public.user_roles WHERE role='ceo' LIMIT 1),
    'ffffffff-0000-0000-0000-000000000001'::uuid
  ),
  'CEO ve qualquer card via is_admin bypass'
);

SELECT * FROM finish();

ROLLBACK;
