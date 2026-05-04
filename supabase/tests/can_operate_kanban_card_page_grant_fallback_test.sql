-- supabase/tests/can_operate_kanban_card_page_grant_fallback_test.sql
--
-- pgTAP: validates that can_operate_kanban_card respects page_grants
-- as fallback when role matrix does not match.
--
-- 5 scenarios x multiple actions = 13 asserts:
--   1. Admin (ceo) -> true regardless
--   2. Native role (editor_video on editor-video board) -> true via matrix
--   3. Non-matching role WITHOUT page_grant -> false
--   4. Non-matching role WITH page_grant -> true (the fix)
--   5. user_action_override granted=false overrides page_grant -> false

BEGIN;

SELECT plan(13);

-- ── Setup: users ──────────────────────────────────────────────────────────

-- CEO (admin)
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES ('ff000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'pgf-ceo@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email)
VALUES ('ff000000-0000-0000-0000-000000000001', 'PGF CEO', 'pgf-ceo@test.local')
ON CONFLICT (user_id) DO NOTHING;

DELETE FROM public.user_roles WHERE user_id = 'ff000000-0000-0000-0000-000000000001';
INSERT INTO public.user_roles (user_id, role)
VALUES ('ff000000-0000-0000-0000-000000000001', 'ceo'::public.user_role);

-- editor_video (native role)
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES ('ff000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'pgf-editor@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email)
VALUES ('ff000000-0000-0000-0000-000000000002', 'PGF Editor', 'pgf-editor@test.local')
ON CONFLICT (user_id) DO NOTHING;

DELETE FROM public.user_roles WHERE user_id = 'ff000000-0000-0000-0000-000000000002';
INSERT INTO public.user_roles (user_id, role)
VALUES ('ff000000-0000-0000-0000-000000000002', 'editor_video'::public.user_role);

-- consultor_comercial (non-matching role, will get page_grant)
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES ('ff000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'pgf-comercial@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email)
VALUES ('ff000000-0000-0000-0000-000000000003', 'PGF Comercial', 'pgf-comercial@test.local')
ON CONFLICT (user_id) DO NOTHING;

DELETE FROM public.user_roles WHERE user_id = 'ff000000-0000-0000-0000-000000000003';
INSERT INTO public.user_roles (user_id, role)
VALUES ('ff000000-0000-0000-0000-000000000003', 'consultor_comercial'::public.user_role);

-- rh (non-matching role, NO page_grant — control group)
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES ('ff000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'pgf-rh@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email)
VALUES ('ff000000-0000-0000-0000-000000000004', 'PGF RH', 'pgf-rh@test.local')
ON CONFLICT (user_id) DO NOTHING;

DELETE FROM public.user_roles WHERE user_id = 'ff000000-0000-0000-0000-000000000004';
INSERT INTO public.user_roles (user_id, role)
VALUES ('ff000000-0000-0000-0000-000000000004', 'rh'::public.user_role);

-- ── Setup: board ──────────────────────────────────────────────────────────

INSERT INTO public.kanban_boards (id, name, slug, page_slug, allowed_roles)
VALUES ('ff110000-0000-0000-0000-000000000001'::uuid, 'PGF editor-video', 'pgf-editor-video', 'editor-video', ARRAY[]::text[])
ON CONFLICT (id) DO NOTHING;

-- ── Setup: page_grants ────────────────────────────────────────────────────

-- Grant editor-video page to consultor_comercial user
INSERT INTO public.user_page_grants (user_id, page_slug, source, granted_by)
VALUES ('ff000000-0000-0000-0000-000000000003', 'editor-video', 'direct', 'ff000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Grant editor-video page to editor_video user (for can_view_board to work)
INSERT INTO public.user_page_grants (user_id, page_slug, source, granted_by)
VALUES ('ff000000-0000-0000-0000-000000000002', 'editor-video', 'direct', 'ff000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- NO grant for rh user — intentional

-- ── Setup: override (consultor_comercial denied 'delete' explicitly) ──────

INSERT INTO public.user_action_overrides (user_id, page_slug, action, granted, granted_by)
VALUES ('ff000000-0000-0000-0000-000000000003', 'editor-video', 'delete', false, 'ff000000-0000-0000-0000-000000000001')
ON CONFLICT (user_id, page_slug, action) DO UPDATE SET granted = false;

-- ====================================================================
-- Scenario 1: Admin (ceo) always passes
-- ====================================================================

SELECT ok(
  public.can_operate_kanban_card('ff000000-0000-0000-0000-000000000001'::uuid, 'ff110000-0000-0000-0000-000000000001'::uuid, 'create'),
  'admin (ceo) can create on editor-video board'
);

SELECT ok(
  public.can_operate_kanban_card('ff000000-0000-0000-0000-000000000001'::uuid, 'ff110000-0000-0000-0000-000000000001'::uuid, 'delete'),
  'admin (ceo) can delete on editor-video board'
);

-- ====================================================================
-- Scenario 2: Native role (editor_video) passes via matrix
-- ====================================================================

SELECT ok(
  public.can_operate_kanban_card('ff000000-0000-0000-0000-000000000002'::uuid, 'ff110000-0000-0000-0000-000000000001'::uuid, 'create'),
  'editor_video can create on editor-video board (native matrix)'
);

SELECT ok(
  public.can_operate_kanban_card('ff000000-0000-0000-0000-000000000002'::uuid, 'ff110000-0000-0000-0000-000000000001'::uuid, 'move'),
  'editor_video can move on editor-video board (native matrix)'
);

-- ====================================================================
-- Scenario 3: Non-matching role WITHOUT page_grant -> blocked
-- ====================================================================

SELECT ok(
  NOT public.can_operate_kanban_card('ff000000-0000-0000-0000-000000000004'::uuid, 'ff110000-0000-0000-0000-000000000001'::uuid, 'create'),
  'rh cannot create on editor-video board (no grant, no matrix match)'
);

SELECT ok(
  NOT public.can_operate_kanban_card('ff000000-0000-0000-0000-000000000004'::uuid, 'ff110000-0000-0000-0000-000000000001'::uuid, 'move'),
  'rh cannot move on editor-video board (no grant, no matrix match)'
);

-- ====================================================================
-- Scenario 4: Non-matching role WITH page_grant -> allowed (THE FIX)
-- ====================================================================

SELECT ok(
  public.can_operate_kanban_card('ff000000-0000-0000-0000-000000000003'::uuid, 'ff110000-0000-0000-0000-000000000001'::uuid, 'create'),
  'consultor_comercial WITH page_grant can create on editor-video (fallback)'
);

SELECT ok(
  public.can_operate_kanban_card('ff000000-0000-0000-0000-000000000003'::uuid, 'ff110000-0000-0000-0000-000000000001'::uuid, 'move'),
  'consultor_comercial WITH page_grant can move on editor-video (fallback)'
);

SELECT ok(
  public.can_operate_kanban_card('ff000000-0000-0000-0000-000000000003'::uuid, 'ff110000-0000-0000-0000-000000000001'::uuid, 'archive'),
  'consultor_comercial WITH page_grant can archive on editor-video (fallback)'
);

SELECT ok(
  public.can_operate_kanban_card('ff000000-0000-0000-0000-000000000003'::uuid, 'ff110000-0000-0000-0000-000000000001'::uuid, 'edit_briefing'),
  'consultor_comercial WITH page_grant can edit_briefing on editor-video (fallback)'
);

-- ====================================================================
-- Scenario 5: user_action_override granted=false overrides page_grant
-- ====================================================================

SELECT ok(
  NOT public.can_operate_kanban_card('ff000000-0000-0000-0000-000000000003'::uuid, 'ff110000-0000-0000-0000-000000000001'::uuid, 'delete'),
  'consultor_comercial WITH page_grant but override=false cannot delete (override wins)'
);

-- ====================================================================
-- Bonus: null/invalid inputs -> false
-- ====================================================================

SELECT ok(
  NOT public.can_operate_kanban_card(NULL, 'ff110000-0000-0000-0000-000000000001'::uuid, 'create'),
  'null user_id returns false'
);

SELECT ok(
  NOT public.can_operate_kanban_card('ff000000-0000-0000-0000-000000000003'::uuid, NULL, 'create'),
  'null board_id returns false'
);

SELECT * FROM finish();

ROLLBACK;
