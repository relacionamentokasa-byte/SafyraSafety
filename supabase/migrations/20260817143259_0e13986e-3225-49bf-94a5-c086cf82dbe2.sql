-- Allow authenticated users to view materials in commercial_materials bucket
CREATE POLICY "View materials policy" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'commercial_materials');

-- Allow admins and gestores to upload/manage objects in commercial_materials bucket
CREATE POLICY "Manage materials policy" ON storage.objects
FOR ALL TO authenticated
USING (
    bucket_id = 'commercial_materials' AND (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'gestor_comercial')
    )
)
WITH CHECK (
    bucket_id = 'commercial_materials' AND (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'gestor_comercial')
    )
);
