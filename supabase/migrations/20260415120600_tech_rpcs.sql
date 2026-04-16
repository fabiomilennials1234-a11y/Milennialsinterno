-- 20260415120600_tech_rpcs.sql
-- All RPCs are SECURITY DEFINER; they validate auth.uid() and role internally.

BEGIN;

CREATE OR REPLACE FUNCTION public.tech_can_edit_task(_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_executive(auth.uid())
      OR EXISTS (SELECT 1 FROM public.tech_tasks t WHERE t.id = _task_id AND t.assignee_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.tech_task_collaborators c WHERE c.task_id = _task_id AND c.user_id = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.tech_can_edit_task(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.tech_timer_is_active(_task_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT type IN ('START','RESUME')
     FROM public.tech_time_entries
     WHERE task_id = _task_id AND user_id = _user_id
     ORDER BY created_at DESC
     LIMIT 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.tech_start_timer(_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status public.tech_task_status;
  other_task_id uuid;
BEGIN
  IF NOT public.tech_can_edit_task(_task_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  FOR other_task_id IN
    SELECT DISTINCT te.task_id
    FROM public.tech_time_entries te
    WHERE te.user_id = auth.uid()
      AND te.task_id != _task_id
  LOOP
    IF public.tech_timer_is_active(other_task_id, auth.uid()) THEN
      INSERT INTO public.tech_time_entries (task_id, user_id, type)
      VALUES (other_task_id, auth.uid(), 'PAUSE');
      INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
      VALUES (other_task_id, auth.uid(), 'timer_paused', jsonb_build_object('auto', true));
    END IF;
  END LOOP;

  SELECT status INTO current_status FROM public.tech_tasks WHERE id = _task_id;
  IF current_status IN ('BACKLOG','TODO') THEN
    UPDATE public.tech_tasks SET status = 'IN_PROGRESS' WHERE id = _task_id;
  END IF;

  INSERT INTO public.tech_time_entries (task_id, user_id, type)
  VALUES (_task_id, auth.uid(), 'START');
  INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
  VALUES (_task_id, auth.uid(), 'timer_started', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.tech_pause_timer(_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.tech_can_edit_task(_task_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF NOT public.tech_timer_is_active(_task_id, auth.uid()) THEN
    RAISE EXCEPTION 'No active timer';
  END IF;
  INSERT INTO public.tech_time_entries (task_id, user_id, type) VALUES (_task_id, auth.uid(), 'PAUSE');
  INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
  VALUES (_task_id, auth.uid(), 'timer_paused', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.tech_resume_timer(_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  other_task_id uuid;
BEGIN
  IF NOT public.tech_can_edit_task(_task_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  FOR other_task_id IN
    SELECT DISTINCT te.task_id FROM public.tech_time_entries te
    WHERE te.user_id = auth.uid() AND te.task_id != _task_id
  LOOP
    IF public.tech_timer_is_active(other_task_id, auth.uid()) THEN
      INSERT INTO public.tech_time_entries (task_id, user_id, type)
      VALUES (other_task_id, auth.uid(), 'PAUSE');
      INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
      VALUES (other_task_id, auth.uid(), 'timer_paused', jsonb_build_object('auto', true));
    END IF;
  END LOOP;
  INSERT INTO public.tech_time_entries (task_id, user_id, type) VALUES (_task_id, auth.uid(), 'RESUME');
  INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
  VALUES (_task_id, auth.uid(), 'timer_resumed', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.tech_stop_timer(_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.tech_can_edit_task(_task_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF NOT public.tech_timer_is_active(_task_id, auth.uid()) THEN
    RAISE EXCEPTION 'No active timer';
  END IF;
  INSERT INTO public.tech_time_entries (task_id, user_id, type) VALUES (_task_id, auth.uid(), 'STOP');
  INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
  VALUES (_task_id, auth.uid(), 'timer_stopped', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.tech_send_to_review(_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.tech_can_edit_task(_task_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF public.tech_timer_is_active(_task_id, auth.uid()) THEN
    INSERT INTO public.tech_time_entries (task_id, user_id, type) VALUES (_task_id, auth.uid(), 'STOP');
  END IF;
  UPDATE public.tech_tasks SET status = 'REVIEW' WHERE id = _task_id;
  INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
  VALUES (_task_id, auth.uid(), 'sent_to_review', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.tech_approve_task(_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status public.tech_task_status;
BEGIN
  IF NOT public.is_executive(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT status INTO current_status FROM public.tech_tasks WHERE id = _task_id;
  IF current_status != 'REVIEW' THEN
    RAISE EXCEPTION 'Task not in REVIEW';
  END IF;
  UPDATE public.tech_tasks SET status = 'DONE' WHERE id = _task_id;
  INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
  VALUES (_task_id, auth.uid(), 'approved', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.tech_reject_task(_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status public.tech_task_status;
BEGIN
  IF NOT public.is_executive(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT status INTO current_status FROM public.tech_tasks WHERE id = _task_id;
  IF current_status != 'REVIEW' THEN
    RAISE EXCEPTION 'Task not in REVIEW';
  END IF;
  UPDATE public.tech_tasks SET status = 'IN_PROGRESS' WHERE id = _task_id;
  INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
  VALUES (_task_id, auth.uid(), 'rejected', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.tech_block_task(_task_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.tech_can_edit_task(_task_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.tech_tasks SET is_blocked = true, blocker_reason = _reason WHERE id = _task_id;
  INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
  VALUES (_task_id, auth.uid(), 'task_blocked', jsonb_build_object('reason', _reason));
END;
$$;

CREATE OR REPLACE FUNCTION public.tech_unblock_task(_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.tech_can_edit_task(_task_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.tech_tasks SET is_blocked = false, blocker_reason = null WHERE id = _task_id;
  INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
  VALUES (_task_id, auth.uid(), 'task_unblocked', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.tech_start_sprint(_sprint_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status public.tech_sprint_status;
  active_count int;
BEGIN
  IF NOT public.is_executive(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT status INTO current_status FROM public.tech_sprints WHERE id = _sprint_id;
  IF current_status != 'PLANNING' THEN
    RAISE EXCEPTION 'Sprint not in PLANNING';
  END IF;
  SELECT COUNT(*) INTO active_count FROM public.tech_sprints WHERE status = 'ACTIVE';
  IF active_count > 0 THEN
    RAISE EXCEPTION 'Another sprint is already ACTIVE';
  END IF;
  UPDATE public.tech_tasks SET status = 'TODO' WHERE sprint_id = _sprint_id AND status = 'BACKLOG';
  UPDATE public.tech_sprints SET status = 'ACTIVE' WHERE id = _sprint_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tech_end_sprint(_sprint_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status public.tech_sprint_status;
BEGIN
  IF NOT public.is_executive(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT status INTO current_status FROM public.tech_sprints WHERE id = _sprint_id;
  IF current_status != 'ACTIVE' THEN
    RAISE EXCEPTION 'Sprint not ACTIVE';
  END IF;
  UPDATE public.tech_tasks SET sprint_id = null, status = 'BACKLOG'
    WHERE sprint_id = _sprint_id AND status != 'DONE';
  UPDATE public.tech_sprints SET status = 'COMPLETED' WHERE id = _sprint_id;
END;
$$;

GRANT EXECUTE ON FUNCTION
  public.tech_start_timer(uuid),
  public.tech_pause_timer(uuid),
  public.tech_resume_timer(uuid),
  public.tech_stop_timer(uuid),
  public.tech_timer_is_active(uuid, uuid),
  public.tech_send_to_review(uuid),
  public.tech_approve_task(uuid),
  public.tech_reject_task(uuid),
  public.tech_block_task(uuid, text),
  public.tech_unblock_task(uuid),
  public.tech_start_sprint(uuid),
  public.tech_end_sprint(uuid)
TO authenticated;

COMMIT;
