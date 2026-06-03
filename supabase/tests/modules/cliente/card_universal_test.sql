-- supabase/tests/modules/cliente/card_universal_test.sql
-- pgTAP — Slice 1 (#77) — Card Universal de Cliente (LEITURA). ADR 0004/0005.
--
-- Prova o CONTRATO de leitura consolidada do cliente e seu gate de AUDIÊNCIA,
-- além do fechamento do furo de RLS de public.client_info_bank (SELECT que hoje
-- é USING(true) — qualquer authenticated lê qualquer cliente).
--
-- Invariantes provadas (via interface pública, não implementação):
--   ESTRUTURA
--     - cliente.pode_ver_cliente(uuid,uuid) existe e é SECURITY DEFINER;
--     - cliente.card_universal(uuid) existe e é SECURITY DEFINER.
--   PREDICADO DE VISIBILIDADE (mesmo conjunto da RLS de public.clients / ADR 0005)
--     - envolvido vê (true); não-envolvido não vê (false);
--     - admin vê (bypass A); page-grant 'cliente-list' vê (D).
--   CONTRATO card_universal — gate de audiência:
--     - envolvido recebe a linha (1 row) com os campos consolidados;
--     - não-envolvido recebe VAZIO (0 rows) — semântica "200+vazio" do #78;
--     - admin recebe a linha.
--   RLS de public.client_info_bank — o furo está fechado:
--     - SELECT direto por NÃO-envolvido em client_info_bank retorna 0 rows
--       (não vaza o banco do cliente alheio);
--     - SELECT direto por envolvido retorna a linha.
--
-- Runner: scripts/sb-pgtap.sh supabase/tests/modules/cliente/card_universal_test.sql
-- UUID prefix: 'ca000000' (card namespace; evita colisão com e0/a2).
BEGIN;

SELECT plan(14);

-- Helper de impersonação (padrão tech_rls_test.sql / membership_rpc_test.sql).
CREATE OR REPLACE FUNCTION _cu_set(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_user_id,'role','authenticated')::text, true);
END;$$;

-- =============================================================================
-- ESTRUTURA
-- =============================================================================
SELECT has_function('cliente','pode_ver_cliente', ARRAY['uuid','uuid'],
  'cliente.pode_ver_cliente(uuid,uuid) existe (predicado unificado de visibilidade do cliente)');
SELECT has_function('cliente','card_universal', ARRAY['uuid'],
  'cliente.card_universal(uuid) existe (contrato de leitura do Card Universal)');

SELECT is(
  (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='cliente' AND p.proname='pode_ver_cliente'),
  true, 'cliente.pode_ver_cliente é SECURITY DEFINER (hardening ADR 0004)');
SELECT is(
  (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='cliente' AND p.proname='card_universal'),
  true, 'cliente.card_universal é SECURITY DEFINER (hardening ADR 0004)');

-- =============================================================================
-- SEED — 1 admin(ceo), 1 cliente com info_bank, 1 envolvido, 1 estranho,
--        1 page-grant holder (não-envolvido).
-- =============================================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT u,'00000000-0000-0000-0000-000000000000'::uuid,u::text||'@cu.test',crypt('t',gen_salt('bf')),'authenticated','authenticated',now(),now(),''
FROM (VALUES
  ('ca000000-0000-0000-0000-0000000000a1'::uuid),  -- admin (ceo)
  ('ca000000-0000-0000-0000-0000000000e1'::uuid),  -- envolvido
  ('ca000000-0000-0000-0000-0000000000b0'::uuid),  -- estranho (só role design do trigger)
  ('ca000000-0000-0000-0000-0000000000d1'::uuid)   -- page-grant holder (cliente-list), não-envolvido
) AS t(u)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id,name,email) VALUES
 ('ca000000-0000-0000-0000-0000000000a1'::uuid,'CU Admin','a1@cu.test'),
 ('ca000000-0000-0000-0000-0000000000e1'::uuid,'CU Envolvido','e1@cu.test'),
 ('ca000000-0000-0000-0000-0000000000b0'::uuid,'CU Estranho','b0@cu.test'),
 ('ca000000-0000-0000-0000-0000000000d1'::uuid,'CU PageGrant','d1@cu.test')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id,role) VALUES
 ('ca000000-0000-0000-0000-0000000000a1'::uuid,'ceo')
ON CONFLICT (user_id,role) DO NOTHING;

INSERT INTO public.clients (id,name) VALUES
 ('ca000000-0000-0000-0000-0000000c1100'::uuid,'CU Client')
ON CONFLICT (id) DO NOTHING;

-- Card data (fonte única). created_by/updated_by = admin.
INSERT INTO public.client_info_bank (client_id, brand_colors, website_url, notes, created_by, updated_by)
VALUES ('ca000000-0000-0000-0000-0000000c1100'::uuid,
        '#FF0055', 'https://cu-client.test', 'nota confidencial do cliente',
        'ca000000-0000-0000-0000-0000000000a1'::uuid,
        'ca000000-0000-0000-0000-0000000000a1'::uuid)
ON CONFLICT (client_id) DO NOTHING;

-- Envolvido em CU Client.
INSERT INTO cliente.client_members (client_id, user_id, papel_no_cliente)
VALUES ('ca000000-0000-0000-0000-0000000c1100'::uuid,
        'ca000000-0000-0000-0000-0000000000e1'::uuid, 'ads_manager')
ON CONFLICT DO NOTHING;

-- Page-grant 'cliente-list' (não-sensível) ao holder — caminho (D), NÃO envolvimento.
INSERT INTO public.user_page_grants (user_id, page_slug, source, granted_by)
VALUES ('ca000000-0000-0000-0000-0000000000d1'::uuid, 'cliente-list', 'direct',
        'ca000000-0000-0000-0000-0000000000a1'::uuid)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- PREDICADO pode_ver_cliente — mesmo conjunto da RLS de public.clients
-- =============================================================================
SELECT is(cliente.pode_ver_cliente('ca000000-0000-0000-0000-0000000c1100'::uuid,
                                   'ca000000-0000-0000-0000-0000000000e1'::uuid),
  true, 'envolvido pode_ver_cliente = true (C)');
SELECT is(cliente.pode_ver_cliente('ca000000-0000-0000-0000-0000000c1100'::uuid,
                                   'ca000000-0000-0000-0000-0000000000b0'::uuid),
  false, 'estranho (não-envolvido, sem grant) pode_ver_cliente = false');
SELECT is(cliente.pode_ver_cliente('ca000000-0000-0000-0000-0000000c1100'::uuid,
                                   'ca000000-0000-0000-0000-0000000000a1'::uuid),
  true, 'admin pode_ver_cliente = true (bypass A)');
SELECT is(cliente.pode_ver_cliente('ca000000-0000-0000-0000-0000000c1100'::uuid,
                                   'ca000000-0000-0000-0000-0000000000d1'::uuid),
  true, 'page-grant cliente-list pode_ver_cliente = true (D)');

-- =============================================================================
-- CONTRATO card_universal — gate de audiência (impersonação real)
-- =============================================================================
-- Envolvido: recebe 1 linha com os dados consolidados.
SELECT _cu_set('ca000000-0000-0000-0000-0000000000e1'::uuid);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM cliente.card_universal('ca000000-0000-0000-0000-0000000c1100'::uuid)),
  1, 'envolvido recebe 1 linha do card_universal');
SELECT is(
  (SELECT website_url FROM cliente.card_universal('ca000000-0000-0000-0000-0000000c1100'::uuid)),
  'https://cu-client.test', 'card_universal entrega os campos consolidados (website_url)');
RESET ROLE;

-- Não-envolvido (estranho): recebe VAZIO (não erro) — semântica 200+vazio do #78.
SELECT _cu_set('ca000000-0000-0000-0000-0000000000b0'::uuid);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM cliente.card_universal('ca000000-0000-0000-0000-0000000c1100'::uuid)),
  0, 'não-envolvido recebe VAZIO do card_universal (gate de audiência)');
RESET ROLE;

-- Admin: recebe a linha (bypass A).
SELECT _cu_set('ca000000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM cliente.card_universal('ca000000-0000-0000-0000-0000000c1100'::uuid)),
  1, 'admin recebe 1 linha do card_universal (bypass A)');
RESET ROLE;

-- =============================================================================
-- RLS de public.client_info_bank — o furo (USING true) está FECHADO.
-- =============================================================================
-- Não-envolvido NÃO consegue ler client_info_bank direto (sem passar pela RPC).
SELECT _cu_set('ca000000-0000-0000-0000-0000000000b0'::uuid);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM public.client_info_bank
    WHERE client_id='ca000000-0000-0000-0000-0000000c1100'::uuid),
  0, 'SELECT direto em client_info_bank por NÃO-envolvido retorna 0 (RLS fechada)');
RESET ROLE;

-- Envolvido lê direto (RLS deixa passar quem pode ver o cliente).
SELECT _cu_set('ca000000-0000-0000-0000-0000000000e1'::uuid);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM public.client_info_bank
    WHERE client_id='ca000000-0000-0000-0000-0000000c1100'::uuid),
  1, 'SELECT direto em client_info_bank por envolvido retorna 1 (RLS permite quem vê o cliente)');
RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
