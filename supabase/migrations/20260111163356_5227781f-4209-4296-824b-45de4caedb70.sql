-- Primeiro, verificar se a categoria 'design' existe na tabela independent_categories
-- Se não existir, vamos criar
INSERT INTO public.independent_categories (name, slug, icon, position)
SELECT 'Design', 'design', 'Palette', 1
WHERE NOT EXISTS (SELECT 1 FROM public.independent_categories WHERE slug = 'design');

-- Criar o board de Design
INSERT INTO public.kanban_boards (name, slug, description, category_id)
SELECT 
  'Design',
  'design',
  'Quadro de demandas de design',
  (SELECT id FROM public.independent_categories WHERE slug = 'design')
WHERE NOT EXISTS (SELECT 1 FROM public.kanban_boards WHERE slug = 'design');

-- Criar as colunas do board de Design
WITH design_board AS (
  SELECT id FROM public.kanban_boards WHERE slug = 'design'
)
INSERT INTO public.kanban_columns (board_id, title, color, position)
SELECT db.id, col.title, col.color, col.position
FROM design_board db
CROSS JOIN (VALUES
  ('BY FRANK DESIGNER', '#8B5CF6', 0),
  ('EM PRODUÇÃO', '#F59E0B', 1),
  ('REVISÃO', '#3B82F6', 2),
  ('APROVADO', '#10B981', 3),
  ('ENTREGUE', '#6B7280', 4)
) AS col(title, color, position)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_columns kc 
  WHERE kc.board_id = db.id AND kc.title = col.title
);