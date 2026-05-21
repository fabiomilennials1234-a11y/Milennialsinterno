-- Add per-client report cycle configuration
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS report_cycle_days integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS report_cycle_reset_at timestamptz;

-- For each gestor, set the second half of their active clients to 30-day cycle
WITH ranked AS (
  SELECT id, assigned_ads_manager,
    ROW_NUMBER() OVER (PARTITION BY assigned_ads_manager ORDER BY name) AS rn,
    COUNT(*) OVER (PARTITION BY assigned_ads_manager) AS total
  FROM public.clients
  WHERE status = 'active'
    AND campaign_published_at IS NOT NULL
    AND assigned_ads_manager IS NOT NULL
)
UPDATE public.clients
SET report_cycle_days = 30
FROM ranked
WHERE clients.id = ranked.id
  AND ranked.rn > ranked.total / 2;

-- Reset all overdue report cycles for active clients
UPDATE public.clients
SET report_cycle_reset_at = now()
WHERE status = 'active'
  AND campaign_published_at IS NOT NULL
  AND assigned_ads_manager IS NOT NULL;

-- Clean up duplicate results-report tasks (keep oldest per title per manager)
DELETE FROM public.ads_tasks
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY ads_manager_id, title
        ORDER BY created_at ASC
      ) AS rn
    FROM public.ads_tasks
    WHERE (title ILIKE 'Gerar PDF de Resultados%' OR title ILIKE 'Marcar apresentação de resultado%')
      AND (archived IS NULL OR archived = false)
  ) dupes
  WHERE dupes.rn > 1
);
