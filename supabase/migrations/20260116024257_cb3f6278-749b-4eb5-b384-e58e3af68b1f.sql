-- Add justification field to onboarding_tasks
ALTER TABLE public.onboarding_tasks ADD COLUMN IF NOT EXISTS justification TEXT;
ALTER TABLE public.onboarding_tasks ADD COLUMN IF NOT EXISTS justification_at TIMESTAMP WITH TIME ZONE;

-- Add justification field to department_tasks
ALTER TABLE public.department_tasks ADD COLUMN IF NOT EXISTS justification TEXT;
ALTER TABLE public.department_tasks ADD COLUMN IF NOT EXISTS justification_at TIMESTAMP WITH TIME ZONE;

-- Add justification field to ads_tasks
ALTER TABLE public.ads_tasks ADD COLUMN IF NOT EXISTS justification TEXT;
ALTER TABLE public.ads_tasks ADD COLUMN IF NOT EXISTS justification_at TIMESTAMP WITH TIME ZONE;

-- Add justification field to kanban_cards for general kanban tasks
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS justification TEXT;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS justification_at TIMESTAMP WITH TIME ZONE;