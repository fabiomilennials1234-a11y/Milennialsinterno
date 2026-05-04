-- 20260504100600_rpc_master_actions.sql

CREATE OR REPLACE FUNCTION public.request_justification_revision(
  p_justification_id uuid,
  p_comment text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_target uuid;
  v_notification_id uuid;
  v_task_title text;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF p_justification_id IS NULL OR p_comment IS NULL OR length(trim(p_comment)) = 0 THEN
    RAISE EXCEPTION 'justification_id and non-empty comment required';
  END IF;

  SELECT j.user_id, j.notification_id INTO v_target, v_notification_id
    FROM public.task_delay_justifications j
    WHERE j.id = p_justification_id;

  IF v_target IS NULL THEN RAISE EXCEPTION 'justification not found'; END IF;

  PERFORM public.assert_user_in_my_scope(v_target);

  UPDATE public.task_delay_justifications
    SET master_comment = trim(p_comment),
        master_comment_by = v_caller,
        master_comment_at = now(),
        requires_revision = true,
        revision_requested_by = v_caller,
        revision_requested_at = now()
    WHERE id = p_justification_id;

  SELECT task_title INTO v_task_title
    FROM public.task_delay_notifications WHERE id = v_notification_id;

  INSERT INTO public.system_notifications (
    recipient_id, recipient_role, notification_type, title, message, priority
  )
  SELECT
    v_target,
    (SELECT role FROM public.user_roles WHERE user_id = v_target LIMIT 1),
    'justification_revision_required',
    'Refaça sua justificativa',
    format('Justificativa para "%s" precisa ser refeita: %s', COALESCE(v_task_title,'tarefa'), trim(p_comment)),
    'high';
END $$;

REVOKE ALL ON FUNCTION public.request_justification_revision(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.request_justification_revision(uuid, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.nudge_user_for_justification(
  p_notification_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_target uuid;
  v_task_title text;
  v_recent_count int;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF p_notification_id IS NULL THEN RAISE EXCEPTION 'notification_id required'; END IF;

  SELECT n.task_owner_id, n.task_title INTO v_target, v_task_title
    FROM public.task_delay_notifications n WHERE n.id = p_notification_id;

  IF v_target IS NULL THEN RAISE EXCEPTION 'notification not found'; END IF;

  PERFORM public.assert_user_in_my_scope(v_target);

  SELECT count(*) INTO v_recent_count
    FROM public.system_notifications
    WHERE recipient_id = v_target
      AND notification_type = 'justification_nudge'
      AND message LIKE '%' || COALESCE(v_task_title, '') || '%'
      AND created_at >= now() - interval '1 hour';

  IF v_recent_count > 0 THEN RETURN; END IF;

  INSERT INTO public.system_notifications (
    recipient_id, recipient_role, notification_type, title, message, priority
  )
  SELECT
    v_target,
    (SELECT role FROM public.user_roles WHERE user_id = v_target LIMIT 1),
    'justification_nudge',
    'Você tem justificativa pendente',
    format('Tarefa atrasada sem justificativa: %s', COALESCE(v_task_title, 'tarefa')),
    'high';
END $$;

REVOKE ALL ON FUNCTION public.nudge_user_for_justification(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.nudge_user_for_justification(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.archive_justification(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_target uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT user_id INTO v_target FROM public.task_delay_justifications WHERE id = p_id;
  IF v_target IS NULL THEN RAISE EXCEPTION 'justification not found'; END IF;

  PERFORM public.assert_user_in_my_scope(v_target);

  UPDATE public.task_delay_justifications
    SET archived = true, archived_at = now(), archived_by = auth.uid()
    WHERE id = p_id;
END $$;

REVOKE ALL ON FUNCTION public.archive_justification(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.archive_justification(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.unarchive_justification(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_target uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT user_id INTO v_target FROM public.task_delay_justifications WHERE id = p_id;
  IF v_target IS NULL THEN RAISE EXCEPTION 'justification not found'; END IF;

  PERFORM public.assert_user_in_my_scope(v_target);

  UPDATE public.task_delay_justifications
    SET archived = false, archived_at = NULL, archived_by = NULL
    WHERE id = p_id;
END $$;

REVOKE ALL ON FUNCTION public.unarchive_justification(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.unarchive_justification(uuid) TO authenticated;
