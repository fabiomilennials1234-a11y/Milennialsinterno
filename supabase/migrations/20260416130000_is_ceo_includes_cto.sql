-- 20260416130000_is_ceo_includes_cto.sql
--
-- Fixes: CTO users see empty users/profiles lists, empty clients tabs, and
-- broken kanban visibility because every existing RLS policy still relies on
-- public.is_ceo(_user_id), which only returned true for role='ceo'.
--
-- History: 20260415120000_add_cto_role.sql asserted no policies referenced the
-- 'ceo' literal and left is_ceo() untouched. That scan was wrong — 14
-- migrations call is_ceo(auth.uid()) as an authorization gate (clients,
-- profiles via can_view_user, kanban_boards via can_view_board, onboarding_*,
-- pro_tools, company_content, group_role_limits, product_categories,
-- trainings, custom_roles, organization_groups management, squads management,
-- independent_categories management, user_roles CUD, ads_*_notifications,
-- etc.). The 20260415120001 migration introduced is_executive() but nothing
-- was rewritten to call it, so CTO silently inherited none of CEO's access.
--
-- Rather than DROP/CREATE every dependent policy (high churn, risk of missing
-- one), redefine is_ceo() so CTO is treated as an executive everywhere at once.
-- is_executive() is kept as the canonical name for new code; is_ceo() is now
-- an alias for backward compatibility.

CREATE OR REPLACE FUNCTION public.is_ceo(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('ceo', 'cto')
  )
$$;
