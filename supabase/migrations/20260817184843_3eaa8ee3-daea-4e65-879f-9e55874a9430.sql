-- Políticas de acesso para o bucket company_assets_private
-- Permitir leitura para usuários autenticados
CREATE POLICY "Auth View Assets" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'company_assets_private');

-- Permitir upload e gestão para usuários autenticados
CREATE POLICY "Auth Manage Assets" ON storage.objects FOR ALL TO authenticated 
USING (bucket_id = 'company_assets_private')
WITH CHECK (bucket_id = 'company_assets_private');
