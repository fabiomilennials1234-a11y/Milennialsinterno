-- Add editor_video ao allowed_roles do board produtora (alinhamento com
-- PRODUTORA_BOARD_VIEWERS em src/hooks/useProdutoraKanban.ts:26-34).
-- Sem isso, editor_video nao passa em can_view_board no slug 'produtora'.

BEGIN;

UPDATE public.kanban_boards
SET allowed_roles = ARRAY['produtora','gestor_ads','outbound','sucesso_cliente','editor_video']
WHERE slug = 'produtora'
  AND NOT ('editor_video' = ANY(allowed_roles));

COMMIT;
