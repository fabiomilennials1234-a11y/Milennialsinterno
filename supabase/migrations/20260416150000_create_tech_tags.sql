-- 20260416150000_create_tech_tags.sql
-- Tag system for Milennials Tech tasks.
-- Tags are scoped to this feature only. Only executives can create/delete tags.

BEGIN;

-- Tags table
CREATE TABLE public.tech_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  color TEXT NOT NULL DEFAULT '#6E6E7A' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tech_tags_name_unique UNIQUE (name)
);

ALTER TABLE public.tech_tags ENABLE ROW LEVEL SECURITY;

-- Junction table
CREATE TABLE public.tech_task_tags (
  task_id UUID NOT NULL REFERENCES public.tech_tasks(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tech_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

ALTER TABLE public.tech_task_tags ENABLE ROW LEVEL SECURITY;

-- RLS: anyone with tech access can read
CREATE POLICY "tech_tags_select" ON public.tech_tags
  FOR SELECT USING (public.can_see_tech(auth.uid()));

CREATE POLICY "tech_task_tags_select" ON public.tech_task_tags
  FOR SELECT USING (public.can_see_tech(auth.uid()));

-- RLS: only executives can create/delete tags
CREATE POLICY "tech_tags_insert" ON public.tech_tags
  FOR INSERT WITH CHECK (public.is_executive(auth.uid()));

CREATE POLICY "tech_tags_delete" ON public.tech_tags
  FOR DELETE USING (public.is_executive(auth.uid()));

-- RLS: executives can manage tag assignments, or task assignee/collaborator
CREATE POLICY "tech_task_tags_insert" ON public.tech_task_tags
  FOR INSERT WITH CHECK (
    public.is_executive(auth.uid())
    OR public.tech_can_edit_task(task_id)
  );

CREATE POLICY "tech_task_tags_delete" ON public.tech_task_tags
  FOR DELETE USING (
    public.is_executive(auth.uid())
    OR public.tech_can_edit_task(task_id)
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tech_tags, public.tech_task_tags;

COMMIT;
