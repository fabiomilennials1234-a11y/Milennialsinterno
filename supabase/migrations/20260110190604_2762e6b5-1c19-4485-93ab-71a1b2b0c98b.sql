-- Add organizational links to kanban_boards
ALTER TABLE public.kanban_boards ADD COLUMN group_id UUID REFERENCES public.organization_groups(id) ON DELETE SET NULL;
ALTER TABLE public.kanban_boards ADD COLUMN squad_id UUID REFERENCES public.squads(id) ON DELETE SET NULL;
ALTER TABLE public.kanban_boards ADD COLUMN category_id UUID REFERENCES public.independent_categories(id) ON DELETE SET NULL;

-- Update existing boards to link to independent categories
UPDATE public.kanban_boards SET category_id = (SELECT id FROM public.independent_categories WHERE slug = 'rh') WHERE slug = 'rh';
UPDATE public.kanban_boards SET category_id = (SELECT id FROM public.independent_categories WHERE slug = 'financeiro') WHERE slug = 'financeiro';
UPDATE public.kanban_boards SET category_id = (SELECT id FROM public.independent_categories WHERE slug = 'produtora') WHERE slug = 'produtora';
UPDATE public.kanban_boards SET category_id = (SELECT id FROM public.independent_categories WHERE slug = 'atrizes') WHERE slug = 'atrizes';

-- Create boards for each squad in Grupo 1
INSERT INTO public.kanban_boards (name, slug, description, squad_id)
SELECT 'Squad 1 - Design', 'grupo-1-squad-1-design', 'Quadro de Design do Squad 1', id FROM public.squads WHERE slug = 'grupo-1-squad-1';

INSERT INTO public.kanban_boards (name, slug, description, squad_id)
SELECT 'Squad 1 - Devs', 'grupo-1-squad-1-devs', 'Quadro de Desenvolvedores do Squad 1', id FROM public.squads WHERE slug = 'grupo-1-squad-1';

INSERT INTO public.kanban_boards (name, slug, description, squad_id)
SELECT 'Squad 1 - Editor Vídeo', 'grupo-1-squad-1-video', 'Quadro de Editor de Vídeo do Squad 1', id FROM public.squads WHERE slug = 'grupo-1-squad-1';

INSERT INTO public.kanban_boards (name, slug, description, squad_id)
SELECT 'Squad 1 - Ads', 'grupo-1-squad-1-ads', 'Quadro de Gestores de Ads do Squad 1', id FROM public.squads WHERE slug = 'grupo-1-squad-1';

INSERT INTO public.kanban_boards (name, slug, description, squad_id)
SELECT 'Squad 2 - Design', 'grupo-1-squad-2-design', 'Quadro de Design do Squad 2', id FROM public.squads WHERE slug = 'grupo-1-squad-2';

INSERT INTO public.kanban_boards (name, slug, description, squad_id)
SELECT 'Squad 2 - Devs', 'grupo-1-squad-2-devs', 'Quadro de Desenvolvedores do Squad 2', id FROM public.squads WHERE slug = 'grupo-1-squad-2';

INSERT INTO public.kanban_boards (name, slug, description, squad_id)
SELECT 'Squad 2 - Editor Vídeo', 'grupo-1-squad-2-video', 'Quadro de Editor de Vídeo do Squad 2', id FROM public.squads WHERE slug = 'grupo-1-squad-2';

INSERT INTO public.kanban_boards (name, slug, description, squad_id)
SELECT 'Squad 2 - Ads', 'grupo-1-squad-2-ads', 'Quadro de Gestores de Ads do Squad 2', id FROM public.squads WHERE slug = 'grupo-1-squad-2';

-- Create boards for each squad in Grupo 2
INSERT INTO public.kanban_boards (name, slug, description, squad_id)
SELECT 'Squad 1 - Design', 'grupo-2-squad-1-design', 'Quadro de Design do Squad 1', id FROM public.squads WHERE slug = 'grupo-2-squad-1';

INSERT INTO public.kanban_boards (name, slug, description, squad_id)
SELECT 'Squad 1 - Devs', 'grupo-2-squad-1-devs', 'Quadro de Desenvolvedores do Squad 1', id FROM public.squads WHERE slug = 'grupo-2-squad-1';

INSERT INTO public.kanban_boards (name, slug, description, squad_id)
SELECT 'Squad 1 - Editor Vídeo', 'grupo-2-squad-1-video', 'Quadro de Editor de Vídeo do Squad 1', id FROM public.squads WHERE slug = 'grupo-2-squad-1';

INSERT INTO public.kanban_boards (name, slug, description, squad_id)
SELECT 'Squad 1 - Ads', 'grupo-2-squad-1-ads', 'Quadro de Gestores de Ads do Squad 1', id FROM public.squads WHERE slug = 'grupo-2-squad-1';

INSERT INTO public.kanban_boards (name, slug, description, squad_id)
SELECT 'Squad 2 - Design', 'grupo-2-squad-2-design', 'Quadro de Design do Squad 2', id FROM public.squads WHERE slug = 'grupo-2-squad-2';

INSERT INTO public.kanban_boards (name, slug, description, squad_id)
SELECT 'Squad 2 - Devs', 'grupo-2-squad-2-devs', 'Quadro de Desenvolvedores do Squad 2', id FROM public.squads WHERE slug = 'grupo-2-squad-2';

INSERT INTO public.kanban_boards (name, slug, description, squad_id)
SELECT 'Squad 2 - Editor Vídeo', 'grupo-2-squad-2-video', 'Quadro de Editor de Vídeo do Squad 2', id FROM public.squads WHERE slug = 'grupo-2-squad-2';

INSERT INTO public.kanban_boards (name, slug, description, squad_id)
SELECT 'Squad 2 - Ads', 'grupo-2-squad-2-ads', 'Quadro de Gestores de Ads do Squad 2', id FROM public.squads WHERE slug = 'grupo-2-squad-2';

-- Create default columns for the new boards
INSERT INTO public.kanban_columns (board_id, title, position, color)
SELECT b.id, 'Backlog', 0, '#6b7280' FROM public.kanban_boards b WHERE b.squad_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.kanban_columns c WHERE c.board_id = b.id);

INSERT INTO public.kanban_columns (board_id, title, position, color)
SELECT b.id, 'A Fazer', 1, '#3b82f6' FROM public.kanban_boards b WHERE b.squad_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.kanban_columns c WHERE c.board_id = b.id AND c.title = 'A Fazer');

INSERT INTO public.kanban_columns (board_id, title, position, color)
SELECT b.id, 'Em Progresso', 2, '#f59e0b' FROM public.kanban_boards b WHERE b.squad_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.kanban_columns c WHERE c.board_id = b.id AND c.title = 'Em Progresso');

INSERT INTO public.kanban_columns (board_id, title, position, color)
SELECT b.id, 'Revisão', 3, '#8b5cf6' FROM public.kanban_boards b WHERE b.squad_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.kanban_columns c WHERE c.board_id = b.id AND c.title = 'Revisão');

INSERT INTO public.kanban_columns (board_id, title, position, color)
SELECT b.id, 'Concluído', 4, '#22c55e' FROM public.kanban_boards b WHERE b.squad_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.kanban_columns c WHERE c.board_id = b.id AND c.title = 'Concluído');

-- Create boards for Coringas (at group level)
INSERT INTO public.kanban_boards (name, slug, description, group_id)
SELECT 'Gestor de CRM', 'grupo-1-crm', 'Quadro do Gestor de CRM do Grupo 1', id FROM public.organization_groups WHERE slug = 'grupo-1';

INSERT INTO public.kanban_boards (name, slug, description, group_id)
SELECT 'Consultor Comercial', 'grupo-1-comercial', 'Quadro do Consultor Comercial do Grupo 1', id FROM public.organization_groups WHERE slug = 'grupo-1';

INSERT INTO public.kanban_boards (name, slug, description, group_id)
SELECT 'Gestor de Projetos', 'grupo-1-projetos', 'Quadro do Gestor de Projetos do Grupo 1', id FROM public.organization_groups WHERE slug = 'grupo-1';

INSERT INTO public.kanban_boards (name, slug, description, group_id)
SELECT 'Gestor de CRM', 'grupo-2-crm', 'Quadro do Gestor de CRM do Grupo 2', id FROM public.organization_groups WHERE slug = 'grupo-2';

INSERT INTO public.kanban_boards (name, slug, description, group_id)
SELECT 'Consultor Comercial', 'grupo-2-comercial', 'Quadro do Consultor Comercial do Grupo 2', id FROM public.organization_groups WHERE slug = 'grupo-2';

INSERT INTO public.kanban_boards (name, slug, description, group_id)
SELECT 'Gestor de Projetos', 'grupo-2-projetos', 'Quadro do Gestor de Projetos do Grupo 2', id FROM public.organization_groups WHERE slug = 'grupo-2';

-- Create columns for group-level boards (Coringas)
INSERT INTO public.kanban_columns (board_id, title, position, color)
SELECT b.id, 'Backlog', 0, '#6b7280' FROM public.kanban_boards b WHERE b.group_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.kanban_columns c WHERE c.board_id = b.id);

INSERT INTO public.kanban_columns (board_id, title, position, color)
SELECT b.id, 'A Fazer', 1, '#3b82f6' FROM public.kanban_boards b WHERE b.group_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.kanban_columns c WHERE c.board_id = b.id AND c.title = 'A Fazer');

INSERT INTO public.kanban_columns (board_id, title, position, color)
SELECT b.id, 'Em Progresso', 2, '#f59e0b' FROM public.kanban_boards b WHERE b.group_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.kanban_columns c WHERE c.board_id = b.id AND c.title = 'Em Progresso');

INSERT INTO public.kanban_columns (board_id, title, position, color)
SELECT b.id, 'Concluído', 3, '#22c55e' FROM public.kanban_boards b WHERE b.group_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.kanban_columns c WHERE c.board_id = b.id AND c.title = 'Concluído');

-- Create boards for independent categories
INSERT INTO public.kanban_boards (name, slug, description, category_id)
SELECT 'RH', 'rh-board', 'Quadro do RH', id FROM public.independent_categories WHERE slug = 'rh'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.kanban_boards (name, slug, description, category_id)
SELECT 'Financeiro', 'financeiro-board', 'Quadro do Financeiro', id FROM public.independent_categories WHERE slug = 'financeiro'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.kanban_boards (name, slug, description, category_id)
SELECT 'Produtora', 'produtora-board', 'Quadro da Produtora', id FROM public.independent_categories WHERE slug = 'produtora'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.kanban_boards (name, slug, description, category_id)
SELECT 'Atrizes para Gravação', 'atrizes-board', 'Quadro das Atrizes para Gravação', id FROM public.independent_categories WHERE slug = 'atrizes'
ON CONFLICT (slug) DO NOTHING;

-- Create columns for category boards
INSERT INTO public.kanban_columns (board_id, title, position, color)
SELECT b.id, 'Backlog', 0, '#6b7280' FROM public.kanban_boards b WHERE b.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.kanban_columns c WHERE c.board_id = b.id);

INSERT INTO public.kanban_columns (board_id, title, position, color)
SELECT b.id, 'A Fazer', 1, '#3b82f6' FROM public.kanban_boards b WHERE b.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.kanban_columns c WHERE c.board_id = b.id AND c.title = 'A Fazer');

INSERT INTO public.kanban_columns (board_id, title, position, color)
SELECT b.id, 'Em Progresso', 2, '#f59e0b' FROM public.kanban_boards b WHERE b.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.kanban_columns c WHERE c.board_id = b.id AND c.title = 'Em Progresso');

INSERT INTO public.kanban_columns (board_id, title, position, color)
SELECT b.id, 'Concluído', 3, '#22c55e' FROM public.kanban_boards b WHERE b.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.kanban_columns c WHERE c.board_id = b.id AND c.title = 'Concluído');