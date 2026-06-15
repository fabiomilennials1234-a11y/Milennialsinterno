-- 20260615160000_entregar_produto_sync_torque_tier.sql
--
-- POR QUÊ. As duas colunas de produto do cliente derivavam para estados
-- inconsistentes (drift): clients.contracted_products (contrato/billing) e
-- clients.torque_crm_products (tier operacional do board do Gestor de CRM).
-- useTorqueCrmClients só lista quem tem AMBOS — base 'torque-crm' em
-- contracted_products E ≥1 tier em torque_crm_products. Quando um upsell/concessão
-- de sub-tier torque entregava o slug de billing (ex 'torque-crm-automation') mas
-- não sincronizava o tier operacional, o cliente sumia da lista de briefing.
--
-- O fix anterior (client-side, em useUpsells) era frágil: read-modify-write em
-- duas queries fora de transação, só cobria o caminho de upsell e não o de
-- concessão. Decisão do fundador (ADR 0013, opção C): manter as DUAS colunas,
-- impondo a sincronização TRANSACIONALMENTE na origem da escrita —
-- public._entregar_produto, ponto ÚNICO de entrega chamado por process_upsell
-- (upsell) E conceder_produto (concessão). Sincronizar o tier aqui cobre os DOIS
-- caminhos numa única transação implícita, idempotente.
--
-- Esta migration faz CREATE OR REPLACE a partir da definição VIVA de
-- _entregar_produto (dump via pg_get_functiondef em 2026-06-15), preservando
-- TODOS os galhos vivos. ADICIONA o galho de sync de tier torque logo após o
-- galho #1 (contracted_products). Mantém SECURITY DEFINER + SET search_path=''
-- + identificadores schema-qualified. O ACL vivo (postgres/service_role only,
-- SEM grant a authenticated/anon/PUBLIC) é preservado por CREATE OR REPLACE; o
-- REVOKE FROM PUBLIC ao final reafirma a fronteira (helper interno, chamado só
-- por trigger/RPC owner).

CREATE OR REPLACE FUNCTION public._entregar_produto(
  p_client_id uuid,
  p_product_slug text,
  p_product_name text,
  p_monthly_value numeric,
  p_created_by uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_client_name        text;
  v_current_products   text[];
  v_entry_date         date;
  v_contract_duration  int;
  v_contract_expiration date;
  v_product_value      numeric;
  v_board_id           uuid;
  v_column_id          uuid;
  v_max_position       int;
  v_tier               text;
BEGIN
  SELECT c.name,
         COALESCE(c.contracted_products, ARRAY[]::text[]),
         COALESCE(c.entry_date::date, CURRENT_DATE),
         COALESCE(c.contract_duration_months, 12)
    INTO v_client_name, v_current_products, v_entry_date, v_contract_duration
  FROM public.clients c
  WHERE c.id = p_client_id;

  -- O valor REAL do produto (client_product_values) é o monthly_value passado.
  -- A linha financeiro usa o MESMO parâmetro; quem decide 0 (upsell) vs valor
  -- (conversão de concessão) é o CHAMADOR.
  v_product_value := p_monthly_value;

  -- 1. contracted_products do cliente (idempotente).
  IF NOT (p_product_slug = ANY(v_current_products)) THEN
    UPDATE public.clients
       SET contracted_products = array_append(
             COALESCE(contracted_products, ARRAY[]::text[]), p_product_slug),
           updated_at = now()
     WHERE id = p_client_id;
  END IF;

  -- 1b. SYNC DE TIER TORQUE (invariante de não-drift, ADR 0013 opção C).
  -- Quando o slug entregue é um sub-tier torque ('torque-crm-<sufixo>'),
  -- garante atomicamente: (a) a BASE 'torque-crm' em contracted_products — note
  -- que o galho #1 acima adicionou o SLUG DO SUB-TIER, não a base; a base é o
  -- literal 'torque-crm' separado — e (b) o TIER derivado em torque_crm_products.
  -- Tudo idempotente via guard com ANY(); arrays em clients não têm ON CONFLICT.
  IF p_product_slug LIKE 'torque-crm-%' THEN
    -- Deriva tier do sufixo (regra LOAD-BEARING, ADR 0006). QUIRK: 'v8' é o slug
    -- de billing legado renomeado — o TIER operacional dele é 'torque', nunca 'v8'.
    v_tier := CASE substring(p_product_slug FROM 'torque-crm-(.*)$')
                WHEN 'v8'         THEN 'torque'
                WHEN 'torque'     THEN 'torque'
                WHEN 'automation' THEN 'automation'
                WHEN 'copilot'    THEN 'copilot'
                ELSE NULL  -- sufixo desconhecido: ignora silenciosamente, não falha
              END;

    IF v_tier IS NOT NULL THEN
      UPDATE public.clients
         SET contracted_products = CASE
               WHEN 'torque-crm' = ANY(COALESCE(contracted_products, ARRAY[]::text[]))
                 THEN contracted_products
               ELSE array_append(COALESCE(contracted_products, ARRAY[]::text[]), 'torque-crm')
             END,
             torque_crm_products = CASE
               WHEN v_tier = ANY(COALESCE(torque_crm_products, ARRAY[]::text[]))
                 THEN torque_crm_products
               ELSE array_append(COALESCE(torque_crm_products, ARRAY[]::text[]), v_tier)
             END,
             updated_at = now()
       WHERE id = p_client_id;
    END IF;
  END IF;

  -- 2. client_product_values — valor real do produto.
  INSERT INTO public.client_product_values (client_id, product_slug, product_name, monthly_value)
  VALUES (p_client_id, p_product_slug, p_product_name, v_product_value)
  ON CONFLICT (client_id, product_slug)
  DO UPDATE SET monthly_value = EXCLUDED.monthly_value, updated_at = now();

  -- 3. Card de board roteado por kanban_boards.slug (pula millennials-growth).
  --    TODO subsunção de tier: ver cabeçalho da migration.
  IF p_product_slug <> 'millennials-growth' THEN
    SELECT b.id INTO v_board_id
    FROM public.kanban_boards b
    WHERE b.slug = p_product_slug
    LIMIT 1;

    IF v_board_id IS NOT NULL THEN
      SELECT col.id INTO v_column_id
      FROM public.kanban_columns col
      WHERE col.board_id = v_board_id
        AND (col.title ILIKE '%novo cliente%' OR col.title ILIKE '%novos clientes%')
      ORDER BY col.position ASC
      LIMIT 1;

      IF v_column_id IS NULL THEN
        SELECT col.id INTO v_column_id
        FROM public.kanban_columns col
        WHERE col.board_id = v_board_id
        ORDER BY col.position ASC
        LIMIT 1;
      END IF;

      IF v_column_id IS NOT NULL THEN
        SELECT COALESCE(MAX(kc.position), 0) + 1 INTO v_max_position
        FROM public.kanban_cards kc
        WHERE kc.column_id = v_column_id AND kc.archived = false;

        INSERT INTO public.kanban_cards (
          board_id, column_id, title, description,
          client_id, card_type, created_by, priority, position
        ) VALUES (
          v_board_id, v_column_id,
          'UP Sell: ' || v_client_name,
          'Produto: ' || p_product_name || E'\n' ||
          'Valor Mensal: R$ ' || p_monthly_value::text,
          p_client_id,
          'upsell',
          p_created_by,
          'high',
          v_max_position
        );
      END IF;
    END IF;
  END IF;

  -- 4. FINANCEIRO per-product.
  v_contract_expiration := v_entry_date + (v_contract_duration || ' months')::interval;

  INSERT INTO public.financeiro_client_onboarding (
    client_id, product_slug, product_name, current_step, contract_expiration_date
  ) VALUES (
    p_client_id, p_product_slug, p_product_name, 'novo_cliente', v_contract_expiration
  )
  ON CONFLICT (client_id, product_slug) DO NOTHING;

  INSERT INTO public.financeiro_active_clients (
    client_id, product_slug, product_name, monthly_value, invoice_status, contract_expires_at
  ) VALUES (
    p_client_id, p_product_slug, p_product_name, p_monthly_value, 'em_dia', v_contract_expiration
  )
  ON CONFLICT (client_id, product_slug) DO NOTHING;

  INSERT INTO public.financeiro_tasks (
    client_id, product_slug, product_name, title, status, due_date
  ) VALUES (
    p_client_id, p_product_slug, p_product_name,
    v_client_name || ' — ' || p_product_name || ' → Cadastrar no Asaas + Enviar 1ª Cobrança',
    'pending',
    now() + INTERVAL '3 days'
  );
END;
$function$;

-- Reafirma fronteira: helper interno. Sem grant a authenticated/anon/PUBLIC.
-- A autorização de quem pode entregar produto vive nos chamadores
-- (process_upsell trigger / conceder_produto RPC), não aqui.
REVOKE ALL ON FUNCTION public._entregar_produto(uuid, text, text, numeric, uuid) FROM PUBLIC;
