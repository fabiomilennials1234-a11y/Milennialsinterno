-- 20260608120000_concessao_entregar_produto_refactor.sql
--
-- Slice #145 (Concessão) — ADR 0009.
--
-- POR QUÊ: a Concessão (ADR 0009) precisa REUSAR o pipeline de ENTREGA do upsell
-- (contracted_products + card de board + linhas financeiro per-product) SEM os
-- galhos de DINHEIRO (comissão). Hoje toda essa lógica está fundida dentro de
-- process_upsell(). Este refactor FATORA a parte "entrega" para uma função
-- interna reutilizável — public._entregar_produto() — e reescreve process_upsell
-- para: (1) manter o galho de dinheiro (upsell_commissions 7%) e (2) delegar a
-- entrega à nova função.
--
-- INVARIANTE (provada por supabase/tests/concessao_entregar_produto_parity_test.sql):
-- inserir um upsell produz EXATAMENTE os mesmos efeitos antes e depois. Refactor
-- comportamentalmente NEUTRO.
--
-- DECISÕES DO FUNDADOR ESCRITAS AQUI (não são bugs a corrigir neste slice):
--   * financeiro_active_clients.monthly_value: o trigger vivo grava 0 para upsell
--     (NÃO usa NEW.monthly_value). _entregar_produto PARAMETRIZA esse valor
--     (p_monthly_value) para a futura RPC de concessão poder gravar 0 explícito e
--     a conversão subir o valor; process_upsell passa 0 para REPRODUZIR o
--     comportamento de hoje. Se isso for um bug do upsell, é REPORTE separado.
--   * client_product_values continua recebendo o monthly_value REAL do produto
--     (p_product_value) — idêntico a hoje.
--   * Comissão NUNCA entra em _entregar_produto (entrega ≠ dinheiro). Fica no trigger.
--
-- TODO (slice futuro — subsunção de tier): hoje a entrega roteia o card por
--   kanban_boards.slug = product_slug (com pulo de millennials-growth). A
--   subsunção de tier do Torque CRM (um-card-por-cliente via torque_board_gerar)
--   NÃO entra aqui — torque_board_gerar exige gestor_id + autorização CRM que não
--   existem no contexto de entrega. Mantém-se o roteamento por slug atual.
--
-- HARDENING (ADR 0004 §3): SECURITY DEFINER + SET search_path='' + identificadores
-- schema-qualified. _entregar_produto é helper INTERNO — REVOKE de public/anon/
-- authenticated: só o trigger (owner) e futuras RPCs do módulo a chamam.

BEGIN;

-- Idempotência de assinatura: se uma versão anterior de _entregar_produto existir
-- com aridade diferente, CREATE OR REPLACE criaria um OVERLOAD em vez de
-- substituir. Removemos qualquer 4-args antes de definir a 5-args canônica.
DROP FUNCTION IF EXISTS public._entregar_produto(uuid, text, text, numeric);

-- =============================================================================
-- _entregar_produto — pipeline de ENTREGA fatorado (sem dinheiro/comissão).
-- Reusável por process_upsell (hoje) e pela RPC de concessão (slice futuro).
-- =============================================================================
CREATE OR REPLACE FUNCTION public._entregar_produto(
  p_client_id     uuid,
  p_product_slug  text,
  p_product_name  text,
  p_monthly_value numeric,
  p_created_by    uuid DEFAULT NULL  -- ator do card (upsell: sold_by; concessão: granter). Aditivo p/ preservar a audit-paridade do card sem mudar a posição dos 4 args do contrato.
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

COMMENT ON FUNCTION public._entregar_produto(uuid, text, text, numeric, uuid) IS
  'Pipeline de ENTREGA fatorado do upsell (ADR 0009, Slice #145): contracted_products '
  '+ client_product_values + card de board (roteado por slug, pula millennials-growth) '
  '+ linhas financeiro per-product. SEM dinheiro/comissão (entrega ≠ dinheiro). '
  'p_monthly_value é gravado em financeiro_active_clients (0 p/ upsell, valor p/ conversão) '
  'E em client_product_values. Helper INTERNO: só trigger/RPCs do módulo chamam. '
  'TODO: subsunção de tier (torque_board_gerar) é slice futuro.';

-- Helper interno: nenhum cliente REST/RPC o invoca diretamente.
REVOKE ALL ON FUNCTION public._entregar_produto(uuid, text, text, numeric, uuid) FROM public, anon, authenticated;

-- =============================================================================
-- process_upsell — agora: galho de DINHEIRO (comissão 7%) + delega a entrega.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.process_upsell()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_commission_value NUMERIC;
BEGIN
  -- DINHEIRO: comissão 7% (permanece no trigger de venda — NÃO entra na entrega).
  v_commission_value := NEW.monthly_value * 0.07;

  INSERT INTO public.upsell_commissions (
    upsell_id, user_id, user_name, commission_value, commission_percentage
  ) VALUES (
    NEW.id, NEW.sold_by, NEW.sold_by_name, v_commission_value, 7
  );

  -- ENTREGA: delegada com p_monthly_value=0 -> financeiro_active_clients recebe 0
  -- (comportamento vivo do upsell preservado — ver cabeçalho).
  PERFORM public._entregar_produto(
    NEW.client_id, NEW.product_slug, NEW.product_name, 0::numeric, NEW.sold_by
  );

  -- DIVERGÊNCIA LEGADA (ver cabeçalho + reporte ao fundador): o trigger ORIGINAL
  -- gravava client_product_values = NEW.monthly_value (valor REAL), mas
  -- financeiro_active_clients = 0. A assinatura de 1 valor de _entregar_produto não
  -- carrega os DOIS valores divergentes. Para manter a PARIDADE exata sem mudar a
  -- assinatura: _entregar_produto grava CPV com p_monthly_value (=0); aqui, DEPOIS,
  -- reescrevemos CPV com o valor real — o último upsert vence. Resultado idêntico
  -- a hoje: CPV=real, financeiro=0. (Quando a divergência for resolvida no nível do
  -- produto, esta linha some e a chamada passa o valor real.)
  INSERT INTO public.client_product_values (client_id, product_slug, product_name, monthly_value)
  VALUES (NEW.client_id, NEW.product_slug, NEW.product_name, NEW.monthly_value)
  ON CONFLICT (client_id, product_slug)
  DO UPDATE SET monthly_value = EXCLUDED.monthly_value, updated_at = now();

  RETURN NEW;
END;
$$;

COMMIT;
