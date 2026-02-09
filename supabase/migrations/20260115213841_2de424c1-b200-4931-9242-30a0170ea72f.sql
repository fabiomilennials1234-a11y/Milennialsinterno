-- Add archived fields to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone DEFAULT NULL;

-- Add index for archived field
CREATE INDEX IF NOT EXISTS idx_clients_archived ON public.clients(archived);

-- Add index for status field for better performance
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);