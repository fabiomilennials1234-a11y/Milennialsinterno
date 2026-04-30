-- 20260430260000_backfill_task_ownership_and_dept_visao_total.sql
--
-- Bug: tarefas auto-geradas pra clientes ficaram com user_id = CEO em vez do
-- consultor/gestor real responsável pelo cliente. Resultado: o consultor não
-- enxergava as próprias tarefas (RLS filtra por user_id), enquanto o CEO via
-- 87 comercial_tasks + 134 department_tasks que não eram dele.
--
-- Frontend (Fase A+B) já foi corrigido pra que novas auto-gerações usem o
-- assignee correto. Esta migration cobre o backlog histórico:
--   C — backfill de user_id pra refletir clients.assigned_<role>
--   D — policy SELECT "visao_total" em department_tasks análoga à de
--       comercial_tasks, como defesa em profundidade pra rows órfãos
--       (related_client_id IS NULL) e categorias sem assignee 1:1
--       (financeiro/gestor_projetos/rh/etc).
--
-- Snapshots pré-aplicação salvos em /tmp/task_backfill_preview_20260430_*.json
-- pra reversibilidade manual.

BEGIN;

-- ── C ── Backfill de ownership ──────────────────────────────────────────

-- comercial_tasks: tarefa auto-gerada de cliente → consultor responsável
UPDATE public.comercial_tasks ct
   SET user_id = c.assigned_comercial,
       updated_at = NOW()
  FROM public.clients c
 WHERE ct.related_client_id = c.id
   AND c.assigned_comercial IS NOT NULL
   AND ct.user_id <> c.assigned_comercial
   AND ct.is_auto_generated = TRUE;

-- department_tasks gestor_crm
UPDATE public.department_tasks dt
   SET user_id = c.assigned_crm,
       updated_at = NOW()
  FROM public.clients c
 WHERE dt.related_client_id = c.id
   AND dt.department = 'gestor_crm'
   AND c.assigned_crm IS NOT NULL
   AND dt.user_id <> c.assigned_crm;

-- department_tasks consultor_mktplace
-- clients.assigned_mktplace é TEXT (não uuid) — só atualiza quando valor é uuid válido.
UPDATE public.department_tasks dt
   SET user_id = c.assigned_mktplace::uuid,
       updated_at = NOW()
  FROM public.clients c
 WHERE dt.related_client_id = c.id
   AND dt.department = 'consultor_mktplace'
   AND c.assigned_mktplace IS NOT NULL
   AND c.assigned_mktplace ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   AND dt.user_id <> c.assigned_mktplace::uuid;

-- financeiro: sem assignee 1:1 em clients (é team-level). Pula no backfill,
-- fica coberto pela policy abaixo via has_role(financeiro).

-- ── D ── Policy SELECT visao_total pra department_tasks ─────────────────
-- Mesmo pattern de comercial_tasks_select_visao_total: dono direto,
-- admin (is_admin), ou portador do papel correspondente ao department.

DROP POLICY IF EXISTS "Users can view their own department tasks" ON public.department_tasks;
DROP POLICY IF EXISTS department_tasks_select_visao_total ON public.department_tasks;

CREATE POLICY department_tasks_select_visao_total
  ON public.department_tasks
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR (department = 'gestor_crm'         AND public.has_role(auth.uid(), 'gestor_crm'::public.user_role))
    OR (department = 'consultor_mktplace' AND public.has_role(auth.uid(), 'consultor_mktplace'::public.user_role))
    OR (department = 'financeiro'         AND public.has_role(auth.uid(), 'financeiro'::public.user_role))
    OR (department = 'gestor_projetos'    AND public.has_role(auth.uid(), 'gestor_projetos'::public.user_role))
    OR (department = 'rh'                 AND public.has_role(auth.uid(), 'rh'::public.user_role))
    OR (department = 'sucesso_cliente'    AND public.has_role(auth.uid(), 'sucesso_cliente'::public.user_role))
    OR (department = 'outbound'           AND public.has_role(auth.uid(), 'outbound'::public.user_role))
  );

COMMIT;
