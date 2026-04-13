-- =============================================================
-- MKT Place Relatórios: ciclo recorrente independente do ADS
-- =============================================================

CREATE TABLE IF NOT EXISTS public.mktplace_relatorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  consultor_id TEXT NOT NULL,

  -- Conteúdo do relatório
  titulo TEXT,
  resumo TEXT,
  acoes_realizadas TEXT,
  resultados TEXT,
  metricas_chave TEXT,
  pontos_melhoria TEXT,
  proximos_passos TEXT,
  observacoes TEXT,

  -- Ciclo
  cycle_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  cycle_end_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),

  -- Publicação
  public_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_published BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE mktplace_relatorios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mktplace_rel_all" ON mktplace_relatorios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "mktplace_rel_public" ON mktplace_relatorios FOR SELECT TO anon USING (is_published = true);

CREATE INDEX idx_mktplace_rel_client ON mktplace_relatorios(client_id);
CREATE INDEX idx_mktplace_rel_consultor ON mktplace_relatorios(consultor_id);
CREATE INDEX idx_mktplace_rel_created ON mktplace_relatorios(created_at DESC);
CREATE INDEX idx_mktplace_rel_token ON mktplace_relatorios(public_token);
