-- 20260423130000_fix_rls_leakage_kanban_remove_permissive_policies.sql
--
-- RC4 FIX — CRITICO: remover policies permissivas `USING (true)` que vazam
-- TODOS os registros de kanban_boards, kanban_cards e kanban_columns para
-- qualquer usuario autenticado.
--
-- HISTORICO:
--   - Introduzidas em migration 20260110184318 (d71eb11c...) linhas 68,84,92.
--   - Coexistiam com policies escopadas (`can_view_board`, etc) — como policies
--     PERMISSIVE sao OR-ed entre si em Postgres, a mais permissiva sempre
--     "ganha", anulando o escopo.
--
-- IMPACTO CORRIGIDO:
--   Antes: qualquer authenticated via todos os cards/columns/boards, inclusive
--          de squads/grupos/categorias dos quais nao faz parte.
--   Depois: cards filtrados por `can_view_card(auth.uid(), id)` (ver
--           20260423131000), boards por `can_view_board` (estendido para
--           reconhecer `allowed_roles` na mesma migration seguinte).
--
-- BACKUP: docs/superpowers/qa/2026-04-23-rls-backup-pre-rc4.sql
--
-- ROLLBACK (emergencial — vaza dados de novo, use SO se houver quebra critica
-- e o agente seguranca estiver ciente):
--   CREATE POLICY "Authenticated users can view boards" ON public.kanban_boards
--     FOR SELECT TO authenticated USING (true);
--   CREATE POLICY "Authenticated users can view cards" ON public.kanban_cards
--     FOR SELECT TO authenticated USING (true);
--   CREATE POLICY "Authenticated users can view columns" ON public.kanban_columns
--     FOR SELECT TO authenticated USING (true);

BEGIN;

DROP POLICY IF EXISTS "Authenticated users can view boards" ON public.kanban_boards;
DROP POLICY IF EXISTS "Authenticated users can view cards" ON public.kanban_cards;
DROP POLICY IF EXISTS "Authenticated users can view columns" ON public.kanban_columns;

COMMIT;
