-- supabase/tests/concessao_lifecycle_test.sql
-- pgTAP — Slices #150 (revogar) + #151 (converter) da Concessão. ADR 0009.
--
-- Prova as INVARIANTES das RPCs public.converter_concessao e
-- public.revogar_concessao via INTERFACE PÚBLICA, mais a PARIDADE do trigger
-- process_upsell (venda normal = baseline; flag off não regrediu).
--
-- Estado inicial de cada caso é montado chamando conceder_produto (#147) — a
-- concessão `ativa` + entrega real — para então converter/revogar de verdade.
--
-- Invariantes:
--   ESTRUTURA / HARDENING
--     - ambas RPCs existem, SECURITY DEFINER + search_path travado.
--   CONVERTER (happy)
--     - cria upsell; EXATAMENTE 1 comissão 7%; 1 mrr_changes expansion;
--       financeiro_active_clients.monthly_value sobe 0 -> valor; status=convertida;
--       converted_to_upsell_id setado; ZERO card novo (anti-duplicação, conta antes/depois).
--   CONVERTER (erro)
--     - convertida/revogada -> P0001; valor<=0 -> P0001; sold_by sem role -> P0001;
--       CS de outra carteira -> 42501; admin ok; CS dono ok.
--   REVOGAR (happy)
--     - card archived=true; slug fora de contracted_products; linha financeiro deletada;
--       status=revogada; revoked_by/at setados.
--   REVOGAR (erro)
--     - revogada/convertida -> P0001; CS de outra carteira -> 42501; admin ok.
--   PARIDADE TRIGGER
--     - venda normal (flag off) gera comissão + ENTREGA card como hoje (baseline).
--
-- UUID prefix: 'cf000000'. Runner: scripts/sb-pgtap.sh supabase/tests/concessao_lifecycle_test.sql
BEGIN;

SELECT plan(39);

CREATE OR REPLACE FUNCTION _cf_set(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_user_id,'role','authenticated')::text, true);
END;$$;

-- =============================================================================
-- ESTRUTURA / HARDENING
-- =============================================================================
SELECT has_function('public','converter_concessao',
  ARRAY['uuid','numeric','uuid'], 'converter_concessao(uuid,numeric,uuid) existe');
SELECT has_function('public','revogar_concessao',
  ARRAY['uuid','text'], 'revogar_concessao(uuid,text) existe');

SELECT is((SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='converter_concessao'), true,
  'converter_concessao é SECURITY DEFINER');
SELECT is((SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='revogar_concessao'), true,
  'revogar_concessao é SECURITY DEFINER');
SELECT ok((SELECT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='converter_concessao'),
  'converter_concessao trava search_path');
SELECT ok((SELECT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='revogar_concessao'),
  'revogar_concessao trava search_path');

-- =============================================================================
-- SEED: admin(ceo), CS dono, CS forasteiro, gestor_ads(sem venda).
--   Board+coluna pro slug 'cf-prod' (rotear/arquivar card). 4 clientes (dono=c1):
--   A converter, B revogar, C converter-erros, D paridade-venda-normal.
-- =============================================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT u,'00000000-0000-0000-0000-000000000000'::uuid,u::text||'@m.test',crypt('t',gen_salt('bf')),'authenticated','authenticated',now(),now(),''
FROM (VALUES
  ('cf000000-0000-0000-0000-0000000000a1'::uuid),  -- admin/ceo
  ('cf000000-0000-0000-0000-0000000000c1'::uuid),  -- CS dono
  ('cf000000-0000-0000-0000-0000000000c2'::uuid),  -- CS forasteiro
  ('cf000000-0000-0000-0000-0000000000e1'::uuid)   -- gestor_ads (não vende)
) AS t(u) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id,name,email) VALUES
 ('cf000000-0000-0000-0000-0000000000a1'::uuid,'CF Admin','cfa1@m.test'),
 ('cf000000-0000-0000-0000-0000000000c1'::uuid,'CF CS Dono','cfc1@m.test'),
 ('cf000000-0000-0000-0000-0000000000c2'::uuid,'CF CS Fora','cfc2@m.test'),
 ('cf000000-0000-0000-0000-0000000000e1'::uuid,'CF Ads','cfe1@m.test')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id,role) VALUES
 ('cf000000-0000-0000-0000-0000000000a1'::uuid,'ceo'),
 ('cf000000-0000-0000-0000-0000000000c1'::uuid,'sucesso_cliente'),
 ('cf000000-0000-0000-0000-0000000000c2'::uuid,'sucesso_cliente'),
 ('cf000000-0000-0000-0000-0000000000e1'::uuid,'gestor_ads')
ON CONFLICT (user_id,role) DO NOTHING;

INSERT INTO public.clients (id,name,entry_date,contract_duration_months,assigned_sucesso_cliente) VALUES
 ('cf000000-0000-0000-0000-0000000c1000'::uuid,'CF Client A','2026-01-15'::date,12,'cf000000-0000-0000-0000-0000000000c1'::uuid),
 ('cf000000-0000-0000-0000-0000000c2000'::uuid,'CF Client B','2026-01-15'::date,12,'cf000000-0000-0000-0000-0000000000c1'::uuid),
 ('cf000000-0000-0000-0000-0000000c3000'::uuid,'CF Client C','2026-01-15'::date,12,'cf000000-0000-0000-0000-0000000000c1'::uuid),
 ('cf000000-0000-0000-0000-0000000c4000'::uuid,'CF Client D','2026-01-15'::date,12,'cf000000-0000-0000-0000-0000000000c1'::uuid)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kanban_boards (id, slug, name)
VALUES ('cf000000-0000-0000-0000-00000000b100'::uuid,'cf-prod','CF Prod')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kanban_columns (id, board_id, title, position)
VALUES ('cf000000-0000-0000-0000-00000000c100'::uuid,'cf000000-0000-0000-0000-00000000b100'::uuid,'NOVOS CLIENTES',0)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- CONVERTER — HAPPY PATH (cliente A): concede -> converte.
-- =============================================================================
SELECT _cf_set('cf000000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;

CREATE TEMP TABLE _cf_a ON COMMIT DROP AS
  SELECT public.conceder_produto(
    'cf000000-0000-0000-0000-0000000c1000'::uuid,'cf-prod','risco_churn'::public.concessao_motivo,NULL
  ) AS concessao_id;

-- Conta cards do board ANTES da conversão (asserção anti-duplicação).
CREATE TEMP TABLE _cf_cards_before ON COMMIT DROP AS
  SELECT count(*)::int AS n FROM public.kanban_cards
  WHERE board_id='cf000000-0000-0000-0000-00000000b100'::uuid
    AND client_id='cf000000-0000-0000-0000-0000000c1000'::uuid;

CREATE TEMP TABLE _cf_up ON COMMIT DROP AS
  SELECT public.converter_concessao(
    (SELECT concessao_id FROM _cf_a), 1500::numeric, 'cf000000-0000-0000-0000-0000000000c1'::uuid
  ) AS upsell_id;

SELECT isnt((SELECT upsell_id FROM _cf_up), NULL, 'converter retorna o uuid do upsell criado');

SELECT is((SELECT status FROM public.upsells WHERE id=(SELECT upsell_id FROM _cf_up)),
  'contracted', 'upsell criado com status=contracted');
SELECT is((SELECT monthly_value FROM public.upsells WHERE id=(SELECT upsell_id FROM _cf_up)),
  1500::numeric, 'upsell.monthly_value = valor da conversão');

-- EXATAMENTE 1 comissão 7% do upsell criado.
SELECT is((SELECT count(*)::int FROM public.upsell_commissions WHERE upsell_id=(SELECT upsell_id FROM _cf_up)),
  1, 'EXATAMENTE 1 upsell_commissions gerada pela conversão');
SELECT is((SELECT commission_value FROM public.upsell_commissions WHERE upsell_id=(SELECT upsell_id FROM _cf_up)),
  (1500*0.07)::numeric, 'comissão = 7% do valor');

-- EXATAMENTE 1 mrr_changes expansion 0 -> valor.
SELECT is((SELECT count(*)::int FROM public.mrr_changes
   WHERE client_id='cf000000-0000-0000-0000-0000000c1000'::uuid AND source='concessao_conversao'),
  1, 'EXATAMENTE 1 mrr_changes da conversão');
SELECT is((SELECT change_type FROM public.mrr_changes
   WHERE client_id='cf000000-0000-0000-0000-0000000c1000'::uuid AND source='concessao_conversao'),
  'expansion', 'mrr_changes.change_type = expansion');
SELECT row_eq($$
  SELECT previous_value, new_value, change_value FROM public.mrr_changes
   WHERE client_id='cf000000-0000-0000-0000-0000000c1000'::uuid AND source='concessao_conversao'$$,
  ROW(0::numeric, 1500::numeric, 1500::numeric),
  'mrr_changes: previous=0, new=1500, change=1500');

-- financeiro_active_clients sobe 0 -> valor.
SELECT is((SELECT monthly_value FROM public.financeiro_active_clients
   WHERE client_id='cf000000-0000-0000-0000-0000000c1000'::uuid AND product_slug='cf-prod'),
  1500::numeric, 'financeiro_active_clients.monthly_value sobe 0 -> 1500');

-- concessão convertida + vínculo.
SELECT is((SELECT status::text FROM public.concessoes WHERE id=(SELECT concessao_id FROM _cf_a)),
  'convertida', 'concessão.status = convertida');
SELECT is((SELECT converted_to_upsell_id FROM public.concessoes WHERE id=(SELECT concessao_id FROM _cf_a)),
  (SELECT upsell_id FROM _cf_up), 'concessão.converted_to_upsell_id = upsell criado');

-- ASSERÇÃO CRÍTICA: ZERO card novo (anti-duplicação) — conta depois == antes.
SELECT is(
  (SELECT count(*)::int FROM public.kanban_cards
     WHERE board_id='cf000000-0000-0000-0000-00000000b100'::uuid
       AND client_id='cf000000-0000-0000-0000-0000000c1000'::uuid),
  (SELECT n FROM _cf_cards_before),
  'ANTI-DUP: conversão NÃO criou card novo de board (count depois == antes)');

-- =============================================================================
-- CONVERTER — ERROS.
-- =============================================================================
-- já convertida -> P0001.
SELECT throws_ok($$
  SELECT public.converter_concessao(
    (SELECT concessao_id FROM _cf_a), 1500::numeric, 'cf000000-0000-0000-0000-0000000000c1'::uuid)$$,
  'P0001', NULL, 'converter concessão já convertida -> P0001');

-- valor <= 0 -> P0001. Usa cliente C (concede primeiro).
CREATE TEMP TABLE _cf_c ON COMMIT DROP AS
  SELECT public.conceder_produto(
    'cf000000-0000-0000-0000-0000000c3000'::uuid,'cf-prod','risco_churn'::public.concessao_motivo,NULL
  ) AS concessao_id;

SELECT throws_ok($$
  SELECT public.converter_concessao(
    (SELECT concessao_id FROM _cf_c), 0::numeric, 'cf000000-0000-0000-0000-0000000000c1'::uuid)$$,
  'P0001', NULL, 'converter com valor 0 -> P0001');

-- sold_by sem role de venda (gestor_ads) -> P0001.
SELECT throws_ok($$
  SELECT public.converter_concessao(
    (SELECT concessao_id FROM _cf_c), 1500::numeric, 'cf000000-0000-0000-0000-0000000000e1'::uuid)$$,
  'P0001', NULL, 'converter com sold_by sem role de venda -> P0001');

-- CS de OUTRA carteira -> 42501.
RESET ROLE;
SELECT _cf_set('cf000000-0000-0000-0000-0000000000c2'::uuid);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$
  SELECT public.converter_concessao(
    (SELECT concessao_id FROM _cf_c), 1500::numeric, 'cf000000-0000-0000-0000-0000000000c1'::uuid)$$,
  '42501', NULL, 'converter por CS de outra carteira -> 42501');

-- CS dono converte OK (cliente C).
RESET ROLE;
SELECT _cf_set('cf000000-0000-0000-0000-0000000000c1'::uuid);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$
  SELECT public.converter_concessao(
    (SELECT concessao_id FROM _cf_c), 900::numeric, 'cf000000-0000-0000-0000-0000000000c1'::uuid)$$,
  'CS dono converte sem erro');
SELECT is((SELECT status::text FROM public.concessoes WHERE id=(SELECT concessao_id FROM _cf_c)),
  'convertida', 'CS dono: concessão C convertida');

-- =============================================================================
-- REVOGAR — HAPPY PATH (cliente B): concede -> revoga.
-- =============================================================================
RESET ROLE;
SELECT _cf_set('cf000000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;

CREATE TEMP TABLE _cf_b ON COMMIT DROP AS
  SELECT public.conceder_produto(
    'cf000000-0000-0000-0000-0000000c2000'::uuid,'cf-prod','risco_churn'::public.concessao_motivo,NULL
  ) AS concessao_id;

-- pré-condição: produto entregue (em contracted_products + financeiro + card).
SELECT ok(
  (SELECT 'cf-prod' = ANY(contracted_products) FROM public.clients WHERE id='cf000000-0000-0000-0000-0000000c2000'::uuid),
  'pré-revogar: produto está em contracted_products');

CREATE TEMP TABLE _cf_rev ON COMMIT DROP AS
  SELECT public.revogar_concessao((SELECT concessao_id FROM _cf_b), 'churn definitivo') AS id;

-- card arquivado.
SELECT is(
  (SELECT count(*)::int FROM public.kanban_cards
     WHERE board_id='cf000000-0000-0000-0000-00000000b100'::uuid
       AND client_id='cf000000-0000-0000-0000-0000000c2000'::uuid
       AND card_type='upsell' AND archived=true),
  1, 'revogar: card de board arquivado (archived=true)');
SELECT isnt(
  (SELECT archived_at FROM public.kanban_cards
     WHERE board_id='cf000000-0000-0000-0000-00000000b100'::uuid
       AND client_id='cf000000-0000-0000-0000-0000000c2000'::uuid AND card_type='upsell'),
  NULL, 'revogar: archived_at setado');

-- slug fora de contracted_products.
SELECT ok(
  NOT ('cf-prod' = ANY(COALESCE((SELECT contracted_products FROM public.clients WHERE id='cf000000-0000-0000-0000-0000000c2000'::uuid), ARRAY[]::text[]))),
  'revogar: slug removido de contracted_products');

-- linha financeiro deletada.
SELECT is(
  (SELECT count(*)::int FROM public.financeiro_active_clients
     WHERE client_id='cf000000-0000-0000-0000-0000000c2000'::uuid AND product_slug='cf-prod'),
  0, 'revogar: financeiro_active_clients deletado');

-- status revogada + audit.
SELECT is((SELECT status::text FROM public.concessoes WHERE id=(SELECT concessao_id FROM _cf_b)),
  'revogada', 'revogar: concessão.status = revogada');
SELECT is((SELECT revoked_by FROM public.concessoes WHERE id=(SELECT concessao_id FROM _cf_b)),
  'cf000000-0000-0000-0000-0000000000a1'::uuid, 'revogar: revoked_by = caller');
SELECT isnt((SELECT revoked_at FROM public.concessoes WHERE id=(SELECT concessao_id FROM _cf_b)),
  NULL, 'revogar: revoked_at setado');

-- =============================================================================
-- REVOGAR — ERROS.
-- =============================================================================
-- já revogada -> P0001.
SELECT throws_ok($$
  SELECT public.revogar_concessao((SELECT concessao_id FROM _cf_b), NULL)$$,
  'P0001', NULL, 'revogar concessão já revogada -> P0001');

-- já convertida (concessão A) -> P0001.
SELECT throws_ok($$
  SELECT public.revogar_concessao((SELECT concessao_id FROM _cf_a), NULL)$$,
  'P0001', NULL, 'revogar concessão já convertida -> P0001');

-- CS de outra carteira -> 42501. Concede cliente A já tá convertido; usa novo concede no D.
RESET ROLE;
SELECT _cf_set('cf000000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE _cf_d_conc ON COMMIT DROP AS
  SELECT public.conceder_produto(
    'cf000000-0000-0000-0000-0000000c4000'::uuid,'cf-prod','risco_churn'::public.concessao_motivo,NULL
  ) AS concessao_id;

RESET ROLE;
SELECT _cf_set('cf000000-0000-0000-0000-0000000000c2'::uuid);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$
  SELECT public.revogar_concessao((SELECT concessao_id FROM _cf_d_conc), NULL)$$,
  '42501', NULL, 'revogar por CS de outra carteira -> 42501');

-- admin revoga OK (cliente D).
RESET ROLE;
SELECT _cf_set('cf000000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$
  SELECT public.revogar_concessao((SELECT concessao_id FROM _cf_d_conc), NULL)$$,
  'admin revoga sem erro');

-- =============================================================================
-- PARIDADE TRIGGER — venda normal (flag OFF) gera comissão E entrega card.
--   Insere upsell direto (sem skip_entrega) -> baseline histórico.
-- =============================================================================
RESET ROLE;
INSERT INTO public.clients (id,name,entry_date,contract_duration_months,assigned_sucesso_cliente)
VALUES ('cf000000-0000-0000-0000-0000000c5000'::uuid,'CF Client E','2026-01-15'::date,12,'cf000000-0000-0000-0000-0000000000c1'::uuid)
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE _cf_sale ON COMMIT DROP AS
  WITH ins AS (
    INSERT INTO public.upsells (client_id, product_slug, product_name, monthly_value, sold_by, sold_by_name, status)
    VALUES ('cf000000-0000-0000-0000-0000000c5000'::uuid,'cf-prod','CF Prod',2000,
            'cf000000-0000-0000-0000-0000000000c1'::uuid,'CF CS Dono','contracted')
    RETURNING id
  )
  SELECT id FROM ins;

-- comissão gerada (galho de dinheiro, comum).
SELECT is((SELECT count(*)::int FROM public.upsell_commissions WHERE upsell_id=(SELECT id FROM _cf_sale)),
  1, 'PARIDADE: venda normal gera comissão (flag off)');
-- ENTREGA aconteceu: card criado no board (o que a conversão PULA).
SELECT is((SELECT count(*)::int FROM public.kanban_cards
   WHERE board_id='cf000000-0000-0000-0000-00000000b100'::uuid
     AND client_id='cf000000-0000-0000-0000-0000000c5000'::uuid AND card_type='upsell'),
  1, 'PARIDADE: venda normal ENTREGA card de board (flag off = baseline)');
-- ENTREGA: produto entrou em contracted_products.
SELECT ok((SELECT 'cf-prod' = ANY(contracted_products) FROM public.clients
   WHERE id='cf000000-0000-0000-0000-0000000c5000'::uuid),
  'PARIDADE: venda normal entrega contracted_products (flag off)');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
