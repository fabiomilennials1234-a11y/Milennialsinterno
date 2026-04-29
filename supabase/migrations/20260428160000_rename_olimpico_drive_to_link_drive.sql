-- ─────────────────────────────────────────────────────────────────────────────
-- Rename copy: "grupo Olímpico do Drive" → "grupo o link do Drive"
--
-- Bug: original copy on the auxiliary ads_task created when an
-- onboarding_task of type 'brifar_criativos' is inserted said
-- "Enviar e anexar no grupo Olímpico do Drive – {Nome}". The intended copy
-- was "Enviar e anexar no grupo o link do Drive – {Nome}" — "Olímpico" was a
-- transcription error of "o link". This migration:
--
--   1. Backfills existing rows in public.ads_tasks with the corrected title
--      while preserving the client name suffix.
--   2. Replaces public.create_ads_task_for_onboarding_task() with the same
--      definition shipped in 20260218110000_fix_dedup_no_status_filter.sql,
--      changing only the offending string. Trigger is left intact since the
--      function signature is unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Backfill existing rows ────────────────────────────────────────────────
UPDATE public.ads_tasks
SET title = replace(
              title,
              'Enviar e anexar no grupo Olímpico do Drive – ',
              'Enviar e anexar no grupo o link do Drive – '
            )
WHERE title LIKE 'Enviar e anexar no grupo Olímpico do Drive – %';

-- ── 2. Recreate function with corrected copy ─────────────────────────────────
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
          'Enviar e anexar no grupo o link do Drive – ' || COALESCE(v_name, 'Cliente'),
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
