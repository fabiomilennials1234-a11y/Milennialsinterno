-- 20260504100300_rpc_get_pending_mine.sql

CREATE OR REPLACE FUNCTION public.get_justifications_pending_mine()
RETURNS TABLE(
  notification_id uuid,
  task_id uuid,
  task_table text,
  task_title text,
  task_due_date timestamptz,
  task_owner_id uuid,
  task_owner_name text,
  task_owner_role text,
  master_comment text,
  requires_revision boolean,
  created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
BEGIN
  IF v_caller IS NULL THEN RETURN; END IF;

  SELECT role INTO v_caller_role FROM public.user_roles WHERE user_id = v_caller LIMIT 1;

  RETURN QUERY
  WITH valid_notifs AS (
    SELECT n.*
    FROM public.task_delay_notifications n
    WHERE
      n.task_owner_id = v_caller
      OR (
        n.task_owner_role = 'gestor_ads'
        AND v_caller_role IN ('sucesso_cliente','gestor_projetos','ceo','cto')
      )
      OR (
        n.task_owner_role <> 'gestor_ads'
        AND v_caller_role IN ('gestor_projetos','ceo','cto')
      )
  ),
  my_done AS (
    SELECT j.notification_id, j.requires_revision, j.master_comment
    FROM public.task_delay_justifications j
    WHERE j.user_id = v_caller AND j.archived = false
  )
  SELECT
    n.id AS notification_id,
    n.task_id,
    n.task_table,
    n.task_title,
    n.task_due_date,
    n.task_owner_id,
    n.task_owner_name,
    n.task_owner_role,
    md.master_comment,
    COALESCE(md.requires_revision, false) AS requires_revision,
    n.created_at
  FROM valid_notifs n
  LEFT JOIN my_done md ON md.notification_id = n.id
  WHERE md.notification_id IS NULL OR md.requires_revision = true
  ORDER BY n.task_due_date ASC;
END $$;

REVOKE ALL ON FUNCTION public.get_justifications_pending_mine() FROM public;
GRANT EXECUTE ON FUNCTION public.get_justifications_pending_mine() TO authenticated;
