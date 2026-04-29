-- 20260428213000_ceo_advanced_stats_rpc.sql
--
-- P1: agrega o dashboard avancado Millennials Growth no backend.
--
-- `useCEOAdvancedStats` buscava tabelas inteiras no browser para montar visao
-- executiva. Esta RPC retorna apenas o shape agregado consumido pela tela.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_ceo_advanced_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_now timestamptz := now();
  v_today date := current_date;
  v_start_month date := date_trunc('month', current_date)::date;
  v_current_month text := to_char(current_date, 'YYYY-MM');
  v_total_active int := 0;
  v_label_otimo int := 0;
  v_label_bom int := 0;
  v_label_medio int := 0;
  v_label_ruim int := 0;
  v_label_sem int := 0;
  v_health_score int := 0;
  v_task_overdue int := 0;
  v_distrato_count int := 0;
  v_overdue_receivable numeric := 0;
  v_expired_plans int := 0;
  v_bottlenecks jsonb := '[]'::jsonb;
  v_critical_count int := 0;
  v_warning_count int := 0;
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
    INTO v_total_active, v_label_otimo, v_label_bom, v_label_medio, v_label_ruim, v_label_sem
  FROM active_clients;

  v_health_score := CASE WHEN v_total_active > 0 THEN ROUND((
    v_label_otimo * 100 +
    v_label_bom * 75 +
    v_label_medio * 50 +
    v_label_ruim * 25 +
    v_label_sem * 50
  )::numeric / v_total_active)::int ELSE 0 END;

  WITH kanban_done_columns AS (
    SELECT id
    FROM public.kanban_columns
    WHERE lower(title) LIKE '%aprovado%'
       OR lower(title) LIKE '%conclu%'
       OR lower(title) LIKE '%finalizado%'
  ),
  kanban_overdue AS (
    SELECT kb.slug, kb.name, COUNT(*)::int AS total, MIN(kc.due_date) AS oldest_due
    FROM public.kanban_cards kc
    JOIN public.kanban_boards kb ON kb.id = kc.board_id
    WHERE COALESCE(kc.archived, false) = false
      AND kc.due_date < v_today
      AND NOT EXISTS (SELECT 1 FROM kanban_done_columns dc WHERE dc.id = kc.column_id)
    GROUP BY kb.slug, kb.name
  ),
  task_counts AS (
    SELECT
      (SELECT COUNT(*) FROM public.ads_tasks WHERE COALESCE(archived, false) = false AND due_date < v_today AND status <> 'done')::int AS ads_overdue,
      (SELECT COUNT(*) FROM public.comercial_tasks WHERE COALESCE(archived, false) = false AND due_date::date < v_today AND status <> 'concluída')::int AS comercial_overdue,
      (SELECT COUNT(*) FROM public.rh_tarefas WHERE data_limite < v_today AND status <> 'done')::int AS rh_overdue,
      COALESCE((SELECT SUM(total)::int FROM kanban_overdue), 0) AS kanban_overdue
  )
  SELECT ads_overdue + comercial_overdue + rh_overdue + kanban_overdue
    INTO v_task_overdue
  FROM task_counts;

  SELECT COUNT(*)::int
    INTO v_distrato_count
  FROM public.clients
  WHERE distrato_step IS NOT NULL AND COALESCE(archived, false) = false;

  SELECT COALESCE(SUM(valor), 0)
    INTO v_overdue_receivable
  FROM public.financeiro_contas_receber
  WHERE mes_referencia = v_current_month AND status = 'atrasado';

  SELECT COUNT(*)::int
    INTO v_expired_plans
  FROM public.cs_action_plans
  WHERE due_date < v_now AND status <> 'completed';

  IF v_task_overdue > 10 THEN
    v_bottlenecks := v_bottlenecks || jsonb_build_array(jsonb_build_object(
      'area', 'Tarefas Atrasadas',
      'count', v_task_overdue,
      'severity', CASE WHEN v_task_overdue > 20 THEN 'critical' ELSE 'warning' END,
      'description', v_task_overdue || ' tarefas com prazo vencido'
    ));
  END IF;

  IF v_distrato_count > 0 THEN
    v_bottlenecks := v_bottlenecks || jsonb_build_array(jsonb_build_object(
      'area', 'Clientes em Distrato',
      'count', v_distrato_count,
      'severity', CASE WHEN v_distrato_count > 3 THEN 'critical' ELSE 'warning' END,
      'description', v_distrato_count || ' clientes em processo de saída'
    ));
  END IF;

  IF v_label_ruim > 5 THEN
    v_bottlenecks := v_bottlenecks || jsonb_build_array(jsonb_build_object(
      'area', 'Clientes Insatisfeitos',
      'count', v_label_ruim,
      'severity', CASE WHEN v_label_ruim > 10 THEN 'critical' ELSE 'warning' END,
      'description', v_label_ruim || ' clientes com label "Ruim"'
    ));
  END IF;

  IF v_overdue_receivable > 0 THEN
    v_bottlenecks := v_bottlenecks || jsonb_build_array(jsonb_build_object(
      'area', 'Inadimplência',
      'count', ROUND(v_overdue_receivable)::int,
      'severity', CASE WHEN v_overdue_receivable > 10000 THEN 'critical' ELSE 'warning' END,
      'description', 'R$ ' || to_char(v_overdue_receivable, 'FM999G999G999D00') || ' em atraso'
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
    INTO v_critical_count, v_warning_count
  FROM jsonb_array_elements(v_bottlenecks) AS item;

  RETURN (
    WITH active_clients AS (
      SELECT *
      FROM public.clients
      WHERE COALESCE(archived, false) = false
        AND COALESCE(status, '') <> 'churned'
        AND distrato_step IS NULL
    ),
    value_by_client AS (
      SELECT client_id, SUM(COALESCE(monthly_value, 0))::numeric AS total
      FROM public.client_product_values
      GROUP BY client_id
    ),
    completed_onboarding AS (
      SELECT co.*, c.name, c.assigned_ads_manager, c.onboarding_started_at, p.name AS manager_name
      FROM public.client_onboarding co
      JOIN public.clients c ON c.id = co.client_id
      LEFT JOIN public.profiles p ON p.user_id = c.assigned_ads_manager
      WHERE co.completed_at IS NOT NULL
    ),
    active_onboarding AS (
      SELECT co.*, c.name
      FROM public.client_onboarding co
      JOIN public.clients c ON c.id = co.client_id
      WHERE co.completed_at IS NULL
    ),
    milestone_stats AS (
      SELECT
        m AS milestone,
        COUNT(ao.client_id)::int AS total,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', ao.client_id,
              'name', ao.name,
              'daysInMilestone', GREATEST(0, ROUND(EXTRACT(epoch FROM (
                v_now - COALESCE(
                  CASE m
                    WHEN 1 THEN ao.milestone_1_started_at
                    WHEN 2 THEN ao.milestone_2_started_at
                    WHEN 3 THEN ao.milestone_3_started_at
                    WHEN 4 THEN ao.milestone_4_started_at
                    WHEN 5 THEN ao.milestone_5_started_at
                  END,
                  ao.created_at
                )
              )) / 86400))::int
            )
            ORDER BY ao.created_at DESC
          ) FILTER (WHERE ao.client_id IS NOT NULL),
          '[]'::jsonb
        ) AS clients
      FROM generate_series(1, 5) AS m
      LEFT JOIN active_onboarding ao ON ao.current_milestone = m
      GROUP BY m
    ),
    onboarding_base AS (
      SELECT
        GREATEST(0, ROUND(EXTRACT(epoch FROM (completed_at - onboarding_started_at)) / 86400))::int AS days,
        assigned_ads_manager,
        COALESCE(manager_name, 'Desconhecido') AS manager_name
      FROM completed_onboarding
      WHERE onboarding_started_at IS NOT NULL
    ),
    onboarding_manager_stats AS (
      SELECT
        assigned_ads_manager,
        manager_name,
        ROUND(AVG(days))::int AS avg_days,
        COUNT(*)::int AS completed
      FROM onboarding_base
      WHERE assigned_ads_manager IS NOT NULL
      GROUP BY assigned_ads_manager, manager_name
    ),
    production_boards AS (
      SELECT * FROM (VALUES
        ('design', 'design'),
        ('video', 'editor-video'),
        ('produtora', 'produtora'),
        ('atrizes', 'atrizes-gravacao')
      ) AS t(key, slug)
    ),
    production_stats AS (
      SELECT
        pb.key,
        COUNT(kc.id) FILTER (WHERE dc.id IS NOT NULL)::int AS completed,
        COUNT(kc.id) FILTER (WHERE dc.id IS NULL)::int AS pending,
        COALESCE(ROUND(AVG(GREATEST(0, EXTRACT(epoch FROM (kc.updated_at - kc.created_at)) / 86400)) FILTER (WHERE dc.id IS NOT NULL)), 0)::int AS avg_days
      FROM production_boards pb
      LEFT JOIN public.kanban_boards kb ON kb.slug = pb.slug
      LEFT JOIN public.kanban_columns col ON col.board_id = kb.id
      LEFT JOIN public.kanban_cards kc ON kc.column_id = col.id AND COALESCE(kc.archived, false) = false
      LEFT JOIN public.kanban_columns dc ON dc.id = kc.column_id
        AND (lower(dc.title) LIKE '%aprovado%' OR lower(dc.title) LIKE '%conclu%' OR lower(dc.title) LIKE '%finalizado%')
      GROUP BY pb.key
    ),
    churned_clients AS (
      SELECT c.*, p.name AS manager_name
      FROM public.clients c
      LEFT JOIN public.profiles p ON p.user_id = c.assigned_ads_manager
      WHERE COALESCE(c.archived, false) = true OR c.status = 'churned'
    ),
    distrato_clients AS (
      SELECT c.*, p.name AS manager_name
      FROM public.clients c
      LEFT JOIN public.profiles p ON p.user_id = c.assigned_ads_manager
      WHERE c.distrato_step IS NOT NULL AND COALESCE(c.archived, false) = false
    ),
    labels_by_manager AS (
      SELECT
        ac.assigned_ads_manager,
        COALESCE(p.name, 'Desconhecido') AS manager_name,
        COUNT(*) FILTER (WHERE ac.client_label = 'otimo')::int AS otimo,
        COUNT(*) FILTER (WHERE ac.client_label = 'bom')::int AS bom,
        COUNT(*) FILTER (WHERE ac.client_label = 'medio')::int AS medio,
        COUNT(*) FILTER (WHERE ac.client_label = 'ruim')::int AS ruim,
        COUNT(*) FILTER (WHERE ac.client_label IS NULL OR ac.client_label NOT IN ('otimo','bom','medio','ruim'))::int AS sem_label,
        COUNT(*)::int AS total
      FROM active_clients ac
      LEFT JOIN public.profiles p ON p.user_id = ac.assigned_ads_manager
      WHERE ac.assigned_ads_manager IS NOT NULL
      GROUP BY ac.assigned_ads_manager, p.name
    ),
    group_stats AS (
      SELECT
        g.id,
        g.name,
        COUNT(ac.id)::int AS total_clients,
        COALESCE(SUM(COALESCE(vbc.total, ac.monthly_value, 0)), 0)::numeric AS total_value
      FROM public.organization_groups g
      LEFT JOIN active_clients ac ON ac.group_id = g.id
      LEFT JOIN value_by_client vbc ON vbc.client_id = ac.id
      GROUP BY g.id, g.name
      HAVING COUNT(ac.id) > 0
    ),
    squad_stats AS (
      SELECT
        s.group_id,
        s.id,
        s.name,
        COUNT(ac.id)::int AS total_clients,
        COALESCE(SUM(COALESCE(vbc.total, ac.monthly_value, 0)), 0)::numeric AS total_value,
        COUNT(*) FILTER (WHERE ac.client_label = 'otimo')::int AS otimo,
        COUNT(*) FILTER (WHERE ac.client_label = 'bom')::int AS bom,
        COUNT(*) FILTER (WHERE ac.client_label = 'medio')::int AS medio,
        COUNT(*) FILTER (WHERE ac.client_label = 'ruim')::int AS ruim,
        COUNT(*) FILTER (WHERE ac.client_label IS NULL OR ac.client_label NOT IN ('otimo','bom','medio','ruim'))::int AS sem_label
      FROM public.squads s
      LEFT JOIN active_clients ac ON ac.squad_id = s.id
      LEFT JOIN value_by_client vbc ON vbc.client_id = ac.id
      GROUP BY s.group_id, s.id, s.name
    ),
    kanban_done_columns AS (
      SELECT id
      FROM public.kanban_columns
      WHERE lower(title) LIKE '%aprovado%'
         OR lower(title) LIKE '%conclu%'
         OR lower(title) LIKE '%finalizado%'
    ),
    kanban_overdue AS (
      SELECT kb.slug, kb.name, COUNT(*)::int AS total, MIN(kc.due_date) AS oldest_due
      FROM public.kanban_cards kc
      JOIN public.kanban_boards kb ON kb.id = kc.board_id
      WHERE COALESCE(kc.archived, false) = false
        AND kc.due_date < v_today
        AND NOT EXISTS (SELECT 1 FROM kanban_done_columns dc WHERE dc.id = kc.column_id)
      GROUP BY kb.slug, kb.name
    ),
    financial_product AS (
      SELECT
        fp.id,
        fp.nome,
        fp.slug,
        COALESCE(fp.cor, '#6366f1') AS cor,
        COUNT(DISTINCT cpv.client_id)::int AS client_count,
        COALESCE(SUM(cpv.monthly_value), 0)::numeric AS revenue
      FROM public.financeiro_produtos fp
      LEFT JOIN public.client_product_values cpv ON cpv.product_slug = fp.slug
      LEFT JOIN active_clients ac ON ac.id = cpv.client_id
      WHERE fp.ativo = true
      GROUP BY fp.id, fp.nome, fp.slug, fp.cor
      HAVING COUNT(DISTINCT ac.id) > 0 OR COALESCE(SUM(cpv.monthly_value), 0) > 0
    ),
    finance AS (
      SELECT
        COALESCE((SELECT SUM(COALESCE(monthly_value, 0)) FROM public.financeiro_active_clients), 0)::numeric AS total_receivable,
        COALESCE((SELECT SUM(valor) FROM public.financeiro_contas_receber WHERE mes_referencia = v_current_month AND status = 'pago'), 0)::numeric AS total_received,
        COALESCE((SELECT SUM(valor) FROM public.financeiro_contas_pagar WHERE mes_referencia = v_current_month), 0)::numeric AS total_payable,
        COALESCE((SELECT SUM(valor) FROM public.financeiro_contas_pagar WHERE mes_referencia = v_current_month AND status = 'pago'), 0)::numeric AS total_paid,
        COALESCE((SELECT SUM(valor) FROM public.financeiro_contas_pagar WHERE mes_referencia = v_current_month AND status = 'pendente'), 0)::numeric AS pending_payable,
        v_overdue_receivable AS overdue_receivable
    ),
    task_counts AS (
      SELECT
        (SELECT COUNT(*) FROM public.ads_tasks WHERE COALESCE(archived, false) = false)::int AS ads_total,
        (SELECT COUNT(*) FROM public.ads_tasks WHERE COALESCE(archived, false) = false AND status <> 'done')::int AS ads_pending,
        (SELECT COUNT(*) FROM public.ads_tasks WHERE COALESCE(archived, false) = false AND due_date < v_today AND status <> 'done')::int AS ads_overdue,
        (SELECT COUNT(*) FROM public.comercial_tasks WHERE COALESCE(archived, false) = false)::int AS comercial_total,
        (SELECT COUNT(*) FROM public.comercial_tasks WHERE COALESCE(archived, false) = false AND status <> 'concluída')::int AS comercial_pending,
        (SELECT COUNT(*) FROM public.comercial_tasks WHERE COALESCE(archived, false) = false AND due_date::date < v_today AND status <> 'concluída')::int AS comercial_overdue,
        (SELECT COUNT(*) FROM public.rh_tarefas)::int AS rh_total,
        (SELECT COUNT(*) FROM public.rh_tarefas WHERE status <> 'done')::int AS rh_pending,
        (SELECT COUNT(*) FROM public.rh_tarefas WHERE data_limite < v_today AND status <> 'done')::int AS rh_overdue
    ),
    cs AS (
      SELECT
        (SELECT COUNT(*) FROM public.cs_action_plans)::int AS total_plans,
        (SELECT COUNT(*) FROM public.cs_action_plans WHERE status IN ('active','in_progress'))::int AS active_plans,
        (SELECT COUNT(*) FROM public.cs_action_plans WHERE status = 'completed')::int AS completed_plans,
        v_expired_plans AS expired_plans,
        (SELECT COUNT(*) FROM public.nps_surveys)::int AS avg_nps,
        (SELECT COUNT(*) FROM public.nps_responses)::int AS nps_responses,
        (SELECT COUNT(*) FROM active_clients WHERE last_cs_contact_at IS NULL OR last_cs_contact_at < v_now - interval '30 days')::int AS needs_contact,
        (SELECT COUNT(*) FROM active_clients WHERE cs_classification = 'monitoramento')::int AS monitoramento,
        (SELECT COUNT(*) FROM active_clients WHERE cs_classification = 'sucesso')::int AS sucesso,
        (SELECT COUNT(*) FROM active_clients WHERE cs_classification = 'risco')::int AS risco,
        (SELECT COUNT(*) FROM active_clients WHERE cs_classification = 'critico')::int AS critico
    )
    SELECT jsonb_build_object(
      'onboarding', jsonb_build_object(
        'avgDaysToComplete', COALESCE((SELECT ROUND(AVG(days))::int FROM onboarding_base WHERE days > 0), 0),
        'totalCompleted', (SELECT COUNT(*) FROM completed_onboarding),
        'activeOnboardings', (SELECT COUNT(*) FROM active_onboarding),
        'byManager', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'managerId', assigned_ads_manager,
          'managerName', manager_name,
          'avgDays', avg_days,
          'completed', completed
        ) ORDER BY completed DESC) FROM onboarding_manager_stats), '[]'::jsonb),
        'activeByMilestone', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'milestone', milestone,
          'count', total,
          'clients', clients
        ) ORDER BY milestone) FROM milestone_stats), '[]'::jsonb)
      ),
      'production', jsonb_build_object(
        'design', jsonb_build_object('avgDays', COALESCE((SELECT avg_days FROM production_stats WHERE key='design'), 0), 'totalCompleted', COALESCE((SELECT completed FROM production_stats WHERE key='design'), 0), 'pending', COALESCE((SELECT pending FROM production_stats WHERE key='design'), 0)),
        'video', jsonb_build_object('avgDays', COALESCE((SELECT avg_days FROM production_stats WHERE key='video'), 0), 'totalCompleted', COALESCE((SELECT completed FROM production_stats WHERE key='video'), 0), 'pending', COALESCE((SELECT pending FROM production_stats WHERE key='video'), 0)),
        'produtora', jsonb_build_object('avgDays', COALESCE((SELECT avg_days FROM production_stats WHERE key='produtora'), 0), 'totalCompleted', COALESCE((SELECT completed FROM production_stats WHERE key='produtora'), 0), 'pending', COALESCE((SELECT pending FROM production_stats WHERE key='produtora'), 0)),
        'atrizes', jsonb_build_object('avgDays', COALESCE((SELECT avg_days FROM production_stats WHERE key='atrizes'), 0), 'totalCompleted', COALESCE((SELECT completed FROM production_stats WHERE key='atrizes'), 0), 'pending', COALESCE((SELECT pending FROM production_stats WHERE key='atrizes'), 0))
      ),
      'churn', jsonb_build_object(
        'totalChurned', (SELECT COUNT(*) FROM churned_clients),
        'churnedThisMonth', (SELECT COUNT(*) FROM churned_clients WHERE archived_at >= v_start_month),
        'churnedLastMonth', (SELECT COUNT(*) FROM churned_clients WHERE archived_at >= (v_start_month - interval '1 month') AND archived_at < v_start_month),
        'distratoInProgress', (SELECT COUNT(*) FROM distrato_clients),
        'byManager', COALESCE((SELECT jsonb_agg(jsonb_build_object('managerId', assigned_ads_manager, 'managerName', COALESCE(manager_name, 'Desconhecido'), 'churnCount', total) ORDER BY total DESC) FROM (SELECT assigned_ads_manager, manager_name, COUNT(*)::int AS total FROM churned_clients WHERE assigned_ads_manager IS NOT NULL GROUP BY assigned_ads_manager, manager_name) x), '[]'::jsonb),
        'topChurnManager', (SELECT jsonb_build_object('managerId', assigned_ads_manager, 'managerName', COALESCE(manager_name, 'Desconhecido'), 'churnCount', total) FROM (SELECT assigned_ads_manager, manager_name, COUNT(*)::int AS total FROM churned_clients WHERE assigned_ads_manager IS NOT NULL GROUP BY assigned_ads_manager, manager_name ORDER BY total DESC LIMIT 1) x),
        'distratoClients', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'step', COALESCE(distrato_step, 'unknown'), 'enteredAt', COALESCE(distrato_entered_at, updated_at), 'managerName', COALESCE(manager_name, 'Sem gestor')) ORDER BY COALESCE(distrato_entered_at, updated_at) DESC) FROM distrato_clients), '[]'::jsonb)
      ),
      'clientLabels', jsonb_build_object(
        'total', v_total_active, 'otimo', v_label_otimo, 'bom', v_label_bom, 'medio', v_label_medio, 'ruim', v_label_ruim, 'semLabel', v_label_sem,
        'byManager', COALESCE((SELECT jsonb_agg(jsonb_build_object('managerId', assigned_ads_manager, 'managerName', manager_name, 'otimo', otimo, 'bom', bom, 'medio', medio, 'ruim', ruim, 'semLabel', sem_label, 'total', total) ORDER BY ruim DESC) FROM labels_by_manager), '[]'::jsonb),
        'topRuimManager', (SELECT jsonb_build_object('managerId', assigned_ads_manager, 'managerName', manager_name, 'ruimCount', ruim) FROM labels_by_manager WHERE ruim > 0 ORDER BY ruim DESC LIMIT 1)
      ),
      'groupSquadStats', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'groupId', gs.id,
        'groupName', gs.name,
        'squads', COALESCE((SELECT jsonb_agg(jsonb_build_object('squadId', ss.id, 'squadName', ss.name, 'clientCount', ss.total_clients, 'labels', jsonb_build_object('otimo', ss.otimo, 'bom', ss.bom, 'medio', ss.medio, 'ruim', ss.ruim, 'semLabel', ss.sem_label), 'totalMonthlyValue', ss.total_value) ORDER BY ss.name) FROM squad_stats ss WHERE ss.group_id = gs.id), '[]'::jsonb),
        'totalClients', gs.total_clients,
        'totalMonthlyValue', gs.total_value
      ) ORDER BY gs.name) FROM group_stats gs), '[]'::jsonb),
      'financial', jsonb_build_object(
        'totalReceivable', (SELECT total_receivable FROM finance),
        'totalReceived', (SELECT total_received FROM finance),
        'totalPayable', (SELECT total_payable FROM finance),
        'totalPaid', (SELECT total_paid FROM finance),
        'pendingPayable', (SELECT pending_payable FROM finance),
        'overdueReceivable', (SELECT overdue_receivable FROM finance),
        'result', (SELECT total_receivable - total_payable FROM finance),
        'marginPercent', (SELECT CASE WHEN total_receivable > 0 THEN ((total_receivable - total_payable) / total_receivable) * 100 ELSE 0 END FROM finance),
        'byProduct', COALESCE((SELECT jsonb_agg(jsonb_build_object('productId', id, 'productName', nome, 'productSlug', slug, 'color', cor, 'clientCount', client_count, 'revenue', revenue) ORDER BY revenue DESC) FROM financial_product), '[]'::jsonb),
        'monthlyTrend', '[]'::jsonb
      ),
      'tasks', jsonb_build_object(
        'totalOverdue', v_task_overdue,
        'overdueByArea', COALESCE((SELECT jsonb_agg(jsonb_build_object('area', name, 'areaSlug', slug, 'count', total, 'oldestDays', GREATEST(0, (v_today - oldest_due)::int)) ORDER BY total DESC) FROM kanban_overdue), '[]'::jsonb),
        'tasksByStatus', jsonb_build_object(
          'pending', (SELECT (SELECT COUNT(*) FROM public.ads_tasks WHERE COALESCE(archived, false) = false AND status = 'pending') + (SELECT COUNT(*) FROM public.comercial_tasks WHERE COALESCE(archived, false) = false AND status = 'pendente')),
          'inProgress', (SELECT (SELECT COUNT(*) FROM public.ads_tasks WHERE COALESCE(archived, false) = false AND status = 'in_progress') + (SELECT COUNT(*) FROM public.comercial_tasks WHERE COALESCE(archived, false) = false AND status = 'em_andamento')),
          'done', (SELECT (SELECT COUNT(*) FROM public.ads_tasks WHERE COALESCE(archived, false) = false AND status = 'done') + (SELECT COUNT(*) FROM public.comercial_tasks WHERE COALESCE(archived, false) = false AND status = 'concluída'))
        ),
        'adsTasks', jsonb_build_object('total', (SELECT ads_total FROM task_counts), 'overdue', (SELECT ads_overdue FROM task_counts), 'pending', (SELECT ads_pending FROM task_counts)),
        'comercialTasks', jsonb_build_object('total', (SELECT comercial_total FROM task_counts), 'overdue', (SELECT comercial_overdue FROM task_counts), 'pending', (SELECT comercial_pending FROM task_counts)),
        'rhTasks', jsonb_build_object('total', (SELECT rh_total FROM task_counts), 'overdue', (SELECT rh_overdue FROM task_counts), 'pending', (SELECT rh_pending FROM task_counts))
      ),
      'cs', jsonb_build_object(
        'totalActionPlans', (SELECT total_plans FROM cs),
        'activeActionPlans', (SELECT active_plans FROM cs),
        'completedActionPlans', (SELECT completed_plans FROM cs),
        'expiredActionPlans', (SELECT expired_plans FROM cs),
        'avgNPS', (SELECT avg_nps FROM cs),
        'npsResponses', (SELECT nps_responses FROM cs),
        'clientsNeedingContact', (SELECT needs_contact FROM cs),
        'byClassification', jsonb_build_object('monitoramento', (SELECT monitoramento FROM cs), 'sucesso', (SELECT sucesso FROM cs), 'risco', (SELECT risco FROM cs), 'critico', (SELECT critico FROM cs))
      ),
      'bottlenecks', v_bottlenecks,
      'summary', jsonb_build_object(
        'totalActiveClients', v_total_active,
        'totalTeamMembers', (SELECT COUNT(*) FROM public.profiles),
        'totalGroups', (SELECT COUNT(*) FROM public.organization_groups),
        'totalSquads', (SELECT COUNT(*) FROM public.squads),
        'healthScore', v_health_score,
        'operationalScore', GREATEST(0, 100 - (v_critical_count * 20) - (v_warning_count * 10)),
        'newClientsThisMonth', (SELECT COUNT(*) FROM public.clients WHERE created_at >= v_start_month),
        'avgClientLifetime', COALESCE((SELECT ROUND(AVG(GREATEST(0, EXTRACT(epoch FROM (v_now - COALESCE(entry_date::timestamptz, created_at))) / 2592000)))::int FROM active_clients WHERE entry_date IS NOT NULL OR created_at IS NOT NULL), 0)
      )
    ));
END;
$$;

REVOKE ALL ON FUNCTION public.get_ceo_advanced_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ceo_advanced_stats() TO authenticated;

COMMENT ON FUNCTION public.get_ceo_advanced_stats() IS
  'Retorna o dashboard avancado Millennials Growth agregado no backend, sem trafegar tabelas completas.';

COMMIT;
