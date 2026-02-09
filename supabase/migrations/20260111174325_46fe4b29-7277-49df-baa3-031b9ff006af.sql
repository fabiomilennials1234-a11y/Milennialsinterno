-- Create Kanban Board for Video Editor
INSERT INTO kanban_boards (slug, name, description)
VALUES ('editor-video', 'Editor de Vídeo', 'Kanban para demandas de edição de vídeo')
ON CONFLICT (slug) DO NOTHING;

-- Create columns for each video editor (we'll add BY columns dynamically when editors exist)
-- For now, create placeholder columns that will be filtered
INSERT INTO kanban_columns (board_id, title, position, color)
SELECT 
  kb.id,
  col.title,
  col.position,
  col.color
FROM kanban_boards kb
CROSS JOIN (
  VALUES 
    ('A Fazer', 0, 'slate'),
    ('Fazendo', 1, 'blue'),
    ('Alteração', 2, 'orange'),
    ('Aguardando Aprovação', 3, 'purple'),
    ('Aprovados', 4, 'green')
) AS col(title, position, color)
WHERE kb.slug = 'editor-video'
AND NOT EXISTS (
  SELECT 1 FROM kanban_columns kc WHERE kc.board_id = kb.id AND kc.title = col.title
);

-- Create video_briefings table (similar to design_briefings)
CREATE TABLE IF NOT EXISTS public.video_briefings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL UNIQUE REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  script_url TEXT,
  observations TEXT,
  materials_url TEXT,
  reference_video_url TEXT,
  identity_url TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on video_briefings
ALTER TABLE public.video_briefings ENABLE ROW LEVEL SECURITY;

-- RLS policies for video_briefings
CREATE POLICY "video_briefings_select" ON public.video_briefings
FOR SELECT USING (true);

CREATE POLICY "video_briefings_insert" ON public.video_briefings
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'editor_video')
  )
);

CREATE POLICY "video_briefings_update" ON public.video_briefings
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'editor_video')
  )
);

CREATE POLICY "video_briefings_delete" ON public.video_briefings
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'editor_video')
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_video_briefings_updated_at
BEFORE UPDATE ON public.video_briefings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();