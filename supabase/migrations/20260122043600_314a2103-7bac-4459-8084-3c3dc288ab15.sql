-- Add contract expiration date to financeiro_active_clients
ALTER TABLE public.financeiro_active_clients 
ADD COLUMN IF NOT EXISTS contract_expires_at DATE;

-- Add index for efficient querying of expiring contracts
CREATE INDEX IF NOT EXISTS idx_financeiro_active_clients_expires 
ON public.financeiro_active_clients(contract_expires_at);