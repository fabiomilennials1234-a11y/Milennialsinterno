-- Fix: treinador comercial (consultor_comercial) blocked from saving client_call_forms.
-- Root cause: only admin and assigned_ads_manager had RLS access.
-- This policy covers ALL assigned roles on a client, avoiding per-role policy sprawl.

CREATE POLICY "Assigned role can manage client call forms"
  ON public.client_call_forms
  FOR ALL
  USING (
    client_id IN (
      SELECT c.id
      FROM public.clients c
      WHERE c.assigned_comercial        = auth.uid()
         OR c.assigned_sucesso_cliente   = auth.uid()
         OR c.assigned_crm              = auth.uid()
         OR c.assigned_outbound_manager  = auth.uid()
    )
  );
