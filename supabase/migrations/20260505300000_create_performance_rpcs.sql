-- Performance RPCs: get_ceo_stats and get_dashboard_stats
-- Moves heavy frontend computation to DB for better performance

-- ============================================================
-- RPC: get_ceo_stats
-- Replaces 6 parallel select('*') queries + JS computation
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_ceo_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _today date := current_date;
  _week_ago timestamptz := now() - interval '7 days';
  _result jsonb;
  _total_team int;
  _total_groups int;
  _total_squads int;
  _total_cards bigint;
  _completed_cards bigint;
  _completion_rate int;
  _tasks_created_week bigint;
  _tasks_completed_week bigint;
  _avg_completion_time int;
  _bottlenecks jsonb;
  _squad_performance jsonb;
  _operational_status jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Basic counts
  SELECT count(*) INTO _total_team FROM profiles;
  SELECT count(*) INTO _total_groups FROM organization_groups;
  SELECT count(*) INTO _total_squads FROM squads;

  -- Identify completed column IDs
  CREATE TEMP TABLE _completed_cols ON COMMIT DROP AS
    SELECT id FROM kanban_columns
    WHERE lower(title) LIKE '%conclu%' OR lower(title) LIKE '%resolvido%';

  -- Total cards and completed
  SELECT count(*) INTO _total_cards FROM kanban_cards;
  SELECT count(*) INTO _completed_cards
    FROM kanban_cards c
    WHERE c.column_id IN (SELECT id FROM _completed_cols);

  _completion_rate := CASE WHEN _total_cards > 0
    THEN round((_completed_cards::numeric / _total_cards) * 100)::int
    ELSE 0 END;

  -- Week metrics
  SELECT count(*) INTO _tasks_created_week
    FROM kanban_cards WHERE created_at >= _week_ago;

  SELECT count(*) INTO _tasks_completed_week
    FROM kanban_cards
    WHERE column_id IN (SELECT id FROM _completed_cols)
      AND updated_at >= _week_ago;

  -- Average completion time (days) for completed tasks
  SELECT coalesce(round(avg(
    EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400
  ))::int, 0) INTO _avg_completion_time
    FROM kanban_cards
    WHERE column_id IN (SELECT id FROM _completed_cols)
      AND created_at IS NOT NULL AND updated_at IS NOT NULL;

  -- Bottlenecks: boards with overdue non-completed cards
  SELECT coalesce(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub."overdueCount" DESC), '[]'::jsonb)
  INTO _bottlenecks
  FROM (
    SELECT
      b.name AS "area",
      count(*) AS "overdueCount",
      EXTRACT(DAY FROM (_today - min(c.due_date)))::int AS "oldestOverdueDays"
    FROM kanban_cards c
    JOIN kanban_boards b ON b.id = c.board_id
    WHERE c.due_date < _today
      AND c.column_id NOT IN (SELECT id FROM _completed_cols)
    GROUP BY b.id, b.name
    HAVING count(*) > 0
  ) sub;

  -- Squad performance (real data: count cards assigned to squad members)
  SELECT coalesce(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb)
  INTO _squad_performance
  FROM (
    SELECT
      s.name AS "squadName",
      coalesce(g.name, 'Grupo') AS "groupName",
      count(c.id)::int AS "totalTasks",
      count(c.id) FILTER (WHERE c.column_id IN (SELECT id FROM _completed_cols))::int AS "completedTasks",
      count(c.id) FILTER (WHERE c.due_date < _today AND c.column_id NOT IN (SELECT id FROM _completed_cols))::int AS "overdueTasks",
      CASE WHEN count(c.id) > 0
        THEN round((count(c.id) FILTER (WHERE c.column_id IN (SELECT id FROM _completed_cols))::numeric / count(c.id)) * 100)::int
        ELSE 0 END AS "completionRate"
    FROM squads s
    LEFT JOIN organization_groups g ON g.id = s.group_id
    LEFT JOIN profiles p ON p.squad_id = s.id
    LEFT JOIN kanban_cards c ON c.assigned_to = p.user_id
    GROUP BY s.id, s.name, g.name
  ) sub;

  -- Operational status
  SELECT jsonb_build_object(
    'healthy', count(*) FILTER (WHERE overdue_count = 0),
    'attention', count(*) FILTER (WHERE overdue_count > 0 AND overdue_count <= 3),
    'critical', count(*) FILTER (WHERE overdue_count > 3)
  ) INTO _operational_status
  FROM (
    SELECT b.id,
      count(c.id) FILTER (WHERE c.due_date < _today AND c.column_id NOT IN (SELECT id FROM _completed_cols)) AS overdue_count
    FROM kanban_boards b
    LEFT JOIN kanban_cards c ON c.board_id = b.id
    GROUP BY b.id
  ) board_overdue;

  _result := jsonb_build_object(
    'totalTeamMembers', _total_team,
    'totalGroups', _total_groups,
    'totalSquads', _total_squads,
    'overallCompletionRate', _completion_rate,
    'tasksCompletedThisWeek', _tasks_completed_week,
    'tasksCreatedThisWeek', _tasks_created_week,
    'avgTaskCompletionTime', _avg_completion_time,
    'bottlenecks', _bottlenecks,
    'squadPerformance', _squad_performance,
    'commercialMetrics', jsonb_build_object('newLeads', 0, 'closedDeals', 0, 'conversionRate', 0),
    'operationalStatus', _operational_status
  );

  RETURN _result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_ceo_stats() TO authenticated;


-- ============================================================
-- RPC: get_dashboard_stats
-- Replaces 5 waterfall queries + JS computation
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _today date := current_date;
  _result jsonb;
  _total_cards bigint;
  _completed_cards bigint;
  _in_progress_cards bigint;
  _overdue_cards bigint;
  _board_stats jsonb;
  _priority_dist jsonb;
  _recent_activity jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Identify column types
  CREATE TEMP TABLE _dash_completed_cols ON COMMIT DROP AS
    SELECT id, board_id FROM kanban_columns WHERE lower(title) LIKE '%conclu%';

  CREATE TEMP TABLE _dash_progress_cols ON COMMIT DROP AS
    SELECT id, board_id FROM kanban_columns WHERE lower(title) LIKE '%progresso%';

  -- Global counts
  SELECT count(*) INTO _total_cards FROM kanban_cards;

  SELECT count(*) INTO _completed_cards
    FROM kanban_cards WHERE column_id IN (SELECT id FROM _dash_completed_cols);

  SELECT count(*) INTO _in_progress_cards
    FROM kanban_cards WHERE column_id IN (SELECT id FROM _dash_progress_cols);

  SELECT count(*) INTO _overdue_cards
    FROM kanban_cards
    WHERE due_date < _today
      AND column_id NOT IN (SELECT id FROM _dash_completed_cols);

  -- Board stats
  SELECT coalesce(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb)
  INTO _board_stats
  FROM (
    SELECT
      b.id AS "boardId",
      b.name AS "boardName",
      b.slug AS "boardSlug",
      count(c.id)::int AS "total",
      count(c.id) FILTER (WHERE c.column_id IN (SELECT id FROM _dash_completed_cols WHERE board_id = b.id))::int AS "completed",
      count(c.id) FILTER (WHERE c.column_id IN (SELECT id FROM _dash_progress_cols WHERE board_id = b.id))::int AS "inProgress",
      count(c.id) FILTER (WHERE c.due_date < _today AND c.column_id NOT IN (SELECT id FROM _dash_completed_cols WHERE board_id = b.id))::int AS "overdue"
    FROM kanban_boards b
    LEFT JOIN kanban_cards c ON c.board_id = b.id
    GROUP BY b.id, b.name, b.slug
  ) sub;

  -- Priority distribution
  SELECT jsonb_build_object(
    'low', count(*) FILTER (WHERE priority = 'low'),
    'medium', count(*) FILTER (WHERE priority = 'medium'),
    'high', count(*) FILTER (WHERE priority = 'high'),
    'urgent', count(*) FILTER (WHERE priority = 'urgent')
  ) INTO _priority_dist
  FROM kanban_cards;

  -- Recent activity (last 10)
  SELECT coalesce(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb)
  INTO _recent_activity
  FROM (
    SELECT
      a.id,
      a.action,
      coalesce(kc.title, 'Card removido') AS "cardTitle",
      coalesce(p.name, 'Usuário') AS "userName",
      a.created_at AS "createdAt",
      a.details
    FROM card_activities a
    LEFT JOIN kanban_cards kc ON kc.id = a.card_id
    LEFT JOIN profiles p ON p.user_id = a.user_id
    ORDER BY a.created_at DESC
    LIMIT 10
  ) sub;

  _result := jsonb_build_object(
    'totalCards', _total_cards,
    'completedCards', _completed_cards,
    'inProgressCards', _in_progress_cards,
    'overdueCards', _overdue_cards,
    'boardStats', _board_stats,
    'recentActivity', _recent_activity,
    'priorityDistribution', _priority_dist
  );

  RETURN _result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;
