-- supabase/tests/visao_total_page_grants_kanban_core_test.sql
--
-- pgTAP regression: visao TOTAL via page_grant em kanban core.
--
-- Cenario: gestor_ads sem role default editor-video, mas COM page_grant para
-- editor-video, deve enxergar boards/columns/cards do board editor-video.
--
-- Cobertura: 6 papeis nao-owners x 5 page_slugs de producao = 30 asserts.
-- Cada papel ganha grant explicito ao slug e deve ver:
--   - kanban_boards do slug
--   - kanban_columns do board
--   - kanban_cards do board (sem client_id)

BEGIN;

SELECT plan(30);

-- 6 users nao-owners de boards de producao.
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES
  ('eeee0000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'vt-ads@test.local',     crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('eeee0000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'vt-financeiro@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('eeee0000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'vt-rh@test.local',      crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('eeee0000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'vt-comercial@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('eeee0000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'vt-mktplace@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('eeee0000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'vt-crm@test.local',     crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email)
VALUES
  ('eeee0000-0000-0000-0000-000000000001', 'VT Ads',          'vt-ads@test.local'),
  ('eeee0000-0000-0000-0000-000000000002', 'VT Financeiro',   'vt-financeiro@test.local'),
  ('eeee0000-0000-0000-0000-000000000003', 'VT RH',           'vt-rh@test.local'),
  ('eeee0000-0000-0000-0000-000000000004', 'VT Comercial',    'vt-comercial@test.local'),
  ('eeee0000-0000-0000-0000-000000000005', 'VT Mktplace',     'vt-mktplace@test.local'),
  ('eeee0000-0000-0000-0000-000000000006', 'VT CRM',          'vt-crm@test.local')
ON CONFLICT (user_id) DO NOTHING;

DELETE FROM public.user_roles WHERE user_id IN (
  'eeee0000-0000-0000-0000-000000000001',
  'eeee0000-0000-0000-0000-000000000002',
  'eeee0000-0000-0000-0000-000000000003',
  'eeee0000-0000-0000-0000-000000000004',
  'eeee0000-0000-0000-0000-000000000005',
  'eeee0000-0000-0000-0000-000000000006'
);

INSERT INTO public.user_roles (user_id, role) VALUES
  ('eeee0000-0000-0000-0000-000000000001', 'gestor_ads'::public.user_role),
  ('eeee0000-0000-0000-0000-000000000002', 'financeiro'::public.user_role),
  ('eeee0000-0000-0000-0000-000000000003', 'rh'::public.user_role),
  ('eeee0000-0000-0000-0000-000000000004', 'consultor_comercial'::public.user_role),
  ('eeee0000-0000-0000-0000-000000000005', 'consultor_mktplace'::public.user_role),
  ('eeee0000-0000-0000-0000-000000000006', 'gestor_crm'::public.user_role);

-- Setup boards de producao (5 page_slugs).
-- allowed_roles VAZIO; visao depende EXCLUSIVAMENTE de page_grant + role default.
INSERT INTO public.kanban_boards (id, name, slug, page_slug, allowed_roles)
VALUES
  ('aabb0000-0000-0000-0000-000000000001'::uuid, 'VT design',           'vt-design',           'design',           ARRAY[]::text[]),
  ('aabb0000-0000-0000-0000-000000000002'::uuid, 'VT editor-video',     'vt-editor-video',     'editor-video',     ARRAY[]::text[]),
  ('aabb0000-0000-0000-0000-000000000003'::uuid, 'VT devs',             'vt-devs',             'devs',             ARRAY[]::text[]),
  ('aabb0000-0000-0000-0000-000000000004'::uuid, 'VT atrizes',          'vt-atrizes',          'atrizes-gravacao', ARRAY[]::text[]),
  ('aabb0000-0000-0000-0000-000000000005'::uuid, 'VT produtora',        'vt-produtora',        'produtora',        ARRAY[]::text[]);

INSERT INTO public.kanban_columns (id, board_id, title, position, color)
VALUES
  ('aacc0000-0000-0000-0000-000000000001'::uuid, 'aabb0000-0000-0000-0000-000000000001'::uuid, 'A FAZER', 0, 'primary'),
  ('aacc0000-0000-0000-0000-000000000002'::uuid, 'aabb0000-0000-0000-0000-000000000002'::uuid, 'A FAZER', 0, 'primary'),
  ('aacc0000-0000-0000-0000-000000000003'::uuid, 'aabb0000-0000-0000-0000-000000000003'::uuid, 'A FAZER', 0, 'primary'),
  ('aacc0000-0000-0000-0000-000000000004'::uuid, 'aabb0000-0000-0000-0000-000000000004'::uuid, 'A FAZER', 0, 'primary'),
  ('aacc0000-0000-0000-0000-000000000005'::uuid, 'aabb0000-0000-0000-0000-000000000005'::uuid, 'A FAZER', 0, 'primary');

INSERT INTO public.kanban_cards (id, board_id, column_id, title, status, card_type)
VALUES
  ('aadd0000-0000-0000-0000-000000000001'::uuid, 'aabb0000-0000-0000-0000-000000000001'::uuid, 'aacc0000-0000-0000-0000-000000000001'::uuid, 'VT card design',       'a_fazer', 'design'),
  ('aadd0000-0000-0000-0000-000000000002'::uuid, 'aabb0000-0000-0000-0000-000000000002'::uuid, 'aacc0000-0000-0000-0000-000000000002'::uuid, 'VT card editor-video', 'a_fazer', 'video'),
  ('aadd0000-0000-0000-0000-000000000003'::uuid, 'aabb0000-0000-0000-0000-000000000003'::uuid, 'aacc0000-0000-0000-0000-000000000003'::uuid, 'VT card devs',         'a_fazer', 'dev'),
  ('aadd0000-0000-0000-0000-000000000004'::uuid, 'aabb0000-0000-0000-0000-000000000004'::uuid, 'aacc0000-0000-0000-0000-000000000004'::uuid, 'VT card atrizes',      'a_fazer', 'atrizes'),
  ('aadd0000-0000-0000-0000-000000000005'::uuid, 'aabb0000-0000-0000-0000-000000000005'::uuid, 'aacc0000-0000-0000-0000-000000000005'::uuid, 'VT card produtora',    'a_fazer', 'produtora');

-- Concede page_grant: cada user ganha grant a TODOS os 5 slugs.
-- Active = revoked_at IS NULL (sem coluna `active` na tabela).
INSERT INTO public.user_page_grants (user_id, page_slug, source, granted_by)
SELECT u.user_id, p.slug, 'direct', (SELECT user_id FROM public.user_roles WHERE role='ceo' LIMIT 1)
FROM (VALUES
  ('eeee0000-0000-0000-0000-000000000001'::uuid),
  ('eeee0000-0000-0000-0000-000000000002'::uuid),
  ('eeee0000-0000-0000-0000-000000000003'::uuid),
  ('eeee0000-0000-0000-0000-000000000004'::uuid),
  ('eeee0000-0000-0000-0000-000000000005'::uuid),
  ('eeee0000-0000-0000-0000-000000000006'::uuid)
) AS u(user_id)
CROSS JOIN (VALUES ('design'),('editor-video'),('devs'),('atrizes-gravacao'),('produtora')) AS p(slug);

-- ====================================================================
-- 6 papeis x 5 boards = 30 asserts: cada user ve cada card via grant
-- ====================================================================

-- gestor_ads
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000001'::uuid, 'aadd0000-0000-0000-0000-000000000001'::uuid), 'gestor_ads ve card design via grant');
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000001'::uuid, 'aadd0000-0000-0000-0000-000000000002'::uuid), 'gestor_ads ve card editor-video via grant');
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000001'::uuid, 'aadd0000-0000-0000-0000-000000000003'::uuid), 'gestor_ads ve card devs via grant');
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000001'::uuid, 'aadd0000-0000-0000-0000-000000000004'::uuid), 'gestor_ads ve card atrizes via grant');
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000001'::uuid, 'aadd0000-0000-0000-0000-000000000005'::uuid), 'gestor_ads ve card produtora via grant');

-- financeiro
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000002'::uuid, 'aadd0000-0000-0000-0000-000000000001'::uuid), 'financeiro ve card design via grant');
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000002'::uuid, 'aadd0000-0000-0000-0000-000000000002'::uuid), 'financeiro ve card editor-video via grant');
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000002'::uuid, 'aadd0000-0000-0000-0000-000000000003'::uuid), 'financeiro ve card devs via grant');
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000002'::uuid, 'aadd0000-0000-0000-0000-000000000004'::uuid), 'financeiro ve card atrizes via grant');
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000002'::uuid, 'aadd0000-0000-0000-0000-000000000005'::uuid), 'financeiro ve card produtora via grant');

-- rh
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000003'::uuid, 'aadd0000-0000-0000-0000-000000000001'::uuid), 'rh ve card design via grant');
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000003'::uuid, 'aadd0000-0000-0000-0000-000000000002'::uuid), 'rh ve card editor-video via grant');
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000003'::uuid, 'aadd0000-0000-0000-0000-000000000003'::uuid), 'rh ve card devs via grant');
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000003'::uuid, 'aadd0000-0000-0000-0000-000000000004'::uuid), 'rh ve card atrizes via grant');
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000003'::uuid, 'aadd0000-0000-0000-0000-000000000005'::uuid), 'rh ve card produtora via grant');

-- consultor_comercial
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000004'::uuid, 'aadd0000-0000-0000-0000-000000000001'::uuid), 'consultor_comercial ve card design via grant');
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000004'::uuid, 'aadd0000-0000-0000-0000-000000000002'::uuid), 'consultor_comercial ve card editor-video via grant');
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000004'::uuid, 'aadd0000-0000-0000-0000-000000000003'::uuid), 'consultor_comercial ve card devs via grant');
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000004'::uuid, 'aadd0000-0000-0000-0000-000000000004'::uuid), 'consultor_comercial ve card atrizes via grant');
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000004'::uuid, 'aadd0000-0000-0000-0000-000000000005'::uuid), 'consultor_comercial ve card produtora via grant');

-- consultor_mktplace
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000005'::uuid, 'aadd0000-0000-0000-0000-000000000001'::uuid), 'consultor_mktplace ve card design via grant');
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000005'::uuid, 'aadd0000-0000-0000-0000-000000000002'::uuid), 'consultor_mktplace ve card editor-video via grant');
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000005'::uuid, 'aadd0000-0000-0000-0000-000000000003'::uuid), 'consultor_mktplace ve card devs via grant');
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000005'::uuid, 'aadd0000-0000-0000-0000-000000000004'::uuid), 'consultor_mktplace ve card atrizes via grant');
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000005'::uuid, 'aadd0000-0000-0000-0000-000000000005'::uuid), 'consultor_mktplace ve card produtora via grant');

-- gestor_crm
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000006'::uuid, 'aadd0000-0000-0000-0000-000000000001'::uuid), 'gestor_crm ve card design via grant');
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000006'::uuid, 'aadd0000-0000-0000-0000-000000000002'::uuid), 'gestor_crm ve card editor-video via grant');
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000006'::uuid, 'aadd0000-0000-0000-0000-000000000003'::uuid), 'gestor_crm ve card devs via grant');
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000006'::uuid, 'aadd0000-0000-0000-0000-000000000004'::uuid), 'gestor_crm ve card atrizes via grant');
SELECT ok(public.can_view_card('eeee0000-0000-0000-0000-000000000006'::uuid, 'aadd0000-0000-0000-0000-000000000005'::uuid), 'gestor_crm ve card produtora via grant');

SELECT * FROM finish();

ROLLBACK;
