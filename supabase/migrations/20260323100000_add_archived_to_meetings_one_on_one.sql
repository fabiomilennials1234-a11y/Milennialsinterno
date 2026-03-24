-- Adicionar coluna archived à tabela meetings_one_on_one
-- O arquivamento é apenas visual (Gestor de Projetos), não afeta OKRs semanais
ALTER TABLE meetings_one_on_one
  ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Índice para filtrar reuniões não arquivadas rapidamente
CREATE INDEX IF NOT EXISTS idx_meetings_one_on_one_archived
  ON meetings_one_on_one (archived);

-- Permitir que usuários autenticados façam update (para arquivar/desarquivar)
CREATE POLICY "Users can update meetings_one_on_one"
  ON meetings_one_on_one
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
