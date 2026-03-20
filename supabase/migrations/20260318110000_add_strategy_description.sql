-- Adicionar campo "Como você fez isso?" nas provas sociais
ALTER TABLE public.provas_sociais
  ADD COLUMN IF NOT EXISTS strategy_description TEXT;
