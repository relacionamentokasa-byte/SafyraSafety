-- Índices para otimização de buscas e filtros frequentes

-- Clientes
CREATE INDEX IF NOT EXISTS idx_clients_cnpj ON public.clients (cnpj);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients (status);
CREATE INDEX IF NOT EXISTS idx_clients_representative_id ON public.clients (representative_id);
CREATE INDEX IF NOT EXISTS idx_clients_city ON public.clients (city);

-- Pedidos
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON public.orders (client_id);
CREATE INDEX IF NOT EXISTS idx_orders_representative_id ON public.orders (representative_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);

-- Visitas
CREATE INDEX IF NOT EXISTS idx_visits_client_id ON public.visits (client_id);
CREATE INDEX IF NOT EXISTS idx_visits_representative_id ON public.visits (representative_id);
CREATE INDEX IF NOT EXISTS idx_visits_status ON public.visits (status);
CREATE INDEX IF NOT EXISTS idx_visits_scheduled_at ON public.visits (scheduled_at DESC);

-- Oportunidades
CREATE INDEX IF NOT EXISTS idx_opportunities_client_id ON public.opportunities (client_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_representative_id ON public.opportunities (representative_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON public.opportunities (status);

-- Auditoria e Logs
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON public.activity_log (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications (is_read);

-- Funções para cálculos agregados no servidor (Dashboard)

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(_user_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSON;
    total_sales NUMERIC;
    total_orders BIGINT;
    active_clients BIGINT;
    pending_visits BIGINT;
    new_clients_month BIGINT;
BEGIN
    -- Se _user_id for fornecido, filtra por ele (Representante)
    -- Caso contrário, traz tudo (Admin/Gestor)
    
    SELECT COALESCE(SUM(total_amount), 0) INTO total_sales 
    FROM orders 
    WHERE status != 'cancelled'
    AND (_user_id IS NULL OR representative_id IN (SELECT id FROM representatives WHERE profile_id = _user_id));

    SELECT COUNT(*) INTO total_orders 
    FROM orders 
    WHERE created_at >= CURRENT_DATE
    AND (_user_id IS NULL OR representative_id IN (SELECT id FROM representatives WHERE profile_id = _user_id));

    SELECT COUNT(*) INTO active_clients 
    FROM clients 
    WHERE status = 'active'
    AND (_user_id IS NULL OR representative_id IN (SELECT id FROM representatives WHERE profile_id = _user_id));

    SELECT COUNT(*) INTO pending_visits 
    FROM visits 
    WHERE status = 'scheduled'
    AND scheduled_at >= CURRENT_DATE
    AND (_user_id IS NULL OR representative_id IN (SELECT id FROM representatives WHERE profile_id = _user_id));

    SELECT COUNT(*) INTO new_clients_month 
    FROM clients 
    WHERE created_at >= date_trunc('month', CURRENT_DATE)
    AND (_user_id IS NULL OR representative_id IN (SELECT id FROM representatives WHERE profile_id = _user_id));

    result = json_build_object(
        'total_sales', total_sales,
        'orders_today', total_orders,
        'active_clients', active_clients,
        'pending_visits', pending_visits,
        'new_clients_month', new_clients_month
    );

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(UUID) TO authenticated;
