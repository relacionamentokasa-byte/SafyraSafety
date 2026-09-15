-- Restringe alterações no bucket privado à pasta do usuário autenticado.
-- A leitura continua disponível para usuários autenticados para exibir fotos da equipe.

DROP POLICY IF EXISTS "Leitura autenticada em avatars-new-private" ON storage.objects;
DROP POLICY IF EXISTS "Upload autenticado em avatars-new-private" ON storage.objects;
DROP POLICY IF EXISTS "Update autenticado em avatars-new-private" ON storage.objects;
DROP POLICY IF EXISTS "Delete autenticado em avatars-new-private" ON storage.objects;

CREATE POLICY "Leitura autenticada em avatars-new-private"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars-new-private');

CREATE POLICY "Upload na pasta própria de avatars-new-private"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars-new-private'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Atualização na pasta própria de avatars-new-private"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars-new-private'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars-new-private'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Exclusão na pasta própria de avatars-new-private"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars-new-private'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
