-- Allow authorized roles to view justifications by role (for viewing other roles' justifications on their pages)
CREATE POLICY "Authorized roles can view justifications by role"
ON public.ads_task_delay_justifications
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('gestor_ads', 'sucesso_cliente', 'gestor_projetos', 'ceo')
  )
);