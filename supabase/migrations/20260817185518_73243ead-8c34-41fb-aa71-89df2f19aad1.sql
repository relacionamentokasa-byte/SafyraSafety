
-- 1. Grant access to everyone to see logos since they are public assets
-- We already have the bucket, but let's ensure the policies allow public read
-- even if the bucket 'public' flag failed (it might be because of workspace policy).
-- If public buckets are blocked, we MUST use a proxy or signed URLs, but 
-- since the user says they "load but don't appear" it might be RLS on storage.objects.

DO $$
BEGIN
    -- Policy for public read access to company assets
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Public Access to Company Assets'
    ) THEN
        CREATE POLICY "Public Access to Company Assets"
        ON storage.objects FOR SELECT
        TO public
        USING (bucket_id = 'company_assets_private');
    END IF;

    -- Policy for authenticated users to upload/manage
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Authenticated users can manage company assets'
    ) THEN
        CREATE POLICY "Authenticated users can manage company assets"
        ON storage.objects FOR ALL
        TO authenticated
        USING (bucket_id = 'company_assets_private')
        WITH CHECK (bucket_id = 'company_assets_private');
    END IF;
END $$;
