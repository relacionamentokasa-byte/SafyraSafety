-- Store manufacturer logo paths independently from public URLs.

ALTER TABLE public.manufacturers
  ADD COLUMN IF NOT EXISTS logo_path TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('company_assets_v2', 'company_assets_v2', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public Read V2" ON storage.objects;
DROP POLICY IF EXISTS "Auth Manage V2" ON storage.objects;
DROP POLICY IF EXISTS "Manufacturer logos are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users manage non-manufacturer assets V2" ON storage.objects;
DROP POLICY IF EXISTS "Admins and managers manage manufacturer logos" ON storage.objects;

CREATE POLICY "Public Read V2"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'company_assets_v2');

CREATE POLICY "Authenticated users manage non-manufacturer assets V2"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'company_assets_v2'
    AND name NOT LIKE 'manufacturers/%'
  )
  WITH CHECK (
    bucket_id = 'company_assets_v2'
    AND name NOT LIKE 'manufacturers/%'
  );

CREATE POLICY "Admins and managers manage manufacturer logos"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'company_assets_v2'
    AND name LIKE 'manufacturers/%'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_comercial'))
  )
  WITH CHECK (
    bucket_id = 'company_assets_v2'
    AND name LIKE 'manufacturers/%'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_comercial'))
  );

GRANT SELECT ON public.manufacturers TO authenticated;
