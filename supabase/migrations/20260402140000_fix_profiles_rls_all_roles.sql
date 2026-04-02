-- Fix: Allow all operational roles to view ALL profiles for sidebar consistency.
-- The existing policy "Users can view profiles in their group/squad" is kept intact.
-- These new permissive policies (OR logic) grant each role full profile visibility,
-- so every role sees the same group/squad structure as the CEO in the sidebar.
-- Access control for which kanbans each role can see is handled at the
-- application layer via BOARD_VISIBILITY, not at the database level.

CREATE POLICY "Gestor de Ads can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'gestor_ads'));

CREATE POLICY "Financeiro can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'financeiro'));

CREATE POLICY "Consultor Comercial can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'consultor_comercial'));

CREATE POLICY "Outbound can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'outbound'));

CREATE POLICY "Design can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'design'));

CREATE POLICY "Editor Video can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'editor_video'));

CREATE POLICY "Devs can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'devs'));

CREATE POLICY "RH can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'rh'));

CREATE POLICY "Gestor CRM can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'gestor_crm'));
