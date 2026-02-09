-- Drop existing INSERT policy for churn_notifications
DROP POLICY IF EXISTS "Gestor projetos and CEO can insert churn notifications" ON public.churn_notifications;

-- Create new INSERT policy allowing only financeiro and gestor_projetos
CREATE POLICY "Financeiro and Gestor Projetos can insert churn notifications" 
ON public.churn_notifications 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('financeiro', 'gestor_projetos')
  )
);