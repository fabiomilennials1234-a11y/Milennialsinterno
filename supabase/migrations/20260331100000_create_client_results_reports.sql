-- Table for storing client results reports (30-day cycle)
CREATE TABLE IF NOT EXISTS public.client_results_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,

  -- Report content
  actions_last_30_days TEXT,
  achievements TEXT,
  traffic_results TEXT,
  key_metrics TEXT,
  top_campaign TEXT,
  improvement_points TEXT,
  next_30_days TEXT,
  next_steps TEXT,
  client_logo_url TEXT,
  custom_content JSONB,

  -- Generated output
  public_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_published BOOLEAN DEFAULT false,
  pdf_url TEXT,

  -- Cycle tracking
  cycle_start_date DATE NOT NULL,
  cycle_end_date DATE NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_client_results_reports_client ON public.client_results_reports(client_id);
CREATE INDEX idx_client_results_reports_token ON public.client_results_reports(public_token);

-- RLS
ALTER TABLE public.client_results_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reports"
  ON public.client_results_reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert reports"
  ON public.client_results_reports FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update reports"
  ON public.client_results_reports FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete reports"
  ON public.client_results_reports FOR DELETE
  TO authenticated
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_results_reports;
