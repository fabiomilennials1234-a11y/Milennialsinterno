-- Update storage policies to include devs and editor_video roles for card attachments

-- Drop existing policies
DROP POLICY IF EXISTS card_attachments_storage_insert ON storage.objects;
DROP POLICY IF EXISTS card_attachments_storage_delete ON storage.objects;

-- Create updated insert policy that includes more roles
CREATE POLICY card_attachments_storage_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'card-attachments' AND
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'design', 'editor_video', 'devs', 'sucesso_cliente')
  )
);

-- Create updated delete policy that includes more roles
CREATE POLICY card_attachments_storage_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'card-attachments' AND
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'design', 'editor_video', 'devs')
  )
);