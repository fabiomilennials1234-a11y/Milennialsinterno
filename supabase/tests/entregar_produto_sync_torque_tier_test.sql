-- supabase/tests/entregar_produto_sync_torque_tier_test.sql
-- pgTAP — invariante de sincronização de tier torque em public._entregar_produto
-- (ADR 0013, opção C). Prova que entregar um sub-tier torque sincroniza
-- atomicamente a base 'torque-crm' (contracted_products) E o tier derivado
-- (torque_crm_products), idempotente, com o mapeamento legado v8→torque, sem
-- escrever sufixo inválido e sem falhar.
--
-- CAMINHO: chama _entregar_produto DIRETO como owner (o runner roda como postgres,
-- que tem EXECUTE no helper SECURITY DEFINER). É o caminho mais isolado — não
-- depende da autz de process_upsell/conceder_produto, que é escopo dos testes
-- daqueles chamadores. monthly_value=0 para não poluir asserts financeiros.
--
-- Este teste FALHARIA contra a versão de _entregar_produto SEM o galho 1b (tier
-- nunca apareceria em torque_crm_products) e PASSA com a migration
-- 20260615160000. Runner: supabase db test (local) ou db query --linked (remoto)
-- dentro de BEGIN/ROLLBACK — NÃO suja dados reais.
BEGIN;

SELECT plan(13);

-- Prova estrutural: o corpo vivo carrega o galho de sync e o quirk v8→torque.
SELECT ok(
  pg_get_functiondef('public._entregar_produto(uuid,text,text,numeric,uuid)'::regprocedure)
    LIKE '%torque-crm-%',
  'estrutura: _entregar_produto detecta prefixo torque-crm-');
SELECT ok(
  pg_get_functiondef('public._entregar_produto(uuid,text,text,numeric,uuid)'::regprocedure)
    LIKE '%WHEN ''v8''%THEN ''torque''%',
  'estrutura: mapeamento legado v8 -> torque presente (ADR 0006)');

-- =============================================================================
-- SEED — clientes de teste descartáveis (rollback ao fim).
--   cli_base : tem SÓ a base 'torque-crm', sem tier  (cenário 1, 4, 5, 6)
--   cli_zero : SEM base nenhuma                       (cenário 3)
--   cli_v8   : SÓ base, recebe slug legado v8         (cenário 2)
-- =============================================================================
-- torque_crm_products é NOT NULL default '{}': omitido aqui (cenário "sem tier"
-- = array vazio).
INSERT INTO public.clients (id, name, contracted_products) VALUES
 ('e7000000-0000-0000-0000-0000000000b1'::uuid, 'EP Base',  ARRAY['torque-crm']::text[]),
 ('e7000000-0000-0000-0000-0000000000b2'::uuid, 'EP Zero',  ARRAY[]::text[]),
 ('e7000000-0000-0000-0000-0000000000b3'::uuid, 'EP V8',    ARRAY['torque-crm']::text[])
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 1. Entregar 'torque-crm-automation' num cliente com SÓ base:
--    tier 'automation' aparece E base 'torque-crm' permanece.
-- =============================================================================
SELECT lives_ok($$
  SELECT public._entregar_produto(
    'e7000000-0000-0000-0000-0000000000b1'::uuid,
    'torque-crm-automation', 'Torque Automation', 0, NULL)
$$, '1: entrega torque-crm-automation roda sem erro');

SELECT ok(
  (SELECT 'automation' = ANY(torque_crm_products)
   FROM public.clients WHERE id='e7000000-0000-0000-0000-0000000000b1'::uuid),
  '1: tier ''automation'' presente em torque_crm_products');
SELECT ok(
  (SELECT 'torque-crm' = ANY(contracted_products)
   FROM public.clients WHERE id='e7000000-0000-0000-0000-0000000000b1'::uuid),
  '1: base ''torque-crm'' presente em contracted_products');

-- =============================================================================
-- 2. Mapeamento legado: 'torque-crm-v8' -> tier 'torque' (NÃO 'v8'). ADR 0006.
-- =============================================================================
SELECT public._entregar_produto(
  'e7000000-0000-0000-0000-0000000000b3'::uuid, 'torque-crm-v8', 'Torque V8', 0, NULL);

SELECT ok(
  (SELECT 'torque' = ANY(torque_crm_products)
   FROM public.clients WHERE id='e7000000-0000-0000-0000-0000000000b3'::uuid),
  '2: slug legado v8 grava tier ''torque''');
SELECT ok(
  (SELECT NOT ('v8' = ANY(torque_crm_products))
   FROM public.clients WHERE id='e7000000-0000-0000-0000-0000000000b3'::uuid),
  '2: tier ''v8'' NUNCA escrito (prova do mapeamento legado)');

-- =============================================================================
-- 3. Cliente SEM base nenhuma: entrega adiciona a base 'torque-crm'.
-- =============================================================================
SELECT public._entregar_produto(
  'e7000000-0000-0000-0000-0000000000b2'::uuid, 'torque-crm-copilot', 'Torque Copilot', 0, NULL);

SELECT ok(
  (SELECT 'torque-crm' = ANY(contracted_products) AND 'copilot' = ANY(torque_crm_products)
   FROM public.clients WHERE id='e7000000-0000-0000-0000-0000000000b2'::uuid),
  '3: cliente sem base ganha base ''torque-crm'' + tier ''copilot''');

-- =============================================================================
-- 4. Idempotência: entregar o MESMO slug 2x não duplica tier nem base.
-- =============================================================================
SELECT public._entregar_produto(
  'e7000000-0000-0000-0000-0000000000b1'::uuid, 'torque-crm-automation', 'Torque Automation', 0, NULL);

SELECT is(
  (SELECT count(*)::int FROM public.clients c, unnest(c.torque_crm_products) AS t
   WHERE c.id='e7000000-0000-0000-0000-0000000000b1'::uuid AND t = 'automation'),
  1, '4: tier ''automation'' não duplica após 2ª entrega');
SELECT is(
  (SELECT count(*)::int FROM public.clients c, unnest(c.contracted_products) AS t
   WHERE c.id='e7000000-0000-0000-0000-0000000000b1'::uuid AND t = 'torque-crm'),
  1, '4: base ''torque-crm'' não duplica após 2ª entrega');

-- =============================================================================
-- 5. Sufixo inválido: 'torque-crm-xpto' não falha e não escreve tier inválido.
-- =============================================================================
SELECT lives_ok($$
  SELECT public._entregar_produto(
    'e7000000-0000-0000-0000-0000000000b1'::uuid, 'torque-crm-xpto', 'Torque Xpto', 0, NULL)
$$, '5: sufixo inválido NÃO falha a função');
SELECT ok(
  (SELECT NOT ('xpto' = ANY(torque_crm_products))
   FROM public.clients WHERE id='e7000000-0000-0000-0000-0000000000b1'::uuid),
  '5: sufixo inválido NÃO escreve tier');

-- =============================================================================
-- 6. Invariante de não-drift global: todo cliente de teste com tier tem base.
-- =============================================================================
SELECT is(
  (SELECT count(*)::int FROM public.clients
   WHERE id IN ('e7000000-0000-0000-0000-0000000000b1'::uuid,
                'e7000000-0000-0000-0000-0000000000b2'::uuid,
                'e7000000-0000-0000-0000-0000000000b3'::uuid)
     AND torque_crm_products IS NOT NULL
     AND cardinality(torque_crm_products) > 0
     AND NOT ('torque-crm' = ANY(COALESCE(contracted_products, ARRAY[]::text[])))),
  0, '6: invariante — nenhum cliente com tier sem a base ''torque-crm''');

SELECT * FROM finish();
ROLLBACK;
