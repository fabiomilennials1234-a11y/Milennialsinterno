-- Tabela para rastrear todas as mudanças de MRR (expansion e depreciation)
-- Registra alterações de valor recorrente em clientes já ativos
CREATE TABLE IF NOT EXISTS mrr_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  product_slug TEXT NOT NULL,
  product_name TEXT NOT NULL,
  previous_value NUMERIC NOT NULL DEFAULT 0,
  new_value NUMERIC NOT NULL DEFAULT 0,
  change_value NUMERIC NOT NULL DEFAULT 0,
  change_type TEXT NOT NULL CHECK (change_type IN ('expansion', 'depreciation')),
  source TEXT NOT NULL DEFAULT 'manual',
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE mrr_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users"
  ON mrr_changes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_mrr_changes_client ON mrr_changes(client_id);
CREATE INDEX idx_mrr_changes_type ON mrr_changes(change_type);
CREATE INDEX idx_mrr_changes_date ON mrr_changes(effective_date);
CREATE INDEX idx_mrr_changes_source ON mrr_changes(source);
