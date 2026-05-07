-- Guard unarchive: restrict archived=false (desarquivar) to same roles as archive
-- Extends guard_department_task_archive to block BOTH directions

CREATE OR REPLACE FUNCTION guard_department_task_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Fire when archived is actually changing (either direction)
  IF NEW.archived IS DISTINCT FROM OLD.archived THEN
    IF NOT (is_executive(auth.uid()) OR has_role(auth.uid(), 'sucesso_cliente'::user_role)) THEN
      IF NEW.archived = true THEN
        RAISE EXCEPTION 'Somente CEO, CTO ou Sucesso do Cliente podem arquivar tarefas'
          USING ERRCODE = '42501';
      ELSE
        RAISE EXCEPTION 'Somente CEO, CTO ou Sucesso do Cliente podem desarquivar tarefas'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger already exists (trg_guard_department_task_archive) — no need to recreate.
-- CREATE OR REPLACE FUNCTION replaces the function body in-place.
