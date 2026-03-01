-- Backfill: Atribui assigned_ads_manager para clientes que têm squad_id mas não têm gestor.
-- Esses clientes aparecem em outros kanbans mas não no Gestão de Tráfego PRO+.
-- Usa o owner do board de ads do squad como gestor padrão.
UPDATE public.clients c
SET assigned_ads_manager = (
  SELECT kb.owner_user_id
  FROM public.kanban_boards kb
  WHERE kb.squad_id = c.squad_id
    AND kb.owner_user_id IS NOT NULL
    AND kb.slug ILIKE 'ads-%'
  ORDER BY kb.created_at ASC
  LIMIT 1
)
WHERE c.assigned_ads_manager IS NULL
  AND c.squad_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.kanban_boards kb
    WHERE kb.squad_id = c.squad_id
      AND kb.owner_user_id IS NOT NULL
      AND kb.slug ILIKE 'ads-%'
  );
