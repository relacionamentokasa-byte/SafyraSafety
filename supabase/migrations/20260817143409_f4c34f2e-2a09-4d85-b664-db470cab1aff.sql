-- Policies for commercial_materials bucket
CREATE POLICY "View active materials" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'commercial_materials');

CREATE POLICY "Manage materials" ON storage.objects
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
