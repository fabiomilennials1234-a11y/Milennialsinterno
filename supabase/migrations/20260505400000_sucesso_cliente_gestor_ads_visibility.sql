-- 20260505400000_sucesso_cliente_gestor_ads_visibility.sql
--
-- Fix: sucesso_cliente cannot see data on /gestor-ads/{id} pages.
--
-- Root cause:
--   1. client_onboarding: no SELECT policy for sucesso_cliente or page_grant.
--      AdsOnboardingSection calls useClientOnboarding() which returns empty.
--   2. user_roles: SELECT restricted to own row + admin.
--      useAllGestorClientCounts() queries user_roles for gestor_ads IDs
--      to build sidebar counts — sucesso_cliente sees only own row → counts = 0.
--
-- Fix:
--   1. Add SELECT policy on client_onboarding for users with gestor-ads or
--      sucesso-cliente page access (mirrors pattern from clients/ads_tasks).
--   2. Add SELECT policy on user_roles for sucesso_cliente role.
--      user_roles is (user_id, role) — not sensitive. Sucesso_cliente needs
--      to enumerate gestores for operational visibility.

BEGIN;

-- =============================================
-- 1. client_onboarding: SELECT for page_grant
-- =============================================

DROP POLICY IF EXISTS client_onboarding_page_grant_select ON public.client_onboarding;
CREATE POLICY client_onboarding_page_grant_select ON public.client_onboarding
  FOR SELECT
  TO authenticated
  USING (
    public.can_access_page_data(auth.uid(), 'gestor-ads')
    OR public.can_access_page_data(auth.uid(), 'sucesso-cliente')
  );

-- =============================================
-- 2. user_roles: SELECT for sucesso_cliente
-- =============================================

DROP POLICY IF EXISTS user_roles_sucesso_cliente_select ON public.user_roles;
CREATE POLICY user_roles_sucesso_cliente_select ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'sucesso_cliente'::user_role)
  );

COMMIT;
