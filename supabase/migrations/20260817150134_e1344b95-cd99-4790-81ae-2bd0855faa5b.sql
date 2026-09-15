-- 1. Atualizar enum app_role se necessário
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'gestor_comercial', 'supervisor', 'representante');
    ELSE
        ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gestor_comercial';
        ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supervisor';
    END IF;
END $$;

-- 2. Criar enum de status de acesso
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_status') THEN
        CREATE TYPE public.access_status AS ENUM ('pendente', 'ativo', 'bloqueado', 'inativo');
    END IF;
END $$;

-- 3. Atualizar tabela de perfis (profiles)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status access_status DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS first_login_done BOOLEAN DEFAULT FALSE;

-- 4. Tabela de Auditoria de Acessos
CREATE TABLE IF NOT EXISTS public.access_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    performed_by UUID REFERENCES auth.users(id),
    target_user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT INSERT, SELECT ON public.access_audit_log TO authenticated;
GRANT ALL ON public.access_audit_log TO service_role;
ALTER TABLE public.access_audit_log ENABLE ROW LEVEL SECURITY;

-- 5. Função has_role (já deve existir, mas garantindo search_path e segurança)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- 6. RLS para access_audit_log
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.access_audit_log;
CREATE POLICY "Admins can view all audit logs" 
ON public.access_audit_log FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- 7. RLS para profiles (Admins gerenciam tudo)
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles"
ON public.profiles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 8. Função para verificar status ativo
CREATE OR REPLACE FUNCTION public.check_user_active()
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'ativo'
  );
END;
$$;
