-- Restrict churn_notifications visibility to CEO + sucesso_cliente only.
-- Previously 6 roles could see churn alerts; now only CEO and Sucesso do Cliente.

DROP POLICY IF EXISTS "Users with specific roles can view churn notifications"
  ON public.churn_notifications;

CREATE POLICY "Users with specific roles can view churn notifications"
  ON public.churn_notifications
  FOR SELECT
  USING (
    has_role(auth.uid(), 'ceo'::user_role)
    OR has_role(auth.uid(), 'sucesso_cliente'::user_role)
  );
