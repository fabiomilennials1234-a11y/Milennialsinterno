
-- Add SELECT policy for ads_tasks so that specific roles can view all tasks to check for delays
CREATE POLICY "Authorized roles can view all ads tasks for monitoring"
ON public.ads_tasks
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'sucesso_cliente')
  )
);
