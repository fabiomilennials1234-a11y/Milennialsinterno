-- Feature 10: Fix department_tasks INSERT policy
-- Bug: INSERT policy only checks has_role() but SELECT/UPDATE/DELETE also check can_access_page_data()
-- Fix: Align INSERT WITH CHECK to match the pattern used by other policies

DROP POLICY IF EXISTS "department_tasks_insert_cross_role" ON department_tasks;

CREATE POLICY "department_tasks_insert_cross_role" ON department_tasks
  FOR INSERT
  WITH CHECK (
    (user_id = auth.uid())
    OR is_admin(auth.uid())
    OR (department = 'gestor_crm'        AND (has_role(auth.uid(), 'gestor_crm'::user_role)        OR can_access_page_data(auth.uid(), 'gestor-crm'::text)))
    OR (department = 'consultor_mktplace' AND (has_role(auth.uid(), 'consultor_mktplace'::user_role) OR can_access_page_data(auth.uid(), 'consultor-mktplace'::text)))
    OR (department = 'financeiro'         AND (has_role(auth.uid(), 'financeiro'::user_role)         OR can_access_page_data(auth.uid(), 'financeiro'::text)))
    OR (department = 'gestor_projetos'    AND (has_role(auth.uid(), 'gestor_projetos'::user_role)    OR can_access_page_data(auth.uid(), 'gestor-projetos'::text)))
    OR (department = 'rh'                 AND (has_role(auth.uid(), 'rh'::user_role)                 OR can_access_page_data(auth.uid(), 'rh'::text)))
    OR (department = 'sucesso_cliente'    AND (has_role(auth.uid(), 'sucesso_cliente'::user_role)    OR can_access_page_data(auth.uid(), 'sucesso-cliente'::text)))
    OR (department = 'outbound'           AND (has_role(auth.uid(), 'outbound'::user_role)           OR can_access_page_data(auth.uid(), 'outbound'::text)))
    OR (department = 'gestor_ads'         AND (has_role(auth.uid(), 'gestor_ads'::user_role)         OR can_access_page_data(auth.uid(), 'gestor-ads'::text)))
    OR (department = 'design'             AND (has_role(auth.uid(), 'design'::user_role)             OR can_access_page_data(auth.uid(), 'design'::text)))
    OR (department = 'editor_video'       AND (has_role(auth.uid(), 'editor_video'::user_role)       OR can_access_page_data(auth.uid(), 'editor-video'::text)))
    OR (department = 'devs'               AND (has_role(auth.uid(), 'devs'::user_role)               OR can_access_page_data(auth.uid(), 'devs'::text)))
    OR (department = 'produtora'          AND (has_role(auth.uid(), 'produtora'::user_role)          OR can_access_page_data(auth.uid(), 'produtora'::text)))
    OR (department = 'consultor_comercial' AND (has_role(auth.uid(), 'consultor_comercial'::user_role) OR can_access_page_data(auth.uid(), 'consultor-comercial'::text)))
  );
