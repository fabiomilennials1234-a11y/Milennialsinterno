-- =============================================
-- Allow 'doing' status in financeiro_tasks
-- so Tarefas Diárias can track the "Fazendo" column
-- =============================================

ALTER TABLE public.financeiro_tasks DROP CONSTRAINT IF EXISTS financeiro_tasks_status_check;
ALTER TABLE public.financeiro_tasks ADD CONSTRAINT financeiro_tasks_status_check CHECK (status IN ('pending', 'doing', 'done'));
