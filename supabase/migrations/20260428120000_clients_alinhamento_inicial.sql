-- Coluna jsonb para persistir respostas do "Alinhamento inicial" no card do cliente.
-- 9 perguntas livres, salvas como objeto { q1: string, ..., q9: string }.
-- Schemaless propositalmente — perguntas mudam sem migration.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS alinhamento_inicial jsonb;
