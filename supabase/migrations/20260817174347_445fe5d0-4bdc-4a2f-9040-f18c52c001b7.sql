-- 1. Tabela de Fabricantes
CREATE TABLE public.manufacturers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cnpj TEXT UNIQUE,
    contact_info JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturers TO authenticated;
GRANT ALL ON public.manufacturers TO service_role;

ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e Gestores podem gerenciar fabricantes"
ON public.manufacturers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_comercial'));

CREATE POLICY "Representantes podem visualizar fabricantes"
ON public.manufacturers
FOR SELECT
TO authenticated
USING (true);

-- 2. Tabela de Pagamentos de Pedidos (Liquidez)
CREATE TABLE public.order_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    value NUMERIC(15,2) NOT NULL,
    received_value NUMERIC(15,2) DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')) DEFAULT 'pending',
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_payments TO authenticated;
GRANT ALL ON public.order_payments TO service_role;

ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e Gestores podem gerenciar pagamentos"
ON public.order_payments
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_comercial'));

CREATE POLICY "Representantes podem visualizar pagamentos de seus pedidos"
ON public.order_payments
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = public.order_payments.order_id
        AND o.representative_id IN (
            SELECT id FROM public.representatives WHERE user_id = auth.uid()
        )
    )
);

-- 3. Ajuste em Products para incluir fabricante
ALTER TABLE public.products ADD COLUMN manufacturer_id UUID REFERENCES public.manufacturers(id);

-- 4. Ajuste em Commission Rules para incluir fabricante
ALTER TABLE public.commission_rules ADD COLUMN manufacturer_id UUID REFERENCES public.manufacturers(id);

-- 5. Reestruturação da Tabela de Comissões
-- Adicionar as colunas e ajustar
ALTER TABLE public.commissions 
ADD COLUMN order_payment_id UUID REFERENCES public.order_payments(id),
ADD COLUMN manufacturer_id UUID REFERENCES public.manufacturers(id),
ADD COLUMN base_value NUMERIC(15,2),
ADD COLUMN commission_rate NUMERIC(5,2);

-- 6. Auditoria e Logs
CREATE TABLE public.commission_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commission_id UUID REFERENCES public.commissions(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB,
    performed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT ON public.commission_logs TO authenticated;
GRANT ALL ON public.commission_logs TO service_role;

ALTER TABLE public.commission_logs ENABLE ROW LEVEL SECURITY;

-- 7. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_manufacturers_updated_at BEFORE UPDATE ON public.manufacturers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_order_payments_updated_at BEFORE UPDATE ON public.order_payments FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
