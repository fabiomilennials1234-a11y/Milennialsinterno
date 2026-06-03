-- supabase/tests/modules/cliente/registrar_arquivo_info_bank_test.sql
-- pgTAP — #43 — Gate de ESCRITA/LEITURA de arquivos do Banco de Info do cliente.
-- ADR 0004/0005: cliente.registrar_arquivo_info_bank é o ÚNICO dono da escrita de
-- metadado, gateado por cliente.pode_ver_cliente. Escrita direta REVOGADA; SELECT
-- gateado; legado upload_info_bank_file/delete_info_bank_file delegam ao gate.
--
-- Prova os DOIS lados (incidente RLS-silenciosa 200+vazio):
--   - envolvido escreve/lê; não-envolvido é BLOQUEADO (42501) e LÊ VAZIO.
-- Runner: scripts/sb-pgtap.sh supabase/tests/modules/cliente/registrar_arquivo_info_bank_test.sql
-- UUID prefix: 'fa430000' (namespace #43).

BEGIN;

SELECT plan(16);

-- Helper de auth (sem trocar role — para chamar RPC SECURITY DEFINER).
CREATE OR REPLACE FUNCTION _fa_set_auth(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_user_id,'role','authenticated')::text, true);
END;$$;

-- ============================================================
-- Estrutura — escrita direta revogada, SELECT gateado, escrita só via RPC.
-- ============================================================
SELECT is(
  (SELECT count(*)::int FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name='client_info_bank_files'
      AND grantee='authenticated' AND privilege_type IN ('INSERT','UPDATE','DELETE')),
  0,
  'authenticated NÃO tem grant direto de INSERT/UPDATE/DELETE em client_info_bank_files');

SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname='public' AND tablename='client_info_bank_files'
      AND cmd='SELECT' AND qual LIKE '%pode_ver_cliente%'),
  1,
  'SELECT de client_info_bank_files é gateado por pode_ver_cliente');

SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname='public' AND tablename='client_info_bank_files'
      AND cmd='SELECT' AND qual='true'),
  0,
  'não resta policy SELECT USING(true) (furo de leitura fechado)');

SELECT is(
  (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='cliente' AND p.proname='registrar_arquivo_info_bank'),
  1,
  'contrato cliente.registrar_arquivo_info_bank existe');

-- Storage policies apertadas (todas exigem pode_ver_cliente).
SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname IN ('cib_files_insert','cib_files_select','cib_files_delete','cib_files_update')
      AND (COALESCE(qual,'')||COALESCE(with_check,'')) LIKE '%pode_ver_cliente%'),
  4,
  'as 4 storage policies do bucket exigem pode_ver_cliente');

-- ============================================================
-- Seed: cliente CX (grupo G1), envolvido (ads_manager), outsider design.
-- ============================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT u,'00000000-0000-0000-0000-000000000000'::uuid,u::text||'@fa43.test',crypt('t',gen_salt('bf')),'authenticated','authenticated',now(),now(),''
FROM (VALUES
 ('fa430000-0000-0000-0000-0000000000c1'::uuid),  -- envolvido (ads_manager de CX)
 ('fa430000-0000-0000-0000-0000000000f9'::uuid),  -- outsider limpo (design, sem nada)
 ('fa430000-0000-0000-0000-0000000000a1'::uuid)   -- ceo
) AS t(u) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id,name,email) VALUES
 ('fa430000-0000-0000-0000-0000000000c1'::uuid,'FA Ads','c1@fa43.test'),
 ('fa430000-0000-0000-0000-0000000000f9'::uuid,'FA Outsider','f9@fa43.test'),
 ('fa430000-0000-0000-0000-0000000000a1'::uuid,'FA CEO','a1@fa43.test')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id,role) VALUES
 ('fa430000-0000-0000-0000-0000000000c1'::uuid,'gestor_ads'),
 ('fa430000-0000-0000-0000-0000000000f9'::uuid,'design'),
 ('fa430000-0000-0000-0000-0000000000a1'::uuid,'ceo')
ON CONFLICT (user_id,role) DO NOTHING;

INSERT INTO public.clients (id,name,assigned_ads_manager,created_by) VALUES
 ('fa430000-0000-0000-0000-00000000c100'::uuid,'FA Client CX',
  'fa430000-0000-0000-0000-0000000000c1'::uuid, NULL)
ON CONFLICT (id) DO NOTHING;

-- info_bank do CX (necessário para anexar arquivo).
SELECT _fa_set_auth('fa430000-0000-0000-0000-0000000000c1'::uuid);
SELECT public.upsert_client_info_bank(
  p_client_id := 'fa430000-0000-0000-0000-00000000c100'::uuid, p_brand_colors := '#FA43');

-- ============================================================
-- (+) envolvido REGISTRA arquivo via RPC → uuid não-nulo.
-- ============================================================
SELECT _fa_set_auth('fa430000-0000-0000-0000-0000000000c1'::uuid);
SELECT isnt(
  cliente.registrar_arquivo_info_bank(
    'fa430000-0000-0000-0000-00000000c100'::uuid,'anuncios'::public.info_bank_file_section,
    'ad.png','fa430000-0000-0000-0000-00000000c100/anuncios/u1.png',1024,'image/png'),
  NULL::uuid,
  '(+) envolvido (ads_manager) registra arquivo de CX via contrato');

-- legado delega: upload_info_bank_file também funciona p/ envolvido.
SELECT isnt(
  public.upload_info_bank_file(
    'fa430000-0000-0000-0000-00000000c100'::uuid,'criativos'::public.info_bank_file_section,
    'cr.pdf','fa430000-0000-0000-0000-00000000c100/criativos/u2.pdf',2048,'application/pdf'),
  NULL::uuid,
  '(+) legado upload_info_bank_file delega ao gate (envolvido escreve)');

-- cadeia de versão preservada: mesmo nome → version 2.
SELECT public.upload_info_bank_file(
  'fa430000-0000-0000-0000-00000000c100'::uuid,'anuncios'::public.info_bank_file_section,
  'ad.png','fa430000-0000-0000-0000-00000000c100/anuncios/u3.png',999,'image/png');
SELECT is(
  (SELECT version FROM public.client_info_bank_files
    WHERE client_id='fa430000-0000-0000-0000-00000000c100'::uuid
      AND section='anuncios' AND file_name='ad.png' AND replaced_by IS NULL),
  2,
  'cadeia de versão preservada no contrato (mesmo nome → version 2)');

-- ============================================================
-- (-) OUTSIDER limpo é BLOQUEADO (42501) ao registrar.
-- ============================================================
SELECT _fa_set_auth('fa430000-0000-0000-0000-0000000000f9'::uuid);
SELECT throws_ok(
  $$SELECT cliente.registrar_arquivo_info_bank(
    'fa430000-0000-0000-0000-00000000c100'::uuid,'marca'::public.info_bank_file_section,
    'hack.png','fa430000-0000-0000-0000-00000000c100/marca/x.png',1,'image/png')$$,
  '42501', NULL,
  '(-) outsider (sem visibilidade) é BLOQUEADO ao registrar (42501)');

SELECT throws_ok(
  $$SELECT public.upload_info_bank_file(
    'fa430000-0000-0000-0000-00000000c100'::uuid,'marca'::public.info_bank_file_section,
    'hack2.png','fa430000-0000-0000-0000-00000000c100/marca/y.png',1,'image/png')$$,
  '42501', NULL,
  '(-) legado upload_info_bank_file também bloqueia outsider (gate herdado)');

-- ============================================================
-- (-) OUTSIDER NÃO LÊ metadado (RLS SELECT gateado → vazio).
-- ============================================================
SELECT _fa_set_auth('fa430000-0000-0000-0000-0000000000f9'::uuid);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM public.client_info_bank_files
    WHERE client_id='fa430000-0000-0000-0000-00000000c100'::uuid),
  0,
  '(-) outsider LÊ VAZIO de client_info_bank_files (SELECT gateado)');
RESET ROLE;

-- (+) envolvido LÊ os arquivos do seu cliente.
SELECT _fa_set_auth('fa430000-0000-0000-0000-0000000000c1'::uuid);
SET LOCAL ROLE authenticated;
SELECT cmp_ok(
  (SELECT count(*)::int FROM public.client_info_bank_files
    WHERE client_id='fa430000-0000-0000-0000-00000000c100'::uuid),
  '>', 0,
  '(+) envolvido LÊ os arquivos de CX (SELECT gateado deixa passar)');
RESET ROLE;

-- ============================================================
-- (-) outsider não consegue DELETE via RPC (42501 — gate de audiência).
-- ============================================================
-- pega um file_id existente
SELECT _fa_set_auth('fa430000-0000-0000-0000-0000000000c1'::uuid);
CREATE TEMP TABLE _fa_fid AS
  SELECT id FROM public.client_info_bank_files
   WHERE client_id='fa430000-0000-0000-0000-00000000c100'::uuid AND replaced_by IS NULL LIMIT 1;

SELECT _fa_set_auth('fa430000-0000-0000-0000-0000000000f9'::uuid);
SELECT throws_ok(
  format($$SELECT public.delete_info_bank_file(%L::uuid)$$, (SELECT id FROM _fa_fid)),
  '42501', NULL,
  '(-) outsider é bloqueado no delete_info_bank_file (pode_ver_cliente)');

-- (+) admin (ceo) deleta (audiência via is_executive/is_admin + admin override).
SELECT _fa_set_auth('fa430000-0000-0000-0000-0000000000a1'::uuid);
SELECT isnt(
  public.delete_info_bank_file((SELECT id FROM _fa_fid)),
  NULL,
  '(+) ceo (admin) deleta arquivo via RPC');

-- ============================================================
-- Hardening: contrato é SECURITY DEFINER com search_path vazio.
-- ============================================================
SELECT is(
  (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='cliente' AND p.proname='registrar_arquivo_info_bank'
      AND p.prosecdef = true
      AND array_to_string(p.proconfig,',') LIKE '%search_path=%'),
  1,
  'contrato é SECURITY DEFINER com search_path setado (hardening ADR 0004)');

SELECT is(
  (SELECT count(*)::int FROM information_schema.role_routine_grants
    WHERE routine_schema='cliente' AND routine_name='registrar_arquivo_info_bank'
      AND grantee='authenticated'),
  1,
  'contrato tem GRANT EXECUTE a authenticated');

SELECT * FROM finish();
ROLLBACK;
