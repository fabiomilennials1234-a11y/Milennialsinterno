-- Fix: auxiliary onboarding tasks must NOT overwrite client_onboarding.current_step
-- This prevents clients from disappearing from onboarding when completing parallel/aux tasks.

CREATE OR REPLACE FUNCTION public.advance_client_onboarding_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_id uuid;
  v_task_type text;
  v_milestone int;
  v_next_column text;
  v_target_column_id uuid;
  v_board record;
  v_card record;
  v_max_position int;
BEGIN
  -- Only trigger on status change TO 'done'
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    v_client_id := NEW.client_id;
    v_task_type := NEW.task_type;
    v_milestone := NEW.milestone;

    -- Set completed_at timestamp
    NEW.completed_at := now();

    -- Update client status to 'onboarding' if still 'new_client'
    UPDATE public.clients
    SET status = 'onboarding',
        onboarding_started_at = COALESCE(onboarding_started_at, now()),
        updated_at = now()
    WHERE id = v_client_id
      AND (status = 'new_client' OR status IS NULL);

    -- Determine target column based on task type (ONLY advancing tasks)
    v_next_column := CASE v_task_type
      WHEN 'marcar_call_1' THEN 'Call 1 Marcada'
      WHEN 'realizar_call_1' THEN 'Call 1 Realizada'
      WHEN 'criar_estrategia' THEN 'Estratégia Criada'
      WHEN 'apresentar_estrategia' THEN 'Estratégia Apresentada'
      WHEN 'brifar_criativos' THEN 'Criativos Brifados'
      WHEN 'aguardar_criativos' THEN 'Criativos Prontos'
      WHEN 'publicar_campanha' THEN 'Campanha Publicada'
      ELSE NULL
    END;

    -- If this task is not an advancing task, do NOT change client_onboarding.
    IF v_next_column IS NULL THEN
      RETURN NEW;
    END IF;

    -- Ensure client_onboarding record exists and is updated (only for advancing tasks)
    INSERT INTO public.client_onboarding (client_id, current_milestone, current_step)
    VALUES (v_client_id, v_milestone, v_task_type)
    ON CONFLICT (client_id) DO UPDATE SET
      current_milestone = EXCLUDED.current_milestone,
      current_step = EXCLUDED.current_step,
      updated_at = now();

    -- Find all boards that have a card for this client
    FOR v_board IN
      SELECT DISTINCT kb.id as board_id, kb.slug
      FROM kanban_boards kb
      JOIN kanban_cards kc ON kc.board_id = kb.id
      WHERE kc.client_id = v_client_id
        AND kc.archived = false
    LOOP
      -- Get or create the target column
      SELECT id INTO v_target_column_id
      FROM kanban_columns
      WHERE board_id = v_board.board_id
        AND title = v_next_column;

      -- If column doesn't exist, create it
      IF v_target_column_id IS NULL THEN
        SELECT COALESCE(MAX(position), 0) + 1 INTO v_max_position
        FROM kanban_columns WHERE board_id = v_board.board_id;

        INSERT INTO kanban_columns (board_id, title, position, color)
        VALUES (v_board.board_id, v_next_column, v_max_position, '#6366f1')
        RETURNING id INTO v_target_column_id;
      END IF;

      -- Move the client's card to the target column
      FOR v_card IN
        SELECT id FROM kanban_cards
        WHERE client_id = v_client_id
          AND board_id = v_board.board_id
          AND archived = false
      LOOP
        -- Get max position in target column
        SELECT COALESCE(MAX(position), 0) + 1 INTO v_max_position
        FROM kanban_cards
        WHERE column_id = v_target_column_id AND archived = false;

        UPDATE kanban_cards
        SET column_id = v_target_column_id,
            position = v_max_position,
            updated_at = now()
        WHERE id = v_card.id;
      END LOOP;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;