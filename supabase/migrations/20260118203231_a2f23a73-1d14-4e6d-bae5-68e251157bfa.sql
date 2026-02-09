-- Add archive columns to ads_task_delay_justifications
ALTER TABLE public.ads_task_delay_justifications
ADD COLUMN archived boolean NOT NULL DEFAULT false,
ADD COLUMN archived_at timestamptz,
ADD COLUMN archived_by uuid;

-- Create RLS policy for UPDATE - only CEO can archive/unarchive
CREATE POLICY "Only CEO can archive justifications"
ON public.ads_task_delay_justifications
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'ceo'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'ceo'
  )
);