-- 20260416170000_submit_task_rpc.sql
-- RPC for the shared task submission form. Allows any authenticated user
-- to create a tech task (bypasses can_see_tech RLS via SECURITY DEFINER).
-- Also creates a notification activity for CTO awareness.

BEGIN;

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
  _status public.tech_task_status;
BEGIN
  -- Any authenticated user can submit
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate inputs
  IF char_length(trim(_title)) = 0 THEN
    RAISE EXCEPTION 'Title is required';
  END IF;

  -- Auto-promote to TODO if assignee is set
  _status := CASE WHEN _assignee_id IS NOT NULL THEN 'TODO' ELSE 'BACKLOG' END;

  INSERT INTO public.tech_tasks (title, description, type, status, priority, acceptance_criteria, technical_context, assignee_id, deadline, created_by)
  VALUES (trim(_title), _description, _type, _status, _priority, _acceptance_criteria, _technical_context, _assignee_id, _deadline, auth.uid())
  RETURNING id INTO _task_id;

  -- Log submission activity
  INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
  VALUES (_task_id, auth.uid(), 'task_created', '{}'::jsonb);

  RETURN _task_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tech_submit_task(text, text, public.tech_task_type, public.tech_task_priority, text, text, uuid, timestamptz) TO authenticated;

-- Also allow any authenticated user to upload to the storage bucket
-- (the existing policy already checks can_see_tech, we need a broader one for submissions)
CREATE POLICY "tech_attachments_submit_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'tech-attachments'
    AND auth.uid() IS NOT NULL
  );

COMMIT;
