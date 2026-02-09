-- Drop and recreate the INSERT policy for churn_notifications to include CEO
DROP POLICY IF EXISTS "Financeiro and Gestor Projetos can insert churn notifications" ON public.churn_notifications;

CREATE POLICY "Authorized roles can insert churn notifications"
ON public.churn_notifications
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('financeiro', 'gestor_projetos', 'ceo')
  )
);

-- Create a new UPDATE policy to allow Gestor de ADS to update their assigned clients (for archiving)
CREATE POLICY "Ads Manager can update assigned clients"
ON public.clients
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'gestor_ads'
  )
  AND assigned_ads_manager = auth.uid()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'gestor_ads'
  )
  AND assigned_ads_manager = auth.uid()
);