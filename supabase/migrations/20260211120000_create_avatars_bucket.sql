-- ============================================
-- AVATARS: Bucket e políticas para foto de perfil
-- ============================================

-- 1. Criar bucket avatars (público para exibir avatares via getPublicUrl)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas RLS em storage.objects para avatars

-- SELECT: usuários autenticados podem ler (exibir avatares na app)
CREATE POLICY "avatars_storage_select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

-- INSERT: usuário só pode enviar em seu próprio diretório {user_id}/*
CREATE POLICY "avatars_storage_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE: usuário só pode remover arquivos no próprio diretório
CREATE POLICY "avatars_storage_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Policy para usuários atualizarem o próprio perfil (avatar)
-- CEO continua podendo atualizar qualquer perfil; usuários podem atualizar o próprio
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (user_id = auth.uid());
