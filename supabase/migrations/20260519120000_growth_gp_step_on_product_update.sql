-- 20260519120000_growth_gp_step_on_product_update.sql
--
-- WHY: The trigger trg_set_growth_gp_step only fires on INSERT. If contracted_products
-- is updated post-creation to include 'millennials-growth', growth_gp_step stays NULL
-- and the client never appears in the GP kanban. This migration:
--
--   1. Extends the trigger function to also handle UPDATE (when contracted_products
--      gains 'millennials-growth' and growth_gp_step is still NULL).
--   2. Adds a BEFORE UPDATE trigger binding on clients.
--   3. Backfills any existing clients that have the product but no step set.

BEGIN;

-- =============================================================================
-- 1. EXTEND TRIGGER FUNCTION: handle both INSERT and UPDATE
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_set_growth_gp_step()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set growth_gp_step when millennials-growth is present and step is NULL.
  -- Works for both INSERT (new client) and UPDATE (product added post-creation).
  IF NEW.growth_gp_step IS NULL
     AND NEW.contracted_products IS NOT NULL
     AND 'millennials-growth' = ANY(NEW.contracted_products)
  THEN
    NEW.growth_gp_step := 'novos_clientes';
    NEW.growth_flow_version := 2;
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 2. ADD BEFORE UPDATE TRIGGER (INSERT trigger already exists)
-- =============================================================================

DROP TRIGGER IF EXISTS set_growth_gp_step_on_update ON public.clients;
CREATE TRIGGER set_growth_gp_step_on_update
  BEFORE UPDATE OF contracted_products ON public.clients
  FOR EACH ROW
  WHEN (NEW.contracted_products IS DISTINCT FROM OLD.contracted_products)
  EXECUTE FUNCTION public.trg_set_growth_gp_step();

-- =============================================================================
-- 3. BACKFILL: clients with growth product but no step
-- =============================================================================

UPDATE public.clients
   SET growth_gp_step = 'novos_clientes',
       growth_flow_version = 2,
       updated_at = now()
 WHERE growth_gp_step IS NULL
   AND contracted_products IS NOT NULL
   AND 'millennials-growth' = ANY(contracted_products)
   AND archived = false;

COMMIT;
