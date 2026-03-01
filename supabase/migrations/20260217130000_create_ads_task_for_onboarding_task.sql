-- ─────────────────────────────────────────────────────────────────────────────
-- Part 1: Update handle_ads_task_onboarding_on_completion to be GENERIC
--
-- Before: hardcoded to look for 'marcar_call_1' only.
-- After:  reads the 'onboarding_task_type' tag from the ads_task to determine
--         which onboarding_task to complete. Falls back to 'marcar_call_1' for
--         ads_tasks that don't carry the tag (backwards compatibility).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_ads_task_onboarding_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id        uuid;
  v_task_type        text;
  v_linked_task_id   uuid;
  v_tag              text;
BEGIN
  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN

    IF NEW.tags IS NOT NULL THEN
      FOREACH v_tag IN ARRAY NEW.tags LOOP
        IF v_tag LIKE 'client_id:%' THEN
          BEGIN
            v_client_id := substring(v_tag FROM 'client_id:(.+)')::uuid;
          EXCEPTION WHEN others THEN
            v_client_id := NULL;
          END;
        ELSIF v_tag LIKE 'onboarding_task_type:%' THEN
          v_task_type := substring(v_tag FROM 'onboarding_task_type:(.+)');
        END IF;
      END LOOP;
    END IF;

    -- Default to 'marcar_call_1' for backwards compatibility
    -- (ads_tasks created before the tag was added still work)
    IF v_task_type IS NULL THEN
      v_task_type := 'marcar_call_1';
    END IF;

    IF v_client_id IS NOT NULL THEN
      SELECT id INTO v_linked_task_id
      FROM public.onboarding_tasks
      WHERE client_id = v_client_id
        AND task_type  = v_task_type
        AND status    != 'done'
      ORDER BY created_at ASC
      LIMIT 1;

      IF v_linked_task_id IS NOT NULL THEN
        -- Marking done fires advance_client_onboarding_stage
        -- which moves the client to the next step automatically.
        UPDATE public.onboarding_tasks
        SET status = 'done'
        WHERE id = v_linked_task_id;
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the trigger (function was replaced above)
DROP TRIGGER IF EXISTS ads_task_onboarding_completion_trigger ON public.ads_tasks;
CREATE TRIGGER ads_task_onboarding_completion_trigger
AFTER UPDATE ON public.ads_tasks
FOR EACH ROW
EXECUTE FUNCTION public.handle_ads_task_onboarding_on_completion();


-- ─────────────────────────────────────────────────────────────────────────────
-- Part 2: New trigger — when advance_onboarding_on_task_completion inserts a
--         new onboarding_task that needs a visible ads_task, create it.
--
-- Currently handles:
--   'realizar_call_1' → "Realizar Call 1: [Nome]"
--
-- To add more steps in the future, add them to the IN (...) list and the
-- CASE block inside the function.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_ads_task_for_onboarding_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_name        text;
  v_ads_task_title     text;
  v_ads_task_desc      text;
BEGIN
  -- Only handle task types that need a visible ads_task in Tarefas Diárias
  IF NEW.task_type NOT IN ('realizar_call_1') THEN
    RETURN NEW;
  END IF;

  -- Skip if no manager is assigned (task would be invisible)
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_client_name
  FROM public.clients
  WHERE id = NEW.client_id;

  CASE NEW.task_type
    WHEN 'realizar_call_1' THEN
      v_ads_task_title := 'Realizar Call 1: ' || COALESCE(v_client_name, 'Cliente');
      v_ads_task_desc  := 'Realizar a primeira call com o cliente '
                          || COALESCE(v_client_name, 'Cliente')
                          || '. Ao concluir, o cliente será movido para Criar Estratégia.';
  END CASE;

  -- Create the visible ads_task with both identifying tags:
  --   client_id             → links to client
  --   onboarding_task_type  → tells handle_ads_task_onboarding_on_completion
  --                           which onboarding_task to complete when done
  INSERT INTO public.ads_tasks (
    ads_manager_id,
    title,
    description,
    task_type,
    status,
    priority,
    tags
  )
  VALUES (
    NEW.assigned_to,
    v_ads_task_title,
    v_ads_task_desc,
    'daily',
    'todo',
    'high',
    ARRAY[
      'client_id:'            || NEW.client_id::text,
      'onboarding_task_type:' || NEW.task_type
    ]
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_ads_task_for_onboarding_task_trigger ON public.onboarding_tasks;
CREATE TRIGGER create_ads_task_for_onboarding_task_trigger
AFTER INSERT ON public.onboarding_tasks
FOR EACH ROW
EXECUTE FUNCTION public.create_ads_task_for_onboarding_task();
