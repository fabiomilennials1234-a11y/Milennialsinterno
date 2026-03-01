-- =============================================
-- FINANCEIRO TASKS: Tarefas por produto para Novo Cliente
-- =============================================

-- 1. Add contract_duration_months to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contract_duration_months INTEGER;

-- 2. Create financeiro_tasks table (one task per product per client)
CREATE TABLE IF NOT EXISTS public.financeiro_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  product_slug TEXT NOT NULL,
  product_name TEXT NOT NULL,
  title TEXT NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_financeiro_tasks_client_id ON public.financeiro_tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_tasks_status ON public.financeiro_tasks(status);
CREATE INDEX IF NOT EXISTS idx_financeiro_tasks_client_status ON public.financeiro_tasks(client_id, status);

-- 3. Enable RLS
ALTER TABLE public.financeiro_tasks ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for financeiro, gestor_projetos, ceo
CREATE POLICY "financeiro_tasks_select"
  ON public.financeiro_tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('financeiro', 'gestor_projetos', 'ceo')
    )
  );

CREATE POLICY "financeiro_tasks_insert"
  ON public.financeiro_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('financeiro', 'gestor_projetos', 'ceo')
    )
  );

CREATE POLICY "financeiro_tasks_update"
  ON public.financeiro_tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('financeiro', 'gestor_projetos', 'ceo')
    )
  );

CREATE POLICY "financeiro_tasks_delete"
  ON public.financeiro_tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('financeiro', 'gestor_projetos', 'ceo')
    )
  );

-- 5. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.financeiro_tasks;
