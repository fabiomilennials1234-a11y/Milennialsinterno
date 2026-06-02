-- supabase/tests/rls_reuniao_gravada_test.sql
--
-- pgTAP regression para Reunião Gravada v2 — Fase A.
-- Guarda contra reintrodução de RLS-off / USING(true) em:
--   recorded_meetings, meeting_folders, recording_sessions.
--
-- Migration guardada: 20260602100000_security_fix_reuniao_gravada_rls.sql
--
-- Cenário funcional: owner vê suas linhas; outro user não vê; anon vê 0.

BEGIN;

SELECT plan(18);

-- ============================================================
-- STRUCTURAL — RLS habilitado + sem policy permissiva
-- ============================================================

SELECT is(
  (SELECT count(*)::int FROM pg_class c
     JOIN pg_namespace n ON c.relnamespace=n.oid
     WHERE n.nspname='public'
       AND relname IN ('recorded_meetings','meeting_folders','recording_sessions')
       AND relrowsecurity=true),
  3,
  'RLS habilitado nas 3 tabelas de reunião gravada'
);

SELECT is(
  (SELECT count(*)::int FROM pg_policies
     WHERE tablename IN ('recorded_meetings','meeting_folders','recording_sessions')
       AND (qual='true' OR with_check='true')),
  0,
  'Nenhuma policy USING(true)/WITH CHECK(true) nas 3 tabelas'
);

SELECT is(
  (SELECT count(*)::int FROM pg_policies
     WHERE tablename IN ('recorded_meetings','meeting_folders','recording_sessions')
       AND roles::text LIKE '%public%'),
  0,
  'Nenhuma policy roles={public} nas 3 tabelas'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies
            WHERE tablename='recording_sessions' AND cmd='SELECT'
              AND qual LIKE '%created_by = auth.uid()%' AND qual LIKE '%is_admin%'),
  'recording_sessions SELECT: created_by=auth.uid() OR is_admin'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies
            WHERE tablename='meeting_folders' AND cmd='SELECT'
              AND qual LIKE '%created_by = auth.uid()%' AND qual LIKE '%is_admin%'),
  'meeting_folders SELECT: created_by=auth.uid() OR is_admin'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies
            WHERE tablename='recorded_meetings' AND cmd='SELECT'
              AND qual LIKE '%is_admin%' AND qual LIKE '%meeting_folders%'),
  'recorded_meetings SELECT: ownership via folder + is_admin'
);

-- ============================================================
-- FUNCTIONAL — seed 3 users: owner, other, admin(ceo)
-- ============================================================

INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES
  ('dddddddd-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'rg-owner@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('dddddddd-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'rg-other@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('dddddddd-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'rg-ceo@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email)
VALUES
  ('dddddddd-0000-0000-0000-000000000001'::uuid, 'Owner RG', 'rg-owner@test.local'),
  ('dddddddd-0000-0000-0000-000000000002'::uuid, 'Other RG', 'rg-other@test.local'),
  ('dddddddd-0000-0000-0000-000000000003'::uuid, 'CEO RG', 'rg-ceo@test.local')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('dddddddd-0000-0000-0000-000000000003'::uuid, 'ceo'::user_role)
ON CONFLICT (user_id, role) DO NOTHING;

-- Seed data owned by owner (bypass RLS via current superuser/service context).
INSERT INTO public.meeting_folders (id, name, created_by)
VALUES ('eeeeeeee-0000-0000-0000-0000000000f1'::uuid, 'Pasta do Owner', 'dddddddd-0000-0000-0000-000000000001'::uuid)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.recorded_meetings (id, folder_id, video_url, meeting_date, created_by)
VALUES ('eeeeeeee-0000-0000-0000-0000000000a1'::uuid,
        'eeeeeeee-0000-0000-0000-0000000000f1'::uuid,
        'https://example.com/v.webm', current_date,
        'dddddddd-0000-0000-0000-000000000001'::uuid)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.recording_sessions (id, created_by, title, folder_id, status, chunk_count, total_bytes, storage_prefix)
VALUES ('eeeeeeee-0000-0000-0000-0000000000c1'::uuid,
        'dddddddd-0000-0000-0000-000000000001'::uuid,
        'Sessão do Owner', 'eeeeeeee-0000-0000-0000-0000000000f1'::uuid,
        'recording', 0, 0, 'owner-prefix/')
ON CONFLICT (id) DO NOTHING;

-- --- OWNER vê suas linhas ---
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT is((SELECT count(*)::int FROM public.meeting_folders   WHERE id='eeeeeeee-0000-0000-0000-0000000000f1'::uuid), 1, 'OWNER vê sua folder');
SELECT is((SELECT count(*)::int FROM public.recorded_meetings WHERE id='eeeeeeee-0000-0000-0000-0000000000a1'::uuid), 1, 'OWNER vê sua reunião gravada');
SELECT is((SELECT count(*)::int FROM public.recording_sessions WHERE id='eeeeeeee-0000-0000-0000-0000000000c1'::uuid), 1, 'OWNER vê sua sessão');

-- --- OUTRO user NÃO vê ---
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"dddddddd-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT is((SELECT count(*)::int FROM public.meeting_folders   WHERE id='eeeeeeee-0000-0000-0000-0000000000f1'::uuid), 0, 'OUTRO não vê folder do owner');
SELECT is((SELECT count(*)::int FROM public.recorded_meetings WHERE id='eeeeeeee-0000-0000-0000-0000000000a1'::uuid), 0, 'OUTRO não vê reunião do owner');
SELECT is((SELECT count(*)::int FROM public.recording_sessions WHERE id='eeeeeeee-0000-0000-0000-0000000000c1'::uuid), 0, 'OUTRO não vê sessão do owner');

-- --- ADMIN (ceo) vê tudo ---
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"dddddddd-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT is((SELECT count(*)::int FROM public.meeting_folders   WHERE id='eeeeeeee-0000-0000-0000-0000000000f1'::uuid), 1, 'ADMIN vê folder de qualquer um');
SELECT is((SELECT count(*)::int FROM public.recorded_meetings WHERE id='eeeeeeee-0000-0000-0000-0000000000a1'::uuid), 1, 'ADMIN vê reunião de qualquer um');
SELECT is((SELECT count(*)::int FROM public.recording_sessions WHERE id='eeeeeeee-0000-0000-0000-0000000000c1'::uuid), 1, 'ADMIN vê sessão de qualquer um');

-- --- ANON vê 0 ---
RESET ROLE;
SET LOCAL ROLE anon;

SELECT is((SELECT count(*)::int FROM public.meeting_folders),   0, 'ANON vê 0 meeting_folders');
SELECT is((SELECT count(*)::int FROM public.recorded_meetings), 0, 'ANON vê 0 recorded_meetings');
SELECT is((SELECT count(*)::int FROM public.recording_sessions),0, 'ANON vê 0 recording_sessions');

SELECT * FROM finish();
ROLLBACK;
