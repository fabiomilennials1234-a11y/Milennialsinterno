-- =============================================================
-- MKT Place Kanban: tabelas de tracking e documentação diária
-- =============================================================

-- Tracking diário do acompanhamento (mesmo padrão do client_daily_tracking)
CREATE TABLE IF NOT EXISTS public.mktplace_daily_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  consultor_id TEXT NOT NULL,
  current_day TEXT NOT NULL DEFAULT 'segunda',
  last_moved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_delayed BOOLEAN DEFAULT false,
  tracking_type TEXT NOT NULL DEFAULT 'consultoria' CHECK (tracking_type IN ('consultoria', 'gestao')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

ALTER TABLE mktplace_daily_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mktplace_tracking_all" ON mktplace_daily_tracking FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_mktplace_tracking_consultor ON mktplace_daily_tracking(consultor_id);
CREATE INDEX idx_mktplace_tracking_day ON mktplace_daily_tracking(current_day);

-- Documentação diária do MKT Place
CREATE TABLE IF NOT EXISTS public.mktplace_daily_documentation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  consultor_id TEXT NOT NULL,
  documentation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  tracking_type TEXT NOT NULL DEFAULT 'consultoria' CHECK (tracking_type IN ('consultoria', 'gestao')),
  falou_com_cliente TEXT CHECK (falou_com_cliente IN ('sim', 'nao')),
  falou_justificativa TEXT,
  fez_algo_novo TEXT CHECK (fez_algo_novo IN ('sim', 'nao')),
  fez_algo_justificativa TEXT,
  fez_algo_descricao TEXT,
  combinado TEXT CHECK (combinado IN ('sim', 'nao')),
  combinado_descricao TEXT,
  combinado_prazo DATE,
  combinado_justificativa TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, documentation_date)
);

ALTER TABLE mktplace_daily_documentation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mktplace_doc_all" ON mktplace_daily_documentation FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_mktplace_doc_date ON mktplace_daily_documentation(documentation_date);
CREATE INDEX idx_mktplace_doc_consultor ON mktplace_daily_documentation(consultor_id);
