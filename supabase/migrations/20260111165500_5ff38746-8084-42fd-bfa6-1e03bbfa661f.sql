
-- Update Design Kanban columns to match the correct structure
-- Get the design board ID and update columns

-- Update REVISÃO to ARRUMAR
UPDATE kanban_columns 
SET title = 'ARRUMAR', color = 'orange'
WHERE board_id = (SELECT id FROM kanban_boards WHERE slug = 'design')
AND title = 'REVISÃO';

-- Update APROVADO to ENVIAR / APROVAÇÃO  
UPDATE kanban_columns 
SET title = 'ENVIAR / APROVAÇÃO', color = 'purple'
WHERE board_id = (SELECT id FROM kanban_boards WHERE slug = 'design')
AND title = 'APROVADO';

-- Update ENTREGUE to APROVADOS
UPDATE kanban_columns 
SET title = 'APROVADOS', color = 'green'
WHERE board_id = (SELECT id FROM kanban_boards WHERE slug = 'design')
AND title = 'ENTREGUE';

-- Add BY JOEL DESIGNER column (second designer)
INSERT INTO kanban_columns (board_id, title, color, position)
SELECT id, 'BY JOEL DESIGNER', 'blue', 1
FROM kanban_boards WHERE slug = 'design'
ON CONFLICT DO NOTHING;

-- Reorder positions: BY FRANK (0), BY JOEL (1), EM PRODUÇÃO (2), ARRUMAR (3), ENVIAR/APROVAÇÃO (4), APROVADOS (5)
UPDATE kanban_columns SET position = 0 
WHERE board_id = (SELECT id FROM kanban_boards WHERE slug = 'design') AND title = 'BY FRANK DESIGNER';

UPDATE kanban_columns SET position = 2 
WHERE board_id = (SELECT id FROM kanban_boards WHERE slug = 'design') AND title = 'EM PRODUÇÃO';

UPDATE kanban_columns SET position = 3 
WHERE board_id = (SELECT id FROM kanban_boards WHERE slug = 'design') AND title = 'ARRUMAR';

UPDATE kanban_columns SET position = 4 
WHERE board_id = (SELECT id FROM kanban_boards WHERE slug = 'design') AND title = 'ENVIAR / APROVAÇÃO';

UPDATE kanban_columns SET position = 5 
WHERE board_id = (SELECT id FROM kanban_boards WHERE slug = 'design') AND title = 'APROVADOS';
