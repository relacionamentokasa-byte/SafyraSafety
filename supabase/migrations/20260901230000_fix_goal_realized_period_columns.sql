CREATE OR REPLACE FUNCTION public.update_goal_realized()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_representative_id uuid;
BEGIN
  v_representative_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.representative_id
    ELSE NEW.representative_id
  END;

  UPDATE public.goals AS goal
  SET achieved_value = (
    SELECT COALESCE(SUM(order_row.total_amount), 0)
    FROM public.orders AS order_row
    WHERE order_row.representative_id = v_representative_id
      AND order_row.status NOT IN ('cancelled', 'draft')
      AND EXTRACT(MONTH FROM order_row.created_at)::integer = goal.month
      AND EXTRACT(YEAR FROM order_row.created_at)::integer = goal.year
  )
  WHERE goal.representative_id = v_representative_id;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_goal_realized() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_goal_realized() TO service_role;
