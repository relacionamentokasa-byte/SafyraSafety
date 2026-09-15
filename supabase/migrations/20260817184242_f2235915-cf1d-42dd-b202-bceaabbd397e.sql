-- Expansão da tabela company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS state_registration TEXT,
ADD COLUMN IF NOT EXISTS whatsapp TEXT,
ADD COLUMN IF NOT EXISTS neighborhood TEXT,
ADD COLUMN IF NOT EXISTS address_number TEXT,
ADD COLUMN IF NOT EXISTS address_complement TEXT;

-- Tabela para matriz de permissões
CREATE TABLE IF NOT EXISTS public.permission_matrix (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role public.app_role NOT NULL,
    module TEXT NOT NULL,
    can_view BOOLEAN DEFAULT false,
    can_create BOOLEAN DEFAULT false,
    can_edit BOOLEAN DEFAULT false,
    can_delete BOOLEAN DEFAULT false,
    can_approve BOOLEAN DEFAULT false,
    can_export BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id),
    UNIQUE(role, module)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.permission_matrix TO authenticated;
GRANT ALL ON public.permission_matrix TO service_role;

ALTER TABLE public.permission_matrix ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage permission matrix') THEN
        CREATE POLICY "Admins can manage permission matrix"
        ON public.permission_matrix
        FOR ALL
        TO authenticated
        USING (public.has_role(auth.uid(), 'admin'));
    END IF;
END $$;

-- Tabela para rastreio de importações
CREATE TABLE IF NOT EXISTS public.data_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    data_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'completed_with_errors', 'failed')),
    summary JSONB DEFAULT '{}'::jsonb,
    mapping JSONB NOT NULL,
    error_log JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.data_imports TO authenticated;
GRANT ALL ON public.data_imports TO service_role;

ALTER TABLE public.data_imports ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own imports') THEN
        CREATE POLICY "Users can view their own imports"
        ON public.data_imports
        FOR SELECT
        TO authenticated
        USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
    END IF;
END $$;
