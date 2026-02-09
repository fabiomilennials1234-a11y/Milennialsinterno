-- Add automation fields to rh_tarefas table
ALTER TABLE public.rh_tarefas 
ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN public.rh_tarefas.tipo IS 'Task type: manual, registrar_vaga, publicar_anuncio';
COMMENT ON COLUMN public.rh_tarefas.completed_at IS 'Timestamp when task was completed';