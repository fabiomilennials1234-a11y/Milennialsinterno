-- 20260417130000_submit_task_no_assignee.sql
-- Force tech_submit_task to ignore _assignee_id and always land in BACKLOG.
--
-- Rationale: the public submission form (/submit-task) is meant for anyone to
-- report work. The technical team triages and assigns afterward. Allowing a
-- submitter to pick an assignee (including themselves) was causing authorship
-- confusion — the card/row could render as "self-assigned" and hide the fact
-- that submission and ownership are separate roles.
--
-- We keep the parameter in the function signature for backward compatibility
-- with any client that still passes it, but discard the value server-side so
-- no legacy or malicious caller can bypass this invariant.

CREATE OR REPLACE FUNCTION public.tech_submit_task(
  _title text,
  _description text,
  _type public.tech_task_type,
  _priority public.tech_task_priority,
  _acceptance_criteria text,
  _technical_context text DEFAULT NULL,
  _assignee_id uuid DEFAULT NULL,
  _deadline timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _task_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF char_length(trim(_title)) = 0 THEN
    RAISE EXCEPTION 'Title is required';
  END IF;

  -- _assignee_id is intentionally discarded. Submissions always land
  -- unassigned in BACKLOG so the technical team triages authorship.
  INSERT INTO public.tech_tasks (
    title, description, type, status, priority,
    acceptance_criteria, technical_context,
    assignee_id, deadline, created_by
  )
  VALUES (
    trim(_title), _description, _type, 'BACKLOG', _priority,
    _acceptance_criteria, _technical_context,
    NULL, _deadline, auth.uid()
  )
  RETURNING id INTO _task_id;

  INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
  VALUES (_task_id, auth.uid(), 'task_created', '{}'::jsonb);

  RETURN _task_id;
END;
$$;
