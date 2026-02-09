-- Fix: move client cards on onboarding task completion across *all* boards where the client has cards
-- and auto-create the target onboarding column in that board when missing.

CREATE OR REPLACE FUNCTION public.advance_client_onboarding_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_id uuid;
  v_task_type text;
  v_next_column_title text;
  v_board_id uuid;
  v_target_column_id uuid;
  v_next_position int;
BEGIN
  -- Only proceed if status changed to 'done'
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status <> 'done') THEN
    v_client_id := NEW.client_id;
    v_task_type := NEW.task_type;

    v_next_column_title := CASE v_task_type
      WHEN 'marcar_call_1' THEN 'Call 1 Marcada'
      WHEN 'realizar_call_1' THEN 'Call 1 Realizada'
      WHEN 'criar_estrategia' THEN 'Estratégia Criada'
      WHEN 'apresentar_estrategia' THEN 'Estratégia Apresentada'
      WHEN 'brifar_criativos' THEN 'Criativos Brifados'
      WHEN 'aguardar_criativos' THEN 'Criativos Prontos'
      WHEN 'publicar_campanha' THEN 'Campanha Publicada'
      ELSE NULL
    END;

    IF v_next_column_title IS NOT NULL THEN
      -- Move in every board where this client has at least one card
      FOR v_board_id IN
        SELECT DISTINCT board_id
        FROM public.kanban_cards
        WHERE client_id = v_client_id
      LOOP
        v_target_column_id := NULL;

        SELECT id
        INTO v_target_column_id
        FROM public.kanban_columns
        WHERE board_id = v_board_id
          AND title = v_next_column_title
        LIMIT 1;

        -- If missing, create the column at the end of this board
        IF v_target_column_id IS NULL THEN
          IF NOT EXISTS (
            SELECT 1
            FROM public.kanban_columns
            WHERE board_id = v_board_id
              AND title = v_next_column_title
          ) THEN
            SELECT COALESCE(MAX(position), -1) + 1
            INTO v_next_position
            FROM public.kanban_columns
            WHERE board_id = v_board_id;

            INSERT INTO public.kanban_columns (board_id, title, position)
            VALUES (v_board_id, v_next_column_title, v_next_position);
          END IF;

          SELECT id
          INTO v_target_column_id
          FROM public.kanban_columns
          WHERE board_id = v_board_id
            AND title = v_next_column_title
          LIMIT 1;
        END IF;

        IF v_target_column_id IS NOT NULL THEN
          UPDATE public.kanban_cards
          SET column_id = v_target_column_id,
              updated_at = now()
          WHERE client_id = v_client_id
            AND board_id = v_board_id;
        END IF;
      END LOOP;

      UPDATE public.client_onboarding
      SET current_step = v_task_type || '_completed',
          updated_at = now()
      WHERE client_id = v_client_id;
    END IF;

    NEW.completed_at := now();
  END IF;

  RETURN NEW;
END;
$$;