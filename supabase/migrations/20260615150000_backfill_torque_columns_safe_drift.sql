-- 20260615150000_backfill_torque_columns_safe_drift.sql
--
-- BACKFILL PARCIAL E SEGURO do drift entre clients.contracted_products e
-- clients.torque_crm_products (clientes Torque CRM somem da lista de briefing
-- quando as duas colunas não estão coerentes — useTorqueCrmClients exige AMBAS).
--
-- CONTEXTO: há duas representações de sub-produto torque que driftam:
--   - contracted_products: slug base 'torque-crm' + slugs de billing
--     'torque-crm-automation' / 'torque-crm-copilot' (+ legado 'torque-crm-v8').
--   - torque_crm_products: tiers 'torque' / 'automation' / 'copilot'.
-- Write paths divergentes (_entregar_produto só escreve contracted; useUpsells.ts
-- patcha torque_crm_products best-effort no cliente; RPCs de cadastro gravam tier
-- direto do payload) produzem dois tipos de drift.
--
-- ESTA MIGRATION aplica SÓ as correções DETERMINÍSTICAS (sem inventar dado):
--
--   CASO A — "tier sem base" (5 clientes ativos: GOLETRIC Guarulhos, Maria Bonita,
--     Septem, Vital Caps, VitrineVET): já têm tier válido em torque_crm_products,
--     falta só o slug base 'torque-crm' em contracted_products. Adicionar 'torque-crm'
--     é determinístico — o tier JÁ existe, só falta o marcador base. Idempotente.
--
--   CASO B — "sub sem tier, mas com sufixo de billing" (Antonio Luchtenberg):
--     tem 'torque-crm-automation' e 'torque-crm-copilot' em contracted_products,
--     torque_crm_products vazio. O tier está IMPLÍCITO no slug de billing:
--       'torque-crm-automation' -> 'automation', 'torque-crm-copilot' -> 'copilot',
--       'torque-crm-v8' -> 'torque'. Derivar é determinístico. Idempotente.
--
-- NÃO TRATADO AQUI (DECISÃO DE NEGÓCIO — escalado ao fundador, NÃO backfillar):
--   Cauã Mathias, Hugo Dias, JC, Ricardo Pasqualini: têm SÓ 'torque-crm' base, sem
--   nenhum sufixo de billing e sem tier em lugar nenhum. O slug 'torque-crm' base
--   sozinho é AMBÍGUO (qual tier?). NÃO se inventa o tier. Pendente de decisão:
--   (a) qual tier cada um; (b) 'torque-crm' base implica 'torque' por padrão (vira
--   regra de write path + backfill em massa); (c) não são torque e não deveriam
--   aparecer. Ver entregável ao fundador.
--
-- ESCOPO: SOMENTE clientes NÃO arquivados (archived=false). Nenhum arquivado está
-- em drift (verificado no remoto). Set-based e idempotente — re-rodar é no-op.
--
-- NÃO corrige write path. A causa-raiz (sincronização das duas colunas no
-- _entregar_produto) é proposta separada, pendente de revisão do arquiteto.

BEGIN;

-- =============================================================================
-- CASO A — adiciona 'torque-crm' base onde já há tier válido mas falta o base.
-- =============================================================================
UPDATE public.clients c
   SET contracted_products = array_append(
         COALESCE(c.contracted_products, ARRAY[]::text[]), 'torque-crm'),
       updated_at = now()
 WHERE c.archived = false
   AND EXISTS (
     SELECT 1 FROM unnest(COALESCE(c.torque_crm_products, '{}')) t
      WHERE t IN ('torque','automation','copilot'))
   AND NOT EXISTS (
     SELECT 1 FROM unnest(COALESCE(c.contracted_products, '{}')) p
      WHERE p = 'torque-crm' OR p LIKE 'torque-crm-%');

-- =============================================================================
-- CASO B — deriva tiers de slugs de billing onde torque_crm_products está vazio
-- mas há sufixo de billing em contracted_products. Mapeamento determinístico:
--   torque-crm-automation -> automation, torque-crm-copilot -> copilot,
--   torque-crm-v8 -> torque. (O slug base 'torque-crm' SEM sufixo é IGNORADO aqui:
--   é o caso ambíguo escalado ao fundador — não deriva tier.)
-- =============================================================================
UPDATE public.clients c
   SET torque_crm_products = sub.tiers,
       updated_at = now()
  FROM (
    SELECT c2.id,
           ARRAY(
             SELECT DISTINCT CASE
                      WHEN p = 'torque-crm-v8'        THEN 'torque'
                      WHEN p = 'torque-crm-automation' THEN 'automation'
                      WHEN p = 'torque-crm-copilot'    THEN 'copilot'
                    END
               FROM unnest(COALESCE(c2.contracted_products, '{}')) p
              WHERE p IN ('torque-crm-v8','torque-crm-automation','torque-crm-copilot')
              ORDER BY 1
           ) AS tiers
      FROM public.clients c2
     WHERE c2.archived = false
       AND COALESCE(array_length(
             ARRAY(SELECT t FROM unnest(COALESCE(c2.torque_crm_products,'{}')) t
                    WHERE t IN ('torque','automation','copilot')), 1), 0) = 0
       AND EXISTS (
         SELECT 1 FROM unnest(COALESCE(c2.contracted_products, '{}')) p
          WHERE p IN ('torque-crm-v8','torque-crm-automation','torque-crm-copilot'))
  ) sub
 WHERE c.id = sub.id
   AND array_length(sub.tiers, 1) > 0;

COMMIT;
