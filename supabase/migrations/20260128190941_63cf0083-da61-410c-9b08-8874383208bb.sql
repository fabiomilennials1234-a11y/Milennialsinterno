-- Add client_label column to clients table
ALTER TABLE public.clients 
ADD COLUMN client_label TEXT CHECK (client_label IN ('otimo', 'bom', 'medio', 'ruim'));

-- Add comment for documentation
COMMENT ON COLUMN public.clients.client_label IS 'Client quality label: otimo, bom, medio, ruim';