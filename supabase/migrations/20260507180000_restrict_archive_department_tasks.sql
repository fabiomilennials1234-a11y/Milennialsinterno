-- Restrict archiving of department_tasks to executives (CEO/CTO) + sucesso_cliente
-- Same permission model as DELETE policy: department_tasks_delete_exec_or_sucesso

CREATE OR REPLACE FUNCTION guard_department_task_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when archived is actually changing to true
  IF NEW.archived IS DISTINCT FROM OLD.archived AND NEW.archived = true THEN
    IF NOT (is_executive(auth.uid()) OR has_role(auth.uid(), 'sucesso_cliente'::user_role)) THEN
      RAISE EXCEPTION 'Somente CEO, CTO ou Sucesso do Cliente podem arquivar tarefas'
        USING ERRCODE = '42501'; -- insufficient_privilege
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_department_task_archive
  BEFORE UPDATE ON department_tasks
  FOR EACH ROW
  EXECUTE FUNCTION guard_department_task_archive();
