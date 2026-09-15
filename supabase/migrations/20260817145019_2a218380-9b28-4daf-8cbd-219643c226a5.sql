-- Criar tabelas de configurações da empresa e sistema
CREATE TABLE IF NOT EXISTS public.company_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    legal_name TEXT,
    cnpj TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    logo_url TEXT,
    logo_docs_url TEXT,
    favicon_url TEXT,
    primary_color TEXT DEFAULT '#3b82f6',
    secondary_color TEXT DEFAULT '#1e293b',
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.system_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    language TEXT DEFAULT 'pt-BR',
    currency TEXT DEFAULT 'BRL',
    date_format TEXT DEFAULT 'DD/MM/YYYY',
    items_per_page INTEGER DEFAULT 20,
    timezone TEXT DEFAULT 'America/Sao_Paulo',
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_preferences TO authenticated;
GRANT ALL ON public.system_preferences TO service_role;

-- RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_preferences ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Acesso de leitura para usuários autenticados - Empresa"
ON public.company_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Acesso total para Admins - Empresa"
ON public.company_settings FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Acesso de leitura para usuários autenticados - Preferências"
ON public.system_preferences FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Acesso total para Admins - Preferências"
ON public.system_preferences FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Criar buckets se ainda não existirem (usando SQL como fallback se a ferramenta falhou por permissão, mas aqui focamos no RLS das tabelas que faltavam)
