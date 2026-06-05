-- supabase/tests/torque_crm_sla_foundation_test.sql
-- pgTAP — Slice 2 (#129) — Fundação de SLA do Board Torque CRM. ADR 0006.
--
-- Prova as INVARIANTES da migração 20260605130000_torque_crm_sla_foundation.sql
-- (já aplicada no remoto), via INTERFACE PÚBLICA (as RPCs), não implementação.
--
-- Invariantes provadas:
--   ESTRUTURA
--     - crm_configuracoes.stage_entered_at existe (timestamptz);
--     - crm_sla existe com PK coluna, RLS ON, seed das 5 colunas com SLA
--       (pronto ausente = sem SLA).
--   STAGE_ENTERED_AT nas transições
--     - gerar: card novo nasce com stage_entered_at = created_at;
--     - comecar (a_fazer->tier): grava stage_entered_at = now() (avança);
--     - checklist_set SEM transição (toggle em tier, não-completo): NÃO mexe
--       stage_entered_at (relógio do SLA preservado);
--     - checklist_set COM transição (tier->apresentacao, 100%): grava now() (avança);
--     - pronto (apresentacao->pronto): grava now() (avança);
--     - agendar: NÃO mexe stage_entered_at.
--
-- UUID prefix: 'c1290000'. Runner: scripts/sb-pgtap.sh supabase/tests/torque_crm_sla_foundation_test.sql
BEGIN;

SELECT plan(14);

-- Helper de impersonação (padrão torque_board_rpc_test.sql).
CREATE OR REPLACE FUNCTION _sla_set(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_user_id,'role','authenticated')::text, true);
END;$$;

-- =============================================================================
-- ESTRUTURA
-- =============================================================================
SELECT has_column('public','crm_configuracoes','stage_entered_at',
  'crm_configuracoes.stage_entered_at existe');
SELECT col_type_is('public','crm_configuracoes','stage_entered_at','timestamp with time zone',
  'stage_entered_at é timestamptz');

SELECT has_table('public','crm_sla', 'tabela crm_sla existe');
SELECT col_is_pk('public','crm_sla','coluna', 'crm_sla.coluna é PK');
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname='crm_sla'),
  true, 'crm_sla tem RLS habilitado');

-- Seed: 5 colunas com SLA; pronto ausente (sem SLA).
SELECT is(
  (SELECT max_days FROM public.crm_sla WHERE coluna='a_fazer'), 2, 'SLA a_fazer = 2');
SELECT is(
  (SELECT max_days FROM public.crm_sla WHERE coluna='copilot'), 10, 'SLA copilot = 10');
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.crm_sla WHERE coluna='pronto'),
  'pronto não tem linha de SLA (sem SLA — estado terminal)');

-- =============================================================================
-- SEED de auth/cliente.
-- =============================================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT u,'00000000-0000-0000-0000-000000000000'::uuid,u::text||'@m.test',crypt('t',gen_salt('bf')),'authenticated','authenticated',now(),now(),''
FROM (VALUES
  ('c1290000-0000-0000-0000-0000000000a1'::uuid)   -- admin/ceo
) AS t(u)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id,name,email) VALUES
 ('c1290000-0000-0000-0000-0000000000a1'::uuid,'SLA Admin','slaa1@m.test')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id,role) VALUES
 ('c1290000-0000-0000-0000-0000000000a1'::uuid,'ceo')
ON CONFLICT (user_id,role) DO NOTHING;

INSERT INTO public.clients (id,name) VALUES
 ('c1290000-0000-0000-0000-0000000c1100'::uuid,'SLA Client')
ON CONFLICT (id) DO NOTHING;

SELECT _sla_set('c1290000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;

-- =============================================================================
-- GERAR — stage_entered_at = created_at.
-- =============================================================================
CREATE TEMP TABLE _sla_card ON COMMIT DROP AS
  SELECT public.torque_board_gerar(
    'c1290000-0000-0000-0000-0000000c1100'::uuid,
    'c1290000-0000-0000-0000-0000000000a1',  -- gestor_id = o admin (dono)
    'torque', '{}'::jsonb
  ) AS id;

SELECT is(
  (SELECT stage_entered_at FROM public.crm_configuracoes WHERE id=(SELECT id FROM _sla_card)),
  (SELECT created_at      FROM public.crm_configuracoes WHERE id=(SELECT id FROM _sla_card)),
  'gerar: stage_entered_at = created_at (entrou no board == entrou em A FAZER)');

-- NOTA pgTAP: tudo roda numa ÚNICA transação, então now() é CONSTANTE aqui. Para
-- provar de forma determinística que as transições gravam now() (e não "o valor
-- antigo"), envelhecemos created_at/stage_entered_at para o passado. Em produção
-- cada RPC é sua própria transação e now() avança naturalmente.
UPDATE public.crm_configuracoes
   SET created_at = now() - interval '10 days',
       stage_entered_at = now() - interval '10 days'
 WHERE id=(SELECT id FROM _sla_card);

-- =============================================================================
-- COMECAR — a_fazer -> tier: stage_entered_at vira now() (>> created_at envelhecido).
-- =============================================================================
SELECT public.torque_board_comecar((SELECT id FROM _sla_card));

SELECT ok(
  (SELECT stage_entered_at = now()
     FROM public.crm_configuracoes WHERE id=(SELECT id FROM _sla_card)),
  'comecar: stage_entered_at = now() na transição a_fazer->tier');

-- =============================================================================
-- CHECKLIST_SET sem transição (toggle em tier, não-completo): NÃO mexe o relógio.
-- Envelhece o stage; um set não-completo deve PRESERVAR o valor envelhecido
-- (continua < now()).
-- =============================================================================
UPDATE public.crm_configuracoes
   SET stage_entered_at = now() - interval '10 days'
 WHERE id=(SELECT id FROM _sla_card);

SELECT public.torque_board_checklist_set(
  (SELECT id FROM _sla_card),
  '[{"id":"i1","label":"passo 1","done":false}]'::jsonb);

SELECT ok(
  (SELECT stage_entered_at = now() - interval '10 days'
     FROM public.crm_configuracoes WHERE id=(SELECT id FROM _sla_card)),
  'checklist_set sem mudar de coluna: stage_entered_at PRESERVADO (SLA não reinicia)');

-- =============================================================================
-- CHECKLIST_SET com transição (tier -> apresentacao, 100%): grava now().
-- O stage ainda está envelhecido (-10d); a transição deve trazê-lo para now().
-- =============================================================================
SELECT public.torque_board_checklist_set(
  (SELECT id FROM _sla_card),
  '[{"id":"i1","label":"passo 1","done":true}]'::jsonb);

SELECT ok(
  (SELECT board_status = 'apresentacao' AND stage_entered_at = now()
     FROM public.crm_configuracoes WHERE id=(SELECT id FROM _sla_card)),
  'checklist_set 100% (tier->apresentacao): move a coluna E grava stage_entered_at = now()');

-- =============================================================================
-- AGENDAR — NÃO mexe stage_entered_at (não muda de coluna). Envelhece e exige
-- que permaneça envelhecido.
-- =============================================================================
UPDATE public.crm_configuracoes
   SET stage_entered_at = now() - interval '10 days'
 WHERE id=(SELECT id FROM _sla_card);

SELECT public.torque_board_agendar(
  (SELECT id FROM _sla_card),
  (now() - interval '1 day'));  -- ontem: gate de pronto liberado, e em 'apresentacao'.

SELECT ok(
  (SELECT stage_entered_at = now() - interval '10 days'
     FROM public.crm_configuracoes WHERE id=(SELECT id FROM _sla_card)),
  'agendar: stage_entered_at INALTERADO (não muda de coluna)');

-- =============================================================================
-- PRONTO — apresentacao -> pronto: grava now() (stage ainda envelhecido -10d).
-- =============================================================================
SELECT public.torque_board_pronto((SELECT id FROM _sla_card));

SELECT ok(
  (SELECT board_status = 'pronto' AND stage_entered_at = now()
     FROM public.crm_configuracoes WHERE id=(SELECT id FROM _sla_card)),
  'pronto: move pra PRONTOS E grava stage_entered_at = now()');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
