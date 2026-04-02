-- Allow sucesso_cliente to view ALL profiles
-- Without this, they only see profiles in their own group/squad,
-- causing the Sucesso do Cliente kanban to show incomplete manager lists

CREATE POLICY "Sucesso do Cliente can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'sucesso_cliente'));
