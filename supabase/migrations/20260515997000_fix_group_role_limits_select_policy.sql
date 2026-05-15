-- WHY: group_role_limits SELECT policy used auth.role() = 'authenticated' which
-- is functionally correct but inconsistent with the rest of the codebase (profiles
-- uses auth.uid() IS NOT NULL). Standardize on auth.uid() check for clarity and
-- to avoid edge cases where auth.role() might differ.
-- Also add missing index on group_role_limits(group_id) for RLS policy performance.

-- Replace SELECT policy with auth.uid() IS NOT NULL (matches profiles pattern)
DROP POLICY IF EXISTS "Authenticated users can view group role limits" ON public.group_role_limits;
CREATE POLICY "Authenticated users can view group role limits"
  ON public.group_role_limits
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Ensure index exists on group_id for policy/join performance
CREATE INDEX IF NOT EXISTS idx_group_role_limits_group_id ON public.group_role_limits (group_id);
