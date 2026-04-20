-- supabase/tests/rpc/create_client_with_automations.sql
-- pgTAP regression test for create_client_with_automations RPC.
-- Cobre: happy path por role, permissão negada, CNPJ duplicado (rollback),
-- idempotência, payload inválido, rollback em FK violation, Millennials Growth
-- welcome task, ausência de Growth = no welcome task.

BEGIN;

SELECT plan(28);

-- =============================================================================
-- SETUP: 4 users (ceo, cto, gestor_projetos, financeiro, design-negativo),
-- grupo, squad, e um gestor_projetos dentro do grupo pra welcome task.
-- =============================================================================

-- auth.users
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES
  ('aa000001-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'rpc-ceo@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('aa000001-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'rpc-cto@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('aa000001-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'rpc-gp@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('aa000001-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'rpc-fin@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('aa000001-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'rpc-design@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  -- Um PM dentro do grupo (para welcome task)
  ('aa000001-0000-0000-0000-000000000006'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'rpc-pm-in-group@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  -- Um ads manager pra testar automação
  ('aa000001-0000-0000-0000-000000000007'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'rpc-ads@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

-- Criar grupo & squad ANTES dos profiles (profiles referenciam group_id)
INSERT INTO public.organization_groups (id, name, slug, position)
VALUES ('aa000002-0000-0000-0000-000000000001'::uuid, 'Grupo RPC Test', 'grupo-rpc-test', 999)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.squads (id, name, slug, group_id, position)
VALUES ('aa000003-0000-0000-0000-000000000001'::uuid, 'Squad RPC Test', 'squad-rpc-test',
        'aa000002-0000-0000-0000-000000000001'::uuid, 999)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email, group_id)
VALUES
  ('aa000001-0000-0000-0000-000000000001'::uuid, 'RPC CEO', 'rpc-ceo@test.local', NULL),
  ('aa000001-0000-0000-0000-000000000002'::uuid, 'RPC CTO', 'rpc-cto@test.local', NULL),
  ('aa000001-0000-0000-0000-000000000003'::uuid, 'RPC GP', 'rpc-gp@test.local', NULL),
  ('aa000001-0000-0000-0000-000000000004'::uuid, 'RPC Fin', 'rpc-fin@test.local', NULL),
  ('aa000001-0000-0000-0000-000000000005'::uuid, 'RPC Design', 'rpc-design@test.local', NULL),
  ('aa000001-0000-0000-0000-000000000006'::uuid, 'RPC PM-in-group',
   'rpc-pm-in-group@test.local', 'aa000002-0000-0000-0000-000000000001'::uuid),
  ('aa000001-0000-0000-0000-000000000007'::uuid, 'RPC Ads',
   'rpc-ads@test.local', NULL)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES
  ('aa000001-0000-0000-0000-000000000001'::uuid, 'ceo'),
  ('aa000001-0000-0000-0000-000000000002'::uuid, 'cto'),
  ('aa000001-0000-0000-0000-000000000003'::uuid, 'gestor_projetos'),
  ('aa000001-0000-0000-0000-000000000004'::uuid, 'financeiro'),
  ('aa000001-0000-0000-0000-000000000005'::uuid, 'design'),
  ('aa000001-0000-0000-0000-000000000006'::uuid, 'gestor_projetos'),  -- PM no grupo
  ('aa000001-0000-0000-0000-000000000007'::uuid, 'gestor_ads')
ON CONFLICT (user_id, role) DO NOTHING;

-- =============================================================================
-- Helper: switch active user pra chamada autenticada
-- =============================================================================
-- set_config('request.jwt.claims', json_build_object('sub', <uuid>)::text, true)
-- faz auth.uid() retornar aquele UUID dentro da mesma transação.

-- =============================================================================
-- TESTE 1: Happy path CEO — payload completo, 11+ automations esperadas
-- =============================================================================
SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'aa000001-0000-0000-0000-000000000001')::text, true);

SELECT lives_ok(
  $$
    SELECT public.create_client_with_automations(
      jsonb_build_object(
        'name', 'Cliente RPC CEO Test',
        'cnpj', '11222333000144',
        'cpf', '12345678901',
        'phone', '+5511999998888',
        'razao_social', 'Razão Social LTDA',
        'niche', 'ecommerce',
        'general_info', 'Info geral',
        'expected_investment', 5000,
        'monthly_value', 3000,
        'sales_percentage', 10,
        'group_id', 'aa000002-0000-0000-0000-000000000001',
        'squad_id', 'aa000003-0000-0000-0000-000000000001',
        'assigned_ads_manager', 'aa000001-0000-0000-0000-000000000007',
        'assigned_comercial', 'aa000001-0000-0000-0000-000000000001',
        'assigned_mktplace', 'aa000001-0000-0000-0000-000000000001',
        'entry_date', '2026-04-20',
        'contract_duration_months', 12,
        'payment_due_day', 10,
        'contracted_products', jsonb_build_array('millennials-growth', 'outbound'),
        'torque_crm_products', '[]'::jsonb,
        'product_values', jsonb_build_array(
          jsonb_build_object('product_slug', 'millennials-growth',
                             'product_name', 'Millennials Growth',
                             'monthly_value', 2000),
          jsonb_build_object('product_slug', 'outbound',
                             'product_name', 'Millennials Outbound',
                             'monthly_value', 1000)
        )
      ),
      NULL
    )
  $$,
  'ceo: create_client_with_automations happy path lives_ok'
);

-- Recupera o client criado pra asserts
SELECT is(
  (SELECT count(*)::int FROM public.clients WHERE name = 'Cliente RPC CEO Test'),
  1,
  'ceo: exactly 1 client created'
);

SELECT is(
  (SELECT count(*)::int FROM public.onboarding_tasks ot
   JOIN public.clients c ON c.id = ot.client_id
   WHERE c.name = 'Cliente RPC CEO Test' AND ot.task_type = 'marcar_call_1'),
  -- 1 do trigger_create_initial_onboarding_task + 1 do insert manual = 2
  -- (paridade com hook legado — dívida técnica conhecida)
  2,
  'ceo: onboarding_tasks marcar_call_1 inserted (hook+trigger duplicam hoje, paridade preservada)'
);

SELECT is(
  (SELECT count(*)::int FROM public.ads_new_client_notifications
   WHERE client_name = 'Cliente RPC CEO Test'),
  1,
  'ceo: 1 ads notification created'
);

SELECT is(
  (SELECT count(*)::int FROM public.client_product_values cpv
   JOIN public.clients c ON c.id = cpv.client_id
   WHERE c.name = 'Cliente RPC CEO Test'),
  2,
  'ceo: 2 product values (per product)'
);

SELECT is(
  (SELECT count(*)::int FROM public.financeiro_tasks ft
   JOIN public.clients c ON c.id = ft.client_id
   WHERE c.name = 'Cliente RPC CEO Test'),
  2,
  'ceo: 2 financeiro_tasks (per product)'
);

SELECT is(
  (SELECT count(*)::int FROM public.financeiro_client_onboarding fco
   JOIN public.clients c ON c.id = fco.client_id
   WHERE c.name = 'Cliente RPC CEO Test'),
  2,
  'ceo: 2 financeiro_client_onboarding rows (per product)'
);

SELECT is(
  (SELECT count(*)::int FROM public.financeiro_active_clients fac
   JOIN public.clients c ON c.id = fac.client_id
   WHERE c.name = 'Cliente RPC CEO Test'),
  2,
  'ceo: 2 financeiro_active_clients rows (per product)'
);

-- Welcome task pra PM no grupo (Growth contratado + group_id presente)
SELECT is(
  (SELECT count(*)::int FROM public.department_tasks dt
   JOIN public.clients c ON c.id = dt.related_client_id
   WHERE c.name = 'Cliente RPC CEO Test'
     AND dt.department = 'gestor_projetos'
     AND dt.title ILIKE 'Dar boas-vindas para %'),
  1,
  'ceo: PM welcome task created (Growth + group com PM)'
);

-- =============================================================================
-- TESTE 2: Happy path CTO — garante que o fix do is_ceo_includes_cto cola aqui
-- =============================================================================
SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'aa000001-0000-0000-0000-000000000002')::text, true);

SELECT lives_ok(
  $$
    SELECT public.create_client_with_automations(
      jsonb_build_object(
        'name', 'Cliente RPC CTO Test',
        'entry_date', '2026-04-20'
      ),
      NULL
    )
  $$,
  'cto: create_client_with_automations happy path lives_ok (regressão anti bug CTO)'
);

SELECT is(
  (SELECT count(*)::int FROM public.clients WHERE name = 'Cliente RPC CTO Test'),
  1,
  'cto: client created'
);

-- =============================================================================
-- TESTE 3: Happy path gestor_projetos
-- =============================================================================
SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'aa000001-0000-0000-0000-000000000003')::text, true);

SELECT lives_ok(
  $$
    SELECT public.create_client_with_automations(
      jsonb_build_object('name', 'Cliente RPC GP Test', 'entry_date', '2026-04-20'),
      NULL
    )
  $$,
  'gestor_projetos: create_client_with_automations lives_ok'
);

-- =============================================================================
-- TESTE 4: Happy path financeiro
-- =============================================================================
SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'aa000001-0000-0000-0000-000000000004')::text, true);

SELECT lives_ok(
  $$
    SELECT public.create_client_with_automations(
      jsonb_build_object('name', 'Cliente RPC Fin Test', 'entry_date', '2026-04-20'),
      NULL
    )
  $$,
  'financeiro: create_client_with_automations lives_ok'
);

-- =============================================================================
-- TESTE 5: Permissão negada — role 'design' → P0003
-- =============================================================================
SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'aa000001-0000-0000-0000-000000000005')::text, true);

SELECT throws_ok(
  $$
    SELECT public.create_client_with_automations(
      jsonb_build_object('name', 'Cliente design nao pode', 'entry_date', '2026-04-20'),
      NULL
    )
  $$,
  'P0003',
  NULL,
  'design: RPC raises P0003 (insufficient privilege)'
);

-- Confirma que cliente NÃO foi inserido
SELECT is(
  (SELECT count(*)::int FROM public.clients WHERE name = 'Cliente design nao pode'),
  0,
  'design: no client inserted after rejection'
);

-- =============================================================================
-- TESTE 6: CNPJ duplicado — primeiro insert passou, segundo deve explodir P0004
-- E rollback deve desfazer TUDO (cliente, tasks, etc)
-- =============================================================================
SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'aa000001-0000-0000-0000-000000000001')::text, true);

-- CNPJ '11222333000144' já foi cadastrado no teste 1
SELECT throws_ok(
  $$
    SELECT public.create_client_with_automations(
      jsonb_build_object(
        'name', 'Cliente Duplicado',
        'cnpj', '11.222.333/0001-44',  -- mesma após sanitize
        'entry_date', '2026-04-20',
        'assigned_ads_manager', 'aa000001-0000-0000-0000-000000000007'
      ),
      NULL
    )
  $$,
  'P0004',
  NULL,
  'cnpj duplicate: RPC raises P0004'
);

-- Rollback verificado: 0 rows com name 'Cliente Duplicado' em TODAS as tabelas
SELECT is(
  (SELECT count(*)::int FROM public.clients WHERE name = 'Cliente Duplicado'),
  0,
  'rollback cnpj dup: no client row'
);

SELECT is(
  (SELECT count(*)::int FROM public.ads_new_client_notifications
   WHERE client_name = 'Cliente Duplicado'),
  0,
  'rollback cnpj dup: no ads notification row'
);

SELECT is(
  (SELECT count(*)::int FROM public.onboarding_tasks ot
   LEFT JOIN public.clients c ON c.id = ot.client_id
   WHERE c.name = 'Cliente Duplicado' OR ot.title ILIKE '%Cliente Duplicado%'),
  0,
  'rollback cnpj dup: no onboarding_tasks row'
);

-- =============================================================================
-- TESTE 7: Idempotência — mesma key 2x retorna mesmo client_id
-- =============================================================================
SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'aa000001-0000-0000-0000-000000000001')::text, true);

-- Primeira chamada
DO $$
DECLARE
  r jsonb;
  v_client_id1 uuid;
  v_client_id2 uuid;
BEGIN
  SELECT public.create_client_with_automations(
    jsonb_build_object('name', 'Cliente Idem', 'entry_date', '2026-04-20'),
    'idem-test-key-12345'
  ) INTO r;
  v_client_id1 := (r->>'client_id')::uuid;

  -- Segunda chamada com mesma key
  SELECT public.create_client_with_automations(
    jsonb_build_object('name', 'Cliente Idem DIFERENTE NOME NAO IMPORTA',
                       'entry_date', '2026-04-20'),
    'idem-test-key-12345'
  ) INTO r;
  v_client_id2 := (r->>'client_id')::uuid;

  IF v_client_id1 <> v_client_id2 THEN
    RAISE EXCEPTION 'idempotency failed: client_id differs (% vs %)',
      v_client_id1, v_client_id2;
  END IF;

  IF (r->>'idempotent_hit')::boolean <> true THEN
    RAISE EXCEPTION 'idempotency failed: idempotent_hit not true';
  END IF;
END$$;

SELECT is(
  (SELECT count(*)::int FROM public.clients WHERE name LIKE 'Cliente Idem%'),
  1,
  'idempotency: exactly 1 client created even after 2 calls'
);

SELECT is(
  (SELECT count(*)::int FROM public.client_idempotency_keys
   WHERE key = 'idem-test-key-12345'),
  1,
  'idempotency: exactly 1 row in client_idempotency_keys'
);

-- =============================================================================
-- TESTE 8: Payload inválido — CNPJ malformado (5 dígitos)
-- =============================================================================
SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'aa000001-0000-0000-0000-000000000001')::text, true);

SELECT throws_ok(
  $$
    SELECT public.create_client_with_automations(
      jsonb_build_object('name', 'Cliente Bad CNPJ', 'cnpj', '12345',
                         'entry_date', '2026-04-20'),
      NULL
    )
  $$,
  'P0002',
  NULL,
  'invalid cnpj: RPC raises P0002'
);

-- Payload inválido — name vazio
SELECT throws_ok(
  $$
    SELECT public.create_client_with_automations(
      jsonb_build_object('name', ' '),  -- trim vira vazio
      NULL
    )
  $$,
  'P0002',
  NULL,
  'empty name: RPC raises P0002'
);

-- =============================================================================
-- TESTE 9: FK violation — squad_id inexistente → P0006 + rollback total
-- =============================================================================
SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'aa000001-0000-0000-0000-000000000001')::text, true);

SELECT throws_ok(
  $$
    SELECT public.create_client_with_automations(
      jsonb_build_object(
        'name', 'Cliente FK Viol',
        'entry_date', '2026-04-20',
        'squad_id', '99999999-9999-9999-9999-999999999999'
      ),
      NULL
    )
  $$,
  'P0006',
  NULL,
  'fk violation (squad_id fake): RPC raises P0006'
);

SELECT is(
  (SELECT count(*)::int FROM public.clients WHERE name = 'Cliente FK Viol'),
  0,
  'rollback fk viol: no client row'
);

-- =============================================================================
-- TESTE 10: Sem Millennials Growth → sem welcome task
-- =============================================================================
SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'aa000001-0000-0000-0000-000000000001')::text, true);

SELECT lives_ok(
  $$
    SELECT public.create_client_with_automations(
      jsonb_build_object(
        'name', 'Cliente Sem Growth',
        'entry_date', '2026-04-20',
        'group_id', 'aa000002-0000-0000-0000-000000000001',
        'contracted_products', jsonb_build_array('outbound')  -- SEM growth
      ),
      NULL
    )
  $$,
  'no growth: lives_ok'
);

SELECT is(
  (SELECT count(*)::int FROM public.department_tasks dt
   JOIN public.clients c ON c.id = dt.related_client_id
   WHERE c.name = 'Cliente Sem Growth'
     AND dt.department = 'gestor_projetos'
     AND dt.title ILIKE 'Dar boas-vindas para %'),
  0,
  'no growth: NO welcome task created'
);

-- =============================================================================
-- TESTE 11: Millennials Growth SEM group_id → sem welcome task (mas sem erro)
-- =============================================================================
SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'aa000001-0000-0000-0000-000000000001')::text, true);

SELECT lives_ok(
  $$
    SELECT public.create_client_with_automations(
      jsonb_build_object(
        'name', 'Cliente Growth Sem Grupo',
        'entry_date', '2026-04-20',
        'contracted_products', jsonb_build_array('millennials-growth')
      ),
      NULL
    )
  $$,
  'growth without group: lives_ok'
);

SELECT is(
  (SELECT count(*)::int FROM public.department_tasks dt
   JOIN public.clients c ON c.id = dt.related_client_id
   WHERE c.name = 'Cliente Growth Sem Grupo'
     AND dt.department = 'gestor_projetos'
     AND dt.title ILIKE 'Dar boas-vindas para %'),
  0,
  'growth w/o group: NO welcome task created'
);

-- =============================================================================
-- TESTE 12: Retorno jsonb tem shape esperado (automations_executed, warnings)
-- =============================================================================
SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'aa000001-0000-0000-0000-000000000001')::text, true);

DO $$
DECLARE
  r jsonb;
BEGIN
  SELECT public.create_client_with_automations(
    jsonb_build_object(
      'name', 'Cliente Shape Check',
      'entry_date', '2026-04-20',
      'assigned_comercial', 'aa000001-0000-0000-0000-000000000001'
    ),
    NULL
  ) INTO r;

  IF (r->>'client_id') IS NULL THEN
    RAISE EXCEPTION 'return shape: missing client_id';
  END IF;
  IF (r->>'schema_version') IS NULL THEN
    RAISE EXCEPTION 'return shape: missing schema_version';
  END IF;
  IF jsonb_typeof(r->'automations_executed') <> 'array' THEN
    RAISE EXCEPTION 'return shape: automations_executed not array';
  END IF;
  IF jsonb_typeof(r->'warnings') <> 'array' THEN
    RAISE EXCEPTION 'return shape: warnings not array';
  END IF;
  IF (r->>'idempotent_hit')::boolean <> false THEN
    RAISE EXCEPTION 'return shape: idempotent_hit should be false on fresh call';
  END IF;
END$$;

SELECT pass('return shape: client_id + schema_version + arrays + idempotent_hit present');

SELECT * FROM finish();

ROLLBACK;
