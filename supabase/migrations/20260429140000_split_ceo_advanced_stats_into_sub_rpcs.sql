-- 20260429140000_split_ceo_advanced_stats_into_sub_rpcs.sql
--
-- P1.2: quebra `get_ceo_advanced_stats()` em sub-RPCs por dominio.
-- Cada sub-RPC retorna apenas a secao correspondente do payload final,
-- ficando testavel isoladamente.
--
-- Sub-RPCs criadas:
--   - get_ceo_stats_onboarding()    -> jsonb (impl real, byManager + activeByMilestone)
--   - get_ceo_stats_production()    -> jsonb (placeholder atual preservado)
--   - get_ceo_stats_churn()         -> jsonb (impl parcial: churnedLastMonth)
--   - get_ceo_stats_client_labels() -> jsonb (placeholder byManager preservado)
--   - get_ceo_stats_group_squad()   -> jsonb (placeholder atual preservado)
--   - get_ceo_stats_financial()     -> jsonb (placeholder byProduct/monthlyTrend preservado)
--   - get_ceo_stats_tasks()         -> jsonb (placeholder overdueByArea preservado)
--
-- Cada sub-RPC verifica auth + role executive/admin igual a funcao mae.
-- `get_ceo_advanced_stats()` agora compoe o payload chamando as sub-RPCs.
-- Contrato externo (forma do JSON) inalterado.

BEGIN;

-- ── Helper: assert auth + executive/admin ────────────────────────────────
-- Inline em cada sub-RPC para preservar SECURITY DEFINER caller resolution.

-- ── 1. get_ceo_stats_onboarding ──────────────────────────────────────────
-- Implementacao REAL: byManager (gestor_ads) + activeByMilestone + avgDays.

CREATE OR REPLACE FUNCTION public.get_ceo_stats_onboarding()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_avg_days numeric;
  v_total_completed int;
  v_active int;
  v_by_manager jsonb;
  v_active_by_milestone jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;
  IF NOT (public.is_executive(v_caller) OR public.is_admin(v_caller)) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT
    COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 86400), 0)::numeric(10,2),
    COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::int,
    COUNT(*) FILTER (WHERE completed_at IS NULL)::int
  INTO v_avg_days, v_total_completed, v_active
  FROM public.client_onboarding;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id',   t.user_id,
    'name',      t.name,
    'total',     t.total,
    'completed', t.completed,
    'active',    t.active,
    'avg_days',  t.avg_days
  )), '[]'::jsonb)
  INTO v_by_manager
  FROM (
    SELECT
      p.user_id,
      p.name,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE co.completed_at IS NOT NULL)::int AS completed,
      COUNT(*) FILTER (WHERE co.completed_at IS NULL)::int AS active,
      ROUND(
        COALESCE(
          AVG(EXTRACT(EPOCH FROM (co.completed_at - co.created_at)) / 86400)
            FILTER (WHERE co.completed_at IS NOT NULL),
          0
        )::numeric,
        1
      ) AS avg_days
    FROM public.client_onboarding co
    JOIN public.clients c ON c.id = co.client_id
    JOIN public.profiles p ON p.user_id = c.assigned_ads_manager
    WHERE c.assigned_ads_manager IS NOT NULL
    GROUP BY p.user_id, p.name
    ORDER BY total DESC
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'milestone', t.milestone,
    'count',     t.count
  )), '[]'::jsonb)
  INTO v_active_by_milestone
  FROM (
    SELECT
      current_milestone AS milestone,
      COUNT(*)::int AS count
    FROM public.client_onboarding
    WHERE completed_at IS NULL
    GROUP BY current_milestone
    ORDER BY current_milestone
  ) t;

  RETURN jsonb_build_object(
    'avgDaysToComplete', v_avg_days,
    'totalCompleted', v_total_completed,
    'activeOnboardings', v_active,
    'byManager', v_by_manager,
    'activeByMilestone', v_active_by_milestone
  );
END;
$$;

-- ── 2. get_ceo_stats_production ──────────────────────────────────────────
-- Placeholder preservado (sera preenchido em corte futuro).

CREATE OR REPLACE FUNCTION public.get_ceo_stats_production()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;
  IF NOT (public.is_executive(v_caller) OR public.is_admin(v_caller)) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'design',    jsonb_build_object('avgDays', 0, 'totalCompleted', 0, 'pending', 0),
    'video',     jsonb_build_object('avgDays', 0, 'totalCompleted', 0, 'pending', 0),
    'produtora', jsonb_build_object('avgDays', 0, 'totalCompleted', 0, 'pending', 0),
    'atrizes',   jsonb_build_object('avgDays', 0, 'totalCompleted', 0, 'pending', 0)
  );
END;
$$;

-- ── 3. get_ceo_stats_churn ───────────────────────────────────────────────
-- Implementacao parcial: adiciona churnedLastMonth real. byManager e
-- distratoClients ainda placeholder ate proximo corte.

CREATE OR REPLACE FUNCTION public.get_ceo_stats_churn()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_month_start date := date_trunc('month', current_date)::date;
  v_prev_month_start date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_total_churned int;
  v_churned_this_month int;
  v_churned_last_month int;
  v_distrato int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;
  IF NOT (public.is_executive(v_caller) OR public.is_admin(v_caller)) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) FILTER (WHERE COALESCE(archived, false) = true OR status = 'churned')::int,
         COUNT(*) FILTER (WHERE archived_at >= v_month_start)::int,
         COUNT(*) FILTER (WHERE archived_at >= v_prev_month_start AND archived_at < v_month_start)::int,
         COUNT(*) FILTER (WHERE distrato_step IS NOT NULL AND COALESCE(archived, false) = false)::int
  INTO v_total_churned, v_churned_this_month, v_churned_last_month, v_distrato
  FROM public.clients;

  RETURN jsonb_build_object(
    'totalChurned', v_total_churned,
    'churnedThisMonth', v_churned_this_month,
    'churnedLastMonth', v_churned_last_month,
    'distratoInProgress', v_distrato,
    'byManager', '[]'::jsonb,
    'topChurnManager', NULL,
    'distratoClients', '[]'::jsonb
  );
END;
$$;

-- ── 4. get_ceo_stats_client_labels ───────────────────────────────────────
-- Conta por label + placeholder byManager ate proximo corte.

CREATE OR REPLACE FUNCTION public.get_ceo_stats_client_labels()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_total int;
  v_otimo int;
  v_bom int;
  v_medio int;
  v_ruim int;
  v_sem int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;
  IF NOT (public.is_executive(v_caller) OR public.is_admin(v_caller)) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE client_label = 'otimo')::int,
    COUNT(*) FILTER (WHERE client_label = 'bom')::int,
    COUNT(*) FILTER (WHERE client_label = 'medio')::int,
    COUNT(*) FILTER (WHERE client_label = 'ruim')::int,
    COUNT(*) FILTER (WHERE client_label IS NULL OR client_label NOT IN ('otimo','bom','medio','ruim'))::int
  INTO v_total, v_otimo, v_bom, v_medio, v_ruim, v_sem
  FROM public.clients
  WHERE COALESCE(archived, false) = false
    AND COALESCE(status, '') <> 'churned'
    AND distrato_step IS NULL;

  RETURN jsonb_build_object(
    'total', v_total,
    'otimo', v_otimo,
    'bom', v_bom,
    'medio', v_medio,
    'ruim', v_ruim,
    'semLabel', v_sem,
    'byManager', '[]'::jsonb,
    'topRuimManager', NULL
  );
END;
$$;

-- ── 5. get_ceo_stats_group_squad ─────────────────────────────────────────
-- Placeholder preservado.

CREATE OR REPLACE FUNCTION public.get_ceo_stats_group_squad()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;
  IF NOT (public.is_executive(v_caller) OR public.is_admin(v_caller)) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN '[]'::jsonb;
END;
$$;

-- ── 6. get_ceo_stats_financial ───────────────────────────────────────────
-- Agregado financeiro (real); byProduct/monthlyTrend ainda placeholder.

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

  RETURN jsonb_build_object(
    'totalReceivable', v_total_receivable,
    'totalReceived', v_total_received,
    'totalPayable', v_total_payable,
    'totalPaid', v_total_paid,
    'pendingPayable', v_pending_payable,
    'overdueReceivable', v_overdue_receivable,
    'result', v_total_receivable - v_total_payable,
    'marginPercent', CASE WHEN v_total_receivable > 0
      THEN ((v_total_receivable - v_total_payable) / v_total_receivable) * 100
      ELSE 0 END,
    'byProduct', '[]'::jsonb,
    'monthlyTrend', '[]'::jsonb
  );
END;
$$;

-- ── 7. get_ceo_stats_tasks ───────────────────────────────────────────────
-- Agregado tarefas (real); overdueByArea continua placeholder.

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
    'overdueByArea', '[]'::jsonb,
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

-- ── Funcao mae: compoe o payload chamando as sub-RPCs ────────────────────
CREATE OR REPLACE FUNCTION public.get_ceo_advanced_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_now timestamptz := now();
  v_month_start date := date_trunc('month', current_date)::date;

  v_onboarding jsonb;
  v_production jsonb;
  v_churn jsonb;
  v_client_labels jsonb;
  v_group_squad jsonb;
  v_financial jsonb;
  v_tasks jsonb;

  v_active int;
  v_otimo int;
  v_bom int;
  v_medio int;
  v_ruim int;
  v_sem int;
  v_health int;

  v_distrato int;
  v_overdue_receivable numeric;
  v_total_overdue int;
  v_expired_plans int;

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

  v_onboarding    := public.get_ceo_stats_onboarding();
  v_production    := public.get_ceo_stats_production();
  v_churn         := public.get_ceo_stats_churn();
  v_client_labels := public.get_ceo_stats_client_labels();
  v_group_squad   := public.get_ceo_stats_group_squad();
  v_financial     := public.get_ceo_stats_financial();
  v_tasks         := public.get_ceo_stats_tasks();

  -- Reextrai numeros das secoes para compor bottlenecks/summary.
  v_active := (v_client_labels->>'total')::int;
  v_otimo  := (v_client_labels->>'otimo')::int;
  v_bom    := (v_client_labels->>'bom')::int;
  v_medio  := (v_client_labels->>'medio')::int;
  v_ruim   := (v_client_labels->>'ruim')::int;
  v_sem    := (v_client_labels->>'semLabel')::int;

  v_health := CASE WHEN v_active > 0
    THEN ROUND((v_otimo*100 + v_bom*75 + v_medio*50 + v_ruim*25 + v_sem*50)::numeric / v_active)::int
    ELSE 0 END;

  v_distrato            := (v_churn->>'distratoInProgress')::int;
  v_overdue_receivable  := (v_financial->>'overdueReceivable')::numeric;
  v_total_overdue       := (v_tasks->>'totalOverdue')::int;

  SELECT COUNT(*)::int INTO v_expired_plans
  FROM public.cs_action_plans
  WHERE due_date < v_now AND status <> 'completed';

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
    'onboarding',       v_onboarding,
    'production',       v_production,
    'churn',            v_churn,
    'clientLabels',     v_client_labels,
    'groupSquadStats',  v_group_squad,
    'financial',        v_financial,
    'tasks',            v_tasks,
    'cs', jsonb_build_object(
      'totalActionPlans',     (SELECT COUNT(*) FROM public.cs_action_plans),
      'activeActionPlans',    (SELECT COUNT(*) FROM public.cs_action_plans WHERE status IN ('active','in_progress')),
      'completedActionPlans', (SELECT COUNT(*) FROM public.cs_action_plans WHERE status = 'completed'),
      'expiredActionPlans',   v_expired_plans,
      'avgNPS',               (SELECT COUNT(*) FROM public.nps_surveys),
      'npsResponses',         (SELECT COUNT(*) FROM public.nps_responses),
      'clientsNeedingContact',(SELECT COUNT(*) FROM public.clients
                                 WHERE COALESCE(archived, false) = false
                                   AND (last_cs_contact_at IS NULL OR last_cs_contact_at < v_now - interval '30 days')),
      'byClassification', jsonb_build_object(
        'monitoramento', (SELECT COUNT(*) FROM public.clients WHERE COALESCE(archived, false) = false AND cs_classification = 'monitoramento'),
        'sucesso',       (SELECT COUNT(*) FROM public.clients WHERE COALESCE(archived, false) = false AND cs_classification = 'sucesso'),
        'risco',         (SELECT COUNT(*) FROM public.clients WHERE COALESCE(archived, false) = false AND cs_classification = 'risco'),
        'critico',       (SELECT COUNT(*) FROM public.clients WHERE COALESCE(archived, false) = false AND cs_classification = 'critico')
      )
    ),
    'bottlenecks', v_bottlenecks,
    'summary', jsonb_build_object(
      'totalActiveClients',  v_active,
      'totalTeamMembers',    (SELECT COUNT(*) FROM public.profiles),
      'totalGroups',         (SELECT COUNT(*) FROM public.organization_groups),
      'totalSquads',         (SELECT COUNT(*) FROM public.squads),
      'healthScore',         v_health,
      'operationalScore',    GREATEST(0, 100 - (v_critical * 20) - (v_warning * 10)),
      'newClientsThisMonth', (SELECT COUNT(*) FROM public.clients WHERE created_at >= v_month_start),
      'avgClientLifetime',   0
    )
  );
END;
$$;

-- ── Grants ───────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.get_ceo_stats_onboarding()    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_ceo_stats_production()    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_ceo_stats_churn()         FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_ceo_stats_client_labels() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_ceo_stats_group_squad()   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_ceo_stats_financial()     FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_ceo_stats_tasks()         FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_ceo_stats_onboarding()    TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ceo_stats_production()    TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ceo_stats_churn()         TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ceo_stats_client_labels() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ceo_stats_group_squad()   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ceo_stats_financial()     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ceo_stats_tasks()         TO authenticated;

COMMENT ON FUNCTION public.get_ceo_stats_onboarding()    IS 'Sub-RPC: secao onboarding do payload de get_ceo_advanced_stats. Implementacao real (byManager + activeByMilestone + avgDays).';
COMMENT ON FUNCTION public.get_ceo_stats_production()    IS 'Sub-RPC: secao production. Placeholder ate proximo corte.';
COMMENT ON FUNCTION public.get_ceo_stats_churn()         IS 'Sub-RPC: secao churn. Implementacao parcial (churnedLastMonth real).';
COMMENT ON FUNCTION public.get_ceo_stats_client_labels() IS 'Sub-RPC: secao clientLabels. byManager placeholder.';
COMMENT ON FUNCTION public.get_ceo_stats_group_squad()   IS 'Sub-RPC: secao groupSquadStats. Placeholder.';
COMMENT ON FUNCTION public.get_ceo_stats_financial()     IS 'Sub-RPC: secao financial. Agregado real; byProduct/monthlyTrend placeholder.';
COMMENT ON FUNCTION public.get_ceo_stats_tasks()         IS 'Sub-RPC: secao tasks. Agregado real; overdueByArea placeholder.';

COMMIT;
