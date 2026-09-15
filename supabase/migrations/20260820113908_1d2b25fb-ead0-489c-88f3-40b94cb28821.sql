-- Módulo de Configuração de API (Google Maps e outros)
-- Adiciona suporte para armazenamento de chaves de API com segurança

-- 1. Adicionar coluna para Google Maps API Key na tabela company_settings
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'google_maps_api_key') THEN
        ALTER TABLE public.company_settings ADD COLUMN google_maps_api_key TEXT;
    END IF;
END $$;

-- 2. Garantir permissões
GRANT SELECT, UPDATE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;

-- 3. Comentário explicativo
COMMENT ON COLUMN public.company_settings.google_maps_api_key IS 'Chave de API do Google Maps para os módulos de Campo e Roteirização';