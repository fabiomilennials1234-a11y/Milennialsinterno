-- Fix: restore clients.status transition from 'new_client' to 'onboarding'
--
-- Migration 20260520100000 replaced advance_onboarding_on_task_completion()
-- and accidentally dropped the UPDATE clients SET status = 'onboarding' line.
-- Without it, clients stay as 'new_client' forever (appearing in both
-- "Novo Cliente" and "Onboarding" columns simultaneously).
--
-- This migration:
--   1. Restores the missing UPDATE clients statement in the trigger function
--   2. Fixes existing clients stuck in 'new_client' that already have onboarding records

-- =========================================================================
-- PART 1: Fix existing data — clients stuck as 'new_client' with active onboarding
-- =========================================================================

UPDATE public.clients c
SET status = 'onboarding',
    onboarding_started_at = COALESCE(c.onboarding_started_at, NOW()),
    updated_at = NOW()
FROM public.client_onboarding co
WHERE co.client_id = c.id
  AND c.status = 'new_client'
  AND co.current_step IS NOT NULL
  AND co.completed_at IS NULL;

-- =========================================================================
-- PART 2: Restore the missing status transition in the trigger function
-- =========================================================================

CREATE OR REPLACE FUNCTION public.advance_onboarding_on_task_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  client_name TEXT;
  client_id_val UUID;
  ads_manager_id_val UUID;
  current_step_val TEXT;
  current_milestone_val INT;
  next_task_type TEXT;
  next_task_title TEXT;
  next_task_description TEXT;
  next_due_days INT;
  next_step TEXT;
  next_milestone INT;
  is_advancing_task BOOLEAN := FALSE;
  is_onboarding_complete BOOLEAN := FALSE;
  day_of_week TEXT;
  v_recipient RECORD;
BEGIN
  -- Only proceed if status changed to 'done'
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN

    -- Get client info
    SELECT c.name, c.id, c.assigned_ads_manager
    INTO client_name, client_id_val, ads_manager_id_val
    FROM clients c
    WHERE c.id = NEW.client_id;

    -- Get current onboarding state
    SELECT co.current_step, co.current_milestone
    INTO current_step_val, current_milestone_val
    FROM client_onboarding co
    WHERE co.client_id = NEW.client_id;

    -- Determine if this is an advancing task and what comes next
    CASE NEW.task_type

      -- MILESTONE 2: Dar boas vindas -> Criar estrategia
      WHEN 'dar_boas_vindas' THEN
        is_advancing_task := TRUE;
        next_task_type := 'criar_estrategia';
        next_task_title := 'Criar estrategia para ' || COALESCE(client_name, '');
        next_task_description := 'Criar a estrategia PRO+ para o cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 3;
        next_step := 'criar_estrategia';
        next_milestone := 2;

      -- MILESTONE 2: Criar estrategia -> Marcar apresentacao estrategia
      WHEN 'criar_estrategia' THEN
        is_advancing_task := TRUE;
        next_task_type := 'marcar_apresentacao_estrategia';
        next_task_title := 'Marcar apresentacao da estrategia para ' || COALESCE(client_name, '');
        next_task_description := 'Agendar a apresentacao da estrategia PRO+ para o cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 2;
        next_step := 'marcar_apresentacao_estrategia';
        next_milestone := 2;

      -- MILESTONE 2: Marcar apresentacao -> Realizar apresentacao
      WHEN 'marcar_apresentacao_estrategia' THEN
        is_advancing_task := TRUE;
        next_task_type := 'realizar_apresentacao_estrategia';
        next_task_title := 'Realizar apresentacao da estrategia para ' || COALESCE(client_name, '');
        next_task_description := 'Realizar a apresentacao da estrategia PRO+ para o cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 3;
        next_step := 'realizar_apresentacao_estrategia';
        next_milestone := 2;

      -- MILESTONE 2: Realizar apresentacao -> Marco 3 (Brifar criativos)
      WHEN 'realizar_apresentacao_estrategia' THEN
        is_advancing_task := TRUE;
        next_task_type := 'brifar_criativos';
        next_task_title := 'Brifar Criativos';
        next_task_description := 'Criar briefing de criativos para o cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 5;
        next_step := 'brifar_criativos';
        next_milestone := 3;

      -- Legacy: apresentar_estrategia (old task_type) -> same as realizar_apresentacao
      WHEN 'apresentar_estrategia' THEN
        is_advancing_task := TRUE;
        next_task_type := 'brifar_criativos';
        next_task_title := 'Brifar Criativos';
        next_task_description := 'Criar briefing de criativos para o cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 5;
        next_step := 'brifar_criativos';
        next_milestone := 3;

      -- Legacy: enviar_estrategia (old task_type) -> same destination
      WHEN 'enviar_estrategia' THEN
        is_advancing_task := TRUE;
        next_task_type := 'brifar_criativos';
        next_task_title := 'Brifar Criativos';
        next_task_description := 'Criar briefing de criativos para o cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 5;
        next_step := 'brifar_criativos';
        next_milestone := 3;

      -- Legacy: marcar_call_1 / realizar_call_1 -- clients already migrated,
      -- but handle gracefully if a stale task completes
      WHEN 'marcar_call_1' THEN
        is_advancing_task := TRUE;
        next_task_type := 'dar_boas_vindas';
        next_task_title := 'Dar boas vindas: ' || COALESCE(client_name, '');
        next_task_description := 'Dar boas vindas ao cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 1;
        next_step := 'dar_boas_vindas';
        next_milestone := 2;

      WHEN 'realizar_call_1' THEN
        is_advancing_task := TRUE;
        next_task_type := 'criar_estrategia';
        next_task_title := 'Criar estrategia para ' || COALESCE(client_name, '');
        next_task_description := 'Criar a estrategia PRO+ para o cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 3;
        next_step := 'criar_estrategia';
        next_milestone := 2;

      -- MILESTONE 3: Brifar criativos -> vai para Milestone 4
      WHEN 'brifar_criativos' THEN
        is_advancing_task := TRUE;
        next_task_type := 'brifar_otimizacoes_pendentes';
        next_task_title := 'Brifar otimizacoes pendentes do(a) ' || COALESCE(client_name, '');
        next_task_description := 'Brifar as otimizacoes pendentes do cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 3;
        next_step := 'elencar_otimizacoes';
        next_milestone := 4;

      -- MILESTONE 4: Elencar Otimizacoes -> vai para Milestone 5
      WHEN 'brifar_otimizacoes_pendentes' THEN
        is_advancing_task := TRUE;
        next_task_type := 'configurar_conta_anuncios';
        next_task_title := 'Configurar conta de anuncios do(a) ' || COALESCE(client_name, '');
        next_task_description := 'Configurar a conta de anuncios do cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 2;
        next_step := 'configurar_conta_anuncios';
        next_milestone := 5;

      -- MILESTONE 5: Configuracoes finais -> Marcar call apresentacao torque
      WHEN 'configurar_conta_anuncios' THEN
        is_advancing_task := TRUE;
        next_task_type := 'marcar_call_apresentacao_torque';
        next_task_title := 'Marcar call de apresentacao no torque do(a) ' || COALESCE(client_name, '');
        next_task_description := 'Marcar a call de apresentacao no torque do cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 2;
        next_step := 'marcar_call_apresentacao_torque';
        next_milestone := 5;

      -- MILESTONE 5: Marcar call apresentacao torque -> Publicar campanha
      WHEN 'marcar_call_apresentacao_torque' THEN
        is_advancing_task := TRUE;
        next_task_type := 'publicar_campanha';
        next_task_title := 'Publicar Campanha';
        next_task_description := 'Publicar a campanha do cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 3;
        next_step := 'esperando_criativos';
        next_milestone := 5;

      -- Legacy: certificar_consultoria (old task_type) -> same as marcar_call_apresentacao_torque
      WHEN 'certificar_consultoria' THEN
        is_advancing_task := TRUE;
        next_task_type := 'publicar_campanha';
        next_task_title := 'Publicar Campanha';
        next_task_description := 'Publicar a campanha do cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 3;
        next_step := 'esperando_criativos';
        next_milestone := 5;

      -- Finalizar onboarding
      WHEN 'publicar_campanha' THEN
        is_advancing_task := TRUE;
        is_onboarding_complete := TRUE;
        next_task_type := NULL;
        next_step := 'acompanhamento';
        next_milestone := 6;

      ELSE
        is_advancing_task := FALSE;
    END CASE;

    -- Only advance client and create new tasks if this is an advancing task
    IF is_advancing_task THEN

      -- *** RESTORED: Update client status to 'onboarding' if still 'new_client' ***
      -- This was accidentally dropped in migration 20260520100000.
      -- Without it, clients stay as 'new_client' and appear in both
      -- "Novo Cliente" and "Onboarding" columns simultaneously.
      UPDATE public.clients
      SET status = 'onboarding',
          onboarding_started_at = COALESCE(onboarding_started_at, NOW()),
          updated_at = NOW()
      WHERE id = NEW.client_id
        AND (status = 'new_client' OR status IS NULL);

      -- Update client onboarding status
      UPDATE client_onboarding
      SET
        current_step = next_step,
        current_milestone = next_milestone,
        updated_at = NOW(),
        completed_at = CASE WHEN is_onboarding_complete THEN NOW() ELSE completed_at END
      WHERE client_id = NEW.client_id;

      -- Create next task if there is one
      IF next_task_type IS NOT NULL AND ads_manager_id_val IS NOT NULL THEN
        INSERT INTO onboarding_tasks (
          client_id,
          assigned_to,
          title,
          task_type,
          description,
          status,
          milestone,
          due_date
        ) VALUES (
          NEW.client_id,
          ads_manager_id_val,
          next_task_title,
          next_task_type,
          next_task_description,
          'pending',
          next_milestone,
          NOW() + (next_due_days || ' days')::INTERVAL
        );
      END IF;

      -- If completing publicar_campanha, mark client as active AND create tracking record
      IF NEW.task_type = 'publicar_campanha' THEN
        -- Mark client as active
        UPDATE clients
        SET
          status = 'active',
          campaign_published_at = NOW(),
          updated_at = NOW()
        WHERE id = NEW.client_id;

        -- Get day of week in Portuguese
        day_of_week := public.get_day_of_week_portuguese();

        -- Create tracking record for acompanhamento (only if not exists)
        INSERT INTO client_daily_tracking (
          client_id,
          ads_manager_id,
          current_day,
          last_moved_at,
          is_delayed
        ) VALUES (
          NEW.client_id,
          ads_manager_id_val,
          day_of_week,
          NOW(),
          false
        )
        ON CONFLICT (client_id) DO UPDATE SET
          current_day = EXCLUDED.current_day,
          last_moved_at = NOW(),
          is_delayed = false,
          updated_at = NOW();

        -- N9: Notify CEO + Comercial that onboarding is 100% complete
        FOR v_recipient IN
          SELECT user_id, role FROM public.user_roles
          WHERE role IN ('ceo', 'consultor_comercial')
        LOOP
          INSERT INTO public.system_notifications (
            recipient_id,
            recipient_role,
            notification_type,
            title,
            message,
            client_id,
            priority,
            metadata
          ) VALUES (
            v_recipient.user_id,
            v_recipient.role,
            'onboarding_completed',
            'Onboarding Concluido!',
            'O onboarding do cliente "' || COALESCE(client_name, '') || '" foi 100% concluido. O cliente esta em Acompanhamento.',
            NEW.client_id,
            'medium',
            jsonb_build_object('completed_by', NEW.assigned_to::text, 'client_name', COALESCE(client_name, ''))
          );
        END LOOP;
      END IF;

      -- Create auxiliary task for Milestone 3: only enviar_link_drive
      -- (anexar_link_consultoria and certificar_acompanhamento removed)
      IF (NEW.task_type = 'realizar_apresentacao_estrategia' OR NEW.task_type = 'apresentar_estrategia' OR NEW.task_type = 'enviar_estrategia') AND ads_manager_id_val IS NOT NULL THEN
        INSERT INTO onboarding_tasks (client_id, assigned_to, title, task_type, description, status, milestone, due_date)
        VALUES
          (NEW.client_id, ads_manager_id_val, 'Enviar e anexar no grupo o link do drive', 'enviar_link_drive', 'Enviar e anexar no grupo o link do drive do cliente ' || COALESCE(client_name, ''), 'pending', 3, NOW() + INTERVAL '5 days');
      END IF;

      -- Create auxiliary task after brifar_criativos
      IF NEW.task_type = 'brifar_criativos' AND ads_manager_id_val IS NOT NULL THEN
        INSERT INTO onboarding_tasks (client_id, assigned_to, title, task_type, description, status, milestone, due_date)
        VALUES
          (NEW.client_id, ads_manager_id_val, 'Avisar o(a) ' || COALESCE(client_name, '') || ' o prazo de entrega dos criativos', 'avisar_prazo_criativos', 'Avisar o cliente ' || COALESCE(client_name, '') || ' sobre o prazo de entrega dos criativos.', 'pending', 4, NOW() + INTERVAL '1 day');
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;
