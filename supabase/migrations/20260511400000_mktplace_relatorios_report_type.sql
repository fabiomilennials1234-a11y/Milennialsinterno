-- Add report_type differentiation and new fields to mktplace_relatorios
-- Consultoria = 30-day cycle (9 fields), Gestao = 15-day cycle (12 fields)

ALTER TABLE mktplace_relatorios
  ADD COLUMN IF NOT EXISTS report_type text NOT NULL DEFAULT 'consultoria',
  ADD COLUMN IF NOT EXISTS feedback_cliente text,
  ADD COLUMN IF NOT EXISTS saude_contas text,
  ADD COLUMN IF NOT EXISTS status_logistica text,
  ADD COLUMN IF NOT EXISTS situacao_estoque text;

-- Enforce valid report types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mktplace_relatorios_report_type_check'
  ) THEN
    ALTER TABLE mktplace_relatorios
      ADD CONSTRAINT mktplace_relatorios_report_type_check
      CHECK (report_type IN ('consultoria', 'gestao'));
  END IF;
END $$;

-- Index for filtering by report_type (used in countdown queries)
CREATE INDEX IF NOT EXISTS idx_mktplace_rel_report_type ON mktplace_relatorios(client_id, report_type, created_at DESC);
