-- supabase/tests/concessao_entregar_produto_parity_test.sql
-- pgTAP — Slice #145 (Concessão). ADR 0009.
--
-- INVARIANTE DE PARIDADE COMPORTAMENTAL:
--   Inserir um upsell produz EXATAMENTE os mesmos efeitos ANTES e DEPOIS do
--   refactor que extrai public._entregar_produto() de public.process_upsell().
--
-- Este teste é o GATE do red-green do refactor:
--   1. RED/baseline: roda contra o trigger ATUAL (monolítico) -> VERDE.
--   2. GREEN: roda contra o trigger REFATORADO (que chama _entregar_produto) ->
--      continua VERDE, sem alterar nenhuma asserção.
--
-- Mede os efeitos via INTERFACE (INSERT em upsells -> AFTER trigger), nunca
-- inspecionando implementação. Cobre os 7 galhos do pipeline de entrega + o
-- galho de dinheiro (comissão) que PERMANECE no trigger:
--   1. upsell_commissions: 7% de NEW.monthly_value  (DINHEIRO — fica no trigger)
--   2. clients.contracted_products contém o slug
--   3. client_product_values com o monthly_value REAL (NEW.monthly_value)
--   4. kanban_cards no board do slug, coluna "novos clientes", título "UP Sell: "
--   5. financeiro_active_clients com monthly_value = 0 (COMPORTAMENTO VIVO HOJE —
--      hardcoded na linha ~269 do trigger; preservado pelo refactor, NÃO corrigido.
--      Dívida registrada: ADR 0009 + brief do fundador.)
--   6. financeiro_client_onboarding (current_step='novo_cliente')
--   7. financeiro_tasks (1 task pending)
--
-- E o pulo de millennials-growth: 2º upsell com esse slug NÃO gera card.
--
-- Board/coluna/cliente são SEEDADOS pelo teste (determinístico) — não dependem
-- de dados de produção. Tudo rola dentro de BEGIN/ROLLBACK (RLS desligada no
-- runner Management API; o trigger é SECURITY DEFINER e roda como owner).
--
-- UUID prefix: 'cc000000'. Runner: scripts/sb-pgtap.sh supabase/tests/concessao_entregar_produto_parity_test.sql
BEGIN;

SELECT plan(11);

-- =============================================================================
-- SEED
--   1 usuário (vendedor), 1 cliente, 1 board com slug próprio + coluna
--   "NOVOS CLIENTES". Slug 'cc-parity-prod' roteia o card pra esse board.
-- =============================================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES ('cc000000-0000-0000-0000-0000000000a1'::uuid,'00000000-0000-0000-0000-000000000000'::uuid,
        'cc-seller@m.test',crypt('t',gen_salt('bf')),'authenticated','authenticated',now(),now(),'')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id,name,email)
VALUES ('cc000000-0000-0000-0000-0000000000a1'::uuid,'CC Seller','cc-seller@m.test')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.clients (id,name,entry_date,contract_duration_months)
VALUES ('cc000000-0000-0000-0000-0000000c1000'::uuid,'CC Parity Client',
        '2026-01-15'::date, 12)
ON CONFLICT (id) DO NOTHING;

-- Board + coluna do slug de teste (card roteia por kanban_boards.slug).
INSERT INTO public.kanban_boards (id, slug, name)
VALUES ('cc000000-0000-0000-0000-00000000b100'::uuid,'cc-parity-prod','CC Parity Board')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kanban_columns (id, board_id, title, position)
VALUES ('cc000000-0000-0000-0000-00000000c100'::uuid,
        'cc000000-0000-0000-0000-00000000b100'::uuid,'NOVOS CLIENTES',0)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- ATO: inserir o upsell (dispara AFTER trigger process_upsell).
--   monthly_value = 1000  -> comissão esperada 70; client_product_values 1000.
-- =============================================================================
INSERT INTO public.upsells (id, client_id, product_slug, product_name, monthly_value, sold_by, sold_by_name)
VALUES ('cc000000-0000-0000-0000-0000000059a1'::uuid,
        'cc000000-0000-0000-0000-0000000c1000'::uuid,
        'cc-parity-prod','CC Parity Product', 1000,
        'cc000000-0000-0000-0000-0000000000a1'::uuid,'CC Seller')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 1. DINHEIRO — comissão 7% (= 70). Fica no trigger, NÃO em _entregar_produto.
-- ---------------------------------------------------------------------------
SELECT is(
  (SELECT commission_value FROM public.upsell_commissions
     WHERE upsell_id='cc000000-0000-0000-0000-0000000059a1'::uuid),
  70::numeric, 'comissão 7% de 1000 = 70 (galho de dinheiro preservado no trigger)');

SELECT is(
  (SELECT commission_percentage::int FROM public.upsell_commissions
     WHERE upsell_id='cc000000-0000-0000-0000-0000000059a1'::uuid),
  7, 'commission_percentage = 7');

-- ---------------------------------------------------------------------------
-- 2. ENTREGA — contracted_products do cliente passa a conter o slug.
-- ---------------------------------------------------------------------------
SELECT ok(
  (SELECT 'cc-parity-prod' = ANY(contracted_products) FROM public.clients
     WHERE id='cc000000-0000-0000-0000-0000000c1000'::uuid),
  'clients.contracted_products contém o slug entregue');

-- ---------------------------------------------------------------------------
-- 3. ENTREGA — client_product_values com o monthly_value REAL (1000).
-- ---------------------------------------------------------------------------
SELECT is(
  (SELECT monthly_value FROM public.client_product_values
     WHERE client_id='cc000000-0000-0000-0000-0000000c1000'::uuid
       AND product_slug='cc-parity-prod'),
  1000::numeric, 'client_product_values guarda o monthly_value real (1000)');

-- ---------------------------------------------------------------------------
-- 4. ENTREGA — card no board do slug, coluna "novos clientes", título "UP Sell:".
-- ---------------------------------------------------------------------------
SELECT is(
  (SELECT count(*)::int FROM public.kanban_cards
     WHERE board_id='cc000000-0000-0000-0000-00000000b100'::uuid
       AND column_id='cc000000-0000-0000-0000-00000000c100'::uuid
       AND client_id='cc000000-0000-0000-0000-0000000c1000'::uuid
       AND card_type='upsell'
       AND title='UP Sell: CC Parity Client'),
  1, 'card de board gerado na coluna novos-clientes do slug, título "UP Sell: <cliente>"');

-- Audit-paridade: o card carrega created_by = sold_by do upsell (não NULL).
SELECT is(
  (SELECT created_by FROM public.kanban_cards
     WHERE board_id='cc000000-0000-0000-0000-00000000b100'::uuid
       AND client_id='cc000000-0000-0000-0000-0000000c1000'::uuid
       AND card_type='upsell'),
  'cc000000-0000-0000-0000-0000000000a1'::uuid,
  'card.created_by = sold_by do upsell (audit-paridade preservada)');

-- ---------------------------------------------------------------------------
-- 5. FINANCEIRO — linha active_clients com monthly_value = 0 (COMPORTAMENTO VIVO).
--    Dívida conhecida: o trigger hardcoda 0 aqui (não usa NEW.monthly_value).
--    O refactor PRESERVA isso (parametrizado, mas process_upsell passa 0).
-- ---------------------------------------------------------------------------
SELECT is(
  (SELECT monthly_value FROM public.financeiro_active_clients
     WHERE client_id='cc000000-0000-0000-0000-0000000c1000'::uuid
       AND product_slug='cc-parity-prod'),
  0::numeric, 'financeiro_active_clients.monthly_value = 0 (comportamento vivo do upsell, preservado)');

SELECT is(
  (SELECT invoice_status FROM public.financeiro_active_clients
     WHERE client_id='cc000000-0000-0000-0000-0000000c1000'::uuid
       AND product_slug='cc-parity-prod'),
  'em_dia', 'financeiro_active_clients.invoice_status = em_dia');

-- ---------------------------------------------------------------------------
-- 6. FINANCEIRO — onboarding per-product no step inicial.
-- ---------------------------------------------------------------------------
SELECT is(
  (SELECT current_step FROM public.financeiro_client_onboarding
     WHERE client_id='cc000000-0000-0000-0000-0000000c1000'::uuid
       AND product_slug='cc-parity-prod'),
  'novo_cliente', 'financeiro_client_onboarding criado em current_step=novo_cliente');

-- ---------------------------------------------------------------------------
-- 7. FINANCEIRO — task pending de cobrança.
-- ---------------------------------------------------------------------------
SELECT is(
  (SELECT count(*)::int FROM public.financeiro_tasks
     WHERE client_id='cc000000-0000-0000-0000-0000000c1000'::uuid
       AND product_slug='cc-parity-prod'
       AND status='pending'),
  1, 'financeiro_tasks: 1 task pending gerada');

-- ---------------------------------------------------------------------------
-- 8. ROTEAMENTO — millennials-growth NÃO gera card (pulo preservado).
--    2º upsell, slug millennials-growth: efeitos financeiros sim, card NÃO.
-- ---------------------------------------------------------------------------
INSERT INTO public.upsells (id, client_id, product_slug, product_name, monthly_value, sold_by, sold_by_name)
VALUES ('cc000000-0000-0000-0000-0000000059a2'::uuid,
        'cc000000-0000-0000-0000-0000000c1000'::uuid,
        'millennials-growth','CC Growth', 500,
        'cc000000-0000-0000-0000-0000000000a1'::uuid,'CC Seller')
ON CONFLICT (id) DO NOTHING;

SELECT is(
  (SELECT count(*)::int FROM public.kanban_cards
     WHERE client_id='cc000000-0000-0000-0000-0000000c1000'::uuid
       AND title='UP Sell: CC Parity Client'
       AND description LIKE '%CC Growth%'),
  0, 'millennials-growth NÃO gera card de board (pulo de roteamento preservado)');

SELECT * FROM finish();
ROLLBACK;
