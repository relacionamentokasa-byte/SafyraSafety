-- Fix security issues from the previous migration

-- 1. Secure update_goal_realized function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Revoke public execute from security definer functions
REVOKE EXECUTE ON FUNCTION public.update_goal_realized() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;

-- 3. Grant execute to authenticated users for has_role (needed for RLS)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;

-- 4. Note: update_goal_realized is used only by trigger (which runs as superuser/owner)
-- so it doesn't need to be granted to authenticated.
GRANT EXECUTE ON FUNCTION public.update_goal_realized() TO service_role;
