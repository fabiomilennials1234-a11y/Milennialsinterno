-- 20260416160000_create_tech_attachments.sql
-- Attachment system for Milennials Tech tasks.
-- Files stored in Supabase Storage bucket 'tech-attachments'.

BEGIN;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tech-attachments',
  'tech-attachments',
  true,
  NULL,  -- no size limit
  NULL   -- no mime type restriction (allow images, pdfs, etc.)
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: any authenticated user with tech access can upload/read
CREATE POLICY "tech_attachments_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'tech-attachments');

CREATE POLICY "tech_attachments_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'tech-attachments'
    AND public.can_see_tech(auth.uid())
  );

CREATE POLICY "tech_attachments_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'tech-attachments'
    AND (public.is_executive(auth.uid()) OR (storage.foldername(name))[1] = auth.uid()::text)
  );

-- Attachments metadata table
CREATE TABLE public.tech_task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tech_tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  content_type TEXT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tech_task_attachments_task_idx ON public.tech_task_attachments (task_id);
ALTER TABLE public.tech_task_attachments ENABLE ROW LEVEL SECURITY;

-- RLS
CREATE POLICY "tech_task_attachments_select" ON public.tech_task_attachments
  FOR SELECT USING (public.can_see_tech(auth.uid()));

CREATE POLICY "tech_task_attachments_insert" ON public.tech_task_attachments
  FOR INSERT WITH CHECK (
    public.can_see_tech(auth.uid())
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "tech_task_attachments_delete" ON public.tech_task_attachments
  FOR DELETE USING (
    public.is_executive(auth.uid())
    OR uploaded_by = auth.uid()
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tech_task_attachments;

COMMIT;
