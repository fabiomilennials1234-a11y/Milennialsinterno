-- 20260515400000_torque_bloqueado.sql
--
-- WHY: When a Growth client finishes onboarding (growth_onboarding_step transitions
-- from NOT NULL to NULL), they enter "acompanhamento". At this point, the TORQUE
-- still needs CRM setup, so we tag "TORQUE BLOQUEADO" with a 21-day visual counter.
-- The counter is elapsed (days since created_at), NOT countdown — no cron needed.

BEGIN;

-- =============================================================================
-- 1. TRIGGER: create "TORQUE BLOQUEADO" when growth_onboarding_step → NULL
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_create_torque_bloqueado_on_growth_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- When growth_onboarding_step transitions from any non-null value to NULL
  -- it means the Growth onboarding is complete and client enters acompanhamento
  IF OLD.growth_onboarding_step IS NOT NULL AND NEW.growth_onboarding_step IS NULL THEN
    INSERT INTO public.client_tags (client_id, name, source)
    VALUES (NEW.id, 'TORQUE BLOQUEADO', 'growth:acompanhamento')
    ON CONFLICT (client_id, name) WHERE dismissed_at IS NULL DO NOTHING;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_create_torque_bloqueado_on_growth_complete ON public.clients;
CREATE TRIGGER trg_create_torque_bloqueado_on_growth_complete
  AFTER UPDATE OF growth_onboarding_step ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_create_torque_bloqueado_on_growth_complete();

-- =============================================================================
-- 2. BACKFILL: clients already in acompanhamento (growth_onboarding_step IS NULL
--    but were Growth clients that already went through onboarding)
-- =============================================================================
-- We DON'T backfill because we can't reliably determine which NULL-step clients
-- actually completed Growth onboarding vs never had Growth. The tag will only
-- fire prospectively for new completions.

COMMIT;
