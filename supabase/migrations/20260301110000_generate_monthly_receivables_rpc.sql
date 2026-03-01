-- ============================================================
-- RPC: generate_monthly_receivables
-- Gera cobranças mensais automaticamente para clientes
-- cujo dia de vencimento (payment_due_day) é hoje.
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_monthly_receivables()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today_day INTEGER;
  v_current_month TEXT;
  v_client RECORD;
  v_product RECORD;
  v_prev_unpaid_count INTEGER;
  v_check RECORD;
BEGIN
  -- Dia atual em horário de Brasília
  v_today_day := EXTRACT(DAY FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::INTEGER;
  -- Mês atual no formato yyyy-MM
  v_current_month := TO_CHAR(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM');

  -- Para cada cliente não-arquivado cujo dia de vencimento é hoje
  FOR v_client IN
    SELECT id, payment_due_day
    FROM public.clients
    WHERE archived = false
      AND payment_due_day IS NOT NULL
      AND payment_due_day = v_today_day
  LOOP
    -- Para cada produto ativo desse cliente
    FOR v_product IN
      SELECT fac.client_id, fac.product_slug, fac.product_name, fac.monthly_value
      FROM public.financeiro_active_clients fac
      WHERE fac.client_id = v_client.id
        AND fac.monthly_value > 0
    LOOP
      -- Verificar se já existe entrada para client+product+mês atual
      IF NOT EXISTS (
        SELECT 1 FROM public.financeiro_contas_receber
        WHERE client_id = v_product.client_id
          AND produto_slug = v_product.product_slug
          AND mes_referencia = v_current_month
      ) THEN
        -- Calcular inadimplência consecutiva (meses anteriores não pagos)
        v_prev_unpaid_count := 0;
        FOR v_check IN
          SELECT status FROM public.financeiro_contas_receber
          WHERE client_id = v_product.client_id
            AND produto_slug = v_product.product_slug
            AND mes_referencia < v_current_month
          ORDER BY mes_referencia DESC
        LOOP
          IF v_check.status = 'pago' THEN
            EXIT; -- para de contar ao encontrar mês pago
          END IF;
          v_prev_unpaid_count := v_prev_unpaid_count + 1;
        END LOOP;

        -- Inserir cobrança do mês
        INSERT INTO public.financeiro_contas_receber (
          client_id, produto_slug, valor, status, mes_referencia,
          is_recurring, inadimplencia_count
        ) VALUES (
          v_product.client_id,
          v_product.product_slug,
          v_product.monthly_value,
          'pendente',
          v_current_month,
          true,
          v_prev_unpaid_count
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;
