CREATE OR REPLACE FUNCTION public.get_dashboard_stats(_user_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    result JSON;
    total_sales NUMERIC;
    total_orders BIGINT;
    active_clients BIGINT;
    pending_visits BIGINT;
    new_clients_month BIGINT;
BEGIN
    SELECT COALESCE(SUM(total_amount), 0) INTO total_sales 
    FROM orders 
    WHERE status != 'cancelled'
    AND (_user_id IS NULL OR representative_id IN (SELECT id FROM representatives WHERE user_id = _user_id));

    SELECT COUNT(*) INTO total_orders 
    FROM orders 
    WHERE created_at >= CURRENT_DATE
    AND (_user_id IS NULL OR representative_id IN (SELECT id FROM representatives WHERE user_id = _user_id));

    SELECT COUNT(*) INTO active_clients 
    FROM clients 
    WHERE status = 'active'
    AND (_user_id IS NULL OR representative_id IN (SELECT id FROM representatives WHERE user_id = _user_id));

    SELECT COUNT(*) INTO pending_visits 
    FROM visits 
    WHERE status = 'scheduled'
    AND scheduled_at >= CURRENT_DATE
    AND (_user_id IS NULL OR representative_id IN (SELECT id FROM representatives WHERE user_id = _user_id));

    SELECT COUNT(*) INTO new_clients_month 
    FROM clients 
    WHERE created_at >= date_trunc('month', CURRENT_DATE)
    AND (_user_id IS NULL OR representative_id IN (SELECT id FROM representatives WHERE user_id = _user_id));

    result = json_build_object(
        'total_sales', total_sales,
        'orders_today', total_orders,
        'active_clients', active_clients,
        'pending_visits', pending_visits,
        'new_clients_month', new_clients_month
    );

    RETURN result;
END;
$function$;