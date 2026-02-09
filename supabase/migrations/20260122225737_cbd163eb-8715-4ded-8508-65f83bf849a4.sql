-- Update rh_candidatos table to have proper candidate workflow statuses
-- Add position column for ordering within each status

ALTER TABLE public.rh_candidatos
ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- Create index for better performance on candidate queries
CREATE INDEX IF NOT EXISTS idx_rh_candidatos_vaga_status ON public.rh_candidatos(vaga_id, status);

-- Update default status values to match the new workflow
-- The statuses will be: aplicados, abordados, descartado, entrevista_marcada, entrevista_feita, negociando, selecionando, viaveis, futuro, arquivados

COMMENT ON TABLE public.rh_candidatos IS 'Candidates for each job vacancy, with their own Kanban workflow within the vacancy';