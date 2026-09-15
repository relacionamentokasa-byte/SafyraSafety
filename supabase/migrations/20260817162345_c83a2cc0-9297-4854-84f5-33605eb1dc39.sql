
-- Tipos para status de rota e parada
DO $$ BEGIN
    CREATE TYPE public.route_status AS ENUM ('planejada', 'em_andamento', 'concluida', 'cancelada');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.route_stop_status AS ENUM ('pendente', 'em_deslocamento', 'em_visita', 'concluida', 'pulada', 'cancelada');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabela de Rotas
CREATE TABLE IF NOT EXISTS public.routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    representative_id UUID REFERENCES auth.users(id) NOT NULL,
    name TEXT NOT NULL,
    date DATE NOT NULL,
    status public.route_status DEFAULT 'planejada' NOT NULL,
    
    -- Resumo calculado (Google Maps)
    total_distance_km NUMERIC(10,2),
    total_duration_min INTEGER,
    
    -- Configurações de Origem/Destino
    origin_type TEXT CHECK (origin_type IN ('my_location', 'address', 'company', 'first_client')),
    origin_address TEXT,
    origin_lat NUMERIC(10,7),
    origin_lng NUMERIC(10,7),
    
    destination_type TEXT CHECK (destination_type IN ('last_client', 'company', 'custom_address', 'none')),
    destination_address TEXT,
    destination_lat NUMERIC(10,7),
    destination_lng NUMERIC(10,7),

    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela de Paradas da Rota
CREATE TABLE IF NOT EXISTS public.route_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES public.clients(id), -- Null se for apenas um endereço customizado
    visit_id UUID REFERENCES public.visits(id),   -- Link com a visita real
    
    sequence_order INTEGER NOT NULL,
    status public.route_stop_status DEFAULT 'pendente' NOT NULL,
    
    -- Dados geográficos do ponto
    label TEXT, -- Nome do cliente ou endereço
    latitude NUMERIC(10,7) NOT NULL,
    longitude NUMERIC(10,7) NOT NULL,
    
    -- Informações de trecho (Leg)
    distance_from_previous_km NUMERIC(10,2),
    duration_from_previous_min INTEGER,
    
    -- Planejamento de horário
    scheduled_time TIME,
    estimated_duration_min INTEGER DEFAULT 30,
    
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routes TO authenticated;
GRANT ALL ON public.routes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_stops TO authenticated;
GRANT ALL ON public.route_stops TO service_role;

-- RLS
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;

-- Políticas para Routes
CREATE POLICY "Representantes podem gerenciar suas próprias rotas"
ON public.routes FOR ALL
TO authenticated
USING (representative_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_comercial'));

-- Políticas para Route Stops
CREATE POLICY "Representantes podem gerenciar paradas de suas rotas"
ON public.route_stops FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.routes 
        WHERE id = route_stops.route_id 
        AND (representative_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_comercial'))
    )
);

-- Indices
CREATE INDEX idx_routes_representative ON public.routes(representative_id);
CREATE INDEX idx_routes_date ON public.routes(date);
CREATE INDEX idx_route_stops_route ON public.route_stops(route_id);
