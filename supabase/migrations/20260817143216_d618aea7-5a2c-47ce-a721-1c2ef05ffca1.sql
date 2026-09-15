-- 1. Enums
CREATE TYPE public.material_category AS ENUM (
    'Catálogos', 
    'Fichas técnicas', 
    'Apresentações', 
    'Tabelas comerciais', 
    'Imagens', 
    'Vídeos', 
    'Campanhas', 
    'Materiais de treinamento', 
    'Outros'
);

CREATE TYPE public.material_status AS ENUM ('active', 'inactive');

-- 2. Tables
CREATE TABLE public.commercial_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category material_category NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
    status material_status NOT NULL DEFAULT 'active',
    file_url TEXT NOT NULL,
    file_type TEXT, 
    file_size INTEGER, 
    cover_image_url TEXT,
    observations TEXT,
    usage_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.material_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID REFERENCES public.commercial_materials(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL, 
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Indexes
CREATE INDEX idx_materials_product ON public.commercial_materials(product_id);
CREATE INDEX idx_materials_category ON public.commercial_materials(category);
CREATE INDEX idx_materials_status ON public.commercial_materials(status);
CREATE INDEX idx_material_history_material ON public.material_history(material_id);

-- 4. RLS & Grants
ALTER TABLE public.commercial_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_history ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.commercial_materials TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.commercial_materials TO authenticated;
GRANT ALL ON public.commercial_materials TO service_role;

GRANT SELECT ON public.material_history TO authenticated;
GRANT INSERT ON public.material_history TO authenticated;
GRANT ALL ON public.material_history TO service_role;

-- 5. Policies
CREATE POLICY "View materials policy" ON public.commercial_materials
FOR SELECT TO authenticated
USING (
    status = 'active' OR 
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'gestor_comercial')
);

CREATE POLICY "Manage materials policy" ON public.commercial_materials
FOR ALL TO authenticated
USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'gestor_comercial')
)
WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'gestor_comercial')
);

CREATE POLICY "View history policy" ON public.material_history
FOR SELECT TO authenticated
USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'gestor_comercial')
);

CREATE POLICY "Insert history policy" ON public.material_history
FOR INSERT TO authenticated
WITH CHECK (true); 

-- 6. Triggers
CREATE OR REPLACE FUNCTION public.handle_material_updated()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_material_updated
    BEFORE UPDATE ON public.commercial_materials
    FOR EACH ROW EXECUTE FUNCTION public.handle_material_updated();

CREATE OR REPLACE FUNCTION public.log_material_action()
RETURNS TRIGGER AS $$
DECLARE
    action_name TEXT;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        action_name := 'created';
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.status = 'inactive' AND NEW.status = 'active') THEN
            action_name := 'activated';
        ELSIF (OLD.status = 'active' AND NEW.status = 'inactive') THEN
            action_name := 'deactivated';
        ELSE
            action_name := 'updated';
        END IF;
    END IF;

    INSERT INTO public.material_history (material_id, user_id, action, details)
    VALUES (
        NEW.id, 
        auth.uid(), 
        action_name, 
        jsonb_build_object('name', NEW.name, 'category', NEW.category)
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER tr_log_material_action
    AFTER INSERT OR UPDATE ON public.commercial_materials
    FOR EACH ROW EXECUTE FUNCTION public.log_material_action();
