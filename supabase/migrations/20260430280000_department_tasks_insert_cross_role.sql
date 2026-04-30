-- Permite roles operacionais inserirem department_tasks para outros users
-- (caso de uso: treinador comercial gera tarefa para gestor de CRM via fluxo do diagnóstico,
-- gestor de CRM gera tarefa em outros departamentos, etc.)
-- Policy SELECT já cobre visibilidade cross-role via has_role + is_admin.

DROP POLICY IF EXISTS "Users can insert their own department tasks" ON public.department_tasks;
DROP POLICY IF EXISTS department_tasks_insert_cross_role ON public.department_tasks;

CREATE POLICY department_tasks_insert_cross_role
  ON public.department_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'consultor_comercial'::user_role)
    OR public.has_role(auth.uid(), 'consultor_mktplace'::user_role)
    OR public.has_role(auth.uid(), 'gestor_crm'::user_role)
    OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)
    OR public.has_role(auth.uid(), 'gestor_ads'::user_role)
    OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)
    OR public.has_role(auth.uid(), 'outbound'::user_role)
    OR public.has_role(auth.uid(), 'rh'::user_role)
    OR public.has_role(auth.uid(), 'financeiro'::user_role)
  );
