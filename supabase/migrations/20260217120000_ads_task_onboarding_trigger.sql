-- Trigger on ads_tasks: when a task with a client_id tag is marked as 'done',
-- automatically mark the linked onboarding task (marcar_call_1) as done.
-- This is the DB-level guarantee that the onboarding automation fires even
-- if the frontend code fails or the data hasn't loaded in memory yet.

CREATE OR REPLACE FUNCTION public.handle_ads_task_onboarding_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_linked_task_id uuid;
  v_tag text;
BEGIN
  -- Only fire when status changes to 'done'
  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN

    -- Extract client_id from tags array (e.g. 'client_id:abc-uuid')
    IF NEW.tags IS NOT NULL THEN
      FOREACH v_tag IN ARRAY NEW.tags LOOP
        IF v_tag LIKE 'client_id:%' THEN
          BEGIN
            v_client_id := substring(v_tag FROM 'client_id:(.+)')::uuid;
          EXCEPTION WHEN others THEN
            -- Invalid UUID in tag, skip
            v_client_id := NULL;
          END;
          EXIT; -- Only process the first valid client_id tag
        END IF;
      END LOOP;
    END IF;

    IF v_client_id IS NOT NULL THEN
      -- Find the oldest pending marcar_call_1 task for this client
      SELECT id INTO v_linked_task_id
      FROM public.onboarding_tasks
      WHERE client_id = v_client_id
        AND task_type = 'marcar_call_1'
        AND status != 'done'
      ORDER BY created_at ASC
      LIMIT 1;

      IF v_linked_task_id IS NOT NULL THEN
        -- Mark it as done — this fires advance_client_onboarding_stage
        -- which moves the client to 'call_1_marcada' step automatically
        UPDATE public.onboarding_tasks
        SET status = 'done'
        WHERE id = v_linked_task_id;
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- Drop and recreate the trigger (idempotent)
DROP TRIGGER IF EXISTS ads_task_onboarding_completion_trigger ON public.ads_tasks;
CREATE TRIGGER ads_task_onboarding_completion_trigger
AFTER UPDATE ON public.ads_tasks
FOR EACH ROW
EXECUTE FUNCTION public.handle_ads_task_onboarding_on_completion();
