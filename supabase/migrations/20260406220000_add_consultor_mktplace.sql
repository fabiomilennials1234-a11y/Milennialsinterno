-- Add assigned_mktplace column to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS assigned_mktplace text;

-- Add mktplace_status column to clients table (for kanban flow)
-- Default is NULL — only clients explicitly assigned to a consultor get 'novo'
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS mktplace_status text;

-- Add mktplace_entered_at column to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS mktplace_entered_at timestamptz;

-- Fix: clear mktplace_status for clients that don't have a consultor assigned
-- (in case the column was previously created with DEFAULT 'novo')
UPDATE public.clients
SET mktplace_status = NULL, mktplace_entered_at = NULL
WHERE assigned_mktplace IS NULL AND mktplace_status IS NOT NULL;
