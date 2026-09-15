-- Garantir que a tabela tenha todas as colunas necessárias para o formulário
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS logo_docs_url TEXT,
ADD COLUMN IF NOT EXISTS favicon_url TEXT,
ADD COLUMN IF NOT EXISTS trade_name TEXT;

-- Garantir GRANTs para a tabela
GRANT ALL ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;

-- Políticas de RLS para company_settings (se não existirem)
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view company settings') THEN
        CREATE POLICY "Anyone can view company settings" ON public.company_settings FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update company settings') THEN
        CREATE POLICY "Admins can update company settings" ON public.company_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
    END IF;
END $$;
