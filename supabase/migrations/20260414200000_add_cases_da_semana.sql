-- =============================================================
-- Adiciona campo `cases_da_semana` ao Formulário de Reunião 1 a 1
-- (registra cases positivos da semana junto com os desafios e atrasos).
-- 100% aditivo — nenhuma alteração em colunas existentes.
-- =============================================================

ALTER TABLE public.meetings_one_on_one
  ADD COLUMN IF NOT EXISTS cases_da_semana TEXT[] NOT NULL DEFAULT '{}'::TEXT[];
