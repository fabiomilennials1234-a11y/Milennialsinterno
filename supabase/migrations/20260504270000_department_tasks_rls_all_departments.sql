-- 20260504270000_department_tasks_rls_all_departments.sql
--
-- Bug: SELECT/UPDATE/DELETE visao total policies only covered 7 departments.
-- Missing: gestor_ads, design, editor_video, devs, produtora, consultor_comercial.
-- Users with these roles (or page_grant for these pages) could not see team tasks.
--
-- Fix: recreate all three visao total policies with ALL 13 departments.
-- Mapa department -> slug:
--   gestor_crm          -> gestor-crm
--   consultor_mktplace  -> consultor-mktplace
--   financeiro          -> financeiro
--   gestor_projetos     -> gestor-projetos
--   rh                  -> rh
--   sucesso_cliente     -> sucesso-cliente
--   outbound            -> outbound
--   gestor_ads          -> gestor-ads
--   design              -> design
--   editor_video        -> editor-video
--   devs                -> devs
--   produtora           -> produtora
--   consultor_comercial -> consultor-comercial

BEGIN;

-- ==================== SELECT ====================
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
    OR (department = 'gestor_ads'         AND (public.has_role(auth.uid(), 'gestor_ads'::user_role)         OR public.can_access_page_data(auth.uid(), 'gestor-ads')))
    OR (department = 'design'             AND (public.has_role(auth.uid(), 'design'::user_role)             OR public.can_access_page_data(auth.uid(), 'design')))
    OR (department = 'editor_video'       AND (public.has_role(auth.uid(), 'editor_video'::user_role)       OR public.can_access_page_data(auth.uid(), 'editor-video')))
    OR (department = 'devs'               AND (public.has_role(auth.uid(), 'devs'::user_role)               OR public.can_access_page_data(auth.uid(), 'devs')))
    OR (department = 'produtora'          AND (public.has_role(auth.uid(), 'produtora'::user_role)          OR public.can_access_page_data(auth.uid(), 'produtora')))
    OR (department = 'consultor_comercial' AND (public.has_role(auth.uid(), 'consultor_comercial'::user_role) OR public.can_access_page_data(auth.uid(), 'consultor-comercial')))
  );

-- ==================== UPDATE ====================
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
    OR (department = 'gestor_ads'         AND (public.has_role(auth.uid(), 'gestor_ads'::user_role)         OR public.can_access_page_data(auth.uid(), 'gestor-ads')))
    OR (department = 'design'             AND (public.has_role(auth.uid(), 'design'::user_role)             OR public.can_access_page_data(auth.uid(), 'design')))
    OR (department = 'editor_video'       AND (public.has_role(auth.uid(), 'editor_video'::user_role)       OR public.can_access_page_data(auth.uid(), 'editor-video')))
    OR (department = 'devs'               AND (public.has_role(auth.uid(), 'devs'::user_role)               OR public.can_access_page_data(auth.uid(), 'devs')))
    OR (department = 'produtora'          AND (public.has_role(auth.uid(), 'produtora'::user_role)          OR public.can_access_page_data(auth.uid(), 'produtora')))
    OR (department = 'consultor_comercial' AND (public.has_role(auth.uid(), 'consultor_comercial'::user_role) OR public.can_access_page_data(auth.uid(), 'consultor-comercial')))
  );

-- ==================== DELETE ====================
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
    OR (department = 'gestor_ads'         AND (public.has_role(auth.uid(), 'gestor_ads'::user_role)         OR public.can_access_page_data(auth.uid(), 'gestor-ads')))
    OR (department = 'design'             AND (public.has_role(auth.uid(), 'design'::user_role)             OR public.can_access_page_data(auth.uid(), 'design')))
    OR (department = 'editor_video'       AND (public.has_role(auth.uid(), 'editor_video'::user_role)       OR public.can_access_page_data(auth.uid(), 'editor-video')))
    OR (department = 'devs'               AND (public.has_role(auth.uid(), 'devs'::user_role)               OR public.can_access_page_data(auth.uid(), 'devs')))
    OR (department = 'produtora'          AND (public.has_role(auth.uid(), 'produtora'::user_role)          OR public.can_access_page_data(auth.uid(), 'produtora')))
    OR (department = 'consultor_comercial' AND (public.has_role(auth.uid(), 'consultor_comercial'::user_role) OR public.can_access_page_data(auth.uid(), 'consultor-comercial')))
  );

COMMIT;
