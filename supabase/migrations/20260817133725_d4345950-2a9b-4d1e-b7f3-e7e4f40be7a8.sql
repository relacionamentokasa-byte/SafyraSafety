-- 1. Políticas de RLS para o bucket 'avatars' no storage.objects
-- Permitir leitura pública (já que o bucket é público, mas políticas explícitas garantem funcionamento)
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

-- Permitir upload apenas para usuários autenticados
CREATE POLICY "Authenticated users can upload" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'avatars');

-- Permitir atualização e exclusão para usuários autenticados
CREATE POLICY "Authenticated users can update" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can delete" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'avatars');

-- 2. Adicionar photo_url aos representantes
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='representatives' AND column_name='photo_url') THEN
        ALTER TABLE public.representatives ADD COLUMN photo_url TEXT;
    END IF;
END $$;

GRANT UPDATE(photo_url) ON public.representatives TO authenticated;
GRANT ALL ON public.representatives TO service_role;
