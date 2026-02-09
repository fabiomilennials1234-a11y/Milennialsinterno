-- Fix visual movement between "Novo Cliente" and "Onboarding":
-- when the onboarding task is completed, mark client as onboarding + ensure client_onboarding row exists.

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

    -- 1) Ensure the client leaves the "Novo Cliente" visual list
    -- (UI filters by clients.status = 'new_client')
    UPDATE public.clients
    SET status = 'onboarding',
        onboarding_started_at = COALESCE(onboarding_started_at, now()),
        updated_at = now()
    WHERE id = v_client_id
      AND COALESCE(status, 'new_client') = 'new_client';

    -- 2) Ensure a client_onboarding row exists (so onboarding columns can render)
    -- Use milestone/task_type from the task that was just completed as a sensible baseline.
    INSERT INTO public.client_onboarding (
      client_id,
      current_milestone,
      current_step,
      milestone_1_started_at
    ) VALUES (
      v_client_id,
      COALESCE(NEW.milestone, 1),
      COALESCE(NEW.task_type, 'marcar_call_1'),
      now()
    )
    ON CONFLICT (client_id) DO NOTHING;

    -- 3) Move the client's cards in every board where the client has cards
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

      -- Keep this for backward compatibility (other trigger may overwrite to more specific step)
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

-- Backfill: existing clients with onboarding tasks but still stuck as 'new_client'
UPDATE public.clients c
SET status = 'onboarding',
    onboarding_started_at = COALESCE(c.onboarding_started_at, c.created_at, now()),
    updated_at = now()
WHERE c.status = 'new_client'
  AND EXISTS (
    SELECT 1 FROM public.onboarding_tasks ot
    WHERE ot.client_id = c.id
  );

-- Backfill: ensure client_onboarding rows exist for clients that already have tasks
INSERT INTO public.client_onboarding (
  client_id,
  current_milestone,
  current_step,
  milestone_1_started_at
)
SELECT
  c.id,
  COALESCE(
    (
      SELECT ot.milestone
      FROM public.onboarding_tasks ot
      WHERE ot.client_id = c.id
        AND ot.status = 'pending'
      ORDER BY ot.created_at ASC
      LIMIT 1
    ),
    (
      SELECT MAX(ot.milestone)
      FROM public.onboarding_tasks ot
      WHERE ot.client_id = c.id
    ),
    1
  )::int,
  COALESCE(
    (
      SELECT ot.task_type
      FROM public.onboarding_tasks ot
      WHERE ot.client_id = c.id
        AND ot.status = 'pending'
      ORDER BY ot.created_at ASC
      LIMIT 1
    ),
    (
      SELECT ot.task_type || '_completed'
      FROM public.onboarding_tasks ot
      WHERE ot.client_id = c.id
        AND ot.status = 'done'
      ORDER BY ot.completed_at DESC NULLS LAST, ot.updated_at DESC
      LIMIT 1
    ),
    'marcar_call_1'
  )::text,
  COALESCE(c.onboarding_started_at, c.created_at, now())
FROM public.clients c
WHERE EXISTS (
  SELECT 1 FROM public.onboarding_tasks ot
  WHERE ot.client_id = c.id
)
AND NOT EXISTS (
  SELECT 1 FROM public.client_onboarding co
  WHERE co.client_id = c.id
);
