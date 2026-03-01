-- ─────────────────────────────────────────────────────────────────────────────
-- Full Onboarding Automation: ads_task creation for every onboarding step
--
-- When advance_onboarding_on_task_completion inserts a new onboarding_task,
-- this trigger creates the corresponding visible ads_task(s) in Tarefas Diárias.
--
-- TASK TYPE → ADS TASKS CREATED
-- ─────────────────────────────────────────────────────────────────────────────
-- realizar_call_1          → "Realizar Call 1: {Nome}"
-- apresentar_estrategia    → "Apresentar estratégia Pro+ – {Nome}"
-- brifar_criativos         → "Enviar e anexar no grupo Olímpico do Drive – {Nome}"
--                            "Certificar acompanhamento comercial do(a) {Nome}"
--                            "Anexar link da consultoria do(a) {Nome}"
--                            "Brifar criativos do(a) {Nome}"  ← MAIN (advancing)
-- brifar_otimizacoes_pend. → "Avisar o(a) {Nome} o prazo de entrega dos criativos"
--                            "Brifar otimizações pendentes do(a) {Nome}"  ← MAIN
-- configurar_conta_anuncios→ "Configurar conta de anúncios do(a) {Nome}"
-- certificar_consultoria   → "Certificar se a consultoria do(a) {Nome} já foi realizada"
-- publicar_campanha        → "Publicar campanha do(a) {Nome}"
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_ads_task_for_onboarding_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_aid  uuid;
BEGIN
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_name FROM public.clients WHERE id = NEW.client_id;
  v_aid := NEW.assigned_to;

  CASE NEW.task_type

    -- ── Etapa 3: Realizar Call 1 ────────────────────────────────────────────
    WHEN 'realizar_call_1' THEN
      INSERT INTO public.ads_tasks
        (ads_manager_id, title, description, task_type, status, priority, tags)
      VALUES (
        v_aid,
        'Realizar Call 1: ' || COALESCE(v_name, 'Cliente'),
        'Realizar a primeira call com o cliente ' || COALESCE(v_name, 'Cliente') || '. Ao concluir, o cliente será movido para Criar Estratégia.',
        'daily', 'todo', 'high',
        ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:realizar_call_1']
      );

    -- ── Etapa 4: Apresentar Estratégia ──────────────────────────────────────
    WHEN 'apresentar_estrategia' THEN
      INSERT INTO public.ads_tasks
        (ads_manager_id, title, description, task_type, status, priority, tags)
      VALUES (
        v_aid,
        'Apresentar estratégia Pro+ – ' || COALESCE(v_name, 'Cliente'),
        'Apresentar a estratégia PRO+ para o cliente ' || COALESCE(v_name, 'Cliente') || '. Ao concluir, o cliente será movido para Brifar Criativos.',
        'daily', 'todo', 'high',
        ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:apresentar_estrategia']
      );

    -- ── Etapa 5: Brifar Criativos (3 auxiliares + 1 principal) ──────────────
    WHEN 'brifar_criativos' THEN
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

    -- ── Etapa 6: Elencar Otimizações (1 auxiliar + 1 principal) ─────────────
    WHEN 'brifar_otimizacoes_pendentes' THEN
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

    -- ── Etapa 7: Configurar Conta de Anúncios ───────────────────────────────
    WHEN 'configurar_conta_anuncios' THEN
      INSERT INTO public.ads_tasks
        (ads_manager_id, title, description, task_type, status, priority, tags)
      VALUES (
        v_aid,
        'Configurar conta de anúncios do(a) ' || COALESCE(v_name, 'Cliente'),
        'Configurar a conta de anúncios do cliente ' || COALESCE(v_name, 'Cliente') || '. Ao concluir, o cliente será movido para Certificar Consultoria.',
        'daily', 'todo', 'high',
        ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:configurar_conta_anuncios']
      );

    -- ── Etapa 8: Certificar Consultoria ─────────────────────────────────────
    WHEN 'certificar_consultoria' THEN
      INSERT INTO public.ads_tasks
        (ads_manager_id, title, description, task_type, status, priority, tags)
      VALUES (
        v_aid,
        'Certificar se a consultoria do(a) ' || COALESCE(v_name, 'Cliente') || ' já foi realizada',
        'Verificar se a consultoria do cliente ' || COALESCE(v_name, 'Cliente') || ' foi realizada. Ao concluir, o cliente será movido para Esperando Criativos.',
        'daily', 'todo', 'high',
        ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:certificar_consultoria']
      );

    -- ── Etapa 9: Publicar Campanha ───────────────────────────────────────────
    WHEN 'publicar_campanha' THEN
      INSERT INTO public.ads_tasks
        (ads_manager_id, title, description, task_type, status, priority, tags)
      VALUES (
        v_aid,
        'Publicar campanha do(a) ' || COALESCE(v_name, 'Cliente'),
        'Publicar a campanha do cliente ' || COALESCE(v_name, 'Cliente') || '. Ao concluir, o cliente será movido para Acompanhamento.',
        'daily', 'todo', 'high',
        ARRAY['client_id:' || NEW.client_id::text, 'onboarding_task_type:publicar_campanha']
      );

    ELSE
      NULL;
  END CASE;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_ads_task_for_onboarding_task_trigger ON public.onboarding_tasks;
CREATE TRIGGER create_ads_task_for_onboarding_task_trigger
AFTER INSERT ON public.onboarding_tasks
FOR EACH ROW
EXECUTE FUNCTION public.create_ads_task_for_onboarding_task();


-- ─────────────────────────────────────────────────────────────────────────────
-- Day-of-week routing for Acompanhamento
--
-- When publicar_campanha onboarding_task is marked done, automatically place
-- the client in the correct day column of client_daily_tracking based on
-- the current day of the week.
--
-- Monday=1→segunda, Tuesday=2→terca, Wednesday=3→quarta,
-- Thursday=4→quinta, Friday=5→sexta, Weekend→segunda (Monday)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_publicar_campanha_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day text;
BEGIN
  IF NEW.status = 'done'
    AND OLD.status IS DISTINCT FROM 'done'
    AND NEW.task_type = 'publicar_campanha'
    AND NEW.client_id IS NOT NULL
    AND NEW.assigned_to IS NOT NULL
  THEN
    -- Map current day of week to Portuguese abbreviation
    v_day := CASE EXTRACT(DOW FROM NOW())::int
      WHEN 1 THEN 'segunda'
      WHEN 2 THEN 'terca'
      WHEN 3 THEN 'quarta'
      WHEN 4 THEN 'quinta'
      WHEN 5 THEN 'sexta'
      ELSE 'segunda'   -- Saturday/Sunday → place on Monday
    END;

    -- Insert or update the daily tracking record
    IF EXISTS (
      SELECT 1 FROM public.client_daily_tracking
      WHERE client_id = NEW.client_id
        AND ads_manager_id = NEW.assigned_to
    ) THEN
      UPDATE public.client_daily_tracking
      SET current_day   = v_day,
          last_moved_at = NOW(),
          is_delayed    = FALSE
      WHERE client_id      = NEW.client_id
        AND ads_manager_id = NEW.assigned_to;
    ELSE
      INSERT INTO public.client_daily_tracking
        (client_id, ads_manager_id, current_day, last_moved_at, is_delayed)
      VALUES
        (NEW.client_id, NEW.assigned_to, v_day, NOW(), FALSE);
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS handle_publicar_campanha_complete_trigger ON public.onboarding_tasks;
CREATE TRIGGER handle_publicar_campanha_complete_trigger
AFTER UPDATE ON public.onboarding_tasks
FOR EACH ROW
EXECUTE FUNCTION public.handle_publicar_campanha_complete();
