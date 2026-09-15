-- Criar tabela de Tabelas de Preço (price_tables)
CREATE TABLE IF NOT EXISTS public.price_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    description TEXT,
    manufacturer_id UUID REFERENCES public.manufacturers(id) ON DELETE SET NULL,
    target_audience TEXT NOT NULL DEFAULT 'geral', -- 'consumidor_final', 'revenda', 'industria', 'distribuidor', 'geral'
    region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
    is_default BOOLEAN DEFAULT false,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela de Itens da Tabela de Preço (price_table_items)
CREATE TABLE IF NOT EXISTS public.price_table_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_table_id UUID NOT NULL REFERENCES public.price_tables(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    min_price NUMERIC(15, 2),
    max_discount_percent NUMERIC(5, 2) DEFAULT 0.00,
    commission_rate NUMERIC(5, 2),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_price_table_product UNIQUE (price_table_id, product_id)
);

-- Adicionar vínculo de tabela de preço padrão no cliente se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'clients'
        AND column_name = 'price_table_id'
    ) THEN
        ALTER TABLE public.clients
        ADD COLUMN price_table_id UUID REFERENCES public.price_tables(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Índices para otimização de consultas de preços
CREATE INDEX IF NOT EXISTS idx_price_tables_manufacturer ON public.price_tables(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_price_tables_target ON public.price_tables(target_audience);
CREATE INDEX IF NOT EXISTS idx_price_table_items_table ON public.price_table_items(price_table_id);
CREATE INDEX IF NOT EXISTS idx_price_table_items_product ON public.price_table_items(product_id);
CREATE INDEX IF NOT EXISTS idx_clients_price_table ON public.clients(price_table_id);

-- Habilitar RLS
ALTER TABLE public.price_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_table_items ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS permissivas para o app
CREATE POLICY "Permitir leitura de price_tables para todos autenticados e anônimos"
ON public.price_tables FOR SELECT
USING (true);

CREATE POLICY "Permitir inserção/atualização de price_tables"
ON public.price_tables FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Permitir leitura de price_table_items para todos autenticados e anônimos"
ON public.price_table_items FOR SELECT
USING (true);

CREATE POLICY "Permitir inserção/atualização de price_table_items"
ON public.price_table_items FOR ALL
USING (true)
WITH CHECK (true);
