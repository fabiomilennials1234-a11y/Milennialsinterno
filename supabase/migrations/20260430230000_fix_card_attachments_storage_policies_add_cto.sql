-- 20260430230000_fix_card_attachments_storage_policies_add_cto.sql
--
-- Bug: storage policies de card-attachments INSERT/DELETE listavam
-- ['ceo','gestor_projetos','gestor_ads','design','editor_video','devs','sucesso_cliente']
-- esquecendo 'cto' e demais roles que precisam upload (atrizes_gravacao,
-- produtora). Pra CEO funciona; CTO falha em upload.
--
-- Fix: substitui por has_role check via is_admin (ceo/cto/gestor_projetos)
-- + outros roles operacionais. Mais robusto: usa funcao canonica is_admin.

BEGIN;

DROP POLICY IF EXISTS card_attachments_storage_insert ON storage.objects;
CREATE POLICY card_attachments_storage_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'card-attachments'
    AND (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role::text = ANY(ARRAY[
            'gestor_ads','design','editor_video','devs',
            'sucesso_cliente','produtora','atrizes_gravacao',
            'consultor_comercial','consultor_mktplace','gestor_crm',
            'outbound','rh','financeiro'
          ])
      )
    )
  );

DROP POLICY IF EXISTS card_attachments_storage_delete ON storage.objects;
CREATE POLICY card_attachments_storage_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'card-attachments'
    AND (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role::text = ANY(ARRAY[
            'gestor_ads','design','editor_video','devs',
            'sucesso_cliente','produtora','atrizes_gravacao',
            'consultor_comercial','consultor_mktplace','gestor_crm',
            'outbound','rh','financeiro'
          ])
      )
    )
  );

COMMIT;
