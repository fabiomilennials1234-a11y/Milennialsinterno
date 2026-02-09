-- Add tags column to ads_tasks
ALTER TABLE public.ads_tasks
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Create ads_task_comments table
CREATE TABLE IF NOT EXISTS public.ads_task_comments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.ads_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ads_task_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for ads_task_comments
CREATE POLICY "Users can view comments on tasks they can access"
ON public.ads_task_comments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.ads_tasks t
        WHERE t.id = task_id
        AND (t.ads_manager_id = auth.uid() OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('ceo', 'gestor_projetos', 'sucesso_cliente')
        ))
    )
);

CREATE POLICY "Users can create comments"
ON public.ads_task_comments FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own comments"
ON public.ads_task_comments FOR DELETE
USING (user_id = auth.uid());