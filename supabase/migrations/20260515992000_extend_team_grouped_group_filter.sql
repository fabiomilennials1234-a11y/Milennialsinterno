-- 20260515992000_extend_team_grouped_group_filter.sql
--
-- Adds optional p_group_id filter to get_justifications_team_grouped.
-- When provided, only returns delays for users belonging to that group.
-- Used by SquadDelaysJustificationsSection so each GP sees only their group's delays.

DROP FUNCTION IF EXISTS public.get_justifications_team_grouped(boolean, text[]);
DROP FUNCTION IF EXISTS public.get_justifications_team_grouped(boolean, text[], uuid);

CREATE OR REPLACE FUNCTION public.get_justifications_team_grouped(
  p_only_pending boolean DEFAULT false,
  p_task_tables text[] DEFAULT NULL,
  p_group_id uuid DEFAULT NULL
)
RETURNS TABLE(
  user_id uuid,
  user_name text,
  user_role text,
  notification_id uuid,
  task_id uuid,
  task_table text,
  task_title text,
  task_due_date timestamptz,
  justification_id uuid,
  justification_text text,
  master_comment text,
  requires_revision boolean,
  archived boolean,
  created_at timestamptz,
  client_name text,
  department text,
  justification_at timestamptz,
  task_archived boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH scope AS (
    SELECT s.user_id FROM public.get_team_users_in_scope() s
  ),
  -- When p_group_id is provided, narrow scope to users in that group.
  filtered_scope AS (
    SELECT sc.user_id
    FROM scope sc
    WHERE p_group_id IS NULL
       OR EXISTS (
         SELECT 1 FROM public.profiles p
         WHERE p.user_id = sc.user_id
           AND p.group_id = p_group_id
       )
  ),
  valid_notifs AS (
    SELECT n.*
    FROM public.task_delay_notifications n
    JOIN filtered_scope fs ON fs.user_id = n.task_owner_id
    WHERE p_task_tables IS NULL OR n.task_table = ANY(p_task_tables)
  ),
  task_state AS (
    SELECT
      n.id AS notification_id,
      'comercial_tasks'::text AS source_table,
      ct.status,
      ct.archived,
      ct.related_client_id AS client_id,
      'comercial'::text AS dept
    FROM valid_notifs n
    JOIN public.comercial_tasks ct ON ct.id = n.task_id
    WHERE n.task_table = 'comercial_tasks'
    UNION ALL
    SELECT
      n.id,
      'ads_tasks',
      at.status,
      at.archived,
      NULL::uuid,
      'ads'::text
    FROM valid_notifs n
    JOIN public.ads_tasks at ON at.id = n.task_id
    WHERE n.task_table = 'ads_tasks'
    UNION ALL
    SELECT
      n.id,
      'department_tasks',
      dt.status,
      dt.archived,
      dt.related_client_id,
      dt.department
    FROM valid_notifs n
    JOIN public.department_tasks dt ON dt.id = n.task_id
    WHERE n.task_table = 'department_tasks'
    UNION ALL
    SELECT
      n.id,
      'kanban_cards',
      kc.status,
      kc.archived,
      kc.client_id,
      COALESCE(kb.slug, 'kanban')
    FROM valid_notifs n
    JOIN public.kanban_cards kc ON kc.id = n.task_id
    LEFT JOIN public.kanban_boards kb ON kb.id = kc.board_id
    WHERE n.task_table = 'kanban_cards'
  )
  SELECT
    n.task_owner_id AS user_id,
    n.task_owner_name AS user_name,
    n.task_owner_role AS user_role,
    n.id AS notification_id,
    n.task_id,
    n.task_table,
    n.task_title,
    n.task_due_date,
    j.id AS justification_id,
    j.justification AS justification_text,
    j.master_comment,
    COALESCE(j.requires_revision, false) AS requires_revision,
    COALESCE(j.archived, false) AS archived,
    n.created_at,
    cl.name AS client_name,
    ts.dept AS department,
    j.created_at AS justification_at,
    ts.archived AS task_archived
  FROM valid_notifs n
  LEFT JOIN public.task_delay_justifications j
    ON j.notification_id = n.id
   AND j.user_id = n.task_owner_id
   AND j.archived = false
  LEFT JOIN task_state ts ON ts.notification_id = n.id
  LEFT JOIN public.clients cl ON cl.id = ts.client_id
  WHERE
    (ts.notification_id IS NULL OR ts.status IS DISTINCT FROM 'done')
    AND (
      NOT p_only_pending
      OR j.id IS NULL
      OR j.requires_revision = true
    )
  ORDER BY n.task_owner_name, n.task_due_date ASC;
END $$;

REVOKE ALL ON FUNCTION public.get_justifications_team_grouped(boolean, text[], uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_justifications_team_grouped(boolean, text[], uuid) TO authenticated;
