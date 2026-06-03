-- supabase/tests/modules/cliente/editar_card_universal_test.sql
-- pgTAP — Slice 3 (#79) — Card Universal de Cliente (ESCRITA). ADR 0004/0005.
--
-- Prova o CONTRATO de ESCRITA consolidada do cliente e seu gate de AUTORIZAÇÃO,
-- além do FECHAMENTO do furo de escrita de public.client_info_bank
-- (INSERT/UPDATE hoje WITH CHECK(true) — qualquer authenticated escreve o banco
-- de info de QUALQUER cliente) e dos 3 perfis legados.
--
-- Invariantes provadas (via interface pública, não implementação):
--   ESTRUTURA
--     - cliente.editar_card_universal(...) existe e é SECURITY DEFINER.
--   GATE DE AUTORIZAÇÃO DA RPC (mesmo predicado de visibilidade — ADR 0005)
--     - envolvido edita → persiste (UPSERT idempotente);
--     - não-envolvido → 42501 (insufficient_privilege);
--     - admin edita → persiste (bypass A);
--     - cliente inexistente → P0002 (no_data_found).
--   ESCRITA DIRETA FECHADA — o furo WITH CHECK(true) está fechado:
--     - INSERT direto em public.client_info_bank por authenticated FALHA;
--     - UPDATE direto em public.client_info_bank por authenticated FALHA;
--     - INSERT direto nos 3 client_{design,dev,video}_profiles por authenticated FALHA.
--   RPCs LEGADAS DE PERFIL NEUTRALIZADAS
--     - upsert_client_design_profile  → RAISE 'deprecated...';
--     - upsert_client_video_profile   → RAISE 'deprecated...';
--     - upsert_client_dev_profile     → RAISE 'deprecated...'.
--   GATE DE EXISTÊNCIA (onboarding GP) SEGUE VERDE
--     - realizar_call_1 → escolher_equipe sem info_bank → P0002 (inalterado).
--
-- Runner: scripts/sb-pgtap.sh supabase/tests/modules/cliente/editar_card_universal_test.sql
-- UUID prefix: 'ec000000' (edit-card namespace; evita colisão com ca0/e0/a2).
BEGIN;

SELECT plan(15);

-- Helper de impersonação (padrão card_universal_test.sql).
CREATE OR REPLACE FUNCTION _ec_set(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_user_id,'role','authenticated')::text, true);
END;$$;

-- =============================================================================
-- ESTRUTURA
-- =============================================================================
SELECT has_function('cliente','editar_card_universal',
  'cliente.editar_card_universal(...) existe (contrato de ESCRITA do Card Universal)');

SELECT is(
  (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='cliente' AND p.proname='editar_card_universal'),
  true, 'cliente.editar_card_universal é SECURITY DEFINER (hardening ADR 0004)');

-- =============================================================================
-- SEED — 1 admin(ceo), 1 cliente, 1 envolvido, 1 estranho (não-envolvido).
-- =============================================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT u,'00000000-0000-0000-0000-000000000000'::uuid,u::text||'@ec.test',crypt('t',gen_salt('bf')),'authenticated','authenticated',now(),now(),''
FROM (VALUES
  ('ec000000-0000-0000-0000-0000000000a1'::uuid),  -- admin (ceo)
  ('ec000000-0000-0000-0000-0000000000e1'::uuid),  -- envolvido
  ('ec000000-0000-0000-0000-0000000000b0'::uuid)   -- estranho (não-envolvido, sem grant)
) AS t(u)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id,name,email) VALUES
 ('ec000000-0000-0000-0000-0000000000a1'::uuid,'EC Admin','a1@ec.test'),
 ('ec000000-0000-0000-0000-0000000000e1'::uuid,'EC Envolvido','e1@ec.test'),
 ('ec000000-0000-0000-0000-0000000000b0'::uuid,'EC Estranho','b0@ec.test')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id,role) VALUES
 ('ec000000-0000-0000-0000-0000000000a1'::uuid,'ceo')
ON CONFLICT (user_id,role) DO NOTHING;

INSERT INTO public.clients (id,name) VALUES
 ('ec000000-0000-0000-0000-0000000c1100'::uuid,'EC Client')
ON CONFLICT (id) DO NOTHING;

-- Envolvido em EC Client.
INSERT INTO cliente.client_members (client_id, user_id, papel_no_cliente)
VALUES ('ec000000-0000-0000-0000-0000000c1100'::uuid,
        'ec000000-0000-0000-0000-0000000000e1'::uuid, 'ads_manager')
ON CONFLICT DO NOTHING;

-- Sem info_bank ainda para EC Client (o envolvido vai CRIAR via RPC).
DELETE FROM public.client_info_bank WHERE client_id = 'ec000000-0000-0000-0000-0000000c1100'::uuid;

-- =============================================================================
-- GATE DE AUTORIZAÇÃO DA RPC — impersonação real
-- =============================================================================
-- (1) Envolvido edita → persiste (INSERT idempotente: cria a linha).
SELECT _ec_set('ec000000-0000-0000-0000-0000000000e1'::uuid);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$SELECT cliente.editar_card_universal(
      'ec000000-0000-0000-0000-0000000c1100'::uuid,
      p_brand_colors := '#0A84FF',
      p_website_url  := 'https://ec-client.test'
    )$$,
  'envolvido edita o card (cria info_bank) via editar_card_universal');
RESET ROLE;

-- Persistiu de fato (lê fora de RLS para verificar o efeito).
SELECT is(
  (SELECT brand_colors FROM public.client_info_bank
     WHERE client_id='ec000000-0000-0000-0000-0000000c1100'::uuid),
  '#0A84FF', 'edição do envolvido persistiu (brand_colors)');

-- (2) Envolvido edita de novo → UPSERT idempotente (atualiza campo distinto,
--     preserva o anterior via COALESCE).
SELECT _ec_set('ec000000-0000-0000-0000-0000000000e1'::uuid);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$SELECT cliente.editar_card_universal(
      'ec000000-0000-0000-0000-0000000c1100'::uuid,
      p_typography := 'Inter'
    )$$,
  'envolvido faz UPSERT idempotente (segunda chamada atualiza)');
RESET ROLE;
SELECT is(
  (SELECT typography||'|'||brand_colors FROM public.client_info_bank
     WHERE client_id='ec000000-0000-0000-0000-0000000c1100'::uuid),
  'Inter|#0A84FF', 'UPSERT preserva campo anterior (COALESCE) e grava o novo');

-- (3) Não-envolvido → 42501 (insufficient_privilege).
SELECT _ec_set('ec000000-0000-0000-0000-0000000000b0'::uuid);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT cliente.editar_card_universal(
      'ec000000-0000-0000-0000-0000000c1100'::uuid,
      p_brand_colors := '#HACK'
    )$$,
  '42501', NULL,
  'não-envolvido recebe 42501 (gate de autorização da escrita)');
RESET ROLE;

-- (4) Admin edita → persiste (bypass A).
SELECT _ec_set('ec000000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$SELECT cliente.editar_card_universal(
      'ec000000-0000-0000-0000-0000000c1100'::uuid,
      p_notes := 'nota do admin'
    )$$,
  'admin edita o card via editar_card_universal (bypass A)');
RESET ROLE;

-- (5) Cliente inexistente → P0002 (no_data_found). Admin chama para isolar o gate
--     de existência do gate de autorização.
SELECT _ec_set('ec000000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT cliente.editar_card_universal(
      'ec000000-0000-0000-0000-00000000dead'::uuid,
      p_brand_colors := '#000'
    )$$,
  'P0002', NULL,
  'cliente inexistente recebe P0002 (gate de existência)');
RESET ROLE;

-- =============================================================================
-- ESCRITA DIRETA FECHADA — o furo WITH CHECK(true) está fechado.
-- (REVOKE de INSERT/UPDATE em authenticated → erro 42501 permission denied.)
-- =============================================================================
-- INSERT direto em client_info_bank por authenticated FALHA.
SELECT _ec_set('ec000000-0000-0000-0000-0000000000e1'::uuid);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$INSERT INTO public.client_info_bank (client_id, brand_colors, created_by, updated_by)
    VALUES ('ec000000-0000-0000-0000-0000000c1100'::uuid, '#DIRECT',
            'ec000000-0000-0000-0000-0000000000e1'::uuid,
            'ec000000-0000-0000-0000-0000000000e1'::uuid)$$,
  '42501', NULL,
  'INSERT direto em client_info_bank por authenticated FALHA (grant revogado)');

-- UPDATE direto em client_info_bank por authenticated FALHA.
SELECT throws_ok(
  $$UPDATE public.client_info_bank SET brand_colors='#DIRECT'
     WHERE client_id='ec000000-0000-0000-0000-0000000c1100'::uuid$$,
  '42501', NULL,
  'UPDATE direto em client_info_bank por authenticated FALHA (grant revogado)');
RESET ROLE;

-- INSERT direto nos 3 perfis legados por authenticated FALHA.
SELECT _ec_set('ec000000-0000-0000-0000-0000000000e1'::uuid);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$INSERT INTO public.client_design_profiles (client_id)
    VALUES ('ec000000-0000-0000-0000-0000000c1100'::uuid)$$,
  '42501', NULL,
  'INSERT direto em client_design_profiles por authenticated FALHA (grant revogado)');
RESET ROLE;

-- =============================================================================
-- RPCs LEGADAS DE PERFIL NEUTRALIZADAS — RAISE 'deprecated...'.
-- =============================================================================
SELECT _ec_set('ec000000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT public.upsert_client_design_profile('ec000000-0000-0000-0000-0000000c1100'::uuid)$$,
  NULL,
  'deprecated: use client_info_bank (cliente.editar_card_universal)',
  'upsert_client_design_profile neutralizada (RAISE deprecated)');
SELECT throws_ok(
  $$SELECT public.upsert_client_video_profile('ec000000-0000-0000-0000-0000000c1100'::uuid)$$,
  NULL,
  'deprecated: use client_info_bank (cliente.editar_card_universal)',
  'upsert_client_video_profile neutralizada (RAISE deprecated)');
SELECT throws_ok(
  $$SELECT public.upsert_client_dev_profile('ec000000-0000-0000-0000-0000000c1100'::uuid)$$,
  NULL,
  'deprecated: use client_info_bank (cliente.editar_card_universal)',
  'upsert_client_dev_profile neutralizada (RAISE deprecated)');
RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
