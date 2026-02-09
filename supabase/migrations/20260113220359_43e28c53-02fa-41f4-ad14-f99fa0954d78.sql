-- Add sales_percentage field to clients table
ALTER TABLE public.clients 
ADD COLUMN sales_percentage numeric NOT NULL DEFAULT 0 
  CHECK (sales_percentage >= 0 AND sales_percentage <= 100);