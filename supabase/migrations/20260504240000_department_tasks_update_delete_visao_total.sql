-- 20260504240000_department_tasks_update_delete_visao_total.sql
--
-- Fix: SELECT policy de department_tasks foi expandida em
-- 20260430290000 para permitir visao total (has_role + page_grant + is_admin),
-- mas UPDATE e DELETE permaneceram restritos a auth.uid() = user_id.
--
-- Resultado: user com visao total enxerga tasks de outros users mas UPDATE/DELETE
-- retornam 0 rows sem erro (comportamento padrao do PostgREST quando RLS bloqueia).
-- O frontend trata como sucesso, invalida cache, refetch mostra task inalterada.
-- Bug visivel: "Feitas 0" — drag-to-done nao persiste.
--
-- Fix: espelhar a mesma logica do SELECT visao_total nas policies UPDATE e DELETE.
-- Mapa department -> slug identico ao SELECT:
--   gestor_crm          -> gestor-crm
--   consultor_mktplace  -> consultor-mktplace
--   financeiro          -> financeiro
--   gestor_projetos     -> gestor-projetos
--   rh                  -> rh
--   sucesso_cliente     -> sucesso-cliente
--   outbound            -> outbound

BEGIN;

-- ==================== UPDATE ====================
-- Drop a policy original restritiva (auth.uid() = user_id only)
DROP POLICY IF EXISTS "Users can update their own department tasks" ON public.department_tasks;
-- Drop caso ja exista (idempotencia)
DROP POLICY IF EXISTS department_tasks_update_visao_total ON public.department_tasks;

CREATE POLICY department_tasks_update_visao_total ON public.department_tasks
  FOR UPDATE
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

-- ==================== DELETE ====================
-- Drop a policy original restritiva
DROP POLICY IF EXISTS "Users can delete their own department tasks" ON public.department_tasks;
-- Drop caso ja exista (idempotencia)
DROP POLICY IF EXISTS department_tasks_delete_visao_total ON public.department_tasks;

CREATE POLICY department_tasks_delete_visao_total ON public.department_tasks
  FOR DELETE
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

COMMIT;
