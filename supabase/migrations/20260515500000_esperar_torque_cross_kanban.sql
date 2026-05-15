-- 20260515500000_esperar_torque_cross_kanban.sql
--
-- WHY: Cross-kanban coordination for TORQUE CRM setup.
-- When ADS reaches "Publicar campanha" (esperando_criativos):
--   - Dismiss "TORQUE BLOQUEADO" (GP no longer needs to wait)
--   - Insert "Esperar TORQUE" (ADS now waits for CRM completion)
--   - Create PM task "Brifar CRM [client]" with 1 business day deadline
--
-- When CRM is finalized (crm_configuracoes.is_finalizado or clients.crm_finalizado_at):
--   - Dismiss "Esperar TORQUE"

BEGIN;

-- =============================================================================
-- 1. TRIGGER on client_onboarding: esperando_criativos → dismiss BLOQUEADO,
--    insert "Esperar TORQUE", create PM task
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_esperar_torque_on_publicar_campanha()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_client      record;
  v_pm_user_id  uuid;
BEGIN
  IF NEW.current_step = 'esperando_criativos'
     AND (OLD.current_step IS DISTINCT FROM NEW.current_step) THEN

    -- Fetch client info for task title
    SELECT c.id, c.name, c.group_id
      INTO v_client
      FROM public.clients c
     WHERE c.id = NEW.client_id;

    -- 1a. Dismiss "TORQUE BLOQUEADO"
    UPDATE public.client_tags
       SET dismissed_at = now(),
           dismissed_reason = 'publicar_campanha_reached'
     WHERE client_id = NEW.client_id
       AND name = 'TORQUE BLOQUEADO'
       AND dismissed_at IS NULL;

    -- 1b. Insert "Esperar TORQUE" (10-day countdown via existing BEFORE INSERT trigger)
    INSERT INTO public.client_tags (client_id, name, source)
    VALUES (NEW.client_id, 'Esperar TORQUE', 'onboarding:publicar_campanha')
    ON CONFLICT (client_id, name) WHERE dismissed_at IS NULL DO NOTHING;

    -- 1c. Create PM task "Brifar CRM [client name]" for gestor_projetos in client's group
    IF v_client.group_id IS NOT NULL THEN
      FOR v_pm_user_id IN
        SELECT p.user_id
          FROM public.profiles p
          JOIN public.user_roles ur ON ur.user_id = p.user_id
         WHERE p.group_id = v_client.group_id
           AND ur.role = 'gestor_projetos'
      LOOP
        INSERT INTO public.department_tasks (
          user_id, title, description, task_type, status, priority,
          department, related_client_id, due_date
        ) VALUES (
          v_pm_user_id,
          'Brifar CRM ' || COALESCE(v_client.name, 'Cliente'),
          'growth:brifar_crm',
          'daily', 'todo', 'high',
          'gestor_projetos', NEW.client_id,
          -- 1 business day: if Friday → Monday, else next day
          CASE EXTRACT(DOW FROM now())
            WHEN 5 THEN now() + interval '3 days'  -- Friday → Monday
            WHEN 6 THEN now() + interval '2 days'  -- Saturday → Monday
            ELSE now() + interval '1 day'
          END
        )
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_esperar_torque_on_publicar_campanha ON public.client_onboarding;
CREATE TRIGGER trg_esperar_torque_on_publicar_campanha
  AFTER UPDATE OF current_step ON public.client_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_esperar_torque_on_publicar_campanha();

-- =============================================================================
-- 2. TRIGGER on crm_configuracoes: is_finalizado → dismiss "Esperar TORQUE"
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_dismiss_esperar_torque_on_crm_finalizado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF (OLD.is_finalizado IS DISTINCT FROM true) AND NEW.is_finalizado = true THEN
    UPDATE public.client_tags
       SET dismissed_at = now(),
           dismissed_reason = 'crm_finalizado'
     WHERE client_id = NEW.client_id
       AND name = 'Esperar TORQUE'
       AND dismissed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_dismiss_esperar_torque_on_crm_finalizado ON public.crm_configuracoes;
CREATE TRIGGER trg_dismiss_esperar_torque_on_crm_finalizado
  AFTER UPDATE OF is_finalizado ON public.crm_configuracoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_dismiss_esperar_torque_on_crm_finalizado();

-- =============================================================================
-- 3. TRIGGER on clients: crm_finalizado_at → dismiss "Esperar TORQUE"
--    (Paddock manual CRM finalization via dismiss_client_torque_tag RPC)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_dismiss_esperar_torque_on_paddock_crm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF OLD.crm_finalizado_at IS NULL AND NEW.crm_finalizado_at IS NOT NULL THEN
    UPDATE public.client_tags
       SET dismissed_at = now(),
           dismissed_reason = 'crm_finalizado_paddock'
     WHERE client_id = NEW.id
       AND name = 'Esperar TORQUE'
       AND dismissed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_dismiss_esperar_torque_on_paddock_crm ON public.clients;
CREATE TRIGGER trg_dismiss_esperar_torque_on_paddock_crm
  AFTER UPDATE OF crm_finalizado_at ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_dismiss_esperar_torque_on_paddock_crm();

COMMIT;
