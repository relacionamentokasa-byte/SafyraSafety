-- Política para permitir que usuários autenticados leiam objetos deste bucket
CREATE POLICY "Leitura autenticada em avatars-new-private"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars-new-private');

-- Política para permitir que usuários autenticados façam upload
CREATE POLICY "Upload autenticado em avatars-new-private"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars-new-private');

-- Política para permitir que usuários autenticados atualizem seus uploads
CREATE POLICY "Update autenticado em avatars-new-private"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars-new-private');
