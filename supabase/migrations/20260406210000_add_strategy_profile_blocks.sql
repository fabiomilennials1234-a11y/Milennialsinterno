-- Add profile assessment blocks to client_strategies
ALTER TABLE public.client_strategies ADD COLUMN IF NOT EXISTS profile_bio jsonb;
ALTER TABLE public.client_strategies ADD COLUMN IF NOT EXISTS profile_destaques jsonb;
ALTER TABLE public.client_strategies ADD COLUMN IF NOT EXISTS profile_posts jsonb;
ALTER TABLE public.client_strategies ADD COLUMN IF NOT EXISTS profile_lp_site jsonb;
