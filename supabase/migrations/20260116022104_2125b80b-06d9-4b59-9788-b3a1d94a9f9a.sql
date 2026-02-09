-- Add niche column to clients table
ALTER TABLE public.clients
ADD COLUMN niche TEXT;