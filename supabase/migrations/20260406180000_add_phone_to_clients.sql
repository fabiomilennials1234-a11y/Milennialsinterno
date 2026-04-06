-- Add phone column to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS phone text;
