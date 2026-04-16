-- 20260416130000_add_tech_comment_rpc.sql
-- Adds RPC for posting comments on tech tasks.
-- Comments appear in the activity timeline.

BEGIN;

CREATE OR REPLACE FUNCTION public.tech_add_comment(_task_id uuid, _text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_see_tech(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF char_length(_text) > 2000 THEN
    RAISE EXCEPTION 'Comment too long (max 2000 chars)';
  END IF;
  IF char_length(trim(_text)) = 0 THEN
    RAISE EXCEPTION 'Comment cannot be empty';
  END IF;
  INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
  VALUES (_task_id, auth.uid(), 'comment', jsonb_build_object('text', trim(_text)));
END;
$$;

GRANT EXECUTE ON FUNCTION public.tech_add_comment(uuid, text) TO authenticated;

COMMIT;
