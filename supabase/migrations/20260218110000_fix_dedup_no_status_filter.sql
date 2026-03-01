-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 1: create_ads_task_for_onboarding_task — remove AND status != 'done'
--
-- Bug: dedup check used "AND status != 'done'" so a task that was already
-- completed was invisible to the guard, allowing it to be recreated (e.g.
-- "Realizar Call 1" reappearing when a later task like publicar_campanha
-- was moved to done and the trigger inserted the next onboarding_task).
--
-- Fix: remove the status filter entirely. If a task with that client +
-- onboarding_task_type tag already exists in ANY state (including done), we
-- do NOT create a new one.
--
-- Fix 2: handle_ads_task_onboarding_on_completion — remove marcar_call_1 fallback
--
-- Bug: ads_tasks without an 'onboarding_task_type' tag defaulted to
-- 'marcar_call_1', so ANY ads_task moved to done (with only a client_id tag)
-- would try to complete the marcar_call_1 onboarding_task again. Now that the
-- "Marcar Call 1" ads_task is created with the explicit tag, the fallback is
-- dangerous and can be removed.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Fix 1: Dedup without status filter ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_ads_task_for_onboarding_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name  text;
  v_aid   uuid;
  v_exists boolean;
BEGIN
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_name FROM public.clients WHERE id = NEW.client_id;
  v_aid := NEW.assigned_to;

  CASE NEW.task_type

    -- ── Realizar Call 1 ──────────────────────────────────────────────────────
    WHEN 'realizar_call_1' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.ads_tasks
        WHERE ads_manager_id = v_aid
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
          'Realizar a primeira call com o cliente ' || COALESCE(v_name, 'Cliente') || '. Ao concluir, o cliente será movido para Criar Estratégia.',
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:realizar_call_1']
        );
      END IF;

    -- ── Apresentar Estratégia ────────────────────────────────────────────────
    WHEN 'apresentar_estrategia' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.ads_tasks
        WHERE ads_manager_id = v_aid
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
          'Apresentar estratégia Pro+ – ' || COALESCE(v_name, 'Cliente'),
          'Apresentar a estratégia PRO+ para o cliente ' || COALESCE(v_name, 'Cliente') || '. Ao concluir, o cliente será movido para Brifar Criativos.',
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:apresentar_estrategia']
        );
      END IF;

    -- ── Brifar Criativos (3 aux + 1 principal) ───────────────────────────────
    WHEN 'brifar_criativos' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.ads_tasks
        WHERE ads_manager_id = v_aid
          AND tags @> ARRAY[
                'client_id:' || NEW.client_id::text,
                'onboarding_task_type:brifar_criativos'
              ]
      ) INTO v_exists;

      IF NOT v_exists THEN
        -- Aux 1
        INSERT INTO public.ads_tasks
          (ads_manager_id, title, task_type, status, priority, tags)
        VALUES (
          v_aid,
          'Enviar e anexar no grupo Olímpico do Drive – ' || COALESCE(v_name, 'Cliente'),
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text]
        );
        -- Aux 2
        INSERT INTO public.ads_tasks
          (ads_manager_id, title, task_type, status, priority, tags)
        VALUES (
          v_aid,
          'Certificar acompanhamento comercial do(a) ' || COALESCE(v_name, 'Cliente'),
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text]
        );
        -- Aux 3
        INSERT INTO public.ads_tasks
          (ads_manager_id, title, task_type, status, priority, tags)
        VALUES (
          v_aid,
          'Anexar link da consultoria do(a) ' || COALESCE(v_name, 'Cliente'),
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text]
        );
        -- Principal (advancing)
        INSERT INTO public.ads_tasks
          (ads_manager_id, title, description, task_type, status, priority, tags)
        VALUES (
          v_aid,
          'Brifar criativos do(a) ' || COALESCE(v_name, 'Cliente'),
          'Brifar os criativos do cliente ' || COALESCE(v_name, 'Cliente') || '. Ao concluir, o cliente será movido para Elencar Otimizações.',
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:brifar_criativos']
        );
      END IF;

    -- ── Elencar Otimizações (1 aux + 1 principal) ────────────────────────────
    WHEN 'brifar_otimizacoes_pendentes' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.ads_tasks
        WHERE ads_manager_id = v_aid
          AND tags @> ARRAY[
                'client_id:' || NEW.client_id::text,
                'onboarding_task_type:brifar_otimizacoes_pendentes'
              ]
      ) INTO v_exists;

      IF NOT v_exists THEN
        -- Aux 1
        INSERT INTO public.ads_tasks
          (ads_manager_id, title, task_type, status, priority, tags)
        VALUES (
          v_aid,
          'Avisar o(a) ' || COALESCE(v_name, 'Cliente') || ' o prazo de entrega dos criativos',
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text]
        );
        -- Principal (advancing)
        INSERT INTO public.ads_tasks
          (ads_manager_id, title, description, task_type, status, priority, tags)
        VALUES (
          v_aid,
          'Brifar otimizações pendentes do(a) ' || COALESCE(v_name, 'Cliente'),
          'Brifar as otimizações pendentes do cliente ' || COALESCE(v_name, 'Cliente') || '. Ao concluir, o cliente será movido para Configurar Conta de Anúncios.',
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:brifar_otimizacoes_pendentes']
        );
      END IF;

    -- ── Configurar Conta de Anúncios ─────────────────────────────────────────
    WHEN 'configurar_conta_anuncios' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.ads_tasks
        WHERE ads_manager_id = v_aid
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
          'Configurar conta de anúncios do(a) ' || COALESCE(v_name, 'Cliente'),
          'Configurar a conta de anúncios do cliente ' || COALESCE(v_name, 'Cliente') || '. Ao concluir, o cliente será movido para Certificar Consultoria.',
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:configurar_conta_anuncios']
        );
      END IF;

    -- ── Certificar Consultoria ────────────────────────────────────────────────
    WHEN 'certificar_consultoria' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.ads_tasks
        WHERE ads_manager_id = v_aid
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
          'Certificar se a consultoria do(a) ' || COALESCE(v_name, 'Cliente') || ' já foi realizada',
          'Verificar se a consultoria do cliente ' || COALESCE(v_name, 'Cliente') || ' foi realizada. Ao concluir, o cliente será movido para Esperando Criativos.',
          'daily', 'todo', 'high',
          ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:certificar_consultoria']
        );
      END IF;

    -- ── Publicar Campanha ─────────────────────────────────────────────────────
    WHEN 'publicar_campanha' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.ads_tasks
        WHERE ads_manager_id = v_aid
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
          'Publicar a campanha do cliente ' || COALESCE(v_name, 'Cliente') || '. Ao concluir, o cliente será movido para Acompanhamento.',
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


-- ── Fix 2: Remove marcar_call_1 fallback ─────────────────────────────────────
--
-- The "Marcar Call 1" ads_task now carries the explicit
-- 'onboarding_task_type:marcar_call_1' tag (set in useAdsNewClientNotifications.ts).
-- The fallback is no longer needed and was dangerous: any ads_task with only
-- a client_id tag (no onboarding_task_type) would silently try to complete
-- marcar_call_1, potentially triggering the whole chain at the wrong time.
--
-- New behaviour: if v_task_type is still NULL after reading tags, do nothing.
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

    -- No fallback: if there's no onboarding_task_type tag, this ads_task is
    -- not linked to any onboarding step and we stop here.
    IF v_client_id IS NULL OR v_task_type IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT id INTO v_linked_task_id
    FROM public.onboarding_tasks
    WHERE client_id = v_client_id
      AND task_type  = v_task_type
      AND status    != 'done'
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_linked_task_id IS NOT NULL THEN
      UPDATE public.onboarding_tasks
      SET status = 'done'
      WHERE id = v_linked_task_id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger (function replaced above)
DROP TRIGGER IF EXISTS ads_task_onboarding_completion_trigger ON public.ads_tasks;
CREATE TRIGGER ads_task_onboarding_completion_trigger
AFTER UPDATE ON public.ads_tasks
FOR EACH ROW
EXECUTE FUNCTION public.handle_ads_task_onboarding_on_completion();
