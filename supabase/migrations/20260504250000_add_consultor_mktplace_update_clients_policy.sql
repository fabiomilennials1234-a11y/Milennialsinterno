-- 20260504250000_add_consultor_mktplace_update_clients_policy.sql
--
-- BUG FIX: same class as consultor_comercial (migration 20260504230000).
-- consultor_mktplace has SELECT access on `clients` but the MKT Place
-- onboarding automation (useDepartmentTasks + useMktplaceKanban) updates
-- `mktplace_status` after task completion. Without an UPDATE policy these
-- writes are silently blocked by RLS, keeping the client stuck at its
-- current step (typically 'novo'). Clients never advance in the onboarding
-- kanban.
--
-- Fix: grant UPDATE on clients to consultor_mktplace, scoped to their own
-- assigned clients. QUIRK: assigned_mktplace is text (not uuid), so we
-- cast auth.uid() to text for the comparison.

DROP POLICY IF EXISTS "Consultor MKT Place can update assigned clients" ON public.clients;

CREATE POLICY "Consultor MKT Place can update assigned clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'consultor_mktplace'::user_role)
    AND assigned_mktplace = auth.uid()::text
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'consultor_mktplace'::user_role)
    AND assigned_mktplace = auth.uid()::text
  );

COMMENT ON POLICY "Consultor MKT Place can update assigned clients" ON public.clients IS
  'Allows consultor_mktplace to update their assigned clients. Required for MKT Place onboarding automation (mktplace_status transitions). Scoped to assigned_mktplace = auth.uid()::text (text column quirk).';
