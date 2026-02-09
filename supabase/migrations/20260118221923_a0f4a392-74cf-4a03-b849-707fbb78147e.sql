-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can manage own tasks" ON public.ads_tasks;

-- Create separate policies for different operations

-- Policy for INSERT: Only the owner can insert their own tasks
CREATE POLICY "Users can insert own tasks" 
ON public.ads_tasks 
FOR INSERT 
WITH CHECK (ads_manager_id = auth.uid());

-- Policy for UPDATE: Owner OR CEO can update tasks
CREATE POLICY "Users can update own tasks or CEO can update any" 
ON public.ads_tasks 
FOR UPDATE 
USING (
  ads_manager_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'ceo'::user_role
  )
);

-- Policy for DELETE: Owner OR CEO can delete tasks
CREATE POLICY "Users can delete own tasks or CEO can delete any" 
ON public.ads_tasks 
FOR DELETE 
USING (
  ads_manager_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'ceo'::user_role
  )
);