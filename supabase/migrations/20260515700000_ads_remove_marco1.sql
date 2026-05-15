-- 20260515700000_ads_remove_marco1.sql
--
-- WHY: Call 1 is now the Gestor de Projetos' responsibility (Cat 1, Wave 1).
-- ADS no longer handles Call 1. Marco 1 is removed from the ADS onboarding flow.
--
-- New ADS flow:
--   dar_boas_vindas (M2) → criar_estrategia (M2) → marcar_apresentacao_estrategia (M2)
--   → realizar_apresentacao_estrategia (M2) → brifar_criativos (M3) → ...
--
-- Changes:
--   1. Data migration: clients in M1 → M2/dar_boas_vindas
--   2. Cancel orphaned M1 tasks
--   3. Replace advance_onboarding_on_task_completion trigger (new flow)
--   4. Replace create_ads_task_for_onboarding_task trigger (new task types)
--   5. Replace create_initial_onboarding_task trigger (dar_boas_vindas instead of marcar_call_1)
--   6. Replace handle_ads_manager_assignment trigger (dar_boas_vindas)

BEGIN;

-- =========================================================================
-- PART 1: Migrate clients currently in Milestone 1 → Milestone 2
-- =========================================================================

-- Clients in milestone 1 (any step) → move to milestone 2 / dar_boas_vindas
UPDATE client_onboarding
SET current_milestone = 2,
    current_step = 'dar_boas_vindas',
    milestone_2_started_at = COALESCE(milestone_2_started_at, now()),
    updated_at = now()
WHERE current_milestone = 1;

-- =========================================================================
-- PART 2: Cancel orphaned Marco 1 tasks
-- =========================================================================

-- Cancel pending/in_progress tasks for Marco 1 task types
UPDATE onboarding_tasks
SET status = 'cancelled',
    updated_at = now()
WHERE milestone = 1
  AND status IN ('pending', 'doing')
  AND task_type IN ('marcar_call_1', 'realizar_call_1');

-- Also mark related ads_tasks as done (visible kanban cards)
UPDATE ads_tasks
SET status = 'done',
    updated_at = now()
WHERE status != 'done'
  AND (
    tags @> ARRAY['onboarding_task_type:marcar_call_1']
    OR tags @> ARRAY['onboarding_task_type:realizar_call_1']
  );

-- =========================================================================
-- PART 3: Replace advance_onboarding_on_task_completion trigger
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

      -- MILESTONE 5: Configuracoes finais
      WHEN 'configurar_conta_anuncios' THEN
        is_advancing_task := TRUE;
        next_task_type := 'certificar_consultoria';
        next_task_title := 'Certificar se a consultoria do(a) ' || COALESCE(client_name, '') || ' ja foi realizada';
        next_task_description := 'Certificar se a consultoria do cliente ' || COALESCE(client_name, '') || ' ja foi realizada.';
        next_due_days := 2;
        next_step := 'certificando_consultoria';
        next_milestone := 5;

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

      -- Create auxiliary tasks for Milestone 3 (when realizar_apresentacao_estrategia or legacy apresentar_estrategia completes)
      IF (NEW.task_type = 'realizar_apresentacao_estrategia' OR NEW.task_type = 'apresentar_estrategia' OR NEW.task_type = 'enviar_estrategia') AND ads_manager_id_val IS NOT NULL THEN
        INSERT INTO onboarding_tasks (client_id, assigned_to, title, task_type, description, status, milestone, due_date)
        VALUES
          (NEW.client_id, ads_manager_id_val, 'Anexar link da consultoria', 'anexar_link_consultoria', 'Anexar o link da consultoria para o cliente ' || COALESCE(client_name, ''), 'pending', 3, NOW() + INTERVAL '5 days'),
          (NEW.client_id, ads_manager_id_val, 'Certificar acompanhamento comercial do(a) ' || COALESCE(client_name, ''), 'certificar_acompanhamento', 'Certificar que o acompanhamento comercial esta configurado para o cliente ' || COALESCE(client_name, ''), 'pending', 3, NOW() + INTERVAL '5 days'),
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
-- PART 4: Replace create_ads_task_for_onboarding_task trigger
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

    -- ── Brifar Criativos (3 aux + 1 principal) ─────────────────────────────
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
          (ads_manager_id, title, task_type, status, priority, tags)
        VALUES (
          v_aid,
          'Certificar acompanhamento comercial do(a) ' || COALESCE(v_name, 'Cliente'),
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text]
        );
        INSERT INTO public.ads_tasks
          (ads_manager_id, title, task_type, status, priority, tags)
        VALUES (
          v_aid,
          'Anexar link da consultoria do(a) ' || COALESCE(v_name, 'Cliente'),
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
            || '. Ao concluir, o cliente sera movido para Certificar Consultoria.',
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:configurar_conta_anuncios']
        );
      END IF;

    -- ── Certificar Consultoria ──────────────────────────────────────────────
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
          'Confirmar se toda a producao esta pronta ' || COALESCE(v_name, 'Cliente'),
          'Verificar se a consultoria do cliente ' || COALESCE(v_name, 'Cliente')
            || ' foi realizada. Ao concluir, o cliente sera movido para Publicar campanha.',
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
-- PART 5: Replace create_initial_onboarding_task (dar_boas_vindas)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.create_initial_onboarding_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_skip text;
BEGIN
  -- Bypass during bulk import
  v_skip := current_setting('app.skip_initial_task', true);
  IF v_skip = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_ads_manager IS NOT NULL THEN
    -- Idempotency: skip if dar_boas_vindas already exists for this client
    IF NOT EXISTS (
      SELECT 1 FROM public.onboarding_tasks
      WHERE client_id = NEW.id
        AND task_type = 'dar_boas_vindas'
    ) THEN
      INSERT INTO public.onboarding_tasks (
        client_id, assigned_to, task_type, title, description,
        status, due_date, milestone
      ) VALUES (
        NEW.id,
        NEW.assigned_ads_manager,
        'dar_boas_vindas',
        'Dar boas vindas: ' || NEW.name,
        'Dar boas vindas ao cliente ' || NEW.name || '.',
        'pending',
        NOW() + INTERVAL '1 day',
        2
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- =========================================================================
-- PART 6: Replace handle_ads_manager_assignment (dar_boas_vindas)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_ads_manager_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_name text;
BEGIN
  -- Only fire when assigned_ads_manager transitions from NULL to a value
  IF OLD.assigned_ads_manager IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.assigned_ads_manager IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1. Create onboarding_task if not exists
  IF NOT EXISTS (
    SELECT 1 FROM public.onboarding_tasks
    WHERE client_id = NEW.id
      AND task_type = 'dar_boas_vindas'
  ) THEN
    INSERT INTO public.onboarding_tasks (
      client_id, assigned_to, task_type, title, description,
      status, due_date, milestone
    ) VALUES (
      NEW.id,
      NEW.assigned_ads_manager,
      'dar_boas_vindas',
      'Dar boas vindas: ' || NEW.name,
      'Dar boas vindas ao cliente ' || NEW.name || '.',
      'pending',
      NOW() + INTERVAL '1 day',
      2
    );
  END IF;

  -- 2. Create client_onboarding record if not exists (start at M2)
  INSERT INTO public.client_onboarding (
    client_id, current_milestone, current_step, milestone_2_started_at
  ) VALUES (
    NEW.id, 2, 'dar_boas_vindas', NOW()
  )
  ON CONFLICT (client_id) DO NOTHING;

  -- 3. Notification for the new ads manager
  SELECT COALESCE(p.name, 'Sistema') INTO v_caller_name
  FROM public.profiles p WHERE p.user_id = auth.uid();

  INSERT INTO public.ads_new_client_notifications (
    ads_manager_id, client_id, client_name,
    created_by, created_by_name
  ) VALUES (
    NEW.assigned_ads_manager,
    NEW.id,
    NEW.name,
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(v_caller_name, 'Sistema')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_handle_ads_manager_assignment ON public.clients;
CREATE TRIGGER trigger_handle_ads_manager_assignment
AFTER UPDATE OF assigned_ads_manager ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.handle_ads_manager_assignment();

-- =========================================================================
-- PART 7: Update advance_client_onboarding_stage for new task types
-- =========================================================================

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
      -- New flow: dar_boas_vindas
      WHEN 'dar_boas_vindas' THEN
        v_next_column := 'Boas Vindas Dada';
        v_next_step := 'criar_estrategia';
        v_next_milestone := 2;
      WHEN 'criar_estrategia' THEN
        v_next_column := 'Estrategia Criada';
        v_next_step := 'marcar_apresentacao_estrategia';
        v_next_milestone := 2;
      WHEN 'marcar_apresentacao_estrategia' THEN
        v_next_column := 'Apresentacao Marcada';
        v_next_step := 'realizar_apresentacao_estrategia';
        v_next_milestone := 2;
      WHEN 'realizar_apresentacao_estrategia' THEN
        v_next_column := 'Estrategia Apresentada';
        v_next_step := 'brifar_criativos';
        v_next_milestone := 3;
      -- Legacy support
      WHEN 'marcar_call_1' THEN
        v_next_column := 'Boas Vindas Dada';
        v_next_step := 'dar_boas_vindas';
        v_next_milestone := 2;
      WHEN 'realizar_call_1' THEN
        v_next_column := 'Estrategia Criada';
        v_next_step := 'criar_estrategia';
        v_next_milestone := 2;
      WHEN 'apresentar_estrategia' THEN
        v_next_column := 'Estrategia Apresentada';
        v_next_step := 'brifar_criativos';
        v_next_milestone := 3;
      -- Remaining unchanged
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
    -- EXCLUDE specialized swim-lane boards
    FOR v_board IN
      SELECT DISTINCT kb.id as board_id, kb.slug
      FROM kanban_boards kb
      JOIN kanban_cards kc ON kc.board_id = kb.id
      WHERE kc.client_id = v_client_id
        AND kc.archived = false
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

COMMENT ON FUNCTION advance_client_onboarding_stage() IS
  'Advances client onboarding when tasks complete. Moves cards to step columns '
  'in management boards (ads, projetos, financeiro, comercial). Excludes '
  'specialized swim-lane boards (design, devs, editor-video, produtora, atrizes) '
  'whose columns follow the BY {NOME} pattern. '
  'Updated 2026-05-15: removed Marco 1 (Call 1), added dar_boas_vindas + sub-steps in M2.';

-- =========================================================================
-- PART 8: Update create_client_with_automations RPC (section 4.4)
--         Replace marcar_call_1 with dar_boas_vindas in the ADS onboarding path
-- =========================================================================

-- Read the current function body and replace the ADS section.
-- We use CREATE OR REPLACE to update only the relevant parts.
-- The function is recreated in full below (copied from 20260515100000 with ADS section updated).

CREATE OR REPLACE FUNCTION public.create_client_with_automations(
  p_payload          jsonb,
  p_idempotency_key  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id          uuid := auth.uid();
  v_caller_name        text;
  v_client_id          uuid;
  v_existing_client_id uuid;
  v_step               text := 'init';
  v_executed           text[] := ARRAY[]::text[];
  v_warnings           text[] := ARRAY[]::text[];
  v_contract_exp_date  date;
  v_entry_date         date;
  v_duration_months    int;
  v_is_growth          boolean;
  v_is_growth_no_ads   boolean;
  v_pv                 jsonb;
  v_pv_count           int;
  v_cnpj_clean         text;
  v_cpf_clean          text;
  v_phone_clean        text;
  v_assigned_ads       uuid;
  v_assigned_comer     uuid;
  v_assigned_mktp      uuid;
  v_assigned_crm       uuid;
  v_assigned_rh        uuid;
  v_assigned_outb      uuid;
  v_assigned_sucesso   uuid;
  v_group_id           uuid;
  v_squad_id           uuid;
  v_name               text;
  v_now                timestamptz := now();
BEGIN
  -- PHASE 1 — Payload validation
  v_step := 'validate_payload';

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = 'P0003';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'payload must be a jsonb object' USING ERRCODE = 'P0002';
  END IF;

  v_name := trim(COALESCE(p_payload->>'name', ''));
  IF length(v_name) < 2 THEN
    RAISE EXCEPTION 'name is required (min 2 chars)' USING ERRCODE = 'P0002';
  END IF;

  IF (p_payload->>'entry_date') IS NOT NULL THEN
    BEGIN
      v_entry_date := (p_payload->>'entry_date')::date;
    EXCEPTION WHEN invalid_datetime_format OR invalid_text_representation THEN
      RAISE EXCEPTION 'entry_date must be ISO yyyy-mm-dd' USING ERRCODE = 'P0002';
    END;
  ELSE
    v_entry_date := CURRENT_DATE;
  END IF;

  v_cnpj_clean := NULLIF(regexp_replace(COALESCE(p_payload->>'cnpj',''), '[^0-9]', '', 'g'), '');
  IF v_cnpj_clean IS NOT NULL AND length(v_cnpj_clean) <> 14 THEN
    RAISE EXCEPTION 'cnpj must have 14 digits after sanitize (got %)', length(v_cnpj_clean)
      USING ERRCODE = 'P0002';
  END IF;

  v_cpf_clean := NULLIF(regexp_replace(COALESCE(p_payload->>'cpf',''), '[^0-9]', '', 'g'), '');
  IF v_cpf_clean IS NOT NULL AND length(v_cpf_clean) <> 11 THEN
    RAISE EXCEPTION 'cpf must have 11 digits after sanitize (got %)', length(v_cpf_clean)
      USING ERRCODE = 'P0002';
  END IF;

  v_phone_clean := NULLIF(trim(COALESCE(p_payload->>'phone','')), '');

  IF p_payload ? 'product_values' THEN
    IF jsonb_typeof(p_payload->'product_values') <> 'array' THEN
      RAISE EXCEPTION 'product_values must be a jsonb array' USING ERRCODE = 'P0002';
    END IF;
    FOR v_pv IN SELECT * FROM jsonb_array_elements(p_payload->'product_values')
    LOOP
      IF jsonb_typeof(v_pv) <> 'object' THEN
        RAISE EXCEPTION 'each product_values entry must be a jsonb object'
          USING ERRCODE = 'P0002';
      END IF;
      IF (v_pv->>'product_slug') IS NULL OR (v_pv->>'product_name') IS NULL THEN
        RAISE EXCEPTION 'product_values entry requires product_slug and product_name'
          USING ERRCODE = 'P0002';
      END IF;
      IF (v_pv->>'monthly_value') IS NOT NULL
         AND (v_pv->>'monthly_value')::numeric < 0 THEN
        RAISE EXCEPTION 'product_values.monthly_value must be >= 0'
          USING ERRCODE = 'P0002';
      END IF;
    END LOOP;
  END IF;

  IF p_payload ? 'contracted_products'
     AND jsonb_typeof(p_payload->'contracted_products') <> 'array' THEN
    RAISE EXCEPTION 'contracted_products must be a jsonb array' USING ERRCODE = 'P0002';
  END IF;

  IF (p_payload->>'payment_due_day') IS NOT NULL THEN
    DECLARE
      v_day int := (p_payload->>'payment_due_day')::int;
    BEGIN
      IF v_day < 1 OR v_day > 31 THEN
        RAISE EXCEPTION 'payment_due_day must be 1..31' USING ERRCODE = 'P0002';
      END IF;
    END;
  END IF;

  v_assigned_ads     := NULLIF(p_payload->>'assigned_ads_manager','')::uuid;
  v_assigned_comer   := NULLIF(p_payload->>'assigned_comercial','')::uuid;
  v_assigned_mktp    := NULLIF(p_payload->>'assigned_mktplace','')::uuid;
  v_assigned_crm     := NULLIF(p_payload->>'assigned_crm','')::uuid;
  v_assigned_rh      := NULLIF(p_payload->>'assigned_rh','')::uuid;
  v_assigned_outb    := NULLIF(p_payload->>'assigned_outbound_manager','')::uuid;
  v_assigned_sucesso := NULLIF(p_payload->>'assigned_sucesso_cliente','')::uuid;
  v_group_id         := NULLIF(p_payload->>'group_id','')::uuid;
  v_squad_id         := NULLIF(p_payload->>'squad_id','')::uuid;

  v_duration_months := COALESCE(NULLIF(p_payload->>'contract_duration_months','')::int, 12);
  IF v_duration_months < 1 OR v_duration_months > 120 THEN
    RAISE EXCEPTION 'contract_duration_months must be 1..120' USING ERRCODE = 'P0002';
  END IF;

  v_contract_exp_date := (v_entry_date + make_interval(months => v_duration_months))::date;

  -- Detect Growth path
  v_is_growth := COALESCE(
    (p_payload->'contracted_products') ? 'millennials-growth',
    false
  );
  v_is_growth_no_ads := v_is_growth AND v_assigned_ads IS NULL;

  -- PHASE 2 — Permission
  v_step := 'check_permission';

  IF NOT (
    public.is_executive(v_caller_id)
    OR public.has_role(v_caller_id, 'gestor_projetos')
    OR public.has_role(v_caller_id, 'financeiro')
    OR public.has_role(v_caller_id, 'sucesso_cliente')
  ) THEN
    RAISE EXCEPTION 'insufficient privilege to create client'
      USING ERRCODE = 'P0003';
  END IF;

  -- PHASE 3 — Idempotency
  v_step := 'check_idempotency';

  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    SELECT client_id INTO v_existing_client_id
    FROM public.client_idempotency_keys
    WHERE key = p_idempotency_key
      AND created_at > v_now - interval '24 hours'
      AND created_by = v_caller_id;

    IF v_existing_client_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'client_id',            v_existing_client_id,
        'automations_executed', ARRAY[]::text[],
        'warnings',             ARRAY['idempotent_hit: returned existing client']::text[],
        'idempotent_hit',       true,
        'schema_version',       1
      );
    END IF;
  END IF;

  -- PHASE 4 — Inserts (all-or-nothing)

  -- 4.1 INSERT clients
  v_step := 'insert_client';
  INSERT INTO public.clients (
    name, cnpj, cpf, phone,
    razao_social, niche, general_info,
    expected_investment, monthly_value, sales_percentage,
    group_id, squad_id,
    assigned_ads_manager, assigned_comercial,
    assigned_crm, assigned_rh, assigned_outbound_manager, assigned_mktplace,
    assigned_sucesso_cliente,
    entry_date, contract_duration_months, payment_due_day,
    contracted_products, torque_crm_products,
    created_by, status,
    comercial_status, comercial_entered_at,
    mktplace_status, mktplace_entered_at,
    crm_status, crm_entered_at,
    cx_validation_status,
    growth_onboarding_step
  )
  VALUES (
    v_name,
    v_cnpj_clean,
    v_cpf_clean,
    v_phone_clean,
    NULLIF(p_payload->>'razao_social',''),
    NULLIF(p_payload->>'niche',''),
    NULLIF(p_payload->>'general_info',''),
    NULLIF(p_payload->>'expected_investment','')::numeric,
    NULLIF(p_payload->>'monthly_value','')::numeric,
    COALESCE(NULLIF(p_payload->>'sales_percentage','')::numeric, 0),
    v_group_id,
    v_squad_id,
    v_assigned_ads,
    v_assigned_comer,
    v_assigned_crm,
    v_assigned_rh,
    v_assigned_outb,
    CASE WHEN v_assigned_mktp IS NULL THEN NULL ELSE v_assigned_mktp::text END,
    v_assigned_sucesso,
    v_entry_date,
    v_duration_months,
    NULLIF(p_payload->>'payment_due_day','')::int,
    COALESCE(
      ARRAY(
        SELECT jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(p_payload->'contracted_products') = 'array'
               THEN p_payload->'contracted_products'
               ELSE '[]'::jsonb END
        )
      ),
      ARRAY[]::text[]
    ),
    COALESCE(
      ARRAY(
        SELECT jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(p_payload->'torque_crm_products') = 'array'
               THEN p_payload->'torque_crm_products'
               ELSE '[]'::jsonb END
        )
      ),
      ARRAY[]::text[]
    ),
    v_caller_id,
    'new_client',
    'novo', v_now,
    CASE WHEN v_assigned_mktp IS NOT NULL THEN 'novo' ELSE NULL END,
    CASE WHEN v_assigned_mktp IS NOT NULL THEN v_now ELSE NULL END,
    CASE WHEN v_assigned_crm  IS NOT NULL THEN 'novo' ELSE NULL END,
    CASE WHEN v_assigned_crm  IS NOT NULL THEN v_now ELSE NULL END,
    'aguardando_validacao',
    CASE WHEN v_is_growth_no_ads THEN 'novos_clientes' ELSE NULL END
  )
  RETURNING id INTO v_client_id;

  v_executed := array_append(v_executed, 'insert_client');

  -- 4.2 Idempotency record
  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    v_step := 'insert_idempotency_key';
    INSERT INTO public.client_idempotency_keys (key, client_id, created_by)
    VALUES (p_idempotency_key, v_client_id, v_caller_id);
  END IF;

  -- 4.3 Growth-without-ads: create BLOQUEADO tag, skip ADS onboarding artifacts
  IF v_is_growth_no_ads THEN
    v_step := 'growth_bloqueado_tag';
    INSERT INTO public.client_tags (client_id, name, source)
    VALUES (v_client_id, 'BLOQUEADO: ESPERAR LIGACAO CX', 'growth:novos_clientes')
    ON CONFLICT (client_id, name) WHERE dismissed_at IS NULL DO NOTHING;
    v_executed := array_append(v_executed, 'growth_bloqueado_tag');

  ELSE
    -- 4.4 ADS onboarding — UPDATED: dar_boas_vindas instead of marcar_call_1
    IF v_assigned_ads IS NOT NULL THEN
      SELECT name INTO v_caller_name FROM public.profiles WHERE user_id = v_caller_id;
      IF v_caller_name IS NULL THEN
        v_caller_name := 'Sistema';
      END IF;

      v_step := 'ads_notification_task';
      INSERT INTO public.ads_tasks (
        ads_manager_id, title, description, task_type, status, priority, tags
      ) VALUES (
        v_assigned_ads,
        'Dar boas vindas: ' || v_name,
        'Dar boas vindas ao cliente ' || v_name
          || '. Ao concluir, o cliente sera movido para Criar Estrategia.',
        'daily', 'todo', 'high',
        ARRAY[
          'client_id:' || v_client_id::text,
          'onboarding_task_type:dar_boas_vindas'
        ]
      );

      v_step := 'ads_notification_record';
      INSERT INTO public.ads_new_client_notifications (
        ads_manager_id, client_id, client_name, created_by, created_by_name
      ) VALUES (
        v_assigned_ads, v_client_id, v_name, v_caller_id, v_caller_name
      );
      v_executed := array_append(v_executed, 'ads_notification');

      v_step := 'onboarding_task';
      INSERT INTO public.onboarding_tasks (
        client_id, assigned_to, task_type, title, description,
        status, due_date, milestone
      ) VALUES (
        v_client_id, v_assigned_ads, 'dar_boas_vindas',
        'Dar boas vindas: ' || v_name,
        'Dar boas vindas ao cliente ' || v_name || '.',
        'pending',
        (v_now + interval '1 day'),
        2
      );
      v_executed := array_append(v_executed, 'onboarding_task');

      v_step := 'client_onboarding';
      INSERT INTO public.client_onboarding (
        client_id, current_milestone, current_step, milestone_2_started_at
      ) VALUES (
        v_client_id, 2, 'dar_boas_vindas', v_now
      )
      ON CONFLICT (client_id) DO NOTHING;
      v_executed := array_append(v_executed, 'client_onboarding');
    END IF;
  END IF;

  -- 4.5 N5: comercial notification (runs for ALL paths including Growth)
  IF v_assigned_comer IS NOT NULL THEN
    v_step := 'comercial_notification';
    INSERT INTO public.system_notifications (
      recipient_id, recipient_role, notification_type,
      title, message, client_id, priority, metadata
    ) VALUES (
      v_assigned_comer, 'consultor_comercial', 'new_client_assigned_comercial',
      'Novo Cliente Atribuido',
      'O cliente "' || v_name || '" foi cadastrado e atribuido a voce. '
        || 'Faca o primeiro contato dentro de 24h.',
      v_client_id, 'high',
      jsonb_build_object('created_by', v_caller_id)
    );
    v_executed := array_append(v_executed, 'comercial_notification');
  END IF;

  -- 4.6 N6: mktplace notification (runs for ALL paths including Growth)
  IF v_assigned_mktp IS NOT NULL THEN
    v_step := 'mktplace_notification';
    INSERT INTO public.system_notifications (
      recipient_id, recipient_role, notification_type,
      title, message, client_id, priority, metadata
    ) VALUES (
      v_assigned_mktp, 'consultor_mktplace', 'new_client_assigned_mktplace',
      'Novo Cliente Atribuido',
      'O cliente "' || v_name || '" foi cadastrado e atribuido a voce como '
        || 'Consultor(a) de MKT Place.',
      v_client_id, 'high',
      jsonb_build_object('created_by', v_caller_id)
    );
    v_executed := array_append(v_executed, 'mktplace_notification');
  END IF;

  -- 4.7 Financeiro per-product (runs for ALL paths)
  SELECT COALESCE(jsonb_array_length(p_payload->'product_values'), 0)
    INTO v_pv_count;

  IF v_pv_count > 0 THEN
    v_step := 'product_values';
    INSERT INTO public.client_product_values (
      client_id, product_slug, product_name, monthly_value
    )
    SELECT
      v_client_id,
      (pv->>'product_slug'),
      (pv->>'product_name'),
      COALESCE((pv->>'monthly_value')::numeric, 0)
    FROM jsonb_array_elements(p_payload->'product_values') pv;
    v_executed := array_append(v_executed, 'product_values');

    v_step := 'financeiro_tasks';
    INSERT INTO public.financeiro_tasks (
      client_id, product_slug, product_name, title, status, due_date
    )
    SELECT
      v_client_id,
      (pv->>'product_slug'),
      (pv->>'product_name'),
      v_name || ' — ' || (pv->>'product_name')
        || ' → Cadastrar no Asaas + Enviar 1a Cobranca',
      'pending',
      (v_now + interval '3 days')
    FROM jsonb_array_elements(p_payload->'product_values') pv;
    v_executed := array_append(v_executed, 'financeiro_tasks');

    v_step := 'financeiro_department_tasks';
    INSERT INTO public.department_tasks (
      user_id, title, description, task_type, status, priority,
      department, related_client_id, due_date
    )
    SELECT
      v_caller_id,
      v_name || ' — ' || (pv->>'product_name')
        || ' → Cadastrar no Asaas + Enviar 1a Cobranca',
      (pv->>'product_slug'),
      'daily', 'todo', 'high',
      'financeiro', v_client_id,
      (v_now + interval '3 days')
    FROM jsonb_array_elements(p_payload->'product_values') pv;
    v_executed := array_append(v_executed, 'financeiro_department_tasks');

    v_step := 'financeiro_client_onboarding';
    INSERT INTO public.financeiro_client_onboarding (
      client_id, product_slug, product_name, current_step,
      contract_expiration_date
    )
    SELECT
      v_client_id,
      (pv->>'product_slug'),
      (pv->>'product_name'),
      'novo_cliente',
      v_contract_exp_date
    FROM jsonb_array_elements(p_payload->'product_values') pv
    ON CONFLICT (client_id, product_slug) DO NOTHING;
    v_executed := array_append(v_executed, 'financeiro_client_onboarding');

    v_step := 'financeiro_active_clients';
    INSERT INTO public.financeiro_active_clients (
      client_id, product_slug, product_name, monthly_value,
      invoice_status, contract_expires_at
    )
    SELECT
      v_client_id,
      (pv->>'product_slug'),
      (pv->>'product_name'),
      0,
      'em_dia',
      v_contract_exp_date
    FROM jsonb_array_elements(p_payload->'product_values') pv
    ON CONFLICT (client_id, product_slug) DO NOTHING;
    v_executed := array_append(v_executed, 'financeiro_active_clients');
  END IF;

  -- 4.8 PM welcome task (Millennials Growth — both paths)
  IF v_is_growth AND v_group_id IS NOT NULL THEN
    v_step := 'pm_welcome_task';

    DECLARE
      v_pm_user_id uuid;
      v_inserted   boolean := false;
    BEGIN
      FOR v_pm_user_id IN
        SELECT p.user_id
        FROM public.profiles p
        JOIN public.user_roles ur ON ur.user_id = p.user_id
        WHERE p.group_id = v_group_id
          AND ur.role = 'gestor_projetos'
      LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.department_tasks
          WHERE user_id = v_pm_user_id
            AND related_client_id = v_client_id
            AND department = 'gestor_projetos'
            AND title ILIKE 'Dar boas-vindas para %'
            AND status <> 'done'
        ) THEN
          INSERT INTO public.department_tasks (
            user_id, title, description, task_type, status, priority,
            department, related_client_id, due_date
          ) VALUES (
            v_pm_user_id,
            'Dar boas-vindas para ' || v_name,
            jsonb_build_object(
              'type', 'project_manager_welcome',
              'trigger', 'client_created'
            )::text,
            'daily', 'todo', 'high',
            'gestor_projetos', v_client_id,
            (v_now + interval '1 day')
          );
          v_inserted := true;
        END IF;
      END LOOP;

      IF v_inserted THEN
        v_executed := array_append(v_executed, 'pm_welcome_task');
      ELSE
        v_warnings := array_append(
          v_warnings,
          'pm_welcome_task_skipped: no gestor_projetos found in group (or task already exists)'
        );
      END IF;
    END;
  END IF;

  -- PHASE 5 — Return
  RETURN jsonb_build_object(
    'client_id',            v_client_id,
    'automations_executed', v_executed,
    'warnings',             v_warnings,
    'idempotent_hit',       false,
    'schema_version',       1
  );

EXCEPTION
  WHEN unique_violation THEN
    IF SQLERRM ILIKE '%idx_clients_cnpj_unique%' THEN
      RAISE EXCEPTION 'cnpj already registered (step=%): %', v_step, SQLERRM
        USING ERRCODE = 'P0004';
    ELSE
      RAISE EXCEPTION 'unique violation at step [%]: %', v_step, SQLERRM
        USING ERRCODE = 'P0005';
    END IF;
  WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'foreign key violation at step [%]: %', v_step, SQLERRM
      USING ERRCODE = 'P0006';
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'insufficient privilege at step [%]: %', v_step, SQLERRM
      USING ERRCODE = 'P0003';
  WHEN raise_exception THEN
    RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'create_client_with_automations failed at step [%]: % (sqlstate=%)',
      v_step, SQLERRM, SQLSTATE
      USING ERRCODE = 'P0001';
END;
$$;

COMMENT ON FUNCTION public.create_client_with_automations(jsonb, text) IS
  'Atomic client creation RPC. Updated 2026-05-15: ADS onboarding now starts with dar_boas_vindas (Marco 2) instead of marcar_call_1 (Marco 1 removed).';

COMMIT;
