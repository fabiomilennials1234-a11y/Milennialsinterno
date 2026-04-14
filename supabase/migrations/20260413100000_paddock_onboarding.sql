-- Paddock Onboarding: add columns to clients table for 9-step onboarding flow
-- and diagnostic 30-day cycle tracking for Treinador Comercial

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS paddock_onboarding_step TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS paddock_diagnostico_link TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS paddock_diagnostico_submitted_at TIMESTAMPTZ;

-- Index for querying clients by onboarding step
CREATE INDEX IF NOT EXISTS idx_clients_paddock_onboarding_step ON public.clients(paddock_onboarding_step) WHERE paddock_onboarding_step IS NOT NULL;
