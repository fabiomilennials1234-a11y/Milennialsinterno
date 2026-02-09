-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can insert own tasks" ON public.ads_tasks;

-- Create new INSERT policy that allows admins to insert for any manager
CREATE POLICY "Users can insert own tasks or admins can insert for any" 
ON public.ads_tasks 
FOR INSERT 
WITH CHECK (
  ads_manager_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('ceo', 'gestor_projetos')
  )
);