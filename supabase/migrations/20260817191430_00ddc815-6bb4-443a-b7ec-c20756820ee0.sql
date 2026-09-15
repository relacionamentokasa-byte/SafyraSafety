-- Habilitar RLS no storage.objects (normalmente já habilitado)
-- Mas garantir que este bucket específico tenha acesso público de leitura

DROP POLICY IF EXISTS "Public Read V2" ON storage.objects;
CREATE POLICY "Public Read V2"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company_assets_v2');

DROP POLICY IF EXISTS "Auth Manage V2" ON storage.objects;
CREATE POLICY "Auth Manage V2"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'company_assets_v2')
WITH CHECK (bucket_id = 'company_assets_v2');
