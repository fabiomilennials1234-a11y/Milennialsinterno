-- Add quantidade_vagas field to rh_vaga_briefings table
ALTER TABLE public.rh_vaga_briefings 
ADD COLUMN IF NOT EXISTS quantidade_vagas INTEGER NOT NULL DEFAULT 1;