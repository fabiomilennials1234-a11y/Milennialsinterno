-- Add distrato_step column to track the distrato workflow
-- Steps: 'churn_solicitado', 'cobranca_retirada', 'distrato_enviado', 'churn_sem_distrato'
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS distrato_step TEXT DEFAULT NULL;

-- Add distrato_entered_at to track when client entered distrato flow
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS distrato_entered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_clients_distrato_step ON public.clients(distrato_step) WHERE distrato_step IS NOT NULL;