-- 20260429170000_financeiro_overview_rpc.sql
--
-- P1.2: agrega o overview financeiro em um RPC unico para evitar 5 queries
-- e download de tabelas inteiras no browser. Ate aqui FinanceiroOverviewDashboard
-- baixava `financeiro_contas_receber.*`, `financeiro_contas_pagar.*`, `mrr_changes.*`,
-- `upsells.*`, `clients.*` e somava tudo no React.
--
-- Acesso: financeiro + admin + executive (CEO/CTO/gestor_projetos).

BEGIN;

CREATE OR REPLACE FUNCTION public.get_financeiro_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_now timestamptz := now();
  v_month text := to_char(current_date, 'YYYY-MM');
  v_month_start timestamptz := date_trunc('month', v_now);
  v_month_end   timestamptz := (date_trunc('month', v_now) + interval '1 month - 1 day');
  v_in_30 timestamptz := v_now + interval '30 days';

  -- Contas a receber.
  v_total_recebiveis numeric := 0;
  v_recebidos_mes   numeric := 0;
  v_pendentes_receber numeric := 0;
  v_inadimplentes   numeric := 0;

  -- Contas a pagar.
  v_total_despesas numeric := 0;
  v_despesas_pagas numeric := 0;
  v_despesas_pendentes numeric := 0;

  -- MRR.
  v_manual_expansion numeric := 0;
  v_manual_depreciation numeric := 0;
  v_upsell_expansion numeric := 0;

  -- Contadores.
  v_contratos_expirando int := 0;
  v_distratos int := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  SELECT role::text INTO v_caller_role
  FROM public.user_roles
  WHERE user_id = v_caller
  LIMIT 1;

  IF NOT (
    public.is_admin(v_caller)
    OR public.is_executive(v_caller)
    OR v_caller_role = 'financeiro'
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- Contas a receber: totais por status no mes atual.
  SELECT
    COALESCE(SUM(valor), 0),
    COALESCE(SUM(valor) FILTER (WHERE status = 'pago'), 0),
    COALESCE(SUM(valor) FILTER (WHERE status IN ('pendente', 'em_dia')), 0),
    COALESCE(SUM(valor) FILTER (WHERE status = 'inadimplente'), 0)
  INTO v_total_recebiveis, v_recebidos_mes, v_pendentes_receber, v_inadimplentes
  FROM public.financeiro_contas_receber
  WHERE mes_referencia = v_month;

  -- Contas a pagar.
  SELECT
    COALESCE(SUM(valor), 0),
    COALESCE(SUM(valor) FILTER (WHERE status = 'pago'), 0),
    COALESCE(SUM(valor) FILTER (WHERE status = 'pendente'), 0)
  INTO v_total_despesas, v_despesas_pagas, v_despesas_pendentes
  FROM public.financeiro_contas_pagar
  WHERE mes_referencia = v_month;

  -- MRR changes do mes (excluindo clientes novos no mes).
  WITH new_clients AS (
    SELECT id FROM public.clients
    WHERE COALESCE(entry_date::timestamptz, created_at) >= v_month_start
      AND COALESCE(entry_date::timestamptz, created_at) <= v_month_end
      AND COALESCE(archived, false) = false
  )
  SELECT
    COALESCE(SUM(change_value) FILTER (WHERE change_type = 'expansion'      AND client_id NOT IN (SELECT id FROM new_clients)), 0),
    COALESCE(SUM(change_value) FILTER (WHERE change_type = 'depreciation'   AND client_id NOT IN (SELECT id FROM new_clients)), 0)
  INTO v_manual_expansion, v_manual_depreciation
  FROM public.mrr_changes
  WHERE effective_date >= v_month_start::date
    AND effective_date <= v_month_end::date;

  WITH new_clients AS (
    SELECT id FROM public.clients
    WHERE COALESCE(entry_date::timestamptz, created_at) >= v_month_start
      AND COALESCE(entry_date::timestamptz, created_at) <= v_month_end
      AND COALESCE(archived, false) = false
  )
  SELECT COALESCE(SUM(monthly_value), 0)
  INTO v_upsell_expansion
  FROM public.upsells
  WHERE created_at >= v_month_start
    AND created_at <= v_month_end
    AND COALESCE(status, '') <> 'cancelled'
    AND client_id NOT IN (SELECT id FROM new_clients);

  -- Contratos expirando nos proximos 30 dias.
  SELECT COUNT(*)::int INTO v_contratos_expirando
  FROM public.financeiro_active_clients
  WHERE contract_expires_at >= v_now::date
    AND contract_expires_at <= v_in_30::date;

  -- Distratos em andamento.
  SELECT COUNT(*)::int INTO v_distratos
  FROM public.clients
  WHERE distrato_step IS NOT NULL
    AND COALESCE(archived, false) = false;

  RETURN jsonb_build_object(
    'month', v_month,
    'contasReceber', jsonb_build_object(
      'total',        v_total_recebiveis,
      'recebidos',    v_recebidos_mes,
      'pendentes',    v_pendentes_receber,
      'inadimplentes',v_inadimplentes
    ),
    'contasPagar', jsonb_build_object(
      'total',     v_total_despesas,
      'pagas',     v_despesas_pagas,
      'pendentes', v_despesas_pendentes
    ),
    'mrr', jsonb_build_object(
      'expansion',     v_manual_expansion + v_upsell_expansion,
      'depreciation',  v_manual_depreciation
    ),
    'contratosExpirando', v_contratos_expirando,
    'distratos',          v_distratos
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_financeiro_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_financeiro_overview() TO authenticated;

COMMENT ON FUNCTION public.get_financeiro_overview() IS
  'Overview agregado para FinanceiroOverviewDashboard. Substitui 5 queries com select(*) no browser.';

COMMIT;
