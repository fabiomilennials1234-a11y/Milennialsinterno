-- Add finance_display_name column to clients table (visual-only name for financial module)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS finance_display_name text;
