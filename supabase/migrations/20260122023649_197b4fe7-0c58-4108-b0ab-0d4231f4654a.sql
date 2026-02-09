-- Drop existing policy
DROP POLICY IF EXISTS "Users can manage own documentation" ON public.ads_daily_documentation;
DROP POLICY IF EXISTS "Admin can view all documentation" ON public.ads_daily_documentation;

-- Create new comprehensive policies

-- SELECT: Users can see their own, admins can see all
CREATE POLICY "Users can view own documentation" 
ON public.ads_daily_documentation 
FOR SELECT 
USING (
  ads_manager_id = auth.uid() 
  OR public.is_admin(auth.uid())
);

-- INSERT: Users can insert their own, admins can insert for anyone
CREATE POLICY "Users can insert own documentation" 
ON public.ads_daily_documentation 
FOR INSERT 
WITH CHECK (
  ads_manager_id = auth.uid() 
  OR public.is_admin(auth.uid())
);

-- UPDATE: Users can update their own, admins can update any
CREATE POLICY "Users can update own documentation" 
ON public.ads_daily_documentation 
FOR UPDATE 
USING (
  ads_manager_id = auth.uid() 
  OR public.is_admin(auth.uid())
);

-- DELETE: Users can delete their own, admins can delete any
CREATE POLICY "Users can delete own documentation" 
ON public.ads_daily_documentation 
FOR DELETE 
USING (
  ads_manager_id = auth.uid() 
  OR public.is_admin(auth.uid())
);