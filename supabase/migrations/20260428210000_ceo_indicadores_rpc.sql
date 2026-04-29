-- 20260428210000_ceo_indicadores_rpc.sql
--
-- P1: agrega indicadores do dashboard CEO no backend.
--
-- Antes, `useCEOIndicadores` baixava tabelas inteiras de financeiro, clientes,
-- produtos, vendas, churn e alteracoes de MRR para calcular tudo no browser.
-- Esta RPC preserva o contrato visual da tela, mas retorna apenas um JSON
-- agregado e protegido por helper de papel.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_ceo_indicadores(_month text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_month text := COALESCE(NULLIF(_month, ''), to_char(now(), 'YYYY-MM'));
  v_month_start date;
  v_month_end date;
  v_previous_month text;
  v_year int;
  v_year_months text[];
  v_faturamento_mes numeric := 0;
  v_faturamento_mes_anterior numeric := 0;
  v_faturamento_previsto numeric := 0;
  v_faturamento_ano numeric := 0;
  v_caixa_hoje numeric := 0;
  v_custos_previstos numeric := 0;
  v_custos_pagos numeric := 0;
  v_inadimplencia_valor numeric := 0;
  v_clientes_em_risco int := 0;
  v_valor_em_risco numeric := 0;
  v_clientes_ativos int := 0;
  v_ticket_medio numeric := 0;
  v_ltv_medio numeric := 0;
  v_roi_clientes numeric := 0;
  v_avg_lifetime_months numeric := 12;
  v_mrr_anterior numeric := 0;
  v_mrr_vendido numeric := 0;
  v_mrr_expansion numeric := 0;
  v_mrr_depreciation numeric := 0;
  v_crescimento_mrr numeric := 0;
  v_novos_clientes_mes int := 0;
  v_vendas_projeto_mes numeric := 0;
  v_churn_geral int := 0;
  v_churn_valor numeric := 0;
  v_faturamento_por_produto jsonb := '[]'::jsonb;
  v_vendas_por_produto_mrr jsonb := '[]'::jsonb;
  v_historico_mensal jsonb := '[]'::jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  IF NOT (public.is_executive(v_caller) OR public.is_admin(v_caller)) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF v_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'invalid month' USING ERRCODE = '22023';
  END IF;

  v_month_start := to_date(v_month || '-01', 'YYYY-MM-DD');
  v_month_end := (v_month_start + interval '1 month - 1 day')::date;
  v_previous_month := to_char(v_month_start - interval '1 month', 'YYYY-MM');
  v_year := extract(year from v_month_start)::int;

  SELECT array_agg(to_char(make_date(v_year, m, 1), 'YYYY-MM') ORDER BY m)
    INTO v_year_months
  FROM generate_series(1, 12) AS m;

  SELECT COALESCE(SUM(valor), 0)
    INTO v_faturamento_mes
  FROM public.financeiro_contas_receber
  WHERE mes_referencia = v_month AND status = 'pago';

  SELECT COALESCE(SUM(valor), 0)
    INTO v_faturamento_mes_anterior
  FROM public.financeiro_contas_receber
  WHERE mes_referencia = v_previous_month AND status = 'pago';

  SELECT COALESCE(SUM(valor), 0)
    INTO v_inadimplencia_valor
  FROM public.financeiro_contas_receber
  WHERE mes_referencia = v_month AND status = 'atrasado';

  SELECT COALESCE(SUM(valor), 0)
    INTO v_custos_previstos
  FROM public.financeiro_contas_pagar
  WHERE mes_referencia = v_month;

  SELECT COALESCE(SUM(valor), 0)
    INTO v_custos_pagos
  FROM public.financeiro_contas_pagar
  WHERE mes_referencia = v_month AND status = 'pago';

  SELECT COALESCE(SUM(valor), 0)
    INTO v_faturamento_ano
  FROM public.financeiro_contas_receber
  WHERE mes_referencia = ANY(v_year_months) AND status = 'pago';

  WITH active_clients AS (
    SELECT c.id, COALESCE(c.monthly_value, 0)::numeric AS monthly_value
    FROM public.clients c
    WHERE COALESCE(c.archived, false) = false
      AND COALESCE(c.status, '') <> 'churned'
      AND c.distrato_step IS NULL
      AND COALESCE(c.entry_date, c.created_at::date) <= v_month_end
  ),
  value_by_client AS (
    SELECT client_id, SUM(COALESCE(monthly_value, 0))::numeric AS total
    FROM public.client_product_values
    GROUP BY client_id
  )
  SELECT
    COUNT(*)::int,
    COALESCE(SUM(COALESCE(vbc.total, ac.monthly_value)), 0)
    INTO v_clientes_ativos, v_faturamento_previsto
  FROM active_clients ac
  LEFT JOIN value_by_client vbc ON vbc.client_id = ac.id;

  SELECT COUNT(*)::int, COALESCE(SUM(COALESCE(monthly_value, 0)), 0)
    INTO v_clientes_em_risco, v_valor_em_risco
  FROM public.clients
  WHERE distrato_step IS NOT NULL AND COALESCE(archived, false) = false;

  v_caixa_hoje := v_faturamento_mes - v_custos_pagos;
  v_ticket_medio := CASE WHEN v_clientes_ativos > 0 THEN v_faturamento_previsto / v_clientes_ativos ELSE 0 END;

  SELECT COALESCE(AVG(GREATEST(1, ROUND(EXTRACT(epoch FROM (COALESCE(archived_at, now()) - created_at)) / 2592000))), 12)
    INTO v_avg_lifetime_months
  FROM public.clients
  WHERE COALESCE(archived, false) = true AND created_at IS NOT NULL;

  v_ltv_medio := v_ticket_medio * v_avg_lifetime_months;
  v_roi_clientes := CASE WHEN v_ticket_medio > 0 THEN v_ltv_medio / v_ticket_medio ELSE 0 END;

  WITH active_clients AS (
    SELECT c.id, COALESCE(c.monthly_value, 0)::numeric AS monthly_value
    FROM public.clients c
    WHERE COALESCE(c.archived, false) = false
      AND COALESCE(c.status, '') <> 'churned'
      AND c.distrato_step IS NULL
      AND COALESCE(c.entry_date, c.created_at::date) <= v_month_end
  ),
  product_values AS (
    SELECT
      cpv.product_slug,
      SUM(COALESCE(cpv.monthly_value, 0))::numeric AS valor,
      COUNT(DISTINCT cpv.client_id)::int AS client_count
    FROM public.client_product_values cpv
    JOIN active_clients ac ON ac.id = cpv.client_id
    GROUP BY cpv.product_slug
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'productSlug', pv.product_slug,
    'productName', COALESCE(fp.nome, pv.product_slug),
    'valor', pv.valor,
    'clientCount', pv.client_count,
    'color', CASE pv.product_slug
      WHEN 'millennials-growth' THEN '#6366f1'
      WHEN 'millennials-criativa' THEN '#8b5cf6'
      WHEN 'millennials-sites' THEN '#06b6d4'
      WHEN 'millennials-rh' THEN '#f59e0b'
      WHEN 'millennials-b2b' THEN '#10b981'
      ELSE '#94a3b8'
    END
  ) ORDER BY pv.valor DESC), '[]'::jsonb)
    INTO v_faturamento_por_produto
  FROM product_values pv
  LEFT JOIN public.financeiro_produtos fp ON fp.slug = pv.product_slug;

  SELECT COALESCE(SUM(valor), 0)
    INTO v_mrr_anterior
  FROM public.financeiro_contas_receber
  WHERE mes_referencia = v_previous_month;

  WITH new_clients AS (
    SELECT c.id
    FROM public.clients c
    WHERE COALESCE(c.archived, false) = false
      AND COALESCE(c.entry_date, c.created_at::date) BETWEEN v_month_start AND v_month_end
  ),
  new_client_mrr AS (
    SELECT COALESCE(SUM(COALESCE(cpv.monthly_value, 0)), 0)::numeric AS total
    FROM public.client_product_values cpv
    JOIN new_clients nc ON nc.id = cpv.client_id
  ),
  manual_expansion AS (
    SELECT COALESCE(SUM(change_value), 0)::numeric AS total
    FROM public.mrr_changes mc
    WHERE mc.change_type = 'expansion'
      AND mc.effective_date BETWEEN v_month_start AND v_month_end
      AND NOT EXISTS (SELECT 1 FROM new_clients nc WHERE nc.id = mc.client_id)
  ),
  manual_depreciation AS (
    SELECT COALESCE(SUM(change_value), 0)::numeric AS total
    FROM public.mrr_changes mc
    WHERE mc.change_type = 'depreciation'
      AND mc.effective_date BETWEEN v_month_start AND v_month_end
      AND NOT EXISTS (SELECT 1 FROM new_clients nc WHERE nc.id = mc.client_id)
  ),
  upsell_expansion AS (
    SELECT COALESCE(SUM(monthly_value), 0)::numeric AS total
    FROM public.upsells u
    WHERE u.created_at::date BETWEEN v_month_start AND v_month_end
      AND COALESCE(u.status, '') <> 'cancelled'
      AND NOT EXISTS (SELECT 1 FROM new_clients nc WHERE nc.id = u.client_id)
  ),
  churns_month AS (
    SELECT
      COUNT(*)::int AS total_count,
      COALESCE(SUM(monthly_value), 0)::numeric AS total_value
    FROM public.client_product_churns cpc
    WHERE COALESCE(cpc.archived, false) = false
      AND cpc.distrato_entered_at::date BETWEEN v_month_start AND v_month_end
  )
  SELECT
    (SELECT COUNT(*) FROM new_clients)::int,
    (SELECT total FROM new_client_mrr),
    (SELECT total FROM manual_expansion) + (SELECT total FROM upsell_expansion),
    (SELECT total FROM manual_depreciation) + (SELECT total_value FROM churns_month),
    (SELECT total_count FROM churns_month)
    INTO v_novos_clientes_mes, v_mrr_vendido, v_mrr_expansion, v_mrr_depreciation, v_churn_geral;

  v_crescimento_mrr := v_mrr_vendido + v_mrr_expansion - v_mrr_depreciation;
  v_churn_valor := v_mrr_depreciation;

  SELECT COALESCE(SUM(sale_value), 0)
    INTO v_vendas_projeto_mes
  FROM public.client_sales
  WHERE sale_date BETWEEN v_month_start AND v_month_end;

  WITH new_clients AS (
    SELECT c.id
    FROM public.clients c
    WHERE COALESCE(c.archived, false) = false
      AND COALESCE(c.entry_date, c.created_at::date) BETWEEN v_month_start AND v_month_end
  ),
  by_product AS (
    SELECT
      cpv.product_slug,
      SUM(COALESCE(cpv.monthly_value, 0))::numeric AS valor_mrr,
      COUNT(*)::int AS total_count
    FROM public.client_product_values cpv
    JOIN new_clients nc ON nc.id = cpv.client_id
    GROUP BY cpv.product_slug
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'productSlug', bp.product_slug,
    'productName', COALESCE(fp.nome, bp.product_slug),
    'valorMRR', bp.valor_mrr,
    'valorProjeto', 0,
    'count', bp.total_count
  ) ORDER BY bp.valor_mrr DESC), '[]'::jsonb)
    INTO v_vendas_por_produto_mrr
  FROM by_product bp
  LEFT JOIN public.financeiro_produtos fp ON fp.slug = bp.product_slug;

  WITH months AS (
    SELECT
      to_char(v_month_start - (i || ' months')::interval, 'YYYY-MM') AS month_ref,
      to_char(v_month_start - (i || ' months')::interval, 'Mon') AS month_label,
      i
    FROM generate_series(5, 0, -1) AS i
  ),
  values AS (
    SELECT
      m.i,
      m.month_label,
      COALESCE(SUM(fcr.valor) FILTER (WHERE fcr.status = 'pago'), 0)::numeric AS faturamento,
      COALESCE(SUM(fcr.valor), 0)::numeric AS mrr
    FROM months m
    LEFT JOIN public.financeiro_contas_receber fcr ON fcr.mes_referencia = m.month_ref
    GROUP BY m.i, m.month_label
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'mes', lower(month_label),
    'faturamento', faturamento,
    'mrr', mrr
  ) ORDER BY i DESC), '[]'::jsonb)
    INTO v_historico_mensal
  FROM values;

  RETURN jsonb_build_object(
    'faturamentoMes', v_faturamento_mes,
    'faturamentoPrevisto', v_faturamento_previsto,
    'faturamentoAno', v_faturamento_ano,
    'faturamentoPorProduto', v_faturamento_por_produto,
    'caixaHoje', v_caixa_hoje,
    'custosPrevistosM', v_custos_previstos,
    'custosPagosM', v_custos_pagos,
    'crescimentoFaturamento', v_faturamento_mes - v_faturamento_mes_anterior,
    'crescimentoFaturamentoPercent', CASE WHEN v_faturamento_mes_anterior > 0 THEN ((v_faturamento_mes - v_faturamento_mes_anterior) / v_faturamento_mes_anterior) * 100 ELSE 0 END,
    'crescimentoMRR', v_crescimento_mrr,
    'crescimentoMRRPercent', CASE WHEN v_mrr_anterior > 0 THEN (v_crescimento_mrr / v_mrr_anterior) * 100 ELSE 0 END,
    'mrrInicial', v_mrr_anterior,
    'mrrDepreciation', v_mrr_depreciation,
    'mrrExpansion', v_mrr_expansion,
    'mrrVendido', v_mrr_vendido,
    'novosClientesMes', v_novos_clientes_mes,
    'vendasMRRMes', v_mrr_vendido + v_mrr_expansion,
    'vendasProjetoMes', v_vendas_projeto_mes,
    'vendasPorProdutoMRR', v_vendas_por_produto_mrr,
    'vendasPorProdutoProjeto', '[]'::jsonb,
    'churnGeral', v_churn_geral,
    'churnValor', v_churn_valor,
    'clientesAtivos', v_clientes_ativos,
    'ticketMedio', v_ticket_medio,
    'ltvMedio', v_ltv_medio,
    'roiClientes', v_roi_clientes,
    'inadimplenciaValor', v_inadimplencia_valor,
    'inadimplenciaTaxa', CASE WHEN v_faturamento_previsto > 0 THEN (v_inadimplencia_valor / v_faturamento_previsto) * 100 ELSE 0 END,
    'clientesEmRisco', v_clientes_em_risco,
    'historicoMensal', v_historico_mensal
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_ceo_indicadores(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ceo_indicadores(text) TO authenticated;

COMMENT ON FUNCTION public.get_ceo_indicadores(text) IS
  'Retorna indicadores mensais agregados do dashboard CEO sem expor tabelas completas ao browser.';

COMMIT;
