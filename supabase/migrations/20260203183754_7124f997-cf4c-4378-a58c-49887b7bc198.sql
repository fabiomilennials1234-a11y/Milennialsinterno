-- Add 'area' column to financeiro_contas_pagar table
ALTER TABLE public.financeiro_contas_pagar
ADD COLUMN IF NOT EXISTS area TEXT DEFAULT NULL;

-- Add 'area' column to financeiro_contas_receber table (for tracking which area the revenue is tied to)
ALTER TABLE public.financeiro_contas_receber
ADD COLUMN IF NOT EXISTS area TEXT DEFAULT NULL;

-- Add comment to document the allowed values
COMMENT ON COLUMN public.financeiro_contas_pagar.area IS 'Business area: Financeiro, RH, Comercial, Operacional, Marketing interno';
COMMENT ON COLUMN public.financeiro_contas_receber.area IS 'Business area: Financeiro, RH, Comercial, Operacional, Marketing interno';