-- supabase/tests/user_page_grants_test.sql
-- pgTAP coverage para o modelo unificado de acesso a páginas
-- (migration 20260420170000_user_page_grants.sql).
--
-- Guarda contra:
--  - regressão de has_page_access() (bypass admin, expiração, revogação, NULL)
--  - policies frouxas em user_page_grants (select/insert/update/delete)
--  - grant_pages() sendo chamável por não-admin
--  - DELETE indireto em user_page_grants (auditoria quebraria)
--  - grants em slug fantasma (FK app_pages)
--  - constraint de consistência do par revoked_at/revoked_by
--
-- Padrão: BEGIN; plan(N); ... ROLLBACK; (alinhado com outros testes do projeto)
-- Helper _test_set_auth copia o padrão de tech_rpcs_test.sql / tech_rls_test.sql.

BEGIN;

SELECT plan(20);

-- ============================================================
-- Helper: simula auth.uid() sem trocar role (pgTAP precisa de extensions)
-- ============================================================
CREATE OR REPLACE FUNCTION _upg_set_auth(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', _user_id, 'role', 'authenticated')::text,
    true
  );
END;
$$;

-- ============================================================
-- Seed: 4 usuários com papéis distintos
-- ============================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES
  ('cccccccc-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'upg-ceo@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('cccccccc-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'upg-admin-gp@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('cccccccc-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'upg-design@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('cccccccc-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'upg-devs@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email)
VALUES
  ('cccccccc-0000-0000-0000-000000000001'::uuid, 'UPG CEO', 'upg-ceo@test.local'),
  ('cccccccc-0000-0000-0000-000000000002'::uuid, 'UPG GP',  'upg-admin-gp@test.local'),
  ('cccccccc-0000-0000-0000-000000000003'::uuid, 'UPG Design', 'upg-design@test.local'),
  ('cccccccc-0000-0000-0000-000000000004'::uuid, 'UPG Dev', 'upg-devs@test.local')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES
  ('cccccccc-0000-0000-0000-000000000001'::uuid, 'ceo'),
  ('cccccccc-0000-0000-0000-000000000002'::uuid, 'gestor_projetos'),
  ('cccccccc-0000-0000-0000-000000000003'::uuid, 'design'),
  ('cccccccc-0000-0000-0000-000000000004'::uuid, 'devs')
ON CONFLICT (user_id, role) DO NOTHING;

-- app_pages já vem populado pela migration. Defensivo caso o teste rode solto.
INSERT INTO public.app_pages (slug, label, route, category) VALUES
  ('design',         'Design PRO+',      '/kanban/design',  'board'),
  ('devs',           'Dev PRO+',         '/kanban/devs',    'board'),
  ('financeiro',     'Financeiro PRO+',  '/financeiro',     'page'),
  ('mtech',          'MTech',            '/milennials-tech','feature')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Bloco 1 — has_page_access(): bypass admin, NULL, grant ausente
-- ============================================================

SELECT ok(
  public.has_page_access('cccccccc-0000-0000-0000-000000000001'::uuid, 'financeiro'),
  'has_page_access: CEO bypass mesmo sem grant explícito'
);

SELECT ok(
  public.has_page_access('cccccccc-0000-0000-0000-000000000002'::uuid, 'financeiro'),
  'has_page_access: gestor_projetos bypass (is_admin)'
);

SELECT ok(
  NOT public.has_page_access('cccccccc-0000-0000-0000-000000000003'::uuid, 'financeiro'),
  'has_page_access: design SEM grant → false'
);

SELECT ok(
  NOT public.has_page_access(NULL, 'financeiro'),
  'has_page_access: caller NULL → false (não vaza)'
);

-- ============================================================
-- Bloco 2 — grant ativo, expirado, revogado
-- ============================================================

-- Caller = CEO → grant_pages() passa pela checagem de is_admin
SELECT _upg_set_auth('cccccccc-0000-0000-0000-000000000001'::uuid);

-- Grant ativo (retorno descartado)
SELECT public.grant_pages(
  'cccccccc-0000-0000-0000-000000000003'::uuid,
  ARRAY['financeiro'],
  'direct',
  NULL,
  NULL,
  'teste grant ativo'
);

SELECT ok(
  public.has_page_access('cccccccc-0000-0000-0000-000000000003'::uuid, 'financeiro'),
  'grant ativo libera acesso'
);

-- Grant com expires_at no passado
SELECT public.grant_pages(
  'cccccccc-0000-0000-0000-000000000003'::uuid,
  ARRAY['devs'],
  'direct',
  NULL,
  now() - interval '1 day',
  'teste grant expirado'
);

SELECT ok(
  NOT public.has_page_access('cccccccc-0000-0000-0000-000000000003'::uuid, 'devs'),
  'grant expirado NÃO libera acesso'
);

-- Revogar grant ativo
SELECT public.revoke_page(
  'cccccccc-0000-0000-0000-000000000003'::uuid,
  'financeiro',
  'revoke em teste'
);

SELECT ok(
  NOT public.has_page_access('cccccccc-0000-0000-0000-000000000003'::uuid, 'financeiro'),
  'grant revogado NÃO libera acesso'
);

-- ============================================================
-- Bloco 3 — idempotência e re-grant reativa
-- ============================================================

-- Re-grant após revoke deve REATIVAR a mesma linha (zera revoked_at)
SELECT public.grant_pages(
  'cccccccc-0000-0000-0000-000000000003'::uuid,
  ARRAY['financeiro'],
  'direct',
  NULL,
  NULL,
  'reativado'
);

SELECT ok(
  public.has_page_access('cccccccc-0000-0000-0000-000000000003'::uuid, 'financeiro'),
  're-grant pós-revoke reativa (revoked_at = NULL)'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.user_page_grants
   WHERE user_id = 'cccccccc-0000-0000-0000-000000000003'::uuid
     AND page_slug = 'financeiro'
     AND source = 'direct'
     AND source_ref IS NULL),
  1,
  'idempotência: apenas 1 linha apesar de grant + revoke + grant'
);

-- ============================================================
-- Bloco 4 — get_my_page_access()
-- ============================================================

-- Caller = CEO: grant direto não existe, função retorna apenas linhas do caller.
SELECT is(
  (SELECT cardinality(public.get_my_page_access())),
  0,
  'get_my_page_access: CEO sem grants diretos retorna array vazio (bypass admin é à parte)'
);

-- Caller = design: tem grant ativo em 'financeiro' e grant expirado em 'devs'
SELECT _upg_set_auth('cccccccc-0000-0000-0000-000000000003'::uuid);

SELECT ok(
  'financeiro' = ANY(public.get_my_page_access()),
  'get_my_page_access: design vê financeiro ativo'
);

SELECT ok(
  NOT ('devs' = ANY(public.get_my_page_access())),
  'get_my_page_access: design NÃO vê grant expirado'
);

-- ============================================================
-- Bloco 5 — RPCs guardadas por is_admin
-- ============================================================

-- Caller = design (não-admin)
SELECT _upg_set_auth('cccccccc-0000-0000-0000-000000000003'::uuid);

SELECT throws_ok(
  $$ SELECT public.grant_pages(
       'cccccccc-0000-0000-0000-000000000004'::uuid,
       ARRAY['devs'],
       'direct',
       NULL,
       NULL,
       'não deveria passar'
     ) $$,
  '42501',
  'not authorized',
  'grant_pages: não-admin recebe 42501'
);

SELECT throws_ok(
  $$ SELECT public.revoke_page(
       'cccccccc-0000-0000-0000-000000000003'::uuid,
       'financeiro',
       NULL
     ) $$,
  '42501',
  'not authorized',
  'revoke_page: não-admin recebe 42501'
);

-- Slug fantasma: CEO chamando deve falhar com 23503
SELECT _upg_set_auth('cccccccc-0000-0000-0000-000000000001'::uuid);

SELECT throws_ok(
  $$ SELECT public.grant_pages(
       'cccccccc-0000-0000-0000-000000000003'::uuid,
       ARRAY['pagina-fantasma-xyz'],
       'direct',
       NULL,
       NULL,
       NULL
     ) $$,
  '23503',
  NULL,
  'grant_pages: rejeita slug inexistente em app_pages'
);

-- ============================================================
-- Bloco 6 — RLS: SELECT próprio vs admin
-- ============================================================
-- pgTAP roda como superuser por default (dono do schema), então RLS não aplica.
-- Para testar a policy, trocamos role para authenticated.
-- Observação: assim que saímos de authenticated, pgTAP volta.

-- Design como authenticated: NÃO vê grants de devs
SET LOCAL ROLE authenticated;
SELECT _upg_set_auth('cccccccc-0000-0000-0000-000000000003'::uuid);

SELECT is(
  (SELECT COUNT(*)::int FROM public.user_page_grants
   WHERE user_id = 'cccccccc-0000-0000-0000-000000000004'::uuid),
  0,
  'RLS: usuário comum NÃO vê grants de terceiros'
);

-- CEO como authenticated: vê grants de todos
SELECT _upg_set_auth('cccccccc-0000-0000-0000-000000000001'::uuid);

SELECT cmp_ok(
  (SELECT COUNT(*)::int FROM public.user_page_grants
   WHERE user_id = 'cccccccc-0000-0000-0000-000000000003'::uuid),
  '>=',
  1,
  'RLS: admin vê grants de terceiros'
);

-- ============================================================
-- Bloco 7 — DELETE proibido (auditoria)
-- ============================================================
-- policy FOR DELETE USING(false) → comando executa mas 0 linhas afetadas.
-- CEO mesmo não consegue. Linha sobrevive.

WITH del AS (
  DELETE FROM public.user_page_grants
  WHERE user_id = 'cccccccc-0000-0000-0000-000000000003'::uuid
    AND page_slug = 'financeiro'
  RETURNING 1
)
SELECT is(
  (SELECT COUNT(*)::int FROM del),
  0,
  'RLS: DELETE em user_page_grants não afeta linha alguma (auditoria preservada)'
);

SELECT cmp_ok(
  (SELECT COUNT(*)::int FROM public.user_page_grants
   WHERE user_id = 'cccccccc-0000-0000-0000-000000000003'::uuid
     AND page_slug = 'financeiro'),
  '>=',
  1,
  'Grant original sobrevive à tentativa de DELETE'
);

-- Volta para role superuser default (pgTAP)
RESET ROLE;

-- ============================================================
-- Bloco 8 — constraint de consistência revoked_at/revoked_by
-- ============================================================

SELECT throws_ok(
  $$ INSERT INTO public.user_page_grants
       (user_id, page_slug, source, granted_by, revoked_at, revoked_by)
     VALUES
       ('cccccccc-0000-0000-0000-000000000004'::uuid,
        'design', 'direct',
        'cccccccc-0000-0000-0000-000000000001'::uuid,
        now(), NULL) $$,
  '23514',
  NULL,
  'CHECK: revoked_at sem revoked_by é rejeitado'
);

-- ============================================================
-- Finish
-- ============================================================

SELECT * FROM finish();

ROLLBACK;
