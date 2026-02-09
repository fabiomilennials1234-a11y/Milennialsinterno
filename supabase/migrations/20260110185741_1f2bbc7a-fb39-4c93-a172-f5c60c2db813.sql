-- Create groups table (Grupos de Pessoas)
CREATE TABLE public.organization_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create squads table (Squads dentro dos Grupos)
CREATE TABLE public.squads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.organization_groups(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create independent categories (Áreas fora de Grupos e Squads)
CREATE TABLE public.independent_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Link users to squads (optional - a user can be in a squad)
ALTER TABLE public.profiles ADD COLUMN squad_id UUID REFERENCES public.squads(id) ON DELETE SET NULL;

-- Link users to groups as coringas (optional - a user can be a coringa in a group)
ALTER TABLE public.profiles ADD COLUMN group_id UUID REFERENCES public.organization_groups(id) ON DELETE SET NULL;

-- Flag to identify if user is a coringa
ALTER TABLE public.profiles ADD COLUMN is_coringa BOOLEAN NOT NULL DEFAULT false;

-- Link users to independent categories (optional)
ALTER TABLE public.profiles ADD COLUMN category_id UUID REFERENCES public.independent_categories(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.organization_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.independent_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organization_groups
CREATE POLICY "Anyone can view groups" ON public.organization_groups FOR SELECT USING (true);
CREATE POLICY "Only CEO can manage groups" ON public.organization_groups FOR ALL USING (public.is_ceo(auth.uid()));

-- RLS Policies for squads
CREATE POLICY "Anyone can view squads" ON public.squads FOR SELECT USING (true);
CREATE POLICY "Only CEO can manage squads" ON public.squads FOR ALL USING (public.is_ceo(auth.uid()));

-- RLS Policies for independent_categories
CREATE POLICY "Anyone can view categories" ON public.independent_categories FOR SELECT USING (true);
CREATE POLICY "Only CEO can manage categories" ON public.independent_categories FOR ALL USING (public.is_ceo(auth.uid()));

-- Create CEO strategic board
INSERT INTO public.kanban_boards (name, slug, description) VALUES 
    ('Kanban CEO', 'ceo', 'Painel estratégico do CEO com visão macro da empresa');

-- Create columns for CEO board
INSERT INTO public.kanban_columns (board_id, title, position, color)
SELECT id, 'Gargalos', 0, '#ef4444' FROM public.kanban_boards WHERE slug = 'ceo'
UNION ALL
SELECT id, 'Atenção Necessária', 1, '#f59e0b' FROM public.kanban_boards WHERE slug = 'ceo'
UNION ALL
SELECT id, 'Em Análise', 2, '#3b82f6' FROM public.kanban_boards WHERE slug = 'ceo'
UNION ALL
SELECT id, 'Resolvido', 3, '#22c55e' FROM public.kanban_boards WHERE slug = 'ceo';

-- Insert default organization groups
INSERT INTO public.organization_groups (name, slug, position) VALUES 
    ('Grupo 1', 'grupo-1', 1),
    ('Grupo 2', 'grupo-2', 2);

-- Insert squads for Grupo 1
INSERT INTO public.squads (group_id, name, slug, position)
SELECT id, 'Squad 1', 'grupo-1-squad-1', 1 FROM public.organization_groups WHERE slug = 'grupo-1'
UNION ALL
SELECT id, 'Squad 2', 'grupo-1-squad-2', 2 FROM public.organization_groups WHERE slug = 'grupo-1';

-- Insert squads for Grupo 2
INSERT INTO public.squads (group_id, name, slug, position)
SELECT id, 'Squad 1', 'grupo-2-squad-1', 1 FROM public.organization_groups WHERE slug = 'grupo-2'
UNION ALL
SELECT id, 'Squad 2', 'grupo-2-squad-2', 2 FROM public.organization_groups WHERE slug = 'grupo-2';

-- Insert independent categories
INSERT INTO public.independent_categories (name, slug, icon, position) VALUES 
    ('RH', 'rh', 'users', 1),
    ('Financeiro', 'financeiro', 'wallet', 2),
    ('Produtora', 'produtora', 'video', 3),
    ('Atrizes para Gravação', 'atrizes', 'camera', 4);

-- Create trigger for updated_at
CREATE TRIGGER update_organization_groups_updated_at
BEFORE UPDATE ON public.organization_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_squads_updated_at
BEFORE UPDATE ON public.squads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();