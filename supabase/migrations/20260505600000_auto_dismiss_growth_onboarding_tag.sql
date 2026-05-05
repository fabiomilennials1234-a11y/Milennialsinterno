-- Auto-dismiss "Esperar ser finalizado o Onboarding do Growth" tag
-- when client reaches publicar_campanha (esperando_criativos) or acompanhamento.
-- Previously tag was never dismissed, accumulating on active clients.

-- 1. Dismiss existing stale tags for clients already past milestone 5
UPDATE client_tags
SET dismissed_at = NOW()
WHERE name = 'Esperar ser finalizado o Onboarding do Growth'
AND dismissed_at IS NULL
AND client_id IN (
  SELECT co.client_id FROM client_onboarding co
  WHERE co.current_milestone >= 5 OR co.completed_at IS NOT NULL
);

-- 2. Also dismiss for clients already active
UPDATE client_tags
SET dismissed_at = NOW()
WHERE name = 'Esperar ser finalizado o Onboarding do Growth'
AND dismissed_at IS NULL
AND client_id IN (
  SELECT id FROM clients WHERE status = 'active'
);

-- 3. Trigger to auto-dismiss going forward
CREATE OR REPLACE FUNCTION public.dismiss_growth_onboarding_tag_on_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.current_step IN ('esperando_criativos', 'acompanhamento')
     AND (OLD.current_step IS NULL OR OLD.current_step NOT IN ('esperando_criativos', 'acompanhamento')) THEN
    UPDATE public.client_tags
    SET dismissed_at = NOW()
    WHERE client_id = NEW.client_id
      AND name = 'Esperar ser finalizado o Onboarding do Growth'
      AND dismissed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dismiss_growth_tag_on_complete ON client_onboarding;
CREATE TRIGGER trg_dismiss_growth_tag_on_complete
  AFTER UPDATE ON client_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION dismiss_growth_onboarding_tag_on_complete();
