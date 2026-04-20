-- 20260420_teste01_e9f754cc_backfill.sql
--
-- One-shot backfill — NÃO é migration, não entra em supabase/migrations/.
--
-- MOTIVO
--   Cliente "TESTE 01" (id e9f754cc-b34b-4fad-b9ad-ace7337e0a38) foi criado
--   pelo usuário CTO em 2026-04-20 19:56 BRT via hook useClientRegistration.
--   Por causa do bug de RLS corrigido em
--   supabase/migrations/20260420190000_fix_cto_missing_in_role_policies.sql,
--   os INSERTs em financeiro_tasks, financeiro_client_onboarding e
--   financeiro_active_clients executados no contexto do CTO foram bloqueados
--   silenciosamente pelas policies. Resultado: cliente órfão.
--
--   Este script reconstitui os registros financeiros esperados a partir
--   de clients + client_product_values, preservando a mesma forma que o
--   hook useClientRegistration.ts (src/hooks/useClientRegistration.ts:~459)
--   teria produzido. Idempotente: pode rodar múltiplas vezes sem duplicar.
--
-- PRÉ-CONDIÇÃO
--   Rodar APÓS aplicar 20260420190000_fix_cto_missing_in_role_policies.sql.
--   Como é SQL direto (não chama RLS do usuário), aplicar como service_role
--   via MCP Supabase ou psql autenticado.
--
-- COMO EXECUTAR
--   Via MCP Supabase:  execute_sql(project_id=..., query=<este arquivo>)
--   Via psql:          psql $DATABASE_URL -f supabase/backfills/...

-- =========================================================================
-- 0. Diagnóstico prévio (READ-ONLY — só confirma estado inicial)
-- =========================================================================
SELECT 'PRE' AS phase, id, name, contracted_products, entry_date, contract_duration_months
FROM public.clients
WHERE id = 'e9f754cc-b34b-4fad-b9ad-ace7337e0a38';

SELECT 'PRE' AS phase, product_slug, product_name, monthly_value
FROM public.client_product_values
WHERE client_id = 'e9f754cc-b34b-4fad-b9ad-ace7337e0a38'
ORDER BY created_at ASC;

SELECT 'PRE financeiro_tasks' AS what, count(*) AS n
FROM public.financeiro_tasks
WHERE client_id = 'e9f754cc-b34b-4fad-b9ad-ace7337e0a38'
UNION ALL
SELECT 'PRE financeiro_client_onboarding', count(*)
FROM public.financeiro_client_onboarding
WHERE client_id = 'e9f754cc-b34b-4fad-b9ad-ace7337e0a38'
UNION ALL
SELECT 'PRE financeiro_active_clients', count(*)
FROM public.financeiro_active_clients
WHERE client_id = 'e9f754cc-b34b-4fad-b9ad-ace7337e0a38';

-- =========================================================================
-- 1. Backfill dentro de transação atômica
-- =========================================================================
BEGIN;

-- 1.1 financeiro_client_onboarding (1 linha por produto)
-- Shape: step 'novo_cliente', contract_expiration_date = entry_date + duration
-- UNIQUE(client_id, product_slug) → ON CONFLICT DO NOTHING garante idempotência.
INSERT INTO public.financeiro_client_onboarding (
  client_id, product_slug, product_name, current_step, contract_expiration_date
)
SELECT
  c.id,
  cpv.product_slug,
  cpv.product_name,
  'novo_cliente',
  (COALESCE(c.entry_date::DATE, CURRENT_DATE)
     + (COALESCE(c.contract_duration_months, 12) || ' months')::INTERVAL
  )::TIMESTAMP WITH TIME ZONE
FROM public.clients c
JOIN public.client_product_values cpv
  ON cpv.client_id = c.id
WHERE c.id = 'e9f754cc-b34b-4fad-b9ad-ace7337e0a38'
ON CONFLICT (client_id, product_slug) DO NOTHING;

-- 1.2 financeiro_active_clients (1 linha por produto)
-- Shape do trigger process_upsell: monthly_value = 0 (placeholder),
-- invoice_status='em_dia', contract_expires_at = entry_date + duration.
INSERT INTO public.financeiro_active_clients (
  client_id, product_slug, product_name, monthly_value, invoice_status,
  contract_expires_at
)
SELECT
  c.id,
  cpv.product_slug,
  cpv.product_name,
  0,
  'em_dia',
  (COALESCE(c.entry_date::DATE, CURRENT_DATE)
     + (COALESCE(c.contract_duration_months, 12) || ' months')::INTERVAL
  )::TIMESTAMP WITH TIME ZONE
FROM public.clients c
JOIN public.client_product_values cpv
  ON cpv.client_id = c.id
WHERE c.id = 'e9f754cc-b34b-4fad-b9ad-ace7337e0a38'
ON CONFLICT (client_id, product_slug) DO NOTHING;

-- 1.3 financeiro_tasks (1 task por produto, pending, due=now+3d)
-- Shape replicado de src/hooks/useClientRegistration.ts:~459:
--   title = "<name> — <product_name> → Cadastrar no Asaas + Enviar 1ª Cobrança"
-- Não há UNIQUE em (client_id, product_slug) aqui, então dedup manual via NOT EXISTS.
INSERT INTO public.financeiro_tasks (
  client_id, product_slug, product_name, title, status, due_date
)
SELECT
  c.id,
  cpv.product_slug,
  cpv.product_name,
  c.name || ' — ' || cpv.product_name || ' → Cadastrar no Asaas + Enviar 1ª Cobrança',
  'pending',
  (now() + INTERVAL '3 days')
FROM public.clients c
JOIN public.client_product_values cpv
  ON cpv.client_id = c.id
WHERE c.id = 'e9f754cc-b34b-4fad-b9ad-ace7337e0a38'
  AND NOT EXISTS (
    SELECT 1 FROM public.financeiro_tasks ft
    WHERE ft.client_id = c.id
      AND ft.product_slug = cpv.product_slug
  );

COMMIT;

-- =========================================================================
-- 2. Verificação pós (READ-ONLY — confirma backfill)
-- =========================================================================
SELECT 'POST financeiro_tasks' AS what, count(*) AS n
FROM public.financeiro_tasks
WHERE client_id = 'e9f754cc-b34b-4fad-b9ad-ace7337e0a38'
UNION ALL
SELECT 'POST financeiro_client_onboarding', count(*)
FROM public.financeiro_client_onboarding
WHERE client_id = 'e9f754cc-b34b-4fad-b9ad-ace7337e0a38'
UNION ALL
SELECT 'POST financeiro_active_clients', count(*)
FROM public.financeiro_active_clients
WHERE client_id = 'e9f754cc-b34b-4fad-b9ad-ace7337e0a38';

-- Esperado: counts > 0 em todas 3, exatamente 1 por produto em
-- client_product_values.
