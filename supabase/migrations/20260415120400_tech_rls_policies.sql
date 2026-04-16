-- 20260415120400_tech_rls_policies.sql
-- RLS for Milennials Tech. Read: ceo+cto+devs. Write: see per-table rules.

BEGIN;

-- Helper to check if caller is ceo/cto/devs (SELECT access)
CREATE OR REPLACE FUNCTION public.can_see_tech(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('ceo','cto','devs')
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_see_tech(uuid) TO authenticated;

--
-- tech_sprints
--
CREATE POLICY "tech_sprints_select" ON public.tech_sprints
  FOR SELECT USING (public.can_see_tech(auth.uid()));

CREATE POLICY "tech_sprints_insert" ON public.tech_sprints
  FOR INSERT WITH CHECK (public.is_executive(auth.uid()));

CREATE POLICY "tech_sprints_update" ON public.tech_sprints
  FOR UPDATE USING (public.is_executive(auth.uid()))
  WITH CHECK (public.is_executive(auth.uid()));

CREATE POLICY "tech_sprints_delete" ON public.tech_sprints
  FOR DELETE USING (public.is_executive(auth.uid()));

--
-- tech_tasks
--
CREATE POLICY "tech_tasks_select" ON public.tech_tasks
  FOR SELECT USING (public.can_see_tech(auth.uid()));

CREATE POLICY "tech_tasks_insert" ON public.tech_tasks
  FOR INSERT WITH CHECK (
    public.can_see_tech(auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "tech_tasks_update_exec" ON public.tech_tasks
  FOR UPDATE USING (public.is_executive(auth.uid()))
  WITH CHECK (public.is_executive(auth.uid()));

CREATE POLICY "tech_tasks_update_own" ON public.tech_tasks
  FOR UPDATE USING (
    assignee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tech_task_collaborators c
      WHERE c.task_id = tech_tasks.id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    assignee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tech_task_collaborators c
      WHERE c.task_id = tech_tasks.id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "tech_tasks_delete" ON public.tech_tasks
  FOR DELETE USING (public.is_executive(auth.uid()));

--
-- tech_task_collaborators
--
CREATE POLICY "tech_task_collaborators_select" ON public.tech_task_collaborators
  FOR SELECT USING (public.can_see_tech(auth.uid()));

CREATE POLICY "tech_task_collaborators_write_exec" ON public.tech_task_collaborators
  FOR INSERT WITH CHECK (public.is_executive(auth.uid()));
CREATE POLICY "tech_task_collaborators_delete_exec" ON public.tech_task_collaborators
  FOR DELETE USING (public.is_executive(auth.uid()));

CREATE POLICY "tech_task_collaborators_write_assignee" ON public.tech_task_collaborators
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.tech_tasks t WHERE t.id = task_id AND t.assignee_id = auth.uid())
  );

CREATE POLICY "tech_task_collaborators_delete_assignee" ON public.tech_task_collaborators
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.tech_tasks t WHERE t.id = task_id AND t.assignee_id = auth.uid())
  );

--
-- tech_time_entries (writes via RPC only)
--
CREATE POLICY "tech_time_entries_select" ON public.tech_time_entries
  FOR SELECT USING (public.can_see_tech(auth.uid()));

--
-- tech_task_activities (writes via RPC/trigger only, immutable)
--
CREATE POLICY "tech_task_activities_select" ON public.tech_task_activities
  FOR SELECT USING (public.can_see_tech(auth.uid()));

COMMIT;
