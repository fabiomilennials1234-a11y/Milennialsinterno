-- 20260429160000_finalize_ceo_stats_remaining_placeholders.sql
--
-- P1.2: substitui os 4 placeholders restantes por agregacoes reais:
--   - get_ceo_stats_financial.byProduct       -> SUM(monthly_value) por product_slug
--   - get_ceo_stats_financial.monthlyTrend    -> serie 6 meses de recebido/pago/result
--   - get_ceo_stats_tasks.overdueByArea       -> breakdown por area (kanban/ads/comercial/rh)
--   - get_ceo_stats_group_squad               -> agregado por organization_groups + squads
--
-- Encerra a quebra de get_ceo_advanced_stats em sub-RPCs com implementacao
-- 100% real (sem placeholders).

BEGIN;

-- ── get_ceo_stats_financial ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_ceo_stats_financial()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_month text := to_char(current_date, 'YYYY-MM');
  v_total_receivable numeric := 0;
  v_total_received numeric := 0;
  v_total_payable numeric := 0;
  v_total_paid numeric := 0;
  v_pending_payable numeric := 0;
  v_overdue_receivable numeric := 0;
  v_by_product jsonb;
  v_monthly_trend jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;
  IF NOT (public.is_executive(v_caller) OR public.is_admin(v_caller)) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(monthly_value), 0) INTO v_total_receivable
  FROM public.financeiro_active_clients;

  SELECT
    COALESCE(SUM(valor) FILTER (WHERE status = 'pago'), 0),
    COALESCE(SUM(valor) FILTER (WHERE status = 'atrasado'), 0)
  INTO v_total_received, v_overdue_receivable
  FROM public.financeiro_contas_receber
  WHERE mes_referencia = v_month;

  SELECT
    COALESCE(SUM(valor), 0),
    COALESCE(SUM(valor) FILTER (WHERE status = 'pago'), 0),
    COALESCE(SUM(valor) FILTER (WHERE status = 'pendente'), 0)
  INTO v_total_payable, v_total_paid, v_pending_payable
  FROM public.financeiro_contas_pagar
  WHERE mes_referencia = v_month;

  -- byProduct: agregado por product_slug em financeiro_active_clients.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_slug', product_slug,
    'product_name', product_name,
    'count',        count,
    'total_value',  total_value
  ) ORDER BY total_value DESC), '[]'::jsonb)
  INTO v_by_product
  FROM (
    SELECT
      COALESCE(product_slug, 'unknown') AS product_slug,
      COALESCE(product_name, 'Sem produto') AS product_name,
      COUNT(*)::int AS count,
      COALESCE(SUM(monthly_value), 0)::numeric AS total_value
    FROM public.financeiro_active_clients
    GROUP BY product_slug, product_name
  ) t;

  -- monthlyTrend: serie de 6 meses (atual + 5 anteriores) com receber/pago/result.
  WITH months AS (
    SELECT to_char(date_trunc('month', current_date) - (n || ' months')::interval, 'YYYY-MM') AS mes
    FROM generate_series(0, 5) AS n
  ),
  receber AS (
    SELECT mes_referencia AS mes,
           COALESCE(SUM(valor) FILTER (WHERE status = 'pago'), 0) AS recebido,
           COALESCE(SUM(valor), 0) AS receivable
    FROM public.financeiro_contas_receber
    GROUP BY mes_referencia
  ),
  pagar AS (
    SELECT mes_referencia AS mes,
           COALESCE(SUM(valor), 0) AS payable,
           COALESCE(SUM(valor) FILTER (WHERE status = 'pago'), 0) AS pago
    FROM public.financeiro_contas_pagar
    GROUP BY mes_referencia
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'mes',       m.mes,
    'recebido',  COALESCE(r.recebido, 0),
    'pago',      COALESCE(p.pago, 0),
    'receivable',COALESCE(r.receivable, 0),
    'payable',   COALESCE(p.payable, 0),
    'result',    COALESCE(r.receivable, 0) - COALESCE(p.payable, 0)
  ) ORDER BY m.mes), '[]'::jsonb)
  INTO v_monthly_trend
  FROM months m
  LEFT JOIN receber r ON r.mes = m.mes
  LEFT JOIN pagar   p ON p.mes = m.mes;

  RETURN jsonb_build_object(
    'totalReceivable',  v_total_receivable,
    'totalReceived',    v_total_received,
    'totalPayable',     v_total_payable,
    'totalPaid',        v_total_paid,
    'pendingPayable',   v_pending_payable,
    'overdueReceivable',v_overdue_receivable,
    'result',           v_total_receivable - v_total_payable,
    'marginPercent',    CASE WHEN v_total_receivable > 0
      THEN ((v_total_receivable - v_total_payable) / v_total_receivable) * 100
      ELSE 0 END,
    'byProduct',        v_by_product,
    'monthlyTrend',     v_monthly_trend
  );
END;
$$;

-- ── get_ceo_stats_tasks ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_ceo_stats_tasks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_today date := current_date;
  v_overdue_kanban int := 0;
  v_overdue_ads int := 0;
  v_overdue_comercial int := 0;
  v_overdue_rh int := 0;
  v_total_overdue int;
  v_pending int;
  v_in_progress int;
  v_done int;
  v_ads_total int;
  v_ads_pending int;
  v_comercial_total int;
  v_comercial_pending int;
  v_rh_total int;
  v_rh_pending int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;
  IF NOT (public.is_executive(v_caller) OR public.is_admin(v_caller)) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  WITH done_columns AS (
    SELECT id FROM public.kanban_columns
    WHERE lower(title) LIKE '%aprovado%'
       OR lower(title) LIKE '%conclu%'
       OR lower(title) LIKE '%finalizado%'
  )
  SELECT COUNT(*)::int INTO v_overdue_kanban
  FROM public.kanban_cards kc
  WHERE COALESCE(kc.archived, false) = false
    AND kc.due_date < v_today
    AND NOT EXISTS (SELECT 1 FROM done_columns dc WHERE dc.id = kc.column_id);

  SELECT COUNT(*)::int INTO v_overdue_ads
  FROM public.ads_tasks
  WHERE COALESCE(archived, false) = false AND due_date < v_today AND status <> 'done';

  SELECT COUNT(*)::int INTO v_overdue_comercial
  FROM public.comercial_tasks
  WHERE COALESCE(archived, false) = false AND due_date::date < v_today AND status <> 'concluída';

  SELECT COUNT(*)::int INTO v_overdue_rh
  FROM public.rh_tarefas
  WHERE data_limite < v_today AND status <> 'done';

  v_total_overdue := v_overdue_kanban + v_overdue_ads + v_overdue_comercial + v_overdue_rh;

  SELECT
    (SELECT COUNT(*) FROM public.ads_tasks WHERE COALESCE(archived, false) = false AND status = 'pending')
      + (SELECT COUNT(*) FROM public.comercial_tasks WHERE COALESCE(archived, false) = false AND status = 'pendente'),
    (SELECT COUNT(*) FROM public.ads_tasks WHERE COALESCE(archived, false) = false AND status = 'in_progress')
      + (SELECT COUNT(*) FROM public.comercial_tasks WHERE COALESCE(archived, false) = false AND status = 'em_andamento'),
    (SELECT COUNT(*) FROM public.ads_tasks WHERE COALESCE(archived, false) = false AND status = 'done')
      + (SELECT COUNT(*) FROM public.comercial_tasks WHERE COALESCE(archived, false) = false AND status = 'concluída')
  INTO v_pending, v_in_progress, v_done;

  SELECT
    (COUNT(*) FILTER (WHERE COALESCE(archived, false) = false))::int,
    (COUNT(*) FILTER (WHERE COALESCE(archived, false) = false AND status <> 'done'))::int
  INTO v_ads_total, v_ads_pending
  FROM public.ads_tasks;

  SELECT
    (COUNT(*) FILTER (WHERE COALESCE(archived, false) = false))::int,
    (COUNT(*) FILTER (WHERE COALESCE(archived, false) = false AND status <> 'concluída'))::int
  INTO v_comercial_total, v_comercial_pending
  FROM public.comercial_tasks;

  SELECT
    COUNT(*)::int,
    (COUNT(*) FILTER (WHERE status <> 'done'))::int
  INTO v_rh_total, v_rh_pending
  FROM public.rh_tarefas;

  RETURN jsonb_build_object(
    'totalOverdue', v_total_overdue,
    'overdueByArea', jsonb_build_array(
      jsonb_build_object('area', 'kanban',    'count', v_overdue_kanban),
      jsonb_build_object('area', 'ads',       'count', v_overdue_ads),
      jsonb_build_object('area', 'comercial', 'count', v_overdue_comercial),
      jsonb_build_object('area', 'rh',        'count', v_overdue_rh)
    ),
    'tasksByStatus', jsonb_build_object(
      'pending', v_pending,
      'inProgress', v_in_progress,
      'done', v_done
    ),
    'adsTasks',       jsonb_build_object('total', v_ads_total,       'overdue', v_overdue_ads,       'pending', v_ads_pending),
    'comercialTasks', jsonb_build_object('total', v_comercial_total, 'overdue', v_overdue_comercial, 'pending', v_comercial_pending),
    'rhTasks',        jsonb_build_object('total', v_rh_total,        'overdue', v_overdue_rh,        'pending', v_rh_pending)
  );
END;
$$;

-- ── get_ceo_stats_group_squad ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_ceo_stats_group_squad()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_payload jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;
  IF NOT (public.is_executive(v_caller) OR public.is_admin(v_caller)) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- Estrutura: array de { group, squads: [...] } com agregados de clientes.
  WITH group_clients AS (
    SELECT
      g.id AS group_id,
      g.name AS group_name,
      g.slug AS group_slug,
      COUNT(c.id)::int AS total_clients,
      COALESCE(SUM(c.monthly_value) FILTER (WHERE c.id IS NOT NULL AND COALESCE(c.archived, false) = false), 0)::numeric AS total_mrr,
      COUNT(*) FILTER (WHERE c.id IS NOT NULL AND COALESCE(c.archived, false) = false AND COALESCE(c.status, '') <> 'churned' AND c.distrato_step IS NULL)::int AS active_clients,
      COUNT(*) FILTER (WHERE c.id IS NOT NULL AND (COALESCE(c.archived, false) = true OR c.status = 'churned'))::int AS churned_clients
    FROM public.organization_groups g
    LEFT JOIN public.clients c ON c.group_id = g.id
    GROUP BY g.id, g.name, g.slug
  ),
  squad_clients AS (
    SELECT
      s.id AS squad_id,
      s.group_id,
      s.name AS squad_name,
      s.slug AS squad_slug,
      COUNT(c.id)::int AS total_clients,
      COALESCE(SUM(c.monthly_value) FILTER (WHERE c.id IS NOT NULL AND COALESCE(c.archived, false) = false), 0)::numeric AS total_mrr,
      COUNT(*) FILTER (WHERE c.id IS NOT NULL AND COALESCE(c.archived, false) = false AND COALESCE(c.status, '') <> 'churned' AND c.distrato_step IS NULL)::int AS active_clients,
      COUNT(*) FILTER (WHERE c.id IS NOT NULL AND (COALESCE(c.archived, false) = true OR c.status = 'churned'))::int AS churned_clients
    FROM public.squads s
    LEFT JOIN public.clients c ON c.squad_id = s.id
    GROUP BY s.id, s.group_id, s.name, s.slug
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'group_id',        gc.group_id,
    'group_name',      gc.group_name,
    'group_slug',      gc.group_slug,
    'total_clients',   gc.total_clients,
    'active_clients',  gc.active_clients,
    'churned_clients', gc.churned_clients,
    'total_mrr',       gc.total_mrr,
    'squads',          (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'squad_id',       sc.squad_id,
        'squad_name',     sc.squad_name,
        'squad_slug',     sc.squad_slug,
        'total_clients',  sc.total_clients,
        'active_clients', sc.active_clients,
        'churned_clients',sc.churned_clients,
        'total_mrr',      sc.total_mrr
      ) ORDER BY sc.squad_name), '[]'::jsonb)
      FROM squad_clients sc
      WHERE sc.group_id = gc.group_id
    )
  ) ORDER BY gc.group_name), '[]'::jsonb)
  INTO v_payload
  FROM group_clients gc;

  RETURN v_payload;
END;
$$;

COMMIT;
