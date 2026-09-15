-- Create order status enum
DO $$ BEGIN
    CREATE TYPE public.order_status AS ENUM (
        'draft',
        'sent',
        'analysis',
        'approved',
        'invoiced',
        'delivered',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create orders table
CREATE TABLE IF NOT EXISTS public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL,
    client_id uuid REFERENCES public.clients(id) NOT NULL,
    representative_id uuid REFERENCES public.representatives(id) NOT NULL,
    opportunity_id uuid REFERENCES public.opportunities(id),
    status order_status NOT NULL DEFAULT 'draft',
    
    -- Financials
    subtotal_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    
    -- Commercial Conditions
    payment_method TEXT,
    payment_condition TEXT,
    payment_term TEXT,
    expected_delivery_date DATE,
    
    -- Observations
    commercial_notes TEXT,
    internal_notes TEXT,
    billing_notes TEXT,
    cancellation_reason TEXT,
    rejection_reason TEXT,
    
    -- Metadata
    origin TEXT DEFAULT 'Web',
    created_by uuid REFERENCES auth.users(id),
    updated_by uuid REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create order items table
CREATE TABLE IF NOT EXISTS public.order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    product_id uuid REFERENCES public.products(id) NOT NULL,
    quantity NUMERIC(15,4) NOT NULL DEFAULT 1,
    unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create order history table
CREATE TABLE IF NOT EXISTS public.order_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id),
    action TEXT NOT NULL,
    previous_status order_status,
    new_status order_status,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Function for automatic order numbering
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
    next_val BIGINT;
BEGIN
    IF NEW.order_number IS NULL THEN
        SELECT COALESCE(MAX(SUBSTRING(order_number FROM 5)::BIGINT), 0) + 1 
        INTO next_val 
        FROM public.orders;
        
        NEW.order_number := 'PED-' || LPAD(next_val::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.generate_order_number();

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

GRANT SELECT, INSERT ON public.order_history TO authenticated;
GRANT ALL ON public.order_history TO service_role;

-- RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_history ENABLE ROW LEVEL SECURITY;

-- Policies for orders
CREATE POLICY "Admins can do everything on orders"
ON public.orders FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestores can see and manage team orders"
ON public.orders FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'gestor_comercial'));

CREATE POLICY "Representatives can see their own orders"
ON public.orders FOR SELECT TO authenticated
USING (representative_id IN (SELECT id FROM public.representatives WHERE user_id = auth.uid()));

CREATE POLICY "Representatives can insert their own orders"
ON public.orders FOR INSERT TO authenticated
WITH CHECK (representative_id IN (SELECT id FROM public.representatives WHERE user_id = auth.uid()));

CREATE POLICY "Representatives can update their own draft orders"
ON public.orders FOR UPDATE TO authenticated
USING (
    representative_id IN (SELECT id FROM public.representatives WHERE user_id = auth.uid()) 
    AND status = 'draft'
)
WITH CHECK (
    representative_id IN (SELECT id FROM public.representatives WHERE user_id = auth.uid())
);

-- Policies for order items (follow parent order access)
CREATE POLICY "Order items access"
ON public.order_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders WHERE id = order_items.order_id));

-- Policies for history
CREATE POLICY "Order history access"
ON public.order_history FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders WHERE id = order_history.order_id));

