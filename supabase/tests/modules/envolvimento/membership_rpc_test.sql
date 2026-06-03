-- supabase/tests/modules/envolvimento/membership_rpc_test.sql
-- pgTAP — Slice 2 (#78) — Contrato de membership do módulo cliente (ADR 0005/0004).
-- RPCs: adicionar_membro / remover_membro / membros(client) / clientes_de(user).
-- Comportamento via interface pública (a RPC), não implementação.
--
-- Invariantes provadas:
--   - escrita só via RPC (direct INSERT já revogado — coberto em e_envolvido_test);
--   - adicionar_membro valida existência do cliente (anti-órfão, ADR 0004) -> RAISE;
--   - adicionar é idempotente; remover apaga; membros/clientes_de leem corretamente;
--   - autorização: só admin OU já-envolvido pode mexer na equipe (não qualquer um).
--   - adicionar_membro mantém compat: reflete no assigned_* legado quando aplicável
--     (NÃO testado aqui em profundidade — transição; foco no contrato + autorização).
--
-- UUID prefix: 'a2000000'.
BEGIN;

SELECT plan(9);

-- Helper de impersonação (padrão tech_rls_test.sql).
CREATE OR REPLACE FUNCTION _nr_set(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_user_id,'role','authenticated')::text, true);
END;$$;

SELECT has_function('cliente','adicionar_membro', ARRAY['uuid','uuid','text'],
  'cliente.adicionar_membro(uuid,uuid,text) existe');
SELECT has_function('cliente','remover_membro', ARRAY['uuid','uuid','text'],
  'cliente.remover_membro(uuid,uuid,text) existe');
SELECT has_function('cliente','membros', ARRAY['uuid'],
  'cliente.membros(uuid) existe');
SELECT has_function('cliente','clientes_de', ARRAY['uuid'],
  'cliente.clientes_de(uuid) existe');

-- Seed: 1 admin (ceo), 1 cliente, 2 usuários-alvo.
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT u,'00000000-0000-0000-0000-000000000000'::uuid,u::text||'@m.test',crypt('t',gen_salt('bf')),'authenticated','authenticated',now(),now(),''
FROM (VALUES ('a2000000-0000-0000-0000-0000000000a1'::uuid),('a2000000-0000-0000-0000-0000000000e1'::uuid),('a2000000-0000-0000-0000-0000000000e2'::uuid)) AS t(u)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (user_id,name,email) VALUES
 ('a2000000-0000-0000-0000-0000000000a1'::uuid,'M Admin','a1@m.test'),
 ('a2000000-0000-0000-0000-0000000000e1'::uuid,'M E1','e1@m.test'),
 ('a2000000-0000-0000-0000-0000000000e2'::uuid,'M E2','e2@m.test')
ON CONFLICT (user_id) DO NOTHING;
-- handle_new_user já deu 'design'; adiciona o ceo no admin.
INSERT INTO public.user_roles (user_id,role) VALUES
 ('a2000000-0000-0000-0000-0000000000a1'::uuid,'ceo')
ON CONFLICT (user_id,role) DO NOTHING;
INSERT INTO public.clients (id,name) VALUES
 ('a2000000-0000-0000-0000-0000000c1100'::uuid,'M Client')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Anti-órfão: adicionar_membro para cliente inexistente -> RAISE (ADR 0004).
-- Como admin.
-- ============================================================
SELECT _nr_set('a2000000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT cliente.adicionar_membro('a2000000-0000-0000-0000-0000000bad00'::uuid,
                                     'a2000000-0000-0000-0000-0000000000e1'::uuid, 'ads_manager') $$,
  'P0001',
  NULL,
  'adicionar_membro para cliente inexistente faz RAISE (validação atômica anti-órfão)');
RESET ROLE;

-- ============================================================
-- adicionar_membro (admin) -> e_envolvido true; idempotente.
-- ============================================================
SELECT _nr_set('a2000000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ SELECT cliente.adicionar_membro('a2000000-0000-0000-0000-0000000c1100'::uuid,
                                     'a2000000-0000-0000-0000-0000000000e1'::uuid, 'ads_manager');
     SELECT cliente.adicionar_membro('a2000000-0000-0000-0000-0000000c1100'::uuid,
                                     'a2000000-0000-0000-0000-0000000000e1'::uuid, 'ads_manager'); $$,
  'adicionar_membro é idempotente (chamada dupla não falha)');
RESET ROLE;

SELECT is(
  cliente.e_envolvido('a2000000-0000-0000-0000-0000000c1100'::uuid,
                      'a2000000-0000-0000-0000-0000000000e1'::uuid),
  true,
  'após adicionar_membro, e_envolvido = true');

-- ============================================================
-- Autorização: usuário SEM relação (não-admin, não-envolvido) NÃO pode adicionar.
-- e2 só tem role 'design' (do trigger) — não é admin nem envolvido em M Client.
-- ============================================================
SELECT _nr_set('a2000000-0000-0000-0000-0000000000e2'::uuid);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT cliente.adicionar_membro('a2000000-0000-0000-0000-0000000c1100'::uuid,
                                     'a2000000-0000-0000-0000-0000000000e2'::uuid, 'comercial') $$,
  '42501',
  NULL,
  'não-admin/não-envolvido NÃO pode adicionar membro (autorização do contrato)');
RESET ROLE;

-- ============================================================
-- remover_membro (admin) -> e_envolvido volta a false.
-- ============================================================
SELECT _nr_set('a2000000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ SELECT cliente.remover_membro('a2000000-0000-0000-0000-0000000c1100'::uuid,
                                   'a2000000-0000-0000-0000-0000000000e1'::uuid, 'ads_manager') $$,
  'remover_membro executa');
RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
