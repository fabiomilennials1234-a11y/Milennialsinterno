-- Allow sucesso_cliente role to UPDATE clients for CX validation workflow
-- Without this policy, the CX validation popup mutations fail silently due to RLS

CREATE POLICY "Sucesso do Cliente can update clients for CX validation"
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'sucesso_cliente'))
  WITH CHECK (public.has_role(auth.uid(), 'sucesso_cliente'));
