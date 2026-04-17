-- 20260417140000_tech_submit_attachment_rpc.sql
-- RPC to persist attachment metadata for the shared task submission form.
--
-- Root cause this fixes:
--   tech_task_attachments.INSERT policy requires can_see_tech(auth.uid())
--   (ceo/cto/devs). The /submit-task form is open to any authenticated user
--   who is not a tech member, so every submission from outside the tech team
--   failed with an RLS error after the task itself was already created,
--   leaving orphan tasks and a generic "Erro ao enviar task" toast on the
--   client. The storage upload worked because 20260416170000 added a
--   permissive insert policy for the bucket, but the metadata row never
--   landed.
--
-- This SECURITY DEFINER RPC bypasses the table-level RLS while still
-- enforcing a tight authorization rule: the caller must either
--   (a) have tech visibility (can_see_tech), or
--   (b) be the author of the target task (tech_tasks.created_by),
-- which is exactly the submitter on the shared form path. Without (b), any
-- authenticated user could attach files to arbitrary tasks.

BEGIN;

CREATE OR REPLACE FUNCTION public.tech_submit_attachment(
  _task_id uuid,
  _file_name text,
  _file_path text,
  _file_size bigint,
  _content_type text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _allowed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _task_id IS NULL THEN
    RAISE EXCEPTION 'task_id is required';
  END IF;

  IF char_length(coalesce(trim(_file_name), '')) = 0 THEN
    RAISE EXCEPTION 'file_name is required';
  END IF;

  IF char_length(coalesce(trim(_file_path), '')) = 0 THEN
    RAISE EXCEPTION 'file_path is required';
  END IF;

  SELECT (
    public.can_see_tech(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.tech_tasks
      WHERE id = _task_id AND created_by = auth.uid()
    )
  ) INTO _allowed;

  IF NOT _allowed THEN
    RAISE EXCEPTION 'Not authorized to attach to this task';
  END IF;

  INSERT INTO public.tech_task_attachments (
    task_id, file_name, file_path, file_size, content_type, uploaded_by
  )
  VALUES (
    _task_id, _file_name, _file_path, _file_size, _content_type, auth.uid()
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tech_submit_attachment(uuid, text, text, bigint, text) TO authenticated;

COMMIT;
