-- 20260416110000_harden_tech_rpcs.sql
-- Engineering gate fixes:
-- 1. tech_approve_task / tech_reject_task: validate task exists
-- 2. tech_block_task: enforce _reason length limit
-- 3. Add missing index for tech_time_entries(user_id, seq DESC)

BEGIN;

-- 1. Harden tech_approve_task: guard against non-existent task
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
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;
  IF current_status != 'REVIEW' THEN
    RAISE EXCEPTION 'Task not in REVIEW';
  END IF;
  UPDATE public.tech_tasks SET status = 'DONE' WHERE id = _task_id;
  INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
  VALUES (_task_id, auth.uid(), 'approved', '{}'::jsonb);
END;
$$;

-- 2. Harden tech_reject_task: guard against non-existent task
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
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;
  IF current_status != 'REVIEW' THEN
    RAISE EXCEPTION 'Task not in REVIEW';
  END IF;
  UPDATE public.tech_tasks SET status = 'IN_PROGRESS' WHERE id = _task_id;
  INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
  VALUES (_task_id, auth.uid(), 'rejected', '{}'::jsonb);
END;
$$;

-- 3. Harden tech_block_task: enforce _reason length
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
  IF char_length(_reason) > 1000 THEN
    RAISE EXCEPTION 'Reason too long (max 1000 chars)';
  END IF;
  UPDATE public.tech_tasks SET is_blocked = true, blocker_reason = _reason WHERE id = _task_id;
  INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
  VALUES (_task_id, auth.uid(), 'task_blocked', jsonb_build_object('reason', _reason));
END;
$$;

-- 4. Add missing index for seq-based ordering
CREATE INDEX IF NOT EXISTS tech_time_entries_user_seq
  ON public.tech_time_entries (user_id, seq DESC);

COMMIT;
