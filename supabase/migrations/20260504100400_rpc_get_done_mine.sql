-- 20260504100400_rpc_get_done_mine.sql

CREATE OR REPLACE FUNCTION public.get_justifications_done_mine()
RETURNS TABLE(
  justification_id uuid,
  notification_id uuid,
  task_id uuid,
  task_table text,
  task_title text,
  task_due_date timestamptz,
  justification text,
  master_comment text,
  master_comment_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    j.id AS justification_id,
    j.notification_id,
    n.task_id,
    n.task_table,
    n.task_title,
    n.task_due_date,
    j.justification,
    j.master_comment,
    j.master_comment_at,
    j.created_at
  FROM public.task_delay_justifications j
  JOIN public.task_delay_notifications n ON n.id = j.notification_id
  WHERE j.user_id = v_caller
    AND j.archived = false
    AND j.requires_revision = false
  ORDER BY j.created_at DESC;
END $$;

REVOKE ALL ON FUNCTION public.get_justifications_done_mine() FROM public;
GRANT EXECUTE ON FUNCTION public.get_justifications_done_mine() TO authenticated;
