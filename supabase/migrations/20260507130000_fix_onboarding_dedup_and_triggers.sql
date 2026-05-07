-- 20260507130000_fix_onboarding_dedup_and_triggers.sql
--
-- Fixes 3 problems in ADS task auto-generation:
--
-- 1. DATA CLEANUP: Delete 459 duplicate onboarding_tasks (6 affected clients).
--    Root cause: useAutoCreateTaskForNewClients hook + DB trigger + RPC all
--    creating marcar_call_1 without cross-path idempotency.
--
-- 2. MISSING ADS_TASKS: Insert marcar_call_1 ads_tasks for Multifoods and
--    Tarcisio, which had onboarding_tasks but no corresponding ads_tasks.
--
-- 3. TRIGGER HARDENING:
--    a) create_initial_onboarding_task — add idempotency guard
--    b) create_ads_task_for_onboarding_task — add marcar_call_1 to CASE
--    c) NEW: handle_ads_manager_assignment — UPDATE trigger on clients for
--       when assigned_ads_manager changes from NULL to NOT NULL
--
-- All changes are idempotent. Safe to re-run.

BEGIN;

-- =========================================================================
-- PART 1: Delete duplicate onboarding_tasks (keep oldest per group)
-- =========================================================================
DELETE FROM public.onboarding_tasks
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY client_id, task_type, assigned_to
        ORDER BY created_at ASC
      ) AS rn
    FROM public.onboarding_tasks
  ) ranked
  WHERE rn > 1
);

-- =========================================================================
-- PART 2: Create missing ads_tasks for Multifoods and Tarcisio
-- =========================================================================

-- Multifoods — only if not already present
INSERT INTO public.ads_tasks (ads_manager_id, title, description, task_type, status, priority, tags)
SELECT
  'be5f2c7f-2c47-4a2a-84f2-2d196dbc320c',
  'Marcar Call 1: ' || c.name,
  'Marcar a primeira call com o cliente ' || c.name
    || '. Ao concluir, o cliente sera movido para Call #1 Marcada.',
  'daily', 'todo', 'high',
  ARRAY[
    'client_id:4985afc1-3664-4726-9baa-b928331e672a',
    'onboarding_task_type:marcar_call_1'
  ]
FROM public.clients c
WHERE c.id = '4985afc1-3664-4726-9baa-b928331e672a'
  AND NOT EXISTS (
    SELECT 1 FROM public.ads_tasks
    WHERE tags @> ARRAY[
      'client_id:4985afc1-3664-4726-9baa-b928331e672a',
      'onboarding_task_type:marcar_call_1'
    ]
    AND status != 'done'
  );

-- Tarcisio — only if not already present
INSERT INTO public.ads_tasks (ads_manager_id, title, description, task_type, status, priority, tags)
SELECT
  'be5f2c7f-2c47-4a2a-84f2-2d196dbc320c',
  'Marcar Call 1: ' || c.name,
  'Marcar a primeira call com o cliente ' || c.name
    || '. Ao concluir, o cliente sera movido para Call #1 Marcada.',
  'daily', 'todo', 'high',
  ARRAY[
    'client_id:3bf50d5f-6103-4c09-ba8c-e3766decec25',
    'onboarding_task_type:marcar_call_1'
  ]
FROM public.clients c
WHERE c.id = '3bf50d5f-6103-4c09-ba8c-e3766decec25'
  AND NOT EXISTS (
    SELECT 1 FROM public.ads_tasks
    WHERE tags @> ARRAY[
      'client_id:3bf50d5f-6103-4c09-ba8c-e3766decec25',
      'onboarding_task_type:marcar_call_1'
    ]
    AND status != 'done'
  );

-- =========================================================================
-- PART 3a: Idempotent create_initial_onboarding_task trigger
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
    -- Idempotency: skip if marcar_call_1 already exists for this client
    IF NOT EXISTS (
      SELECT 1 FROM public.onboarding_tasks
      WHERE client_id = NEW.id
        AND task_type = 'marcar_call_1'
    ) THEN
      INSERT INTO public.onboarding_tasks (
        client_id, assigned_to, task_type, title, description,
        status, due_date, milestone
      ) VALUES (
        NEW.id,
        NEW.assigned_ads_manager,
        'marcar_call_1',
        'Marcar Call 1',
        'Agendar a primeira call com o cliente ' || NEW.name || ' para alinhamento inicial.',
        'pending',
        NOW() + INTERVAL '1 day',
        1
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- =========================================================================
-- PART 3b: Add marcar_call_1 to create_ads_task_for_onboarding_task
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

    -- ── Marcar Call 1 ────────────────────────────────────────────────────────
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
          'Marcar Call 1: ' || COALESCE(v_name, 'Cliente'),
          'Marcar a primeira call com o cliente ' || COALESCE(v_name, 'Cliente')
            || '. Ao concluir, o cliente sera movido para Call #1 Marcada.',
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:marcar_call_1']
        );
      END IF;

    -- ── Realizar Call 1 ──────────────────────────────────────────────────────
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
          'Realizar Call 1: ' || COALESCE(v_name, 'Cliente'),
          'Realizar a primeira call com o cliente ' || COALESCE(v_name, 'Cliente')
            || '. Ao concluir, o cliente sera movido para Criar Estrategia.',
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:realizar_call_1']
        );
      END IF;

    -- ── Apresentar Estrategia ────────────────────────────────────────────────
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

    -- ── Brifar Criativos (3 aux + 1 principal) ──────────────────────────────
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

    -- ── Elencar Otimizacoes (1 aux + 1 principal) ───────────────────────────
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

    -- ── Configurar Conta de Anuncios ─────────────────────────────────────────
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

    -- ── Certificar Consultoria ───────────────────────────────────────────────
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

    -- ── Publicar Campanha ────────────────────────────────────────────────────
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

-- Recreate trigger (function replaced above)
DROP TRIGGER IF EXISTS create_ads_task_for_onboarding_task_trigger ON public.onboarding_tasks;
CREATE TRIGGER create_ads_task_for_onboarding_task_trigger
AFTER INSERT ON public.onboarding_tasks
FOR EACH ROW
EXECUTE FUNCTION public.create_ads_task_for_onboarding_task();

-- =========================================================================
-- PART 3c: New trigger — create tasks when assigned_ads_manager goes
--          from NULL to NOT NULL on an existing client
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
  --    (trigger on onboarding_tasks INSERT will create the ads_task via
  --     create_ads_task_for_onboarding_task)
  IF NOT EXISTS (
    SELECT 1 FROM public.onboarding_tasks
    WHERE client_id = NEW.id
      AND task_type = 'marcar_call_1'
  ) THEN
    INSERT INTO public.onboarding_tasks (
      client_id, assigned_to, task_type, title, description,
      status, due_date, milestone
    ) VALUES (
      NEW.id,
      NEW.assigned_ads_manager,
      'marcar_call_1',
      'Marcar Call 1: ' || NEW.name,
      'Agendar a primeira call com o cliente ' || NEW.name || ' para alinhamento inicial.',
      'pending',
      NOW() + INTERVAL '1 day',
      1
    );
  END IF;

  -- 2. Create client_onboarding record if not exists
  INSERT INTO public.client_onboarding (
    client_id, current_milestone, current_step, milestone_1_started_at
  ) VALUES (
    NEW.id, 1, 'marcar_call_1', NOW()
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

COMMIT;
