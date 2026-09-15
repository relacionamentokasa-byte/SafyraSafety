-- Fix UUID aggregation when settling order payments.

CREATE OR REPLACE FUNCTION public.settle_order_payment_and_commissions(
  p_payment_id UUID,
  p_received_value NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_status TEXT;
  v_payment public.order_payments%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_received NUMERIC(15,2);
  v_proportion NUMERIC;
  v_reference_date DATE;
  v_eligible_manufacturers INTEGER;
  v_inserted INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'NOT_AUTHENTICATED';
  END IF;

  SELECT status::text INTO v_profile_status
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_profile_status IS DISTINCT FROM 'ativo' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'USER_PROFILE_MISSING_OR_NOT_ACTIVE';
  END IF;

  IF NOT (
    public.has_role(v_user_id, 'admin')
    OR public.has_role(v_user_id, 'gestor_comercial')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PAYMENT_UPDATE_NOT_AUTHORIZED';
  END IF;

  SELECT * INTO v_payment
  FROM public.order_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'PAYMENT_NOT_FOUND';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_payment.order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'ORDER_NOT_FOUND';
  END IF;

  IF v_order.status NOT IN ('approved', 'invoiced', 'delivered') THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'ORDER_STATUS_NOT_SETTLEABLE';
  END IF;

  IF v_payment.status = 'cancelled' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'PAYMENT_STATUS_NOT_SETTLEABLE';
  END IF;

  IF v_order.representative_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'ORDER_REPRESENTATIVE_REQUIRED_FOR_COMMISSION';
  END IF;

  SELECT COUNT(DISTINCT p.manufacturer_id)
  INTO v_eligible_manufacturers
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = v_order.id
    AND p.manufacturer_id IS NOT NULL;

  IF v_eligible_manufacturers = 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'ORDER_HAS_NO_COMMISSIONABLE_ITEMS';
  END IF;

  IF v_payment.status = 'paid' THEN
    v_received := COALESCE(
      NULLIF(v_payment.received_value, 0),
      v_payment.value
    );

    IF p_received_value IS NOT NULL
       AND p_received_value <> v_received THEN
      RAISE EXCEPTION USING
        ERRCODE = '22023',
        MESSAGE = 'PAYMENT_ALREADY_SETTLED_VALUE_MISMATCH';
    END IF;

    v_reference_date := COALESCE(
      v_payment.received_at::DATE,
      CURRENT_DATE
    );
  ELSE
    v_received := COALESCE(p_received_value, v_payment.value);

    IF v_received <= 0 OR v_received > v_payment.value THEN
      RAISE EXCEPTION USING
        ERRCODE = '22023',
        MESSAGE = 'INVALID_RECEIVED_VALUE';
    END IF;

    UPDATE public.order_payments
    SET status = 'paid',
        received_value = v_received,
        received_at = now(),
        updated_at = now()
    WHERE id = p_payment_id;

    v_reference_date := CURRENT_DATE;
  END IF;

  v_proportion := CASE
    WHEN v_order.total_amount > 0
      THEN v_received / v_order.total_amount
    ELSE 0
  END;

  WITH item_commissions AS (
    SELECT
      p.manufacturer_id,
      ROUND((oi.subtotal * v_proportion)::NUMERIC, 2) AS base_value,
      selected_rule.id AS rule_id,
      COALESCE(selected_rule.commission_rate, 0) AS commission_rate
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    LEFT JOIN LATERAL (
      SELECT cr.id, cr.commission_rate
      FROM public.commission_rules cr
      WHERE cr.status = 'active'
        AND (cr.manufacturer_id IS NULL OR cr.manufacturer_id = p.manufacturer_id)
        AND (cr.representative_id IS NULL OR cr.representative_id = v_order.representative_id)
        AND (cr.product_id IS NULL OR cr.product_id = oi.product_id)
        AND (cr.category_id IS NULL OR cr.category_id = p.category_id)
        AND (cr.valid_from IS NULL OR cr.valid_from <= v_reference_date)
        AND (cr.valid_until IS NULL OR cr.valid_until >= v_reference_date)
      ORDER BY
        CASE WHEN cr.product_id = oi.product_id THEN 0 ELSE 1 END,
        CASE WHEN cr.category_id = p.category_id THEN 0 ELSE 1 END,
        CASE WHEN cr.manufacturer_id = p.manufacturer_id THEN 0 ELSE 1 END,
        CASE WHEN cr.representative_id = v_order.representative_id THEN 0 ELSE 1 END,
        COALESCE(cr.valid_from, DATE '1900-01-01') DESC,
        cr.id
      LIMIT 1
    ) selected_rule ON true
    WHERE oi.order_id = v_order.id
      AND p.manufacturer_id IS NOT NULL
  ), manufacturer_commissions AS (
    SELECT
      manufacturer_id,
      SUM(base_value) AS base_value,
      CASE
        WHEN COUNT(DISTINCT rule_id) <= 1
          THEN (array_agg(rule_id) FILTER (WHERE rule_id IS NOT NULL))[1]
      END AS rule_id,
      SUM(ROUND((base_value * commission_rate / 100)::NUMERIC, 2)) AS commission_value
    FROM item_commissions
    GROUP BY manufacturer_id
  ), inserted AS (
    INSERT INTO public.commissions (
      order_id,
      representative_id,
      order_payment_id,
      manufacturer_id,
      rule_id,
      base_value,
      commission_rate,
      commission_value,
      settlement_key,
      status,
      updated_at
    )
    SELECT
      v_order.id,
      v_order.representative_id,
      p_payment_id,
      mc.manufacturer_id,
      mc.rule_id,
      mc.base_value,
      CASE
        WHEN mc.base_value > 0
          THEN ROUND((mc.commission_value / mc.base_value * 100)::NUMERIC, 4)
        ELSE 0
      END,
      mc.commission_value,
      p_payment_id::TEXT || ':' || mc.manufacturer_id::TEXT || ':' || v_order.representative_id::TEXT,
      'approved',
      now()
    FROM manufacturer_commissions mc
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.commissions existing
      WHERE existing.order_payment_id = p_payment_id
        AND existing.manufacturer_id = mc.manufacturer_id
        AND existing.representative_id = v_order.representative_id
    )
    ON CONFLICT (settlement_key) DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*) INTO v_inserted FROM inserted;

  RETURN jsonb_build_object(
    'id', v_payment.id,
    'status', 'paid',
    'received_value', v_received,
    'commissions_created', v_inserted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.settle_order_payment_and_commissions(UUID, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_order_payment_and_commissions(UUID, NUMERIC) FROM anon;
GRANT EXECUTE ON FUNCTION public.settle_order_payment_and_commissions(UUID, NUMERIC) TO authenticated;
