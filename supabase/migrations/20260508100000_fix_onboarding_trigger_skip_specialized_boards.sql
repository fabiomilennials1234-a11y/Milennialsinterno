-- Fix: advance_client_onboarding_stage must NOT move cards in specialized
-- swim-lane boards (design, devs, editor-video, atrizes, produtora and their
-- squad-level variants).  These boards use "BY {NOME}" columns and onboarding
-- step columns like "Criativos Brifados" are invisible there, causing cards
-- to vanish from the UI.
--
-- The fix adds a WHERE filter to the FOR loop that finds boards with client
-- cards: only boards whose slug does NOT match a specialized pattern are
-- affected.

CREATE OR REPLACE FUNCTION advance_client_onboarding_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client_id uuid;
  v_task_type text;
  v_milestone int;
  v_next_column text;
  v_next_step text;
  v_next_milestone int;
  v_is_onboarding_complete boolean := false;
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

    -- Determine target column and step based on task type (ONLY advancing tasks)
    CASE v_task_type
      WHEN 'marcar_call_1' THEN
        v_next_column := 'Call 1 Marcada';
        v_next_step := 'call_1_marcada';
        v_next_milestone := 1;
      WHEN 'realizar_call_1' THEN
        v_next_column := 'Call 1 Realizada';
        v_next_step := 'criar_estrategia';
        v_next_milestone := 2;
      WHEN 'criar_estrategia' THEN
        v_next_column := 'Estratégia Criada';
        v_next_step := 'estrategia_criada';
        v_next_milestone := 2;
      WHEN 'apresentar_estrategia' THEN
        v_next_column := 'Estratégia Apresentada';
        v_next_step := 'brifar_criativos';
        v_next_milestone := 3;
      WHEN 'brifar_criativos' THEN
        v_next_column := 'Criativos Brifados';
        v_next_step := 'elencar_otimizacoes';
        v_next_milestone := 4;
      WHEN 'aguardar_criativos' THEN
        v_next_column := 'Criativos Prontos';
        v_next_step := 'criativos_prontos';
        v_next_milestone := 5;
      WHEN 'publicar_campanha' THEN
        v_next_column := 'Campanha Publicada';
        v_next_step := 'acompanhamento';
        v_next_milestone := 6;
        v_is_onboarding_complete := true;
      ELSE
        v_next_column := NULL;
    END CASE;

    -- If this task is not an advancing task, do NOT change client_onboarding.
    IF v_next_column IS NULL THEN
      RETURN NEW;
    END IF;

    -- Ensure client_onboarding record exists and is updated (only for advancing tasks)
    INSERT INTO public.client_onboarding (client_id, current_milestone, current_step)
    VALUES (v_client_id, v_next_milestone, v_next_step)
    ON CONFLICT (client_id) DO UPDATE SET
      current_milestone = v_next_milestone,
      current_step = v_next_step,
      updated_at = now(),
      completed_at = CASE WHEN v_is_onboarding_complete THEN now() ELSE client_onboarding.completed_at END;

    -- Find all boards that have a card for this client.
    -- EXCLUDE specialized swim-lane boards — their columns are "BY {NOME}" and
    -- onboarding step columns would be invisible / orphaned.
    FOR v_board IN
      SELECT DISTINCT kb.id as board_id, kb.slug
      FROM kanban_boards kb
      JOIN kanban_cards kc ON kc.board_id = kb.id
      WHERE kc.client_id = v_client_id
        AND kc.archived = false
        -- Exclude specialized boards by slug pattern
        AND kb.slug NOT IN ('design', 'devs', 'editor-video', 'produtora', 'atrizes')
        AND kb.slug NOT LIKE '%-design'
        AND kb.slug NOT LIKE '%-devs'
        AND kb.slug NOT LIKE '%-video'
        AND kb.slug NOT LIKE '%-produtora'
        AND kb.slug NOT LIKE '%-atrizes'
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

-- Add a comment documenting the exclusion
COMMENT ON FUNCTION advance_client_onboarding_stage() IS
  'Advances client onboarding when tasks complete. Moves cards to step columns '
  'in management boards (ads, projetos, financeiro, comercial). Excludes '
  'specialized swim-lane boards (design, devs, editor-video, produtora, atrizes) '
  'whose columns follow the BY {NOME} pattern.';
