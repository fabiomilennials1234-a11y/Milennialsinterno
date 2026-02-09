
-- Remove the standalone status columns, keep only designer columns
DELETE FROM kanban_columns 
WHERE board_id = (SELECT id FROM kanban_boards WHERE slug = 'design')
AND title IN ('EM PRODUÇÃO', 'ARRUMAR', 'ENVIAR / APROVAÇÃO', 'APROVADOS');

-- Update positions for designer columns
UPDATE kanban_columns SET position = 0 
WHERE board_id = (SELECT id FROM kanban_boards WHERE slug = 'design') AND title = 'BY FRANK DESIGNER';

UPDATE kanban_columns SET position = 1 
WHERE board_id = (SELECT id FROM kanban_boards WHERE slug = 'design') AND title = 'BY JOEL DESIGNER';
