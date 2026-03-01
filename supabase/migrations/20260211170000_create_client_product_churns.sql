-- Create table for product-specific churn workflow
-- Allows a client to churn from ONE product while staying active in others
CREATE TABLE public.client_product_churns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  product_slug TEXT NOT NULL,
  product_name TEXT NOT NULL,
  monthly_value NUMERIC,
  distrato_step TEXT NOT NULL DEFAULT 'churn_solicitado',
  distrato_entered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  had_valid_contract BOOLEAN,
  initiated_by UUID,
  initiated_by_name TEXT,
  exit_reason TEXT,
  exit_satisfaction_score INTEGER,
  archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMP WITH TIME ZONE,
  archived_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_product_churns ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Authenticated users can view client product churns"
  ON public.client_product_churns
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert client product churns"
  ON public.client_product_churns
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update client product churns"
  ON public.client_product_churns
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete client product churns"
  ON public.client_product_churns
  FOR DELETE
  TO authenticated
  USING (true);

-- Trigger to update updated_at
CREATE TRIGGER update_client_product_churns_updated_at
  BEFORE UPDATE ON public.client_product_churns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_client_product_churns_client_id ON public.client_product_churns(client_id);
CREATE INDEX idx_client_product_churns_product_slug ON public.client_product_churns(product_slug);
CREATE INDEX idx_client_product_churns_distrato_step ON public.client_product_churns(distrato_step);
CREATE INDEX idx_client_product_churns_archived ON public.client_product_churns(archived);

-- Partial unique index: prevent duplicate active churns per client+product
CREATE UNIQUE INDEX idx_client_product_churns_active_unique
  ON public.client_product_churns(client_id, product_slug)
  WHERE archived = false;
