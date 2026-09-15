-- 1. Atualizar tabela de clientes
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS legal_name TEXT,
ADD COLUMN IF NOT EXISTS trade_name TEXT,
ADD COLUMN IF NOT EXISTS cnpj TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS state_registration TEXT,
ADD COLUMN IF NOT EXISTS segment TEXT,
ADD COLUMN IF NOT EXISTS client_type TEXT,
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'prospect' CHECK (status IN ('prospect', 'active', 'inactive', 'blocked')),
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS contact_role TEXT,
ADD COLUMN IF NOT EXISTS whatsapp TEXT,
ADD COLUMN IF NOT EXISTS address_number TEXT,
ADD COLUMN IF NOT EXISTS address_complement TEXT,
ADD COLUMN IF NOT EXISTS neighborhood TEXT,
ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES public.regions(id),
ADD COLUMN IF NOT EXISTS purchase_potential TEXT CHECK (purchase_potential IN ('alto', 'medio', 'baixo')),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. Tabela de Contatos do Cliente
CREATE TABLE IF NOT EXISTS public.client_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT,
    phone TEXT,
    whatsapp TEXT,
    email TEXT,
    notes TEXT,
    is_main BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Histórico de Transferência de Clientes
CREATE TABLE IF NOT EXISTS public.client_transfer_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    previous_representative_id UUID REFERENCES public.representatives(id),
    new_representative_id UUID REFERENCES public.representatives(id),
    transferred_by UUID REFERENCES auth.users(id),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Segurança (RLS e Grants)
GRANT ALL ON public.client_contacts TO authenticated;
GRANT ALL ON public.client_transfer_history TO authenticated;
GRANT ALL ON public.client_contacts TO service_role;
GRANT ALL ON public.client_transfer_history TO service_role;

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_transfer_history ENABLE ROW LEVEL SECURITY;

-- Políticas para Contatos
CREATE POLICY "Admins can manage contacts" ON public.client_contacts
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Representatives can manage contacts of their clients" ON public.client_contacts
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.clients c
            JOIN public.representatives r ON c.representative_id = r.id
            WHERE c.id = client_contacts.client_id AND r.user_id = auth.uid()
        )
    );

-- Políticas para Transferência (Só Admin/Gestor)
CREATE POLICY "Admins/Managers can see transfer history" ON public.client_transfer_history
    FOR SELECT TO authenticated USING (
        public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_comercial')
    );

-- 5. Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_client_contacts_updated_at BEFORE UPDATE ON public.client_contacts FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
