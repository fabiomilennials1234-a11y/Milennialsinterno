-- Create kanban boards table
CREATE TABLE public.kanban_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create kanban columns table
CREATE TABLE public.kanban_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES public.kanban_boards(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create kanban cards table
CREATE TABLE public.kanban_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id UUID REFERENCES public.kanban_columns(id) ON DELETE CASCADE NOT NULL,
  board_id UUID REFERENCES public.kanban_boards(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending',
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  due_date DATE,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  position INTEGER NOT NULL DEFAULT 0,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create card comments table
CREATE TABLE public.card_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES public.kanban_cards(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create card activity log
CREATE TABLE public.card_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES public.kanban_cards(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.kanban_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for kanban_boards (everyone can view, only admins can create)
CREATE POLICY "Authenticated users can view boards"
ON public.kanban_boards FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can create boards"
ON public.kanban_boards FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update boards"
ON public.kanban_boards FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete boards"
ON public.kanban_boards FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- RLS Policies for kanban_columns
CREATE POLICY "Authenticated users can view columns"
ON public.kanban_columns FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage columns"
ON public.kanban_columns FOR ALL TO authenticated
USING (public.is_admin(auth.uid()));

-- RLS Policies for kanban_cards (view based on board access, create/edit based on role)
CREATE POLICY "Authenticated users can view cards"
ON public.kanban_cards FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create cards"
ON public.kanban_cards FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Card owners and admins can update cards"
ON public.kanban_cards FOR UPDATE TO authenticated
USING (
  created_by = auth.uid() OR 
  assigned_to = auth.uid() OR 
  public.is_admin(auth.uid())
);

CREATE POLICY "Admins can delete cards"
ON public.kanban_cards FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- RLS Policies for comments
CREATE POLICY "Users can view comments"
ON public.card_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create comments"
ON public.card_comments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
ON public.card_comments FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- RLS Policies for activities
CREATE POLICY "Users can view activities"
ON public.card_activities FOR SELECT TO authenticated USING (true);

CREATE POLICY "System can create activities"
ON public.card_activities FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Enable realtime for all kanban tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_boards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_columns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.card_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.card_activities;

-- Create trigger for updated_at on cards
CREATE TRIGGER update_kanban_cards_updated_at
BEFORE UPDATE ON public.kanban_cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kanban_boards_updated_at
BEFORE UPDATE ON public.kanban_boards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default boards
INSERT INTO public.kanban_boards (slug, name, description) VALUES
  ('design', 'Design', 'Quadro de tarefas da equipe de Design'),
  ('editor-video', 'Editor de Vídeo', 'Quadro de tarefas dos Editores de Vídeo'),
  ('devs', 'Desenvolvedores', 'Quadro de tarefas da equipe de Desenvolvimento'),
  ('atrizes', 'Atrizes para Gravação', 'Quadro de tarefas das Atrizes'),
  ('produtora', 'Produtora', 'Quadro de tarefas da Produtora'),
  ('crm', 'Gestor de CRM', 'Quadro de tarefas do CRM'),
  ('comercial', 'Consultor Comercial', 'Quadro de tarefas Comerciais'),
  ('ads', 'Gestor de Ads', 'Quadro de tarefas de Ads'),
  ('sucesso', 'Sucesso do Cliente', 'Quadro de tarefas de Sucesso do Cliente'),
  ('financeiro', 'Financeiro', 'Quadro de tarefas Financeiras'),
  ('rh', 'RH', 'Quadro de tarefas de RH');

-- Insert default columns for each board
INSERT INTO public.kanban_columns (board_id, title, position, color)
SELECT id, 'Backlog', 0, 'slate' FROM public.kanban_boards;

INSERT INTO public.kanban_columns (board_id, title, position, color)
SELECT id, 'A Fazer', 1, 'info' FROM public.kanban_boards;

INSERT INTO public.kanban_columns (board_id, title, position, color)
SELECT id, 'Em Progresso', 2, 'warning' FROM public.kanban_boards;

INSERT INTO public.kanban_columns (board_id, title, position, color)
SELECT id, 'Revisão', 3, 'purple' FROM public.kanban_boards;

INSERT INTO public.kanban_columns (board_id, title, position, color)
SELECT id, 'Concluído', 4, 'success' FROM public.kanban_boards;