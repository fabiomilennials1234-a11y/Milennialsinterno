-- 20260428215000_fix_ceo_advanced_stats_no_nested_aggs.sql
--
-- Hotfix P1: remove agregacoes aninhadas remanescentes da RPC de visao
-- executiva avancada. Mantem o contrato consumido pela UI e prioriza
-- metricas principais estaveis; detalhamentos profundos ficam para RPCs
-- dedicadas em blocos seguintes.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_ceo_advanced_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_today date := current_date;
  v_now timestamptz := now();
  v_month text := to_char(current_date, 'YYYY-MM');
  v_month_start date := date_trunc('month', current_date)::date;
  v_active int := 0;
  v_otimo int := 0;
  v_bom int := 0;
  v_medio int := 0;
  v_ruim int := 0;
  v_sem int := 0;
  v_health int := 0;
  v_overdue_kanban int := 0;
  v_overdue_ads int := 0;
  v_overdue_comercial int := 0;
  v_overdue_rh int := 0;
  v_total_overdue int := 0;
  v_distrato int := 0;
  v_overdue_receivable numeric := 0;
  v_expired_plans int := 0;
  v_total_receivable numeric := 0;
  v_total_received numeric := 0;
  v_total_payable numeric := 0;
  v_total_paid numeric := 0;
  v_pending_payable numeric := 0;
  v_bottlenecks jsonb := '[]'::jsonb;
  v_critical int := 0;
  v_warning int := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  IF NOT (public.is_executive(v_caller) OR public.is_admin(v_caller)) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  WITH active_clients AS (
    SELECT *
    FROM public.clients
    WHERE COALESCE(archived, false) = false
      AND COALESCE(status, '') <> 'churned'
      AND distrato_step IS NULL
  )
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE client_label = 'otimo')::int,
    COUNT(*) FILTER (WHERE client_label = 'bom')::int,
    COUNT(*) FILTER (WHERE client_label = 'medio')::int,
    COUNT(*) FILTER (WHERE client_label = 'ruim')::int,
    COUNT(*) FILTER (WHERE client_label IS NULL OR client_label NOT IN ('otimo','bom','medio','ruim'))::int
    INTO v_active, v_otimo, v_bom, v_medio, v_ruim, v_sem
  FROM active_clients;

  v_health := CASE WHEN v_active > 0 THEN ROUND((
    v_otimo * 100 + v_bom * 75 + v_medio * 50 + v_ruim * 25 + v_sem * 50
  )::numeric / v_active)::int ELSE 0 END;

  WITH done_columns AS (
    SELECT id FROM public.kanban_columns
    WHERE lower(title) LIKE '%aprovado%'
       OR lower(title) LIKE '%conclu%'
       OR lower(title) LIKE '%finalizado%'
  )
  SELECT COUNT(*)::int
    INTO v_overdue_kanban
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

  SELECT COUNT(*)::int INTO v_distrato
  FROM public.clients
  WHERE distrato_step IS NOT NULL AND COALESCE(archived, false) = false;

  SELECT COALESCE(SUM(valor), 0) INTO v_overdue_receivable
  FROM public.financeiro_contas_receber
  WHERE mes_referencia = v_month AND status = 'atrasado';

  SELECT COUNT(*)::int INTO v_expired_plans
  FROM public.cs_action_plans
  WHERE due_date < v_now AND status <> 'completed';

  SELECT COALESCE(SUM(monthly_value), 0) INTO v_total_receivable
  FROM public.financeiro_active_clients;

  SELECT COALESCE(SUM(valor), 0) INTO v_total_received
  FROM public.financeiro_contas_receber
  WHERE mes_referencia = v_month AND status = 'pago';

  SELECT COALESCE(SUM(valor), 0) INTO v_total_payable
  FROM public.financeiro_contas_pagar
  WHERE mes_referencia = v_month;

  SELECT COALESCE(SUM(valor), 0) INTO v_total_paid
  FROM public.financeiro_contas_pagar
  WHERE mes_referencia = v_month AND status = 'pago';

  SELECT COALESCE(SUM(valor), 0) INTO v_pending_payable
  FROM public.financeiro_contas_pagar
  WHERE mes_referencia = v_month AND status = 'pendente';

  IF v_total_overdue > 10 THEN
    v_bottlenecks := v_bottlenecks || jsonb_build_array(jsonb_build_object(
      'area', 'Tarefas Atrasadas',
      'count', v_total_overdue,
      'severity', CASE WHEN v_total_overdue > 20 THEN 'critical' ELSE 'warning' END,
      'description', v_total_overdue || ' tarefas com prazo vencido'
    ));
  END IF;

  IF v_distrato > 0 THEN
    v_bottlenecks := v_bottlenecks || jsonb_build_array(jsonb_build_object(
      'area', 'Clientes em Distrato',
      'count', v_distrato,
      'severity', CASE WHEN v_distrato > 3 THEN 'critical' ELSE 'warning' END,
      'description', v_distrato || ' clientes em processo de saída'
    ));
  END IF;

  IF v_ruim > 5 THEN
    v_bottlenecks := v_bottlenecks || jsonb_build_array(jsonb_build_object(
      'area', 'Clientes Insatisfeitos',
      'count', v_ruim,
      'severity', CASE WHEN v_ruim > 10 THEN 'critical' ELSE 'warning' END,
      'description', v_ruim || ' clientes com label "Ruim"'
    ));
  END IF;

  IF v_overdue_receivable > 0 THEN
    v_bottlenecks := v_bottlenecks || jsonb_build_array(jsonb_build_object(
      'area', 'Inadimplência',
      'count', ROUND(v_overdue_receivable)::int,
      'severity', CASE WHEN v_overdue_receivable > 10000 THEN 'critical' ELSE 'warning' END,
      'description', 'R$ ' || ROUND(v_overdue_receivable)::text || ' em atraso'
    ));
  END IF;

  IF v_expired_plans > 0 THEN
    v_bottlenecks := v_bottlenecks || jsonb_build_array(jsonb_build_object(
      'area', 'Planos de Ação Vencidos',
      'count', v_expired_plans,
      'severity', 'warning',
      'description', v_expired_plans || ' planos com prazo expirado'
    ));
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE item->>'severity' = 'critical')::int,
    COUNT(*) FILTER (WHERE item->>'severity' = 'warning')::int
    INTO v_critical, v_warning
  FROM jsonb_array_elements(v_bottlenecks) AS item;

  RETURN jsonb_build_object(
    'onboarding', jsonb_build_object(
      'avgDaysToComplete', 0,
      'totalCompleted', (SELECT COUNT(*) FROM public.client_onboarding WHERE completed_at IS NOT NULL),
      'activeOnboardings', (SELECT COUNT(*) FROM public.client_onboarding WHERE completed_at IS NULL),
      'byManager', '[]'::jsonb,
      'activeByMilestone', '[]'::jsonb
    ),
    'production', jsonb_build_object(
      'design', jsonb_build_object('avgDays', 0, 'totalCompleted', 0, 'pending', 0),
      'video', jsonb_build_object('avgDays', 0, 'totalCompleted', 0, 'pending', 0),
      'produtora', jsonb_build_object('avgDays', 0, 'totalCompleted', 0, 'pending', 0),
      'atrizes', jsonb_build_object('avgDays', 0, 'totalCompleted', 0, 'pending', 0)
    ),
    'churn', jsonb_build_object(
      'totalChurned', (SELECT COUNT(*) FROM public.clients WHERE COALESCE(archived, false) = true OR status = 'churned'),
      'churnedThisMonth', (SELECT COUNT(*) FROM public.clients WHERE archived_at >= v_month_start),
      'churnedLastMonth', 0,
      'distratoInProgress', v_distrato,
      'byManager', '[]'::jsonb,
      'topChurnManager', NULL,
      'distratoClients', '[]'::jsonb
    ),
    'clientLabels', jsonb_build_object(
      'total', v_active,
      'otimo', v_otimo,
      'bom', v_bom,
      'medio', v_medio,
      'ruim', v_ruim,
      'semLabel', v_sem,
      'byManager', '[]'::jsonb,
      'topRuimManager', NULL
    ),
    'groupSquadStats', '[]'::jsonb,
    'financial', jsonb_build_object(
      'totalReceivable', v_total_receivable,
      'totalReceived', v_total_received,
      'totalPayable', v_total_payable,
      'totalPaid', v_total_paid,
      'pendingPayable', v_pending_payable,
      'overdueReceivable', v_overdue_receivable,
      'result', v_total_receivable - v_total_payable,
      'marginPercent', CASE WHEN v_total_receivable > 0 THEN ((v_total_receivable - v_total_payable) / v_total_receivable) * 100 ELSE 0 END,
      'byProduct', '[]'::jsonb,
      'monthlyTrend', '[]'::jsonb
    ),
    'tasks', jsonb_build_object(
      'totalOverdue', v_total_overdue,
      'overdueByArea', '[]'::jsonb,
      'tasksByStatus', jsonb_build_object(
        'pending', (SELECT COUNT(*) FROM public.ads_tasks WHERE COALESCE(archived, false) = false AND status = 'pending') + (SELECT COUNT(*) FROM public.comercial_tasks WHERE COALESCE(archived, false) = false AND status = 'pendente'),
        'inProgress', (SELECT COUNT(*) FROM public.ads_tasks WHERE COALESCE(archived, false) = false AND status = 'in_progress') + (SELECT COUNT(*) FROM public.comercial_tasks WHERE COALESCE(archived, false) = false AND status = 'em_andamento'),
        'done', (SELECT COUNT(*) FROM public.ads_tasks WHERE COALESCE(archived, false) = false AND status = 'done') + (SELECT COUNT(*) FROM public.comercial_tasks WHERE COALESCE(archived, false) = false AND status = 'concluída')
      ),
      'adsTasks', jsonb_build_object('total', (SELECT COUNT(*) FROM public.ads_tasks WHERE COALESCE(archived, false) = false), 'overdue', v_overdue_ads, 'pending', (SELECT COUNT(*) FROM public.ads_tasks WHERE COALESCE(archived, false) = false AND status <> 'done')),
      'comercialTasks', jsonb_build_object('total', (SELECT COUNT(*) FROM public.comercial_tasks WHERE COALESCE(archived, false) = false), 'overdue', v_overdue_comercial, 'pending', (SELECT COUNT(*) FROM public.comercial_tasks WHERE COALESCE(archived, false) = false AND status <> 'concluída')),
      'rhTasks', jsonb_build_object('total', (SELECT COUNT(*) FROM public.rh_tarefas), 'overdue', v_overdue_rh, 'pending', (SELECT COUNT(*) FROM public.rh_tarefas WHERE status <> 'done'))
    ),
    'cs', jsonb_build_object(
      'totalActionPlans', (SELECT COUNT(*) FROM public.cs_action_plans),
      'activeActionPlans', (SELECT COUNT(*) FROM public.cs_action_plans WHERE status IN ('active','in_progress')),
      'completedActionPlans', (SELECT COUNT(*) FROM public.cs_action_plans WHERE status = 'completed'),
      'expiredActionPlans', v_expired_plans,
      'avgNPS', (SELECT COUNT(*) FROM public.nps_surveys),
      'npsResponses', (SELECT COUNT(*) FROM public.nps_responses),
      'clientsNeedingContact', (SELECT COUNT(*) FROM public.clients WHERE COALESCE(archived, false) = false AND (last_cs_contact_at IS NULL OR last_cs_contact_at < v_now - interval '30 days')),
      'byClassification', jsonb_build_object(
        'monitoramento', (SELECT COUNT(*) FROM public.clients WHERE COALESCE(archived, false) = false AND cs_classification = 'monitoramento'),
        'sucesso', (SELECT COUNT(*) FROM public.clients WHERE COALESCE(archived, false) = false AND cs_classification = 'sucesso'),
        'risco', (SELECT COUNT(*) FROM public.clients WHERE COALESCE(archived, false) = false AND cs_classification = 'risco'),
        'critico', (SELECT COUNT(*) FROM public.clients WHERE COALESCE(archived, false) = false AND cs_classification = 'critico')
      )
    ),
    'bottlenecks', v_bottlenecks,
    'summary', jsonb_build_object(
      'totalActiveClients', v_active,
      'totalTeamMembers', (SELECT COUNT(*) FROM public.profiles),
      'totalGroups', (SELECT COUNT(*) FROM public.organization_groups),
      'totalSquads', (SELECT COUNT(*) FROM public.squads),
      'healthScore', v_health,
      'operationalScore', GREATEST(0, 100 - (v_critical * 20) - (v_warning * 10)),
      'newClientsThisMonth', (SELECT COUNT(*) FROM public.clients WHERE created_at >= v_month_start),
      'avgClientLifetime', 0
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_ceo_advanced_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ceo_advanced_stats() TO authenticated;

COMMIT;
