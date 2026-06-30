-- #169.1 — Escrita uniforme do vinculo issue<->epic via RPC dedicada.
--
-- Problema: tech_issue_update faz `epic_id = COALESCE(p_epic_id, epic_id)`, entao
-- p_epic_id = NULL NUNCA limpa (mantem o epic atual). A UI precisava DESVINCULAR,
-- e ate aqui isso era um UPDATE direto na tabela no client (dois caminhos de
-- escrita pro mesmo campo). Esta RPC unifica: atribuicao INCONDICIONAL de epic_id
-- (valor seta/troca, NULL limpa). "Setar epic" e verbo de dominio proprio ->
-- RPC com responsabilidade unica, em vez de uma flag no tech_issue_update.
--
-- Autoridade identica ao tech_issue_update: tech_assert_staff + (quando epic NAO
-- nulo) o epic tem que pertencer ao MESMO project da issue. Sub-task nao tem epic.

CREATE OR REPLACE FUNCTION public.tech_issue_set_epic(
  p_issue_id uuid,
  p_epic_id  uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_parent  uuid;
  v_project uuid;
BEGIN
  PERFORM public.tech_assert_staff();

  SELECT parent_id, project_id INTO v_parent, v_project
    FROM public.tech_tasks WHERE id = p_issue_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'issue nao existe' USING ERRCODE = '23503';
  END IF;

  -- Sub-task nunca carrega epic; so barra a tentativa de SETAR (clear e inocuo).
  IF v_parent IS NOT NULL AND p_epic_id IS NOT NULL THEN
    RAISE EXCEPTION 'subtask nao tem epic' USING ERRCODE = '23514';
  END IF;

  -- Epic so vale se for do mesmo project da issue.
  IF p_epic_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.tech_epics
                     WHERE id = p_epic_id AND project_id = v_project) THEN
    RAISE EXCEPTION 'epic_id invalido' USING ERRCODE = '23503';
  END IF;

  UPDATE public.tech_tasks SET epic_id = p_epic_id WHERE id = p_issue_id;
END $$;

-- Privilegios: nunca anon. REVOKE de PUBLIC e de anon (o grant implicito do
-- ALTER DEFAULT PRIVILEGES nao some so com REVOKE FROM PUBLIC — ver migration
-- 20260625140000), depois GRANT so a authenticated.
REVOKE ALL ON FUNCTION public.tech_issue_set_epic(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tech_issue_set_epic(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.tech_issue_set_epic(uuid, uuid) TO authenticated;
