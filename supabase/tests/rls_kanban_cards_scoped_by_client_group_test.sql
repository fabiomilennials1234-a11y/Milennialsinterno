-- supabase/tests/rls_kanban_cards_scoped_by_client_group_test.sql
--
-- pgTAP regression test para RC4 fix + Opcao B.
-- Guarda contra:
--   - Reintroducao de policy PERMISSIVE `USING (true)` nas tabelas kanban_*.
--   - Mudanca em can_view_card() que quebre o escopo por client.group_id em
--     boards globais.
--   - Regressao em can_view_board() que ignore `allowed_roles` para boards
--     globais (usuarios nao-admin com role em allowed_roles perderiam o board).
--
-- Migrations guardadas:
--   - 20260423130000_fix_rls_leakage_kanban_remove_permissive_policies.sql
--   - 20260423131000_add_can_view_card_scoped_by_client_group.sql

BEGIN;

SELECT plan(12);

-- ============================================================
-- 0. Pre-condicao: nenhuma policy com USING(true) em kanban_*
-- ============================================================
SELECT is(
  (SELECT count(*)::int FROM pg_policies
     WHERE tablename IN ('kanban_boards','kanban_cards','kanban_columns')
       AND cmd = 'SELECT' AND qual = 'true'),
  0,
  'no SELECT policy with USING(true) exists on kanban_boards/cards/columns (RC4 guard)'
);

-- ============================================================
-- Seed: 2 grupos, 2 users consultor_comercial (um por grupo), 1 admin,
-- 2 clients (um por grupo) + 1 orfao sem client_id.
--
-- Usa IDs fixos determinativos com prefixo 'aaaaaaaa' pra nao colidir com
-- testes vizinhos (is_ceo usa 'bbbbbbbb').
-- ============================================================

-- Grupos
INSERT INTO public.organization_groups (id, slug, name)
VALUES
  ('aaaaaaaa-1111-0000-0000-000000000001'::uuid, 'test-grupo-a', 'Test Grupo A'),
  ('aaaaaaaa-1111-0000-0000-000000000002'::uuid, 'test-grupo-b', 'Test Grupo B')
ON CONFLICT (id) DO NOTHING;

-- Auth users
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES
  ('aaaaaaaa-2222-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'ceo-rc4@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('aaaaaaaa-2222-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'consultor-a@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('aaaaaaaa-2222-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'consultor-b@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('aaaaaaaa-2222-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'editor-a@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

-- Profiles (com group_id)
INSERT INTO public.profiles (user_id, name, email, group_id)
VALUES
  ('aaaaaaaa-2222-0000-0000-000000000001'::uuid, 'CEO RC4', 'ceo-rc4@test.local', NULL),
  ('aaaaaaaa-2222-0000-0000-000000000002'::uuid, 'Consultor A', 'consultor-a@test.local', 'aaaaaaaa-1111-0000-0000-000000000001'::uuid),
  ('aaaaaaaa-2222-0000-0000-000000000003'::uuid, 'Consultor B', 'consultor-b@test.local', 'aaaaaaaa-1111-0000-0000-000000000002'::uuid),
  ('aaaaaaaa-2222-0000-0000-000000000004'::uuid, 'Editor A', 'editor-a@test.local', 'aaaaaaaa-1111-0000-0000-000000000001'::uuid)
ON CONFLICT (user_id) DO NOTHING;

-- User roles
INSERT INTO public.user_roles (user_id, role)
VALUES
  ('aaaaaaaa-2222-0000-0000-000000000001'::uuid, 'ceo'),
  ('aaaaaaaa-2222-0000-0000-000000000002'::uuid, 'consultor_comercial'),
  ('aaaaaaaa-2222-0000-0000-000000000003'::uuid, 'consultor_comercial'),
  ('aaaaaaaa-2222-0000-0000-000000000004'::uuid, 'editor_video')
ON CONFLICT (user_id, role) DO NOTHING;

-- Clients (usa NULLs defensivos; schema clients tem muitos NOT NULL mas trigger
-- de create_client_cards roda on INSERT; driblamos usando ON CONFLICT se o
-- teste rodar 2x)
INSERT INTO public.clients (id, name, group_id, created_by)
VALUES
  ('aaaaaaaa-3333-0000-0000-000000000001'::uuid, 'Client A',
   'aaaaaaaa-1111-0000-0000-000000000001'::uuid,
   'aaaaaaaa-2222-0000-0000-000000000001'::uuid),
  ('aaaaaaaa-3333-0000-0000-000000000002'::uuid, 'Client B',
   'aaaaaaaa-1111-0000-0000-000000000002'::uuid,
   'aaaaaaaa-2222-0000-0000-000000000001'::uuid)
ON CONFLICT (id) DO NOTHING;

-- Board global de teste (simula 'comercial' com allowed_roles)
INSERT INTO public.kanban_boards (id, slug, name, allowed_roles)
VALUES
  ('aaaaaaaa-4444-0000-0000-000000000001'::uuid, 'test-comercial-rc4', 'Test Comercial RC4',
   ARRAY['consultor_comercial','gestor_ads']::text[])
ON CONFLICT (id) DO NOTHING;

-- Coluna
INSERT INTO public.kanban_columns (id, board_id, title, position)
VALUES
  ('aaaaaaaa-5555-0000-0000-000000000001'::uuid,
   'aaaaaaaa-4444-0000-0000-000000000001'::uuid, 'Novos', 0)
ON CONFLICT (id) DO NOTHING;

-- Cards: 1 do group A, 1 do group B, 1 orfao (client_id NULL)
INSERT INTO public.kanban_cards (id, board_id, column_id, title, position, client_id, created_by)
VALUES
  ('aaaaaaaa-6666-0000-0000-000000000001'::uuid,
   'aaaaaaaa-4444-0000-0000-000000000001'::uuid,
   'aaaaaaaa-5555-0000-0000-000000000001'::uuid,
   'Card Group A', 0,
   'aaaaaaaa-3333-0000-0000-000000000001'::uuid,
   'aaaaaaaa-2222-0000-0000-000000000001'::uuid),
  ('aaaaaaaa-6666-0000-0000-000000000002'::uuid,
   'aaaaaaaa-4444-0000-0000-000000000001'::uuid,
   'aaaaaaaa-5555-0000-0000-000000000001'::uuid,
   'Card Group B', 1,
   'aaaaaaaa-3333-0000-0000-000000000002'::uuid,
   'aaaaaaaa-2222-0000-0000-000000000001'::uuid),
  ('aaaaaaaa-6666-0000-0000-000000000003'::uuid,
   'aaaaaaaa-4444-0000-0000-000000000001'::uuid,
   'aaaaaaaa-5555-0000-0000-000000000001'::uuid,
   'Card Orfao', 2,
   NULL,
   'aaaaaaaa-2222-0000-0000-000000000001'::uuid)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 1. Admin (ceo) ve todos os 3 cards
-- ============================================================
SELECT ok(
  public.can_view_card('aaaaaaaa-2222-0000-0000-000000000001'::uuid, 'aaaaaaaa-6666-0000-0000-000000000001'::uuid),
  'CEO sees card group A'
);
SELECT ok(
  public.can_view_card('aaaaaaaa-2222-0000-0000-000000000001'::uuid, 'aaaaaaaa-6666-0000-0000-000000000002'::uuid),
  'CEO sees card group B'
);
SELECT ok(
  public.can_view_card('aaaaaaaa-2222-0000-0000-000000000001'::uuid, 'aaaaaaaa-6666-0000-0000-000000000003'::uuid),
  'CEO sees orphan card (admin bypass)'
);

-- ============================================================
-- 2. Consultor A (grupo A) ve so card A, nao ve B nem orfao
-- ============================================================
SELECT ok(
  public.can_view_card('aaaaaaaa-2222-0000-0000-000000000002'::uuid, 'aaaaaaaa-6666-0000-0000-000000000001'::uuid),
  'Consultor A sees own group card'
);
SELECT ok(
  NOT public.can_view_card('aaaaaaaa-2222-0000-0000-000000000002'::uuid, 'aaaaaaaa-6666-0000-0000-000000000002'::uuid),
  'Consultor A does NOT see other group card (scoped)'
);
SELECT ok(
  NOT public.can_view_card('aaaaaaaa-2222-0000-0000-000000000002'::uuid, 'aaaaaaaa-6666-0000-0000-000000000003'::uuid),
  'Consultor A does NOT see orphan card'
);

-- ============================================================
-- 3. Consultor B (grupo B) ve so card B
-- ============================================================
SELECT ok(
  public.can_view_card('aaaaaaaa-2222-0000-0000-000000000003'::uuid, 'aaaaaaaa-6666-0000-0000-000000000002'::uuid),
  'Consultor B sees own group card'
);
SELECT ok(
  NOT public.can_view_card('aaaaaaaa-2222-0000-0000-000000000003'::uuid, 'aaaaaaaa-6666-0000-0000-000000000001'::uuid),
  'Consultor B does NOT see other group card'
);

-- ============================================================
-- 4. Editor A (role nao em allowed_roles) nao ve nenhum card
-- ============================================================
SELECT ok(
  NOT public.can_view_card('aaaaaaaa-2222-0000-0000-000000000004'::uuid, 'aaaaaaaa-6666-0000-0000-000000000001'::uuid),
  'Editor (role not in allowed_roles) cannot see card even in own group'
);

-- ============================================================
-- 5. can_view_board: admin sempre, consultor com role, editor nunca
-- ============================================================
SELECT ok(
  public.can_view_board('aaaaaaaa-2222-0000-0000-000000000002'::uuid, 'aaaaaaaa-4444-0000-0000-000000000001'::uuid),
  'Consultor (role in allowed_roles) sees global board'
);
SELECT ok(
  NOT public.can_view_board('aaaaaaaa-2222-0000-0000-000000000004'::uuid, 'aaaaaaaa-4444-0000-0000-000000000001'::uuid),
  'Editor (role not in allowed_roles) does NOT see global board'
);

SELECT * FROM finish();

ROLLBACK;
