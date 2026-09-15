-- Certificar que a tabela existe e tem RLS configurado corretamente
CREATE TABLE IF NOT EXISTS public.company_settings (
    id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    company_name TEXT DEFAULT 'Safyra Safety',
    google_maps_api_key TEXT,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#001942',
    secondary_color TEXT DEFAULT '#ff8800',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS se não estiver
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Garantir acesso para leitura
DROP POLICY IF EXISTS "Allow public read for company settings" ON public.company_settings;
CREATE POLICY "Allow public read for company settings" 
ON public.company_settings FOR SELECT 
TO authenticated, anon 
USING (true);

-- Garantir permissões de API
GRANT SELECT ON public.company_settings TO authenticated, anon;
GRANT ALL ON public.company_settings TO service_role;

-- Inserir o registro padrão se não existir ou atualizar a chave
INSERT INTO public.company_settings (id, company_name, google_maps_api_key, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'Safyra Safety', 'AIzaSyCKbLyHj_Hs6DJ-7U2u4GxouvLlYdAOjA0', now())
ON CONFLICT (id) DO UPDATE 
SET google_maps_api_key = 'AIzaSyCKbLyHj_Hs6DJ-7U2u4GxouvLlYdAOjA0',
    updated_at = now();
