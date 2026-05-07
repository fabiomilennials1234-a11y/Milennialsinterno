-- Restringe DELETE em department_tasks a CEO, CTO e Sucesso do Cliente.
-- Antes: qualquer owner ou role de departamento podia deletar.
-- Agora: apenas executivos (CEO/CTO) e sucesso_cliente.

DROP POLICY IF EXISTS "department_tasks_delete_visao_total" ON public.department_tasks;

CREATE POLICY "department_tasks_delete_exec_or_sucesso"
  ON public.department_tasks
  FOR DELETE
  TO authenticated
  USING (
    public.is_executive(auth.uid())
    OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)
  );
