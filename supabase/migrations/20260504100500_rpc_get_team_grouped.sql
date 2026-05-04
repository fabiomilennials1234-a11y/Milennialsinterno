-- 20260504100500_rpc_get_team_grouped.sql

CREATE OR REPLACE FUNCTION public.get_justifications_team_grouped(
  p_only_pending boolean DEFAULT false
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
  created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH scope AS (
    SELECT s.user_id FROM public.get_team_users_in_scope() s
  ),
  valid_notifs AS (
    SELECT n.*
    FROM public.task_delay_notifications n
    JOIN scope ON scope.user_id = n.task_owner_id
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
    n.created_at
  FROM valid_notifs n
  LEFT JOIN public.task_delay_justifications j
    ON j.notification_id = n.id
   AND j.user_id = n.task_owner_id
   AND j.archived = false
  WHERE
    NOT p_only_pending
    OR j.id IS NULL
    OR j.requires_revision = true
  ORDER BY n.task_owner_name, n.task_due_date ASC;
END $$;

REVOKE ALL ON FUNCTION public.get_justifications_team_grouped(boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.get_justifications_team_grouped(boolean) TO authenticated;
