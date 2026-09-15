-- Remover políticas antigas
DROP POLICY IF EXISTS "Allow Public View" ON storage.objects;
DROP POLICY IF EXISTS "Allow Authenticated Manage" ON storage.objects;

-- Criar política de leitura pública irrestrita para este bucket específico
-- Mesmo se o bucket for 'private', a política RLS 'FOR SELECT TO public' permite a visualização via URL pública
CREATE POLICY "Allow Public View"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company_assets_private');

-- Criar política para gerenciamento
CREATE POLICY "Allow Authenticated Manage"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'company_assets_private')
WITH CHECK (bucket_id = 'company_assets_private');
