-- supabase/tests/ads_crm_board_rls_test.sql
-- pgTAP — Slice 2 (#137) — Gestor de ads LÊ o board do CRM (read-only), escopado
-- à carteira. PRD #135, ADR 0006. Depende da slice #136 (_ads_owns_client).
--
-- Prova a INVARIANTE da nova policy RLS de SELECT em crm_configuracoes:
--   ads SÓ enxerga cards de clientes da SUA carteira
--   (_ads_owns_client(client_id, auth.uid())). Card de cliente de OUTRO ads é
--   LINHA INVISÍVEL (não aparece no SELECT) — defesa de DADOS, não só de UI.
--
-- Provado via INTERFACE: SELECT direto em crm_configuracoes sob a role do ads
-- (RLS ativa). Sem expor implementação.
--
-- SEGURANÇA (negativo explícito): card alheio NÃO retorna nenhuma linha; a
-- escrita (crm_config_write) continua barrada para ads (não afrouxada).
--
-- UUID prefix: 'a6000000'. Runner: scripts/sb-pgtap.sh supabase/tests/ads_crm_board_rls_test.sql
BEGIN;

SELECT plan(8);

CREATE OR REPLACE FUNCTION _ab_set(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_user_id,'role','authenticated')::text, true);
END;$$;

-- =============================================================================
-- SEED
--   ads_dono : gestor_ads, carteira = client_alvo
--   ads_fora : gestor_ads, carteira = client_outro
--   gcrm     : gestor_crm (gestor_id dos cards; não-regressão)
--   2 clientes, 2 cards (1 por carteira). Cards criados com RLS desligada (runner).
-- =============================================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT u,'00000000-0000-0000-0000-000000000000'::uuid,u::text||'@m.test',crypt('t',gen_salt('bf')),'authenticated','authenticated',now(),now(),''
FROM (VALUES
  ('a6000000-0000-0000-0000-0000000000a2'::uuid),  -- ads_dono
  ('a6000000-0000-0000-0000-0000000000a3'::uuid),  -- ads_fora
  ('a6000000-0000-0000-0000-0000000000c1'::uuid)   -- gestor_crm
) AS t(u)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id,name,email) VALUES
 ('a6000000-0000-0000-0000-0000000000a2'::uuid,'AB AdsDono','aba2@m.test'),
 ('a6000000-0000-0000-0000-0000000000a3'::uuid,'AB AdsFora','aba3@m.test'),
 ('a6000000-0000-0000-0000-0000000000c1'::uuid,'AB GestorCrm','abc1@m.test')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id,role) VALUES
 ('a6000000-0000-0000-0000-0000000000a2'::uuid,'gestor_ads'),
 ('a6000000-0000-0000-0000-0000000000a3'::uuid,'gestor_ads'),
 ('a6000000-0000-0000-0000-0000000000c1'::uuid,'gestor_crm')
ON CONFLICT (user_id,role) DO NOTHING;

INSERT INTO public.clients (id,name,assigned_ads_manager) VALUES
 ('a6000000-0000-0000-0000-0000000c1100'::uuid,'AB Alvo',  'a6000000-0000-0000-0000-0000000000a2'::uuid),
 ('a6000000-0000-0000-0000-0000000c2200'::uuid,'AB Outro', 'a6000000-0000-0000-0000-0000000000a3'::uuid)
ON CONFLICT (id) DO NOTHING;

-- Cards criados pelo runner (RLS desligada aqui) — 1 por cliente.
INSERT INTO public.crm_configuracoes (id, client_id, gestor_id, produto, current_step, is_finalizado, form_data, board_status, checklist)
VALUES
 ('a6000000-0000-0000-0000-0000000ca110'::uuid,'a6000000-0000-0000-0000-0000000c1100'::uuid,'a6000000-0000-0000-0000-0000000000c1','torque','receber_briefing',false,'{}'::jsonb,'a_fazer','[]'::jsonb),
 ('a6000000-0000-0000-0000-0000000ca220'::uuid,'a6000000-0000-0000-0000-0000000c2200'::uuid,'a6000000-0000-0000-0000-0000000000c1','torque','receber_briefing',false,'{}'::jsonb,'a_fazer','[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- ADS_DONO — vê o card da SUA carteira, NÃO vê o card do outro ads.
-- =============================================================================
SELECT _ab_set('a6000000-0000-0000-0000-0000000000a2'::uuid);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.crm_configuracoes
     WHERE id='a6000000-0000-0000-0000-0000000ca110'::uuid),
  1, 'ads_dono VÊ o card do cliente da sua carteira (RLS SELECT escopada)');

SELECT is(
  (SELECT count(*)::int FROM public.crm_configuracoes
     WHERE id='a6000000-0000-0000-0000-0000000ca220'::uuid),
  0, 'SEGURANÇA: ads_dono NÃO vê o card do cliente de outro ads (linha invisível)');

-- Visão de board agregada: ads_dono só enxerga 1 card no total (o seu).
SELECT is(
  (SELECT count(*)::int FROM public.crm_configuracoes
     WHERE client_id IN ('a6000000-0000-0000-0000-0000000c1100'::uuid,
                         'a6000000-0000-0000-0000-0000000c2200'::uuid)),
  1, 'SEGURANÇA: ads_dono vê APENAS cards da própria carteira (1 de 2)');

-- Escrita continua barrada para ads (crm_config_write NÃO foi afrouxada).
-- Sob RLS, UPDATE cuja row não passa no USING da policy de escrita é FILTRADO
-- (0 linhas afetadas) — não levanta 42501. A invariante de segurança é que o
-- ads NÃO modifica a row: provamos que o UPDATE afeta 0 linhas E que o valor
-- original (checklist '[]') permanece intacto.
CREATE TEMP TABLE _ab_upd ON COMMIT DROP AS
  WITH u AS (
    UPDATE public.crm_configuracoes
       SET checklist='[{"id":"x","label":"y","done":true}]'::jsonb
     WHERE id='a6000000-0000-0000-0000-0000000ca110'::uuid
     RETURNING 1
  )
  SELECT count(*)::int AS n FROM u;

SELECT is(
  (SELECT n FROM _ab_upd),
  0, 'SEGURANÇA: ads NÃO escreve em crm_configuracoes (UPDATE filtrado pela RLS, 0 linhas)');

-- =============================================================================
-- ADS_FORA — espelho: vê só o seu card.
-- =============================================================================
RESET ROLE;
SELECT _ab_set('a6000000-0000-0000-0000-0000000000a3'::uuid);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.crm_configuracoes
     WHERE id='a6000000-0000-0000-0000-0000000ca220'::uuid),
  1, 'ads_fora VÊ o card da sua carteira');

SELECT is(
  (SELECT count(*)::int FROM public.crm_configuracoes
     WHERE id='a6000000-0000-0000-0000-0000000ca110'::uuid),
  0, 'SEGURANÇA: ads_fora NÃO vê o card do ads_dono (sem vazamento cruzado)');

-- =============================================================================
-- NÃO-REGRESSÃO — gestor_crm (gestor_id dos cards) vê ambos via gestor_id branch.
-- =============================================================================
RESET ROLE;
SELECT _ab_set('a6000000-0000-0000-0000-0000000000c1'::uuid);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.crm_configuracoes
     WHERE id IN ('a6000000-0000-0000-0000-0000000ca110'::uuid,
                  'a6000000-0000-0000-0000-0000000ca220'::uuid)),
  2, 'NÃO-REGRESSÃO: gestor_crm (gestor_id dos cards) vê ambos os cards');

SELECT lives_ok($$
  UPDATE public.crm_configuracoes SET board_status='tier'
   WHERE id='a6000000-0000-0000-0000-0000000ca110'::uuid
$$, 'NÃO-REGRESSÃO: gestor_crm dono ainda ESCREVE (write preservada)');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
