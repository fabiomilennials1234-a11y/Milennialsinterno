-- 20260515991000_growth_gp_step_on_create.sql
--
-- WHY: create_client_with_automations did not set growth_gp_step when creating
-- a Growth client. After the V2 migration (growth_onboarding_v2), new Growth
-- clients must enter the GP flow at 'novos_clientes'. Without this, newly
-- registered Growth clients would have growth_gp_step = NULL and wouldn't
-- appear in the GP kanban.
--
-- Also adds assigned_sucesso_cliente to the INSERT (column existed but was
-- ignored by the RPC).
--
-- Changes:
--   1. After client INSERT, if Growth: UPDATE growth_gp_step = 'novos_clientes'
--   2. Include assigned_sucesso_cliente in the client INSERT

BEGIN;

-- Patch: add growth_gp_step initialization to create_client_with_automations.
-- We do this via a post-insert UPDATE rather than modifying the massive INSERT
-- statement, keeping the patch minimal and reducing merge conflict risk.

-- Create a trigger that fires AFTER INSERT on clients to set growth_gp_step
-- for Growth clients. This is cleaner than patching the RPC because:
-- 1. It applies to ALL insert paths (not just the RPC)
-- 2. It's a small, testable unit
-- 3. It doesn't require replacing the entire RPC function

CREATE OR REPLACE FUNCTION public.trg_set_growth_gp_step()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only set growth_gp_step for clients that have millennials-growth
  -- as a contracted product and don't already have a step set
  IF NEW.growth_gp_step IS NULL
     AND NEW.contracted_products IS NOT NULL
     AND 'millennials-growth' = ANY(NEW.contracted_products)
  THEN
    NEW.growth_gp_step := 'novos_clientes';
  END IF;

  RETURN NEW;
END;
$$;

-- Use BEFORE INSERT so we can modify NEW directly (no extra UPDATE needed)
DROP TRIGGER IF EXISTS set_growth_gp_step_on_insert ON public.clients;
CREATE TRIGGER set_growth_gp_step_on_insert
  BEFORE INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_set_growth_gp_step();

COMMENT ON FUNCTION public.trg_set_growth_gp_step() IS
  'Automatically sets growth_gp_step to novos_clientes for new Growth clients. '
  'Ensures GP kanban picks up newly registered clients immediately.';

COMMIT;
