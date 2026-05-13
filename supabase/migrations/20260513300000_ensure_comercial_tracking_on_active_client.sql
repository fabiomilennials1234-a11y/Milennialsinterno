-- Fix: ensure_tracking_on_active_client was only creating client_daily_tracking
-- (ADS view) but NOT comercial_tracking. Comercial consultants never saw their
-- assigned clients in the Acompanhamento kanban.

CREATE OR REPLACE FUNCTION ensure_tracking_on_active_client()
RETURNS TRIGGER AS $$
DECLARE
  v_day text;
  v_manager_name text;
BEGIN
  IF NEW.status = 'active'
     AND NEW.campaign_published_at IS NOT NULL
     AND NEW.assigned_ads_manager IS NOT NULL
  THEN
    -- Map current day of week to Portuguese
    v_day := CASE EXTRACT(DOW FROM NOW())::int
      WHEN 1 THEN 'segunda'
      WHEN 2 THEN 'terca'
      WHEN 3 THEN 'quarta'
      WHEN 4 THEN 'quinta'
      WHEN 5 THEN 'sexta'
      ELSE 'segunda'
    END;

    -- ADS daily tracking
    IF NOT EXISTS (
      SELECT 1 FROM public.client_daily_tracking
      WHERE client_id = NEW.id
    ) THEN
      INSERT INTO public.client_daily_tracking
        (client_id, ads_manager_id, current_day, last_moved_at, is_delayed)
      VALUES
        (NEW.id, NEW.assigned_ads_manager, v_day, NOW(), FALSE)
      ON CONFLICT (client_id) DO NOTHING;
    END IF;

    -- Comercial tracking (if assigned_comercial is set)
    IF NEW.assigned_comercial IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.comercial_tracking
        WHERE client_id = NEW.id
      ) THEN
        SELECT name INTO v_manager_name
        FROM public.profiles
        WHERE user_id = NEW.assigned_ads_manager
        LIMIT 1;

        INSERT INTO public.comercial_tracking
          (comercial_user_id, client_id, manager_id, manager_name,
           current_day, last_moved_at, is_delayed)
        VALUES
          (NEW.assigned_comercial, NEW.id, NEW.assigned_ads_manager,
           COALESCE(v_manager_name, 'Gestor'), v_day, NOW(), FALSE)
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill: create comercial_tracking for all active clients that have
-- assigned_comercial but no tracking row.
INSERT INTO comercial_tracking
  (comercial_user_id, client_id, manager_id, manager_name,
   current_day, last_moved_at, is_delayed)
SELECT
  c.assigned_comercial,
  c.id,
  c.assigned_ads_manager,
  COALESCE(p.name, 'Gestor'),
  CASE EXTRACT(DOW FROM NOW())::int
    WHEN 1 THEN 'segunda'
    WHEN 2 THEN 'terca'
    WHEN 3 THEN 'quarta'
    WHEN 4 THEN 'quinta'
    WHEN 5 THEN 'sexta'
    ELSE 'segunda'
  END,
  NOW(),
  FALSE
FROM clients c
LEFT JOIN profiles p ON p.user_id = c.assigned_ads_manager
WHERE c.status = 'active'
  AND c.archived = false
  AND c.assigned_comercial IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM comercial_tracking ct WHERE ct.client_id = c.id
  );
