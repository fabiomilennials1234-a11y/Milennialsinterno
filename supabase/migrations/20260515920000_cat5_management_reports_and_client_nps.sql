-- Cat 5: Management Reports + Client NPS
-- Creates tables for monthly management reports (5A) and per-client NPS (5B),
-- plus new columns on client_results_reports for gestor de trafego fields (5D).

-- ─── 1. client_management_reports ────────────────────────────────────

CREATE TABLE public.client_management_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  reference_month text NOT NULL, -- '2026-05' ISO format

  -- Bloco 1: Consolidacao das entregas do mes
  campanhas_veiculadas text,
  leads_gerados text,
  cpl_medio text,
  criativos_performance text,
  entregas_extra_escopo text,
  planejado_nao_executado text,

  -- Bloco 2: Relatorio executivo
  maior_resultado_mes text,
  principal_desafio text,
  mudanca_estrategia text,

  -- Bloco 3: Dica de gestao
  dica_eixo text CHECK (dica_eixo IN ('pessoas','estrategia','processos','gestao','cultura')),
  dica_texto text,
  dica_fonte text,

  -- Bloco 4: Plano de acao 30-60-90
  plano_30d text,
  plano_60d text,
  plano_90d text,
  responsaveis_acoes jsonb DEFAULT '[]'::jsonb,

  -- Bloco 5: One-page
  investimento_total numeric,
  leads_gerados_num integer,
  cpl_num numeric,
  taxa_conversao numeric,
  melhor_criativo_url text,
  melhor_criativo_metrica text,
  frase_destaque text,
  proximo_passo text,
  client_logo_url text,

  -- Meta
  public_token text UNIQUE DEFAULT gen_random_uuid()::text,
  is_published boolean DEFAULT true,
  pdf_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- One report per client per month
ALTER TABLE public.client_management_reports
  ADD CONSTRAINT uq_client_management_report_month UNIQUE (client_id, reference_month);

CREATE INDEX idx_management_reports_client ON public.client_management_reports(client_id);
CREATE INDEX idx_management_reports_token ON public.client_management_reports(public_token);

-- RLS
ALTER TABLE public.client_management_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view management reports"
  ON public.client_management_reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anon can view published management reports by token"
  ON public.client_management_reports FOR SELECT
  TO anon
  USING (is_published = true AND public_token IS NOT NULL);

CREATE POLICY "Admins and CEO can manage management reports"
  ON public.client_management_reports FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()) OR is_ceo(auth.uid()));

CREATE POLICY "Creator can manage own management reports"
  ON public.client_management_reports FOR ALL
  TO authenticated
  USING (created_by = auth.uid());

-- updated_at trigger
CREATE TRIGGER set_updated_at_management_reports
  BEFORE UPDATE ON public.client_management_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ─── 2. client_nps_responses ─────────────────────────────────────────

CREATE TABLE public.client_nps_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  reference_month text NOT NULL, -- '2026-05'
  nps_score integer NOT NULL CHECK (nps_score >= 0 AND nps_score <= 10),
  score_reason text,
  collected_by uuid NOT NULL,
  collected_at timestamptz DEFAULT now(),
  public_token text UNIQUE DEFAULT gen_random_uuid()::text,
  created_at timestamptz DEFAULT now()
);

-- One NPS per client per month
ALTER TABLE public.client_nps_responses
  ADD CONSTRAINT uq_client_nps_month UNIQUE (client_id, reference_month);

CREATE INDEX idx_client_nps_client ON public.client_nps_responses(client_id);
CREATE INDEX idx_client_nps_token ON public.client_nps_responses(public_token);

-- RLS
ALTER TABLE public.client_nps_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view client NPS"
  ON public.client_nps_responses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anon can view client NPS by token"
  ON public.client_nps_responses FOR SELECT
  TO anon
  USING (public_token IS NOT NULL);

CREATE POLICY "Admins and CEO can manage client NPS"
  ON public.client_nps_responses FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()) OR is_ceo(auth.uid()));

CREATE POLICY "Collector can manage own NPS entries"
  ON public.client_nps_responses FOR ALL
  TO authenticated
  USING (collected_by = auth.uid());

-- Trigger: auto-update clients.client_label from NPS score
CREATE OR REPLACE FUNCTION update_client_label_from_nps()
RETURNS trigger AS $$
BEGIN
  UPDATE public.clients
  SET client_label = CASE
    WHEN NEW.nps_score >= 9 THEN 'otimo'
    WHEN NEW.nps_score >= 7 THEN 'bom'
    WHEN NEW.nps_score >= 5 THEN 'medio'
    ELSE 'ruim'
  END
  WHERE id = NEW.client_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_client_label_nps
  AFTER INSERT OR UPDATE ON public.client_nps_responses
  FOR EACH ROW EXECUTE FUNCTION update_client_label_from_nps();


-- ─── 3. New columns on client_results_reports (SE5 - gestor fields) ──

ALTER TABLE public.client_results_reports
  ADD COLUMN IF NOT EXISTS analise_funil_comercial text,
  ADD COLUMN IF NOT EXISTS indicadores_dominio_gestor text,
  ADD COLUMN IF NOT EXISTS analise_crm_cliente text,
  ADD COLUMN IF NOT EXISTS analise_estrategias_captacao text;
