-- 20260520100000_ads_task_cleanup_and_rename.sql
--
-- 4 changes to ADS gestor task system:
--
-- 1. REMOVE aux task "Certificar acompanhamento comercial do(a) {Nome}"
--    from brifar_criativos step (both ads_task creation and onboarding_task creation)
-- 2. REMOVE weekly task "Enviar relatório para todos os clientes"
--    from pg_cron job create_weekly_gestor_tasks()
-- 3. REMOVE aux task "Anexar link da consultoria do(a) {Nome}"
--    from brifar_criativos step (both ads_task creation and onboarding_task creation)
-- 4. RENAME milestone certificar_consultoria → marcar_call_apresentacao_torque
--    (task_type, step, title, description, tags)
--
-- All changes are idempotent. Safe to re-run.

BEGIN;

-- =========================================================================
-- PART 1: Data migration — rename existing records
-- =========================================================================

-- 1a. client_onboarding: update current_step
UPDATE public.client_onboarding
SET current_step = 'marcar_call_apresentacao_torque',
    updated_at = now()
WHERE current_step = 'certificando_consultoria';

-- 1b. onboarding_tasks: update task_type for pending/doing tasks
UPDATE public.onboarding_tasks
SET task_type = 'marcar_call_apresentacao_torque',
    updated_at = now()
WHERE task_type = 'certificar_consultoria'
  AND status IN ('pending', 'doing');

-- 1c. ads_tasks: update tags for active tasks
UPDATE public.ads_tasks
SET tags = array_replace(
      tags,
      'onboarding_task_type:certificar_consultoria',
      'onboarding_task_type:marcar_call_apresentacao_torque'
    ),
    updated_at = now()
WHERE tags @> ARRAY['onboarding_task_type:certificar_consultoria']
  AND status != 'done';

-- =========================================================================
-- PART 2: Replace advance_onboarding_on_task_completion trigger
--         Changes:
--         - configurar_conta_anuncios now points to marcar_call_apresentacao_torque
--         - certificar_consultoria WHEN renamed to marcar_call_apresentacao_torque
--         - Aux tasks for M3: removed anexar_link_consultoria + certificar_acompanhamento
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

      -- MILESTONE 2: Dar boas vindas → Criar estrategia
      WHEN 'dar_boas_vindas' THEN
        is_advancing_task := TRUE;
        next_task_type := 'criar_estrategia';
        next_task_title := 'Criar estrategia para ' || COALESCE(client_name, '');
        next_task_description := 'Criar a estrategia PRO+ para o cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 3;
        next_step := 'criar_estrategia';
        next_milestone := 2;

      -- MILESTONE 2: Criar estrategia → Marcar apresentacao estrategia
      WHEN 'criar_estrategia' THEN
        is_advancing_task := TRUE;
        next_task_type := 'marcar_apresentacao_estrategia';
        next_task_title := 'Marcar apresentacao da estrategia para ' || COALESCE(client_name, '');
        next_task_description := 'Agendar a apresentacao da estrategia PRO+ para o cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 2;
        next_step := 'marcar_apresentacao_estrategia';
        next_milestone := 2;

      -- MILESTONE 2: Marcar apresentacao → Realizar apresentacao
      WHEN 'marcar_apresentacao_estrategia' THEN
        is_advancing_task := TRUE;
        next_task_type := 'realizar_apresentacao_estrategia';
        next_task_title := 'Realizar apresentacao da estrategia para ' || COALESCE(client_name, '');
        next_task_description := 'Realizar a apresentacao da estrategia PRO+ para o cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 3;
        next_step := 'realizar_apresentacao_estrategia';
        next_milestone := 2;

      -- MILESTONE 2: Realizar apresentacao → Marco 3 (Brifar criativos)
      WHEN 'realizar_apresentacao_estrategia' THEN
        is_advancing_task := TRUE;
        next_task_type := 'brifar_criativos';
        next_task_title := 'Brifar Criativos';
        next_task_description := 'Criar briefing de criativos para o cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 5;
        next_step := 'brifar_criativos';
        next_milestone := 3;

      -- Legacy: apresentar_estrategia (old task_type) → same as realizar_apresentacao
      WHEN 'apresentar_estrategia' THEN
        is_advancing_task := TRUE;
        next_task_type := 'brifar_criativos';
        next_task_title := 'Brifar Criativos';
        next_task_description := 'Criar briefing de criativos para o cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 5;
        next_step := 'brifar_criativos';
        next_milestone := 3;

      -- Legacy: enviar_estrategia (old task_type) → same destination
      WHEN 'enviar_estrategia' THEN
        is_advancing_task := TRUE;
        next_task_type := 'brifar_criativos';
        next_task_title := 'Brifar Criativos';
        next_task_description := 'Criar briefing de criativos para o cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 5;
        next_step := 'brifar_criativos';
        next_milestone := 3;

      -- Legacy: marcar_call_1 / realizar_call_1 — clients already migrated,
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

      -- MILESTONE 5: Configuracoes finais → Marcar call apresentacao torque
      WHEN 'configurar_conta_anuncios' THEN
        is_advancing_task := TRUE;
        next_task_type := 'marcar_call_apresentacao_torque';
        next_task_title := 'Marcar call de apresentacao no torque do(a) ' || COALESCE(client_name, '');
        next_task_description := 'Marcar a call de apresentacao no torque do cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 2;
        next_step := 'marcar_call_apresentacao_torque';
        next_milestone := 5;

      -- MILESTONE 5: Marcar call apresentacao torque → Publicar campanha
      WHEN 'marcar_call_apresentacao_torque' THEN
        is_advancing_task := TRUE;
        next_task_type := 'publicar_campanha';
        next_task_title := 'Publicar Campanha';
        next_task_description := 'Publicar a campanha do cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 3;
        next_step := 'esperando_criativos';
        next_milestone := 5;

      -- Legacy: certificar_consultoria (old task_type) → same as marcar_call_apresentacao_torque
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

-- =========================================================================
-- PART 3: Replace create_ads_task_for_onboarding_task trigger
--         Changes:
--         - brifar_criativos: removed 2 aux inserts (certificar_acompanhamento, anexar_link)
--         - certificar_consultoria WHEN renamed to marcar_call_apresentacao_torque
--         - configurar_conta_anuncios description updated
-- =========================================================================

CREATE OR REPLACE FUNCTION public.create_ads_task_for_onboarding_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name   text;
  v_aid    uuid;
  v_exists boolean;
BEGIN
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_name FROM public.clients WHERE id = NEW.client_id;
  v_aid := NEW.assigned_to;

  CASE NEW.task_type

    -- ── Dar Boas Vindas ─────────────────────────────────────────────────────
    WHEN 'dar_boas_vindas' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.ads_tasks
        WHERE ads_manager_id = v_aid
          AND status != 'done'
          AND tags @> ARRAY[
                'client_id:' || NEW.client_id::text,
                'onboarding_task_type:dar_boas_vindas'
              ]
      ) INTO v_exists;

      IF NOT v_exists THEN
        INSERT INTO public.ads_tasks
          (ads_manager_id, title, description, task_type, status, priority, tags)
        VALUES (
          v_aid,
          'Dar boas vindas: ' || COALESCE(v_name, 'Cliente'),
          'Dar boas vindas ao cliente ' || COALESCE(v_name, 'Cliente')
            || '. Ao concluir, o cliente sera movido para Criar Estrategia.',
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:dar_boas_vindas']
        );
      END IF;

    -- ── Criar Estrategia ────────────────────────────────────────────────────
    WHEN 'criar_estrategia' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.ads_tasks
        WHERE ads_manager_id = v_aid
          AND status != 'done'
          AND tags @> ARRAY[
                'client_id:' || NEW.client_id::text,
                'onboarding_task_type:criar_estrategia'
              ]
      ) INTO v_exists;

      IF NOT v_exists THEN
        INSERT INTO public.ads_tasks
          (ads_manager_id, title, description, task_type, status, priority, tags)
        VALUES (
          v_aid,
          'Criar estrategia: ' || COALESCE(v_name, 'Cliente'),
          'Criar a estrategia PRO+ para o cliente ' || COALESCE(v_name, 'Cliente')
            || '. Ao concluir, o cliente sera movido para Marcar Apresentacao.',
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:criar_estrategia']
        );
      END IF;

    -- ── Marcar Apresentacao Estrategia ───────────────────────────────────────
    WHEN 'marcar_apresentacao_estrategia' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.ads_tasks
        WHERE ads_manager_id = v_aid
          AND status != 'done'
          AND tags @> ARRAY[
                'client_id:' || NEW.client_id::text,
                'onboarding_task_type:marcar_apresentacao_estrategia'
              ]
      ) INTO v_exists;

      IF NOT v_exists THEN
        INSERT INTO public.ads_tasks
          (ads_manager_id, title, description, task_type, status, priority, tags)
        VALUES (
          v_aid,
          'Marcar apresentacao estrategia: ' || COALESCE(v_name, 'Cliente'),
          'Agendar a apresentacao da estrategia PRO+ para o cliente ' || COALESCE(v_name, 'Cliente')
            || '. Ao concluir, o cliente sera movido para Realizar Apresentacao.',
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:marcar_apresentacao_estrategia']
        );
      END IF;

    -- ── Realizar Apresentacao Estrategia ─────────────────────────────────────
    WHEN 'realizar_apresentacao_estrategia' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.ads_tasks
        WHERE ads_manager_id = v_aid
          AND status != 'done'
          AND tags @> ARRAY[
                'client_id:' || NEW.client_id::text,
                'onboarding_task_type:realizar_apresentacao_estrategia'
              ]
      ) INTO v_exists;

      IF NOT v_exists THEN
        INSERT INTO public.ads_tasks
          (ads_manager_id, title, description, task_type, status, priority, tags)
        VALUES (
          v_aid,
          'Realizar apresentacao estrategia: ' || COALESCE(v_name, 'Cliente'),
          'Realizar a apresentacao da estrategia PRO+ para o cliente ' || COALESCE(v_name, 'Cliente')
            || '. Ao concluir, o cliente sera movido para Brifar Criativos.',
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:realizar_apresentacao_estrategia']
        );
      END IF;

    -- ── Legacy: Marcar Call 1 (stale tasks) ─────────────────────────────────
    WHEN 'marcar_call_1' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.ads_tasks
        WHERE ads_manager_id = v_aid
          AND status != 'done'
          AND tags @> ARRAY[
                'client_id:' || NEW.client_id::text,
                'onboarding_task_type:marcar_call_1'
              ]
      ) INTO v_exists;

      IF NOT v_exists THEN
        INSERT INTO public.ads_tasks
          (ads_manager_id, title, description, task_type, status, priority, tags)
        VALUES (
          v_aid,
          'Dar boas vindas: ' || COALESCE(v_name, 'Cliente'),
          'Dar boas vindas ao cliente ' || COALESCE(v_name, 'Cliente')
            || '. (Migrado de Marcar Call 1)',
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:marcar_call_1']
        );
      END IF;

    -- ── Legacy: Realizar Call 1 ─────────────────────────────────────────────
    WHEN 'realizar_call_1' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.ads_tasks
        WHERE ads_manager_id = v_aid
          AND status != 'done'
          AND tags @> ARRAY[
                'client_id:' || NEW.client_id::text,
                'onboarding_task_type:realizar_call_1'
              ]
      ) INTO v_exists;

      IF NOT v_exists THEN
        INSERT INTO public.ads_tasks
          (ads_manager_id, title, description, task_type, status, priority, tags)
        VALUES (
          v_aid,
          'Criar estrategia: ' || COALESCE(v_name, 'Cliente'),
          'Criar a estrategia PRO+ para o cliente ' || COALESCE(v_name, 'Cliente')
            || '. (Migrado de Realizar Call 1)',
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:realizar_call_1']
        );
      END IF;

    -- ── Apresentar Estrategia (legacy) ──────────────────────────────────────
    WHEN 'apresentar_estrategia' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.ads_tasks
        WHERE ads_manager_id = v_aid
          AND status != 'done'
          AND tags @> ARRAY[
                'client_id:' || NEW.client_id::text,
                'onboarding_task_type:apresentar_estrategia'
              ]
      ) INTO v_exists;

      IF NOT v_exists THEN
        INSERT INTO public.ads_tasks
          (ads_manager_id, title, description, task_type, status, priority, tags)
        VALUES (
          v_aid,
          'Apresentar estrategia Pro+ – ' || COALESCE(v_name, 'Cliente'),
          'Apresentar a estrategia PRO+ para o cliente ' || COALESCE(v_name, 'Cliente')
            || '. Ao concluir, o cliente sera movido para Brifar Criativos.',
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:apresentar_estrategia']
        );
      END IF;

    -- ── Brifar Criativos (1 aux + 1 principal) ─────────────────────────────
    -- Removed: "Certificar acompanhamento comercial" and "Anexar link da consultoria"
    WHEN 'brifar_criativos' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.ads_tasks
        WHERE ads_manager_id = v_aid
          AND status != 'done'
          AND tags @> ARRAY[
                'client_id:' || NEW.client_id::text,
                'onboarding_task_type:brifar_criativos'
              ]
      ) INTO v_exists;

      IF NOT v_exists THEN
        INSERT INTO public.ads_tasks
          (ads_manager_id, title, task_type, status, priority, tags)
        VALUES (
          v_aid,
          'Enviar e anexar no grupo o link do Drive – ' || COALESCE(v_name, 'Cliente'),
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text]
        );
        INSERT INTO public.ads_tasks
          (ads_manager_id, title, description, task_type, status, priority, tags)
        VALUES (
          v_aid,
          'Brifar criativos do(a) ' || COALESCE(v_name, 'Cliente'),
          'Brifar os criativos do cliente ' || COALESCE(v_name, 'Cliente')
            || '. Ao concluir, o cliente sera movido para Elencar Otimizacoes.',
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:brifar_criativos']
        );
      END IF;

    -- ── Elencar Otimizacoes (1 aux + 1 principal) ──────────────────────────
    WHEN 'brifar_otimizacoes_pendentes' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.ads_tasks
        WHERE ads_manager_id = v_aid
          AND status != 'done'
          AND tags @> ARRAY[
                'client_id:' || NEW.client_id::text,
                'onboarding_task_type:brifar_otimizacoes_pendentes'
              ]
      ) INTO v_exists;

      IF NOT v_exists THEN
        INSERT INTO public.ads_tasks
          (ads_manager_id, title, task_type, status, priority, tags)
        VALUES (
          v_aid,
          'Avisar o(a) ' || COALESCE(v_name, 'Cliente') || ' o prazo de entrega dos criativos',
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text]
        );
        INSERT INTO public.ads_tasks
          (ads_manager_id, title, description, task_type, status, priority, tags)
        VALUES (
          v_aid,
          'Brifar otimizacoes pendentes do(a) ' || COALESCE(v_name, 'Cliente'),
          'Brifar as otimizacoes pendentes do cliente ' || COALESCE(v_name, 'Cliente')
            || '. Ao concluir, o cliente sera movido para Configurar Conta de Anuncios.',
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:brifar_otimizacoes_pendentes']
        );
      END IF;

    -- ── Configurar Conta de Anuncios ────────────────────────────────────────
    WHEN 'configurar_conta_anuncios' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.ads_tasks
        WHERE ads_manager_id = v_aid
          AND status != 'done'
          AND tags @> ARRAY[
                'client_id:' || NEW.client_id::text,
                'onboarding_task_type:configurar_conta_anuncios'
              ]
      ) INTO v_exists;

      IF NOT v_exists THEN
        INSERT INTO public.ads_tasks
          (ads_manager_id, title, description, task_type, status, priority, tags)
        VALUES (
          v_aid,
          'Configurar conta de anuncios do(a) ' || COALESCE(v_name, 'Cliente'),
          'Configurar a conta de anuncios do cliente ' || COALESCE(v_name, 'Cliente')
            || '. Ao concluir, o cliente sera movido para Marcar Call Apresentacao Torque.',
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:configurar_conta_anuncios']
        );
      END IF;

    -- ── Marcar Call Apresentacao Torque ─────────────────────────────────────
    WHEN 'marcar_call_apresentacao_torque' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.ads_tasks
        WHERE ads_manager_id = v_aid
          AND status != 'done'
          AND tags @> ARRAY[
                'client_id:' || NEW.client_id::text,
                'onboarding_task_type:marcar_call_apresentacao_torque'
              ]
      ) INTO v_exists;

      IF NOT v_exists THEN
        INSERT INTO public.ads_tasks
          (ads_manager_id, title, description, task_type, status, priority, tags)
        VALUES (
          v_aid,
          'Marcar call de apresentacao no torque do(a) ' || COALESCE(v_name, 'Cliente'),
          'Marcar a call de apresentacao no torque do cliente ' || COALESCE(v_name, 'Cliente')
            || '. Ao concluir, o cliente sera movido para Publicar campanha.',
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:marcar_call_apresentacao_torque']
        );
      END IF;

    -- ── Legacy: Certificar Consultoria (old task_type) ─────────────────────
    WHEN 'certificar_consultoria' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.ads_tasks
        WHERE ads_manager_id = v_aid
          AND status != 'done'
          AND tags @> ARRAY[
                'client_id:' || NEW.client_id::text,
                'onboarding_task_type:certificar_consultoria'
              ]
      ) INTO v_exists;

      IF NOT v_exists THEN
        INSERT INTO public.ads_tasks
          (ads_manager_id, title, description, task_type, status, priority, tags)
        VALUES (
          v_aid,
          'Marcar call de apresentacao no torque do(a) ' || COALESCE(v_name, 'Cliente'),
          'Marcar a call de apresentacao no torque do cliente ' || COALESCE(v_name, 'Cliente')
            || '. Ao concluir, o cliente sera movido para Publicar campanha. (Migrado de Certificar Consultoria)',
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:certificar_consultoria']
        );
      END IF;

    -- ── Publicar Campanha ───────────────────────────────────────────────────
    WHEN 'publicar_campanha' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.ads_tasks
        WHERE ads_manager_id = v_aid
          AND status != 'done'
          AND tags @> ARRAY[
                'client_id:' || NEW.client_id::text,
                'onboarding_task_type:publicar_campanha'
              ]
      ) INTO v_exists;

      IF NOT v_exists THEN
        INSERT INTO public.ads_tasks
          (ads_manager_id, title, description, task_type, status, priority, tags)
        VALUES (
          v_aid,
          'Publicar campanha do(a) ' || COALESCE(v_name, 'Cliente'),
          'Publicar a campanha do cliente ' || COALESCE(v_name, 'Cliente')
            || '. Ao concluir, o cliente sera movido para Acompanhamento.',
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:publicar_campanha']
        );
      END IF;

    ELSE
      NULL;
  END CASE;

  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS create_ads_task_for_onboarding_task_trigger ON public.onboarding_tasks;
CREATE TRIGGER create_ads_task_for_onboarding_task_trigger
AFTER INSERT ON public.onboarding_tasks
FOR EACH ROW
EXECUTE FUNCTION public.create_ads_task_for_onboarding_task();

-- =========================================================================
-- PART 4: Replace create_weekly_gestor_tasks()
--         Removed: "Enviar relatório para todos os clientes"
--         Kept: "Enviar lema no grupo dos gestores"
-- =========================================================================

CREATE OR REPLACE FUNCTION public.create_weekly_gestor_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gestor_id UUID;
  v_monday DATE;
  v_due_date DATE;
  v_week_tag TEXT;
  v_success_count INT := 0;
  v_skip_count INT := 0;
BEGIN
  -- Calcular a segunda-feira da semana atual
  v_monday := date_trunc('week', CURRENT_DATE)::date;
  -- Prazo: 1 dia após a segunda (terça-feira)
  v_due_date := v_monday + INTERVAL '1 day';
  -- Tag de referência da semana para idempotência
  v_week_tag := 'auto_weekly:' || v_monday::text;

  -- Iterar sobre todos os gestores de ads ativos
  FOR v_gestor_id IN
    SELECT ur.user_id
    FROM user_roles ur
    JOIN profiles p ON p.user_id = ur.user_id
    WHERE ur.role = 'gestor_ads'
  LOOP
    -- Tarefa: Enviar lema no grupo dos gestores
    IF NOT EXISTS (
      SELECT 1 FROM ads_tasks
      WHERE ads_manager_id = v_gestor_id
        AND title = 'Enviar lema no grupo dos gestores'
        AND v_week_tag = ANY(tags)
        AND (archived IS NULL OR archived = false)
    ) THEN
      INSERT INTO ads_tasks (
        ads_manager_id, title, description, task_type, status, priority, due_date, tags
      ) VALUES (
        v_gestor_id,
        'Enviar lema no grupo dos gestores',
        'Tarefa automática semanal — criada em ' || v_monday::text,
        'daily',
        'todo',
        'high',
        v_due_date,
        ARRAY[v_week_tag, 'auto_semanal']
      );
      v_success_count := v_success_count + 1;
    ELSE
      v_skip_count := v_skip_count + 1;
    END IF;
  END LOOP;

  RAISE LOG '[WeeklyTasks] Concluído: % tarefas criadas, % ignoradas (duplicatas)', v_success_count, v_skip_count;
END;
$$;

-- Re-schedule cron job (idempotent)
SELECT cron.unschedule('weekly-gestor-tasks')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'weekly-gestor-tasks'
);

SELECT cron.schedule(
  'weekly-gestor-tasks',
  '0 9 * * 1',
  $$SELECT public.create_weekly_gestor_tasks()$$
);

COMMIT;
