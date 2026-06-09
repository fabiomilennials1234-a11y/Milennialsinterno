-- supabase/tests/concessao_rls_test.sql
-- pgTAP — Slice #146 (Concessão). ADR 0009.
--
-- INVARIANTES DA RLS de public.concessoes:
--   SELECT escopado a quem VÊ o cliente (delegado a cliente.pode_ver_cliente —
--   fonte única de visibilidade do cliente, ADR 0005):
--     * admin (ceo) VÊ qualquer concessão (bypass A).
--     * usuário ENVOLVIDO no cliente (cliente.client_members) VÊ a concessão DESSE
--       cliente e NÃO vê a de OUTRO cliente (escopo por cliente — defesa de DADOS).
--     * papel sem acesso ao cliente NÃO vê NENHUMA (linha invisível).
--   ESCRITA contract-only (ADR 0004): authenticated NÃO tem grant de
--   INSERT/UPDATE/DELETE — escrita real só via RPC do módulo (slice futuro). As
--   policies de escrita (admin OR sucesso_cliente) existem versionadas/testáveis,
--   mas o GRANT direto é revogado: INSERT direto por authenticated FALHA com
--   insufficient_privilege (42501).
--
-- Provado via INTERFACE: SELECT/INSERT direto sob a role authenticated (RLS ativa).
-- Linhas de fixture criadas com RLS desligada (runner Management API roda como owner).
--
-- UUID prefix: 'cce50000'. Runner: scripts/sb-pgtap.sh supabase/tests/concessao_rls_test.sql
BEGIN;

SELECT plan(8);

CREATE OR REPLACE FUNCTION _ce_set(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_user_id,'role','authenticated')::text, true);
END;$$;

-- =============================================================================
-- 0. Pré-condição estrutural: RLS ligada, SEM policy USING(true), escrita revogada.
-- =============================================================================
SELECT is(
  (SELECT relrowsecurity::int FROM pg_class WHERE oid='public.concessoes'::regclass),
  1, 'concessoes: RLS habilitada');

SELECT is(
  (SELECT count(*)::int FROM pg_policies
     WHERE schemaname='public' AND tablename='concessoes' AND qual='true'),
  0, 'concessoes: NENHUMA policy com USING(true)');

-- Grant direto de escrita a authenticated NÃO existe (contract-only).
SELECT is(
  (SELECT count(*)::int FROM information_schema.role_table_grants
     WHERE table_schema='public' AND table_name='concessoes'
       AND grantee='authenticated'
       AND privilege_type IN ('INSERT','UPDATE','DELETE')),
  0, 'concessoes: authenticated SEM grant de INSERT/UPDATE/DELETE (escrita contract-only)');

-- =============================================================================
-- SEED
--   admin   : ceo (bypass A)
--   envolv  : editor_video, ENVOLVIDO em client_alvo (client_members) — sem page-grant
--   fora    : editor_video, NÃO envolvido em nada, sem page-grant — negativo
--   2 clientes, 2 concessões (1 por cliente). Criadas com RLS off.
-- =============================================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT u,'00000000-0000-0000-0000-000000000000'::uuid,u::text||'@m.test',crypt('t',gen_salt('bf')),'authenticated','authenticated',now(),now(),''
FROM (VALUES
  ('cce50000-0000-0000-0000-0000000000a1'::uuid),  -- admin/ceo
  ('cce50000-0000-0000-0000-0000000000a2'::uuid),  -- envolvido
  ('cce50000-0000-0000-0000-0000000000a3'::uuid)   -- fora
) AS t(u)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id,name,email) VALUES
 ('cce50000-0000-0000-0000-0000000000a1'::uuid,'CE Admin','cea1@m.test'),
 ('cce50000-0000-0000-0000-0000000000a2'::uuid,'CE Envolvido','cea2@m.test'),
 ('cce50000-0000-0000-0000-0000000000a3'::uuid,'CE Fora','cea3@m.test')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id,role) VALUES
 ('cce50000-0000-0000-0000-0000000000a1'::uuid,'ceo'),
 ('cce50000-0000-0000-0000-0000000000a2'::uuid,'editor_video'),
 ('cce50000-0000-0000-0000-0000000000a3'::uuid,'editor_video')
ON CONFLICT (user_id,role) DO NOTHING;

INSERT INTO public.clients (id,name) VALUES
 ('cce50000-0000-0000-0000-0000000c1000'::uuid,'CE Alvo'),
 ('cce50000-0000-0000-0000-0000000c2000'::uuid,'CE Outro')
ON CONFLICT (id) DO NOTHING;

-- Envolvimento: 'envolv' é membro SÓ de client_alvo (escopo por cliente).
INSERT INTO cliente.client_members (client_id, user_id, papel_no_cliente) VALUES
 ('cce50000-0000-0000-0000-0000000c1000'::uuid,'cce50000-0000-0000-0000-0000000000a2'::uuid,'editor')
ON CONFLICT (client_id, user_id, papel_no_cliente) DO NOTHING;

-- Concessões (1 por cliente). Criadas com RLS off (runner = owner).
INSERT INTO public.concessoes (id, client_id, product_slug, product_name, monthly_value, motivo, status, granted_by, granted_by_name)
VALUES
 ('cce50000-0000-0000-0000-00000000ce10'::uuid,'cce50000-0000-0000-0000-0000000c1000'::uuid,
  'torque-copilot','Torque Copilot', 0, 'risco_churn','ativa',
  'cce50000-0000-0000-0000-0000000000a1'::uuid,'CE Admin'),
 ('cce50000-0000-0000-0000-00000000ce20'::uuid,'cce50000-0000-0000-0000-0000000c2000'::uuid,
  'torque-copilot','Torque Copilot', 0, 'cortesia_estrategica','ativa',
  'cce50000-0000-0000-0000-0000000000a1'::uuid,'CE Admin')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 1. ADMIN (ceo) vê AMBAS as concessões (bypass A).
-- =============================================================================
SELECT _ce_set('cce50000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.concessoes
     WHERE id IN ('cce50000-0000-0000-0000-00000000ce10'::uuid,
                  'cce50000-0000-0000-0000-00000000ce20'::uuid)),
  2, 'admin (ceo) VÊ ambas as concessões (bypass)');

RESET ROLE;

-- =============================================================================
-- 2. ENVOLVIDO vê a concessão do SEU cliente, NÃO vê a do outro (escopo).
-- =============================================================================
SELECT _ce_set('cce50000-0000-0000-0000-0000000000a2'::uuid);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.concessoes
     WHERE id='cce50000-0000-0000-0000-00000000ce10'::uuid),
  1, 'envolvido VÊ a concessão do cliente que atende');

SELECT is(
  (SELECT count(*)::int FROM public.concessoes
     WHERE id='cce50000-0000-0000-0000-00000000ce20'::uuid),
  0, 'SEGURANÇA: envolvido NÃO vê concessão de OUTRO cliente (linha invisível, escopo por cliente)');

RESET ROLE;

-- =============================================================================
-- 3. FORA (sem envolvimento, sem page-grant) NÃO vê NENHUMA.
-- =============================================================================
SELECT _ce_set('cce50000-0000-0000-0000-0000000000a3'::uuid);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.concessoes
     WHERE id IN ('cce50000-0000-0000-0000-00000000ce10'::uuid,
                  'cce50000-0000-0000-0000-00000000ce20'::uuid)),
  0, 'SEGURANÇA: papel sem acesso ao cliente NÃO vê NENHUMA concessão');

-- =============================================================================
-- 4. ESCRITA contract-only: INSERT direto por authenticated FALHA (grant revogado).
--    Mesmo um admin (ceo) não tem grant DIRETO — escrita só via RPC futura.
-- =============================================================================
SELECT throws_ok($$
  INSERT INTO public.concessoes (client_id, product_slug, product_name, motivo, granted_by, granted_by_name)
  VALUES ('cce50000-0000-0000-0000-0000000c1000'::uuid,'x','X','risco_churn',
          'cce50000-0000-0000-0000-0000000000a3'::uuid,'CE Fora')
$$, '42501', NULL,
  'SEGURANÇA: INSERT direto por authenticated é barrado (grant de escrita revogado, contract-only)');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
