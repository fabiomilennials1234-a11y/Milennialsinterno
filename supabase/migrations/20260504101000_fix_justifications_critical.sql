-- 20260504101000_fix_justifications_critical.sql
-- Corrige issues críticas detectadas em code review pós-implementação.
--
-- C1: get_justifications_pending_mine duplicava lógica de escopo. Agora retorna
--     apenas pendências do próprio caller (task_owner_id = auth.uid()). Visão
--     master vive em get_justifications_team_grouped (tab Equipe). Tab Pendentes
--     é exclusivamente pessoal — alinha com spec seção 5 + Q4.
--
-- C2: nudge_user_for_justification deduplicava por LIKE no message, frágil e
--     contornável (NULL/'' title casa com qualquer nudge → bloqueia tudo durante
--     1h). Migrado para dedupe via metadata->>'notification_id' que é precisa
--     e segue o que o spec linha 366 sempre quis: "guard de 1h para mesma
--     notification_id". request_justification_revision também passa a gravar
--     notification_id em metadata para auditoria.

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
BEGIN
  IF v_caller IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH my_done AS (
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
  FROM public.task_delay_notifications n
  LEFT JOIN my_done md ON md.notification_id = n.id
  WHERE n.task_owner_id = v_caller
    AND (md.notification_id IS NULL OR md.requires_revision = true)
  ORDER BY n.task_due_date ASC;
END $$;


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

  -- Dedupe por notification_id em metadata (preciso, não vaza entre tarefas)
  SELECT count(*) INTO v_recent_count
    FROM public.system_notifications
    WHERE recipient_id = v_target
      AND notification_type = 'justification_nudge'
      AND metadata->>'notification_id' = p_notification_id::text
      AND created_at >= now() - interval '1 hour';

  IF v_recent_count > 0 THEN RETURN; END IF;

  INSERT INTO public.system_notifications (
    recipient_id, recipient_role, notification_type, title, message, priority, metadata
  )
  SELECT
    v_target,
    (SELECT role FROM public.user_roles WHERE user_id = v_target LIMIT 1),
    'justification_nudge',
    'Você tem justificativa pendente',
    format('Tarefa atrasada sem justificativa: %s', COALESCE(v_task_title, 'tarefa')),
    'high',
    jsonb_build_object('notification_id', p_notification_id);
END $$;


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
    recipient_id, recipient_role, notification_type, title, message, priority, metadata
  )
  SELECT
    v_target,
    (SELECT role FROM public.user_roles WHERE user_id = v_target LIMIT 1),
    'justification_revision_required',
    'Refaça sua justificativa',
    format('Justificativa para "%s" precisa ser refeita: %s', COALESCE(v_task_title,'tarefa'), trim(p_comment)),
    'high',
    jsonb_build_object('notification_id', v_notification_id, 'justification_id', p_justification_id);
END $$;
