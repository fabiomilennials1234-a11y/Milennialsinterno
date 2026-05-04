-- 20260504100200_rpc_submit_justification.sql

CREATE OR REPLACE FUNCTION public.submit_justification(
  p_notification_id uuid,
  p_text text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_existing_id uuid;
  v_existing_revision boolean;
  v_new_id uuid;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF p_notification_id IS NULL OR p_text IS NULL OR length(trim(p_text)) = 0 THEN
    RAISE EXCEPTION 'notification_id and non-empty text required';
  END IF;

  SELECT role INTO v_caller_role FROM public.user_roles WHERE user_id = v_caller LIMIT 1;

  SELECT id, requires_revision INTO v_existing_id, v_existing_revision
    FROM public.task_delay_justifications
    WHERE notification_id = p_notification_id
      AND user_id = v_caller
      AND archived = false
    ORDER BY created_at DESC
    LIMIT 1;

  IF v_existing_id IS NOT NULL AND v_existing_revision = false THEN
    UPDATE public.task_delay_justifications
      SET justification = trim(p_text)
      WHERE id = v_existing_id;
    RETURN v_existing_id;
  END IF;

  IF v_existing_id IS NOT NULL AND v_existing_revision = true THEN
    UPDATE public.task_delay_justifications
      SET archived = true,
          archived_at = now(),
          archived_by = v_caller
      WHERE id = v_existing_id;
  END IF;

  INSERT INTO public.task_delay_justifications (
    notification_id, user_id, user_role, justification, requires_revision
  ) VALUES (
    p_notification_id, v_caller, COALESCE(v_caller_role, 'unknown'), trim(p_text), false
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END $$;

REVOKE ALL ON FUNCTION public.submit_justification(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_justification(uuid, text) TO authenticated;
