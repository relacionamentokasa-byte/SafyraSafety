-- 1. Estrutura de Categorias
CREATE TABLE IF NOT EXISTS public.product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for authenticated" ON public.product_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write for admin and gestor" ON public.product_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_comercial'));

-- 2. Atualização da Tabela de Produtos (Se já existe, adiciona campos)
-- Nota: A tabela 'products' já existe de forma simplificada, vamos expandi-la.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS trade_name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.product_categories(id);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unit TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive'));
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_price NUMERIC(15,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS commercial_notes TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS technical_specifications JSONB;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS applications TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS main_image_url TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Grants e RLS para Products (Garantir que estão ativos)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products visible to all authenticated" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Products manageable by admin and gestor" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_comercial'));

-- 3. Materiais Comerciais e Arquivos
CREATE TABLE IF NOT EXISTS public.product_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT, -- 'image', 'pdf', 'catalog', 'technical_sheet'
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_materials TO authenticated;
GRANT ALL ON public.product_materials TO service_role;
ALTER TABLE public.product_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Materials visible to all authenticated" ON public.product_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Materials manageable by admin and gestor" ON public.product_materials FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_comercial'));

-- 4. Histórico de Alterações de Produtos
CREATE TABLE IF NOT EXISTS public.product_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL, -- 'created', 'updated', 'status_change', 'price_change'
    changes JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT ON public.product_history TO authenticated;
GRANT ALL ON public.product_history TO service_role;
ALTER TABLE public.product_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "History visible to admin and gestor" ON public.product_history FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_comercial'));

-- 5. Trigger para Updated At
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_product_categories_updated_at BEFORE UPDATE ON public.product_categories FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
