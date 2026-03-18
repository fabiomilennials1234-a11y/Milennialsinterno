-- Add archived column to weekly_summaries
ALTER TABLE public.weekly_summaries ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- Allow authenticated users to update weekly summaries (needed for archiving)
CREATE POLICY "Autenticados podem atualizar resumos semanais"
  ON public.weekly_summaries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
