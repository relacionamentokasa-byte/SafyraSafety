-- 1. Tabela de Regiões
CREATE TABLE public.regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    state CHAR(2) NOT NULL,
    cities TEXT[] DEFAULT '{}',
    status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.regions TO authenticated;
GRANT ALL ON public.regions TO service_role;

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage regions" ON public.regions
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view active regions" ON public.regions
    FOR SELECT TO authenticated USING (status = 'active');

-- 2. Atualizar a tabela representatives para incluir campos do Prompt 02
ALTER TABLE public.representatives 
    ADD COLUMN region_id UUID REFERENCES public.regions(id),
    ADD COLUMN code TEXT UNIQUE,
    ADD COLUMN cpf TEXT UNIQUE,
    ADD COLUMN birth_date DATE,
    ADD COLUMN whatsapp TEXT,
    ADD COLUMN email TEXT,
    ADD COLUMN monthly_goal DECIMAL DEFAULT 0,
    ADD COLUMN start_date DATE,
    ADD COLUMN status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    ADD COLUMN cep TEXT,
    ADD COLUMN address TEXT,
    ADD COLUMN number TEXT,
    ADD COLUMN complement TEXT,
    ADD COLUMN neighborhood TEXT,
    ADD COLUMN city TEXT,
    ADD COLUMN state CHAR(2),
    ADD COLUMN created_by UUID REFERENCES auth.users(id),
    ADD COLUMN updated_by UUID REFERENCES auth.users(id);

-- 3. Atualizar a tabela profiles para incluir campos de auditoria e telefone
ALTER TABLE public.profiles
    ADD COLUMN phone TEXT,
    ADD COLUMN status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    ADD COLUMN last_access TIMESTAMPTZ;

-- 4. Função para registrar auditoria (representantes)
CREATE OR REPLACE FUNCTION public.handle_representatives_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by = auth.uid();
  END IF;
  NEW.updated_by = auth.uid();
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_representative_audit
    BEFORE INSERT OR UPDATE ON public.representatives
    FOR EACH ROW EXECUTE FUNCTION public.handle_representatives_audit();

-- 5. Preparar tabelas para próximos módulos (Follow-ups, Oportunidades, Metas, Comissões)
CREATE TABLE public.opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    representative_id UUID REFERENCES public.representatives(id),
    client_id UUID REFERENCES public.clients(id),
    title TEXT NOT NULL,
    description TEXT,
    value DECIMAL DEFAULT 0,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO authenticated;
GRANT ALL ON public.opportunities TO service_role;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    representative_id UUID REFERENCES public.representatives(id),
    client_id UUID REFERENCES public.clients(id),
    opportunity_id UUID REFERENCES public.opportunities(id),
    description TEXT,
    scheduled_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_ups TO authenticated;
GRANT ALL ON public.follow_ups TO service_role;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    representative_id UUID REFERENCES public.representatives(id),
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    target_value DECIMAL DEFAULT 0,
    achieved_value DECIMAL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    representative_id UUID REFERENCES public.representatives(id),
    order_id UUID,
    value DECIMAL DEFAULT 0,
    paid BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commissions TO authenticated;
GRANT ALL ON public.commissions TO service_role;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reps see their own opportunities" ON public.opportunities FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR representative_id IN (SELECT id FROM public.representatives WHERE user_id = auth.uid()));
CREATE POLICY "Reps see their own follow-ups" ON public.follow_ups FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR representative_id IN (SELECT id FROM public.representatives WHERE user_id = auth.uid()));
CREATE POLICY "Reps see their own goals" ON public.goals FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR representative_id IN (SELECT id FROM public.representatives WHERE user_id = auth.uid()));
CREATE POLICY "Reps see their own commissions" ON public.commissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR representative_id IN (SELECT id FROM public.representatives WHERE user_id = auth.uid()));
