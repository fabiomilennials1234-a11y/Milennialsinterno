-- 20260608160000_concessao_process_upsell_skip_entrega.sql
--
-- Slice #151 (converter concessão) — ADR 0009. Forma 1 (aprovada pelo fundador):
-- a CONVERSÃO de uma concessão em venda cria uma linha REAL em public.upsells,
-- reusando o pipeline de dinheiro (comissão 7%) do trigger process_upsell. MAS a
-- ENTREGA (card de board, contracted_products, linhas financeiro) JÁ aconteceu
-- quando o produto foi CONCEDIDO (#147) — re-entregar duplicaria card e linhas.
--
-- MECANISMO: a RPC converter_concessao seta `SET LOCAL app.skip_entrega='on'`
-- (escopo da transação da RPC) ANTES de inserir o upsell. O trigger detecta a
-- flag e PULA a entrega + o upsert de paridade do CPV, mantendo SÓ o dinheiro.
--   * flag 'on'  (conversão): comissão SIM, entrega NÃO -> RETURN antes de _entregar_produto.
--   * flag off   (venda normal): comportamento IDÊNTICO ao de hoje (paridade).
--
-- PARIDADE (provada em concessao_lifecycle_test.sql): a escrita de comissão do
-- galho 'on' é BYTE-A-BYTE a mesma do caminho normal (mesmo cálculo 7%, mesmas
-- colunas/valores em upsell_commissions). Venda normal não regride.
--
-- current_setting('app.skip_entrega', true): o 2º arg `missing_ok=true` retorna
-- NULL (não erro) quando a GUC nunca foi setada — caminho de venda normal nunca
-- precisa declarar a flag. SET LOCAL garante que ela NÃO vaza para fora da
-- transação da RPC.
--
-- HARDENING: SECURITY DEFINER + search_path travado (preservado do original).

BEGIN;

CREATE OR REPLACE FUNCTION public.process_upsell()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_commission_value NUMERIC;
BEGIN
  -- DINHEIRO: comissão 7% (galho de venda — comum aos dois caminhos).
  v_commission_value := NEW.monthly_value * 0.07;

  INSERT INTO public.upsell_commissions (
    upsell_id, user_id, user_name, commission_value, commission_percentage
  ) VALUES (
    NEW.id, NEW.sold_by, NEW.sold_by_name, v_commission_value, 7
  );

  -- CONVERSÃO DE CONCESSÃO (#151, Forma 1): produto JÁ foi entregue ao conceder.
  -- Dinheiro sim (acima), entrega não. Pula _entregar_produto E o upsert de
  -- paridade de CPV abaixo. Flag é SET LOCAL na RPC converter_concessao.
  IF current_setting('app.skip_entrega', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- ===== CAMINHO DE VENDA NORMAL (flag off) — INALTERADO vs. hoje. =====

  -- ENTREGA: delegada com p_monthly_value=0 -> financeiro_active_clients recebe 0
  -- (comportamento vivo do upsell preservado).
  PERFORM public._entregar_produto(
    NEW.client_id, NEW.product_slug, NEW.product_name, 0::numeric, NEW.sold_by
  );

  -- DIVERGÊNCIA LEGADA (paridade): _entregar_produto gravou CPV com 0; aqui
  -- reescrevemos CPV com o valor REAL — último upsert vence. Resultado idêntico
  -- a hoje: CPV=real, financeiro=0.
  INSERT INTO public.client_product_values (client_id, product_slug, product_name, monthly_value)
  VALUES (NEW.client_id, NEW.product_slug, NEW.product_name, NEW.monthly_value)
  ON CONFLICT (client_id, product_slug)
  DO UPDATE SET monthly_value = EXCLUDED.monthly_value, updated_at = now();

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.process_upsell() IS
  'Trigger AFTER INSERT em upsells (ADR 0009). SEMPRE gera comissão 7% '
  '(upsell_commissions). Se app.skip_entrega=''on'' (conversão de concessão, #151): '
  'RETURN antes da entrega — produto já foi entregue ao conceder, re-entregar '
  'duplicaria card/linhas. Flag off (venda normal): entrega via _entregar_produto + '
  'reescrita de CPV com valor real — comportamento idêntico ao histórico (paridade).';

COMMIT;
