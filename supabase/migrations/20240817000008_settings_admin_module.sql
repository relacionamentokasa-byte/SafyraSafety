-- Tabela de Dados da Empresa
CREATE TABLE public.company_settings (
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

GRANT SELECT ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
GRANT UPDATE ON public.company_settings TO authenticated; -- Policies will restrict to admin

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage company settings"
ON public.company_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone authenticated can read company settings"
ON public.company_settings
FOR SELECT
TO authenticated
USING (true);

-- Tabela de Preferências Globais do Sistema
CREATE TABLE public.system_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date_format TEXT DEFAULT 'DD/MM/YYYY',
    currency_code TEXT DEFAULT 'BRL',
    timezone TEXT DEFAULT 'America/Sao_Paulo',
    default_pagination INTEGER DEFAULT 10,
    language TEXT DEFAULT 'pt-BR',
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT ON public.system_preferences TO authenticated;
GRANT ALL ON public.system_preferences TO service_role;
GRANT UPDATE ON public.system_preferences TO authenticated;

ALTER TABLE public.system_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage system preferences"
ON public.system_preferences
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone authenticated can read system preferences"
ON public.system_preferences
FOR SELECT
TO authenticated
USING (true);

-- Inserir dados iniciais caso não existam (Seed)
INSERT INTO public.company_settings (company_name, legal_name)
SELECT 'Safyra Safety', 'Safyra Safety Enterprise'
WHERE NOT EXISTS (SELECT 1 FROM public.company_settings);

INSERT INTO public.system_preferences (language)
SELECT 'pt-BR'
WHERE NOT EXISTS (SELECT 1 FROM public.system_preferences);

-- Garantir que a tabela user_roles seja acessível para auditoria e gestão
-- (Já existe do bootstrap)

-- A tabela activity_log já foi criada no prompt anterior. 
-- Vamos apenas garantir que ela tenha suporte para auditoria detalhada se necessário.
-- Adicionando colunas de metadados se não existirem (já existem: details JSONB)

