-- Grant select to authenticated role just in case RLS is missing it
GRANT SELECT ON public.company_settings TO authenticated;
GRANT SELECT ON public.company_settings TO anon;

-- Ensure RLS is enabled
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing read policy if any to avoid conflicts
DROP POLICY IF EXISTS "Allow public read for company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Permitir leitura para todos os usuários" ON public.company_settings;

-- Create a robust policy
CREATE POLICY "Allow read access for all" 
ON public.company_settings 
FOR SELECT 
TO public
USING (true);
