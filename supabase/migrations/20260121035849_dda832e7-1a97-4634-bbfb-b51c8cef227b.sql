-- Update RLS policies for card_attachments to allow DEV roles to create/delete attachments

DROP POLICY IF EXISTS card_attachments_insert ON public.card_attachments;
DROP POLICY IF EXISTS card_attachments_delete ON public.card_attachments;

CREATE POLICY card_attachments_insert ON public.card_attachments
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'devs', 'sucesso_cliente')
  )
);

CREATE POLICY card_attachments_delete ON public.card_attachments
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'devs', 'sucesso_cliente')
  )
);