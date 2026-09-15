-- Migration for Goals and Commissions module

-- 1. Create Enums
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'goal_type') THEN
        CREATE TYPE public.goal_type AS ENUM ('monthly', 'quarterly', 'semiannual', 'annual');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'goal_status') THEN
        CREATE TYPE public.goal_status AS ENUM ('active', 'closed', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commission_status') THEN
        CREATE TYPE public.commission_status AS ENUM ('pending', 'approved', 'scheduled', 'paid', 'cancelled');
    END IF;
END $$;

-- 2. Goals Table
CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    representative_id UUID REFERENCES public.representatives(id) ON DELETE CASCADE NOT NULL,
    period TEXT NOT NULL, -- e.g., '2026-08'
    type goal_type NOT NULL DEFAULT 'monthly',
    target_value DECIMAL(12,2) NOT NULL DEFAULT 0,
    achieved_value DECIMAL(12,2) NOT NULL DEFAULT 0,
    status goal_status NOT NULL DEFAULT 'active',
    observations TEXT,
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Commission Rules Table
CREATE TABLE IF NOT EXISTS public.commission_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    representative_id UUID REFERENCES public.representatives(id) ON DELETE CASCADE, -- NULL means global/group
    category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    commission_rate DECIMAL(5,2) NOT NULL, -- e.g., 5.00 for 5%
    valid_from DATE,
    valid_until DATE,
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Commissions Table
CREATE TABLE IF NOT EXISTS public.commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    representative_id UUID REFERENCES public.representatives(id) ON DELETE CASCADE NOT NULL,
    rule_id UUID REFERENCES public.commission_rules(id) ON DELETE SET NULL,
    base_value DECIMAL(12,2) NOT NULL, -- Order total or eligible value
    commission_rate DECIMAL(5,2) NOT NULL, -- Snapshot of rate at calculation time
    commission_value DECIMAL(12,2) NOT NULL,
    status commission_status NOT NULL DEFAULT 'pending',
    expected_payment_date DATE,
    payment_date DATE,
    payment_value DECIMAL(12,2),
    payment_method TEXT,
    payment_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. History / Audit Table
CREATE TABLE IF NOT EXISTS public.commissions_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commission_id UUID REFERENCES public.commissions(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. RLS and Grants
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions_history ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
GRANT ALL ON public.commission_rules TO authenticated;
GRANT ALL ON public.commission_rules TO service_role;
GRANT ALL ON public.commissions TO authenticated;
GRANT ALL ON public.commissions TO service_role;
GRANT ALL ON public.commissions_history TO authenticated;
GRANT ALL ON public.commissions_history TO service_role;

-- 7. Policies

-- Goals Policies
CREATE POLICY "Admins/Gestores can manage goals" ON public.goals
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_comercial'));

CREATE POLICY "Representantes can view own goals" ON public.goals
    FOR SELECT TO authenticated
    USING (representative_id IN (SELECT id FROM public.representatives WHERE user_id = auth.uid()));

-- Commission Rules Policies
CREATE POLICY "Admins/Gestores can manage rules" ON public.commission_rules
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_comercial'));

CREATE POLICY "Anyone authenticated can view rules" ON public.commission_rules
    FOR SELECT TO authenticated
    USING (true);

-- Commissions Policies
CREATE POLICY "Admins/Gestores can manage commissions" ON public.commissions
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_comercial'));

CREATE POLICY "Representantes can view own commissions" ON public.commissions
    FOR SELECT TO authenticated
    USING (representative_id IN (SELECT id FROM public.representatives WHERE user_id = auth.uid()));

-- History Policies
CREATE POLICY "Everyone can view history" ON public.commissions_history
    FOR SELECT TO authenticated
    USING (true);

-- 8. Trigger to update achieved_value on goal when orders change
CREATE OR REPLACE FUNCTION public.update_goal_realized()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        UPDATE public.goals
        SET achieved_value = (
            SELECT COALESCE(SUM(total_amount), 0)
            FROM public.orders
            WHERE representative_id = NEW.representative_id
              AND status NOT IN ('cancelled', 'draft')
              AND to_char(created_at, 'YYYY-MM') = goals.period
        )
        WHERE representative_id = NEW.representative_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.goals
        SET achieved_value = (
            SELECT COALESCE(SUM(total_amount), 0)
            FROM public.orders
            WHERE representative_id = OLD.representative_id
              AND status NOT IN ('cancelled', 'draft')
              AND to_char(created_at, 'YYYY-MM') = goals.period
        )
        WHERE representative_id = OLD.representative_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_update_goal_realized
AFTER INSERT OR UPDATE OF total_amount, status OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.update_goal_realized();
