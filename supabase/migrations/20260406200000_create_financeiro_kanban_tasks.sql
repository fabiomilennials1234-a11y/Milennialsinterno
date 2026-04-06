-- Create financeiro kanban tasks table
CREATE TABLE IF NOT EXISTS public.financeiro_kanban_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
  position integer NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.financeiro_kanban_tasks ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to CRUD (financeiro-only access enforced in frontend)
CREATE POLICY "Allow all operations for authenticated users" ON public.financeiro_kanban_tasks
  FOR ALL USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER set_updated_at
  BEFORE UPDATE ON public.financeiro_kanban_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
