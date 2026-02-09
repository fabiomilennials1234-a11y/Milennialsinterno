-- CEO needs to view ALL justifications (not just their own)
CREATE POLICY "CEO can view all justifications"
ON public.ads_task_delay_justifications
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'ceo'
  )
);