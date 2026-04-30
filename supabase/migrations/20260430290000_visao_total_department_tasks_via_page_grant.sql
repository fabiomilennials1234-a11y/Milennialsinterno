-- 20260430290000_visao_total_department_tasks_via_page_grant.sql
--
-- Estende SELECT de department_tasks: usuário com page_grant ativo na página
-- correspondente ao department vê os mesmos dados que o role nativo.
-- Princípio: page_grant = visão total daquela página (igual ao role).
--
-- Mapa department -> slug:
--   gestor_crm          -> gestor-crm
--   consultor_mktplace  -> consultor-mktplace
--   financeiro          -> financeiro
--   gestor_projetos     -> gestor-projetos
--   rh                  -> rh
--   sucesso_cliente     -> sucesso-cliente
--   outbound            -> outbound

DROP POLICY IF EXISTS department_tasks_select_visao_total ON public.department_tasks;

CREATE POLICY department_tasks_select_visao_total ON public.department_tasks
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR (department = 'gestor_crm'         AND (public.has_role(auth.uid(), 'gestor_crm'::user_role)         OR public.can_access_page_data(auth.uid(), 'gestor-crm')))
    OR (department = 'consultor_mktplace' AND (public.has_role(auth.uid(), 'consultor_mktplace'::user_role) OR public.can_access_page_data(auth.uid(), 'consultor-mktplace')))
    OR (department = 'financeiro'         AND (public.has_role(auth.uid(), 'financeiro'::user_role)         OR public.can_access_page_data(auth.uid(), 'financeiro')))
    OR (department = 'gestor_projetos'    AND (public.has_role(auth.uid(), 'gestor_projetos'::user_role)    OR public.can_access_page_data(auth.uid(), 'gestor-projetos')))
    OR (department = 'rh'                 AND (public.has_role(auth.uid(), 'rh'::user_role)                 OR public.can_access_page_data(auth.uid(), 'rh')))
    OR (department = 'sucesso_cliente'    AND (public.has_role(auth.uid(), 'sucesso_cliente'::user_role)    OR public.can_access_page_data(auth.uid(), 'sucesso-cliente')))
    OR (department = 'outbound'           AND (public.has_role(auth.uid(), 'outbound'::user_role)           OR public.can_access_page_data(auth.uid(), 'outbound')))
  );
