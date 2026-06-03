-- 20260603150100_module_demanda_kanban_link.sql
-- Slice 4 (#80) — Link strangler: cards de domínio apontam para uma demanda.
-- ADR 0004 (contrato-only) + CONTEXT.md → "Demanda" (padrão strangler).
--
-- ESCOPO MÍNIMO DELIBERADO: apenas public.kanban_cards (a god-table, maior alcance).
-- Os *_cards / *_tasks específicos NÃO ganham demanda_id nesta slice — cada um entra
-- quando SEU módulo migrar. Razão: cada tabela com demanda_id implica um caminho de
-- escrita; uma RPC vincular_card que cobre N tabelas vira god-function (CASE por tabela)
-- — exatamente o acoplamento que o módulo existe para eliminar. Link é OPCIONAL.
--
-- demanda_id é uuid SOLTO (sem FK cross-schema, ADR 0004): a integridade do vínculo
-- card->demanda é mantida pela RPC demanda.vincular_card (validação atômica) +
-- reconciliação (Slice 7). PURAMENTE ADITIVO: coluna nullable, nenhum default destrutivo.

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS demanda_id uuid;  -- ref por contrato; SEM FK cross-schema

COMMENT ON COLUMN public.kanban_cards.demanda_id IS
  'Strangler link (#80): demanda à qual este card pertence (CONTEXT.md → Demanda). '
  'uuid solto, sem FK cross-schema (ADR 0004). Setado SÓ via demanda.vincular_card '
  '(valida existência da demanda). NULL = card ainda não agrupado sob uma demanda.';

-- Índice parcial: só linhas vinculadas (a maioria começa NULL). Suporta o futuro
-- "cards desta demanda" sem inchar o índice com os não-vinculados.
CREATE INDEX IF NOT EXISTS idx_kanban_cards_demanda
  ON public.kanban_cards (demanda_id)
  WHERE demanda_id IS NOT NULL;
