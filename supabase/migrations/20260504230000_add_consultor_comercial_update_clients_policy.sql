-- 20260504230000_add_consultor_comercial_update_clients_policy.sql
--
-- BUG FIX: consultor_comercial had SELECT-only access on `clients` but the
-- Paddock onboarding automation (frontend) updates `comercial_status`,
-- `paddock_onboarding_step`, and `comercial_onboarding_started_at` after task
-- completion. Without an UPDATE policy, these writes were silently blocked by
-- RLS, keeping the client stuck at comercial_status='novo'. This caused an
-- infinite loop: useAutoCreateTasksForNewClients kept re-creating the
-- "Marcar alinhamento inicial" task because the dedup check only looked for
-- non-done tasks, and the completed task didn't advance the client.
--
-- Fix: grant UPDATE on clients to consultor_comercial, scoped to their own
-- assigned clients (assigned_comercial = auth.uid()). Only the columns needed
-- for the Paddock flow are mutated — RLS doesn't restrict columns, but the
-- scope restriction ensures a consultor can't touch other consultors' clients.

DROP POLICY IF EXISTS "Consultor Comercial can update assigned clients" ON public.clients;

CREATE POLICY "Consultor Comercial can update assigned clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'consultor_comercial'::user_role)
    AND assigned_comercial = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'consultor_comercial'::user_role)
    AND assigned_comercial = auth.uid()
  );

COMMENT ON POLICY "Consultor Comercial can update assigned clients" ON public.clients IS
  'Allows consultor_comercial to update their assigned clients. Required for Paddock onboarding automation (comercial_status, paddock_onboarding_step transitions). Scoped to assigned_comercial = auth.uid().';
