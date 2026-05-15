-- Fix Bug 10: gestor_crm (and other department owners) cannot delete
-- their own department tasks. The previous DELETE policy only allowed
-- executives and sucesso_cliente. Align with the UPDATE policy pattern
-- so each department role can delete tasks in their own department.

BEGIN;

DROP POLICY IF EXISTS "department_tasks_delete_exec_or_sucesso" ON department_tasks;

CREATE POLICY "department_tasks_delete_by_dept_owner"
  ON department_tasks FOR DELETE
  USING (
    -- Owner can always delete their own tasks
    user_id = auth.uid()
    -- Admin bypass
    OR is_admin(auth.uid())
    -- Department-scoped: same pattern as the UPDATE policy
    OR (department = 'gestor_crm'       AND (has_role(auth.uid(), 'gestor_crm')       OR can_access_page_data(auth.uid(), 'gestor-crm')))
    OR (department = 'consultor_mktplace' AND (has_role(auth.uid(), 'consultor_mktplace') OR can_access_page_data(auth.uid(), 'consultor-mktplace')))
    OR (department = 'financeiro'        AND (has_role(auth.uid(), 'financeiro')        OR can_access_page_data(auth.uid(), 'financeiro')))
    OR (department = 'gestor_projetos'   AND (has_role(auth.uid(), 'gestor_projetos')   OR can_access_page_data(auth.uid(), 'gestor-projetos')))
    OR (department = 'rh'               AND (has_role(auth.uid(), 'rh')               OR can_access_page_data(auth.uid(), 'rh')))
    OR (department = 'sucesso_cliente'   AND (has_role(auth.uid(), 'sucesso_cliente')   OR can_access_page_data(auth.uid(), 'sucesso-cliente')))
    OR (department = 'outbound'         AND (has_role(auth.uid(), 'outbound')         OR can_access_page_data(auth.uid(), 'outbound')))
    OR (department = 'gestor_ads'       AND (has_role(auth.uid(), 'gestor_ads')       OR can_access_page_data(auth.uid(), 'gestor-ads')))
    OR (department = 'design'           AND (has_role(auth.uid(), 'design')           OR can_access_page_data(auth.uid(), 'design')))
    OR (department = 'editor_video'     AND (has_role(auth.uid(), 'editor_video')     OR can_access_page_data(auth.uid(), 'editor-video')))
    OR (department = 'devs'             AND (has_role(auth.uid(), 'devs')             OR can_access_page_data(auth.uid(), 'devs')))
    OR (department = 'produtora'        AND (has_role(auth.uid(), 'produtora')        OR can_access_page_data(auth.uid(), 'produtora')))
    OR (department = 'consultor_comercial' AND (has_role(auth.uid(), 'consultor_comercial') OR can_access_page_data(auth.uid(), 'consultor-comercial')))
  );

COMMIT;
