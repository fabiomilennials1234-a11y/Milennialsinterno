-- Add entry_date column to clients table
ALTER TABLE public.clients
ADD COLUMN entry_date date DEFAULT CURRENT_DATE;

-- Update existing clients to use their created_at as entry_date
UPDATE public.clients
SET entry_date = DATE(created_at)
WHERE entry_date IS NULL;