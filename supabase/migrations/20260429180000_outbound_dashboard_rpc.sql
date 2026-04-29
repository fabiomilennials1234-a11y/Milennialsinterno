-- 20260429180000_outbound_dashboard_rpc.sql
--
-- P1.2: agrega o dashboard outbound em uma RPC unica para evitar 7 queries
-- com select(*) no browser:
--   - clients (todos com assigned_outbound_manager)
--   - client_onboarding (todos)
--   - client_daily_tracking (todos)
--   - client_product_churns (filtro outbound)
--   - outbound_tasks (todos)
--   - outbound_meetings (todos)
--   - outbound_daily_documentation (do dia)
--
-- Retorna jsonb com KPIs, funnel, statusData, managerPerformance, monthlyEvolution.
--
-- Acesso: outbound + admin + executive + sucesso_cliente.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_outbound_dashboard(_manager_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_today_text text := to_char(v_today, 'YYYY-MM-DD');
  v_current_month text := to_char(v_today, 'YYYY-MM');

  v_total_active int;
  v_total_onboarding int;
  v_total_churns int;
  v_mrr_outbound numeric;
  v_avg_onboarding_days int;
  v_total_tasks_today int;
  v_total_meetings_month int;
  v_total_docs_today int;
  v_funnel jsonb;
  v_status jsonb;
  v_manager_perf jsonb;
  v_monthly jsonb;
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
    OR v_caller_role IN ('outbound', 'sucesso_cliente')
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- KPIs sobre clients filtrados.
  WITH base_clients AS (
    SELECT *
    FROM public.clients
    WHERE COALESCE(archived, false) = false
      AND assigned_outbound_manager IS NOT NULL
      AND (_manager_id IS NULL OR assigned_outbound_manager = _manager_id)
  ),
  base_churns AS (
    SELECT cpc.*
    FROM public.client_product_churns cpc
    LEFT JOIN public.clients c ON c.id = cpc.client_id
    WHERE COALESCE(cpc.archived, false) = false
      AND cpc.product_slug ILIKE '%outbound%'
      AND (_manager_id IS NULL OR c.assigned_outbound_manager = _manager_id)
  )
  SELECT
    COUNT(*) FILTER (WHERE status = 'active')::int,
    COUNT(*) FILTER (WHERE status IN ('onboarding', 'new_client'))::int,
    COALESCE(SUM(monthly_value) FILTER (WHERE status = 'active'), 0)::numeric,
    (SELECT COUNT(*)::int FROM base_churns)
  INTO v_total_active, v_total_onboarding, v_mrr_outbound, v_total_churns
  FROM base_clients;

  -- Avg onboarding days (apenas completados, sem filtro de manager).
  SELECT COALESCE(
    AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 86400)
      FILTER (WHERE completed_at IS NOT NULL),
    0
  )::int
  INTO v_avg_onboarding_days
  FROM public.client_onboarding;

  -- Tasks done hoje.
  SELECT COUNT(*)::int
  INTO v_total_tasks_today
  FROM public.outbound_tasks
  WHERE COALESCE(archived, false) = false
    AND status = 'done'
    AND due_date = v_today
    AND (_manager_id IS NULL OR outbound_manager_id = _manager_id);

  -- Meetings este mes.
  SELECT COUNT(*)::int
  INTO v_total_meetings_month
  FROM public.outbound_meetings
  WHERE meeting_date IS NOT NULL
    AND substring(meeting_date::text, 1, 7) = v_current_month
    AND (_manager_id IS NULL OR outbound_manager_id = _manager_id);

  -- Docs hoje.
  SELECT COUNT(*)::int
  INTO v_total_docs_today
  FROM public.outbound_daily_documentation
  WHERE documentation_date = v_today
    AND (_manager_id IS NULL OR outbound_manager_id = _manager_id);

  -- Funnel: client_onboarding por milestone (entre clientes filtrados em onboarding).
  WITH base_clients AS (
    SELECT id
    FROM public.clients
    WHERE COALESCE(archived, false) = false
      AND assigned_outbound_manager IS NOT NULL
      AND status IN ('onboarding', 'new_client')
      AND (_manager_id IS NULL OR assigned_outbound_manager = _manager_id)
  ),
  milestones AS (
    SELECT n AS milestone_num,
      CASE n
        WHEN 1 THEN 'Marco 1'
        WHEN 2 THEN 'Marco 2'
        WHEN 3 THEN 'Marco 3'
        WHEN 4 THEN 'Marco 4'
        WHEN 5 THEN 'Marco 5'
      END AS label,
      CASE n
        WHEN 1 THEN 'hsl(217 91% 60%)'
        WHEN 2 THEN 'hsl(258 90% 66%)'
        WHEN 3 THEN 'hsl(160 84% 39%)'
        WHEN 4 THEN 'hsl(38 92% 50%)'
        WHEN 5 THEN 'hsl(217 91% 50%)'
      END AS color
    FROM generate_series(1, 5) AS n
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'milestone', m.label,
    'count',     COALESCE(co_count, 0),
    'color',     m.color
  ) ORDER BY m.milestone_num), '[]'::jsonb)
  INTO v_funnel
  FROM milestones m
  LEFT JOIN (
    SELECT current_milestone, COUNT(*)::int AS co_count
    FROM public.client_onboarding co
    JOIN base_clients bc ON bc.id = co.client_id
    WHERE co.completed_at IS NULL
    GROUP BY current_milestone
  ) c ON c.current_milestone = m.milestone_num;

  -- Status distribution.
  WITH base_clients AS (
    SELECT *
    FROM public.clients
    WHERE COALESCE(archived, false) = false
      AND assigned_outbound_manager IS NOT NULL
      AND (_manager_id IS NULL OR assigned_outbound_manager = _manager_id)
  ),
  status_counts AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'new_client')::int AS new_client,
      COUNT(*) FILTER (WHERE status = 'onboarding')::int AS onboarding,
      COUNT(*) FILTER (WHERE status = 'active')::int AS active,
      COUNT(*) FILTER (WHERE status = 'churned')::int AS churned_in_clients
    FROM base_clients
  ),
  extra_churns AS (
    SELECT COUNT(*)::int AS extra
    FROM public.client_product_churns cpc
    JOIN base_clients bc ON bc.id = cpc.client_id
    WHERE COALESCE(cpc.archived, false) = false
      AND cpc.product_slug ILIKE '%outbound%'
      AND bc.status <> 'churned'
  )
  SELECT (
    SELECT jsonb_agg(item) FROM (
      SELECT jsonb_build_object('name', 'Novo Cliente', 'value', new_client, 'color', 'hsl(217 91% 60%)') AS item, 1 AS sort FROM status_counts WHERE new_client > 0
      UNION ALL
      SELECT jsonb_build_object('name', 'Onboarding',   'value', onboarding,  'color', 'hsl(258 90% 66%)'), 2 FROM status_counts WHERE onboarding > 0
      UNION ALL
      SELECT jsonb_build_object('name', 'Ativo',        'value', active,      'color', 'hsl(160 84% 39%)'), 3 FROM status_counts WHERE active > 0
      UNION ALL
      SELECT jsonb_build_object('name', 'Churn',        'value', churned_in_clients + (SELECT extra FROM extra_churns), 'color', 'hsl(0 84% 60%)'), 4
        FROM status_counts WHERE (churned_in_clients + (SELECT extra FROM extra_churns)) > 0
      ORDER BY sort
    ) AS s
  )
  INTO v_status;

  v_status := COALESCE(v_status, '[]'::jsonb);

  -- Manager performance: aggregate by outbound manager (sem filtro — sempre lista todos).
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name',              split_part(p.name, ' ', 1),
    'activeClients',     COALESCE(active_clients, 0),
    'onboardingClients', COALESCE(onboarding_clients, 0),
    'tasksDone',         COALESCE(tasks_done, 0),
    'docsToday',         COALESCE(docs_today, 0)
  )), '[]'::jsonb)
  INTO v_manager_perf
  FROM (
    SELECT DISTINCT assigned_outbound_manager AS manager_id
    FROM public.clients
    WHERE COALESCE(archived, false) = false
      AND assigned_outbound_manager IS NOT NULL
  ) m
  JOIN public.profiles p ON p.user_id = m.manager_id
  LEFT JOIN (
    SELECT assigned_outbound_manager AS manager_id,
           COUNT(*) FILTER (WHERE status = 'active')::int AS active_clients,
           COUNT(*) FILTER (WHERE status IN ('onboarding','new_client'))::int AS onboarding_clients
    FROM public.clients
    WHERE COALESCE(archived, false) = false
    GROUP BY assigned_outbound_manager
  ) c ON c.manager_id = m.manager_id
  LEFT JOIN (
    SELECT outbound_manager_id AS manager_id, COUNT(*)::int AS tasks_done
    FROM public.outbound_tasks
    WHERE COALESCE(archived, false) = false
      AND status = 'done'
      AND due_date = v_today
    GROUP BY outbound_manager_id
  ) t ON t.manager_id = m.manager_id
  LEFT JOIN (
    SELECT outbound_manager_id AS manager_id, COUNT(*)::int AS docs_today
    FROM public.outbound_daily_documentation
    WHERE documentation_date = v_today
    GROUP BY outbound_manager_id
  ) d ON d.manager_id = m.manager_id;

  -- Monthly evolution: last 6 months.
  WITH months AS (
    SELECT
      n,
      to_char(date_trunc('month', current_date) - (n || ' months')::interval, 'YYYY-MM') AS key,
      to_char(date_trunc('month', current_date) - (n || ' months')::interval, 'TMmon "de" YY') AS label
    FROM generate_series(0, 5) AS n
  ),
  base_clients AS (
    SELECT *
    FROM public.clients
    WHERE COALESCE(archived, false) = false
      AND assigned_outbound_manager IS NOT NULL
      AND (_manager_id IS NULL OR assigned_outbound_manager = _manager_id)
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'mes',      label,
    'entradas', entradas,
    'churns',   churns_count,
    'ativos',   ativos
  ) ORDER BY n DESC), '[]'::jsonb)
  INTO v_monthly
  FROM (
    SELECT
      m.n,
      m.label,
      (SELECT COUNT(*) FROM base_clients WHERE entry_date::text LIKE m.key || '%')::int AS entradas,
      (SELECT COUNT(*)::int FROM public.client_product_churns cpc
        JOIN public.clients c ON c.id = cpc.client_id
        WHERE COALESCE(cpc.archived, false) = false
          AND cpc.product_slug ILIKE '%outbound%'
          AND cpc.distrato_entered_at::text LIKE m.key || '%'
          AND (_manager_id IS NULL OR c.assigned_outbound_manager = _manager_id)
      ) AS churns_count,
      (SELECT COUNT(*) FROM base_clients
        WHERE status = 'active'
          AND entry_date IS NOT NULL
          AND entry_date::text <= m.key || '-31'
      )::int AS ativos
    FROM months m
  ) t;

  RETURN jsonb_build_object(
    'totalActive',            v_total_active,
    'totalOnboarding',        v_total_onboarding,
    'totalChurns',            v_total_churns,
    'mrrOutbound',            v_mrr_outbound,
    'avgOnboardingDays',      v_avg_onboarding_days,
    'totalTasksDoneToday',    v_total_tasks_today,
    'totalMeetingsThisMonth', v_total_meetings_month,
    'totalDocsToday',         v_total_docs_today,
    'funnelData',             v_funnel,
    'statusData',             v_status,
    'managerPerformance',     v_manager_perf,
    'monthlyEvolution',       v_monthly
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_outbound_dashboard(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_outbound_dashboard(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_outbound_dashboard(uuid) IS
  'Dashboard outbound agregado. Substitui 7 queries com select(*) no browser. Filtra por manager opcional.';

COMMIT;
