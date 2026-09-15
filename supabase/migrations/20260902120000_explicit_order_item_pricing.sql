-- Exige a escolha explícita de uma tabela de preço por item de pedido.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS price_table_item_id UUID REFERENCES public.price_table_items(id);

CREATE INDEX IF NOT EXISTS idx_order_items_price_table_item_id
  ON public.order_items (price_table_item_id);

CREATE OR REPLACE FUNCTION public.create_order(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_status TEXT;
  v_is_admin BOOLEAN := public.has_role(auth.uid(), 'admin');
  v_is_manager BOOLEAN := public.has_role(auth.uid(), 'gestor_comercial');
  v_is_supervisor BOOLEAN := public.has_role(auth.uid(), 'supervisor');
  v_is_rep BOOLEAN := public.has_role(auth.uid(), 'representante');
  v_client_id UUID;
  v_representative_id UUID;
  v_opportunity_id UUID;
  v_requested_table_id UUID;
  v_client_table_id UUID;
  v_payment_plan_id UUID;
  v_order_id UUID;
  v_order_number TEXT;
  v_created_at TIMESTAMPTZ;
  v_payment_plan_code TEXT;
  v_payment_plan_name TEXT;
  v_payment_method_code TEXT;
  v_payment_method_name TEXT;
  v_payment_plan_version INTEGER;
  v_terms JSONB;
  v_payment_snapshot JSONB;
  v_lines JSONB := '[]'::jsonb;
  v_pricing_snapshot JSONB;
  v_subtotal NUMERIC(15, 2) := 0;
  v_discount NUMERIC(15, 2) := 0;
  v_total NUMERIC(15, 2) := 0;
  v_gross_subtotal NUMERIC(15, 2) := 0;
  v_item JSONB;
  v_product_id UUID;
  v_product_name TEXT;
  v_product_code TEXT;
  v_product_sku TEXT;
  v_product_unit TEXT;
  v_product_brand TEXT;
  v_manufacturer_id UUID;
  v_product_price NUMERIC(15, 2);
  v_product_min_price NUMERIC(15, 2);
  v_product_commission NUMERIC(7, 4);
  v_quantity NUMERIC(15, 4);
  v_requested_discount NUMERIC(7, 4);
  v_base_unit_price NUMERIC(15, 2);
  v_resolved_unit_price NUMERIC(15, 2);
  v_min_unit_price NUMERIC(15, 2);
  v_max_discount NUMERIC(7, 4);
  v_commission_rate NUMERIC(7, 4);
  v_line_gross NUMERIC(15, 2);
  v_line_discount NUMERIC(15, 2);
  v_line_subtotal NUMERIC(15, 2);
  v_table_id UUID;
  v_table_name TEXT;
  v_table_code TEXT;
  v_negotiated_id UUID;
  v_rule_id UUID;
  v_rule_type TEXT;
  v_rule_value NUMERIC(15, 4);
  v_rule_max_discount NUMERIC(7, 4);
  v_pricing_source TEXT;
  v_base_pricing_source TEXT;
  v_item_index INTEGER := 0;
  v_request_key TEXT := NULLIF(trim(p_payload->>'idempotency_key'), '');
  v_request_hash TEXT := md5(p_payload::text);
  v_existing_request RECORD;
  v_existing_payments JSONB;
  v_existing_items JSONB;
  v_installment RECORD;
  v_payment_value NUMERIC(15, 2);
  v_payment_sum NUMERIC(15, 2) := 0;
  v_installment_count INTEGER;
  v_client_snapshot JSONB;
  v_rep_snapshot JSONB;
  v_requested_override NUMERIC(15, 2);
  v_price_table_item_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'NOT_AUTHENTICATED';
  END IF;

  IF v_request_key IS NULL OR length(v_request_key) < 8 OR length(v_request_key) > 128 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'IDEMPOTENCY_KEY_REQUIRED';
  END IF;

  SELECT status::text INTO v_profile_status
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_profile_status IS DISTINCT FROM 'ativo' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'USER_PROFILE_MISSING_OR_NOT_ACTIVE';
  END IF;

  INSERT INTO public.order_requests (actor_id, idempotency_key, request_hash)
  VALUES (v_user_id, v_request_key, v_request_hash)
  ON CONFLICT (actor_id, idempotency_key) DO NOTHING;

  SELECT * INTO v_existing_request
  FROM public.order_requests
  WHERE actor_id = v_user_id AND idempotency_key = v_request_key
  FOR UPDATE;

  IF v_existing_request.request_hash <> v_request_hash THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'IDEMPOTENCY_KEY_REUSED';
  END IF;

  IF v_existing_request.order_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.installment_number), '[]'::jsonb)
    INTO v_existing_payments
    FROM public.order_payments p
    WHERE p.order_id = v_existing_request.order_id;

    SELECT COALESCE(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
    INTO v_existing_items
    FROM public.order_items i
    WHERE i.order_id = v_existing_request.order_id;

    RETURN jsonb_build_object(
      'id', v_existing_request.order_id,
      'idempotent', true,
      'items', v_existing_items,
      'payments', v_existing_payments
    );
  END IF;

  IF jsonb_typeof(p_payload->'items') <> 'array' OR jsonb_array_length(p_payload->'items') = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ITEMS_REQUIRED';
  END IF;

  BEGIN
    v_client_id := NULLIF(p_payload->>'client_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CLIENT_ID_MUST_BE_UUID';
  END;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CLIENT_REQUIRED';
  END IF;

  BEGIN
    v_representative_id := NULLIF(p_payload->>'representative_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'REPRESENTATIVE_ID_MUST_BE_UUID';
  END;

  IF v_representative_id IS NULL THEN
    SELECT id INTO v_representative_id
    FROM public.representatives
    WHERE user_id = v_user_id AND coalesce(status, 'active') = 'active'
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF v_representative_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'REPRESENTATIVE_REQUIRED';
  END IF;

  IF v_is_rep AND NOT EXISTS (
    SELECT 1 FROM public.representatives
    WHERE id = v_representative_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'REPRESENTATIVE_NOT_AUTHORIZED';
  END IF;

  IF NOT (v_is_admin OR v_is_manager OR v_is_supervisor OR v_is_rep) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'ROLE_NOT_AUTHORIZED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clients
    WHERE id = v_client_id
      AND coalesce(status, 'active') NOT IN ('inactive', 'blocked')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'CLIENT_NOT_FOUND_OR_INACTIVE';
  END IF;

  IF v_is_rep AND NOT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = v_client_id
      AND (c.representative_id IS NULL OR c.representative_id = v_representative_id)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'CLIENT_NOT_IN_REPRESENTATIVE_SCOPE';
  END IF;

  SELECT c.price_table_id INTO v_client_table_id
  FROM public.clients c
  WHERE c.id = v_client_id
  FOR SHARE;

  BEGIN
    v_requested_table_id := NULLIF(p_payload->>'price_table_id', '')::uuid;
    v_opportunity_id := NULLIF(p_payload->>'opportunity_id', '')::uuid;
    v_payment_plan_id := NULLIF(p_payload->>'payment_plan_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_REFERENCE_ID';
  END;

  IF v_requested_table_id IS NOT NULL AND NOT (v_is_admin OR v_is_manager OR v_is_supervisor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PRICE_TABLE_OVERRIDE_NOT_AUTHORIZED';
  END IF;

  IF v_payment_plan_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'PAYMENT_PLAN_REQUIRED';
  END IF;

  SELECT pp.code, pp.name, pp.version, pm.code, pm.name
  INTO v_payment_plan_code, v_payment_plan_name, v_payment_plan_version, v_payment_method_code, v_payment_method_name
  FROM public.payment_plans pp
  LEFT JOIN public.payment_methods pm ON pm.id = pp.payment_method_id
  WHERE pp.id = v_payment_plan_id
    AND pp.status = 'active'
    AND (pp.valid_from IS NULL OR pp.valid_from <= now())
    AND (pp.valid_until IS NULL OR pp.valid_until >= now())
    AND (pm.id IS NULL OR (pm.status = 'active' AND (pm.valid_from IS NULL OR pm.valid_from <= now()) AND (pm.valid_until IS NULL OR pm.valid_until >= now())));

  IF v_payment_plan_code IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'PAYMENT_PLAN_NOT_AVAILABLE';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'installment_number', i.installment_number,
      'days_after_order', i.days_after_order,
      'percentage', i.percentage
    ) ORDER BY i.installment_number
  ), count(*)
  INTO v_terms, v_installment_count
  FROM public.payment_plan_installments i
  WHERE i.payment_plan_id = v_payment_plan_id;

  IF coalesce(v_installment_count, 0) = 0 OR abs((SELECT sum((x->>'percentage')::numeric) FROM jsonb_array_elements(v_terms) x) - 100) > 0.01 THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PAYMENT_PLAN_TERMS_INVALID';
  END IF;

  v_payment_snapshot := jsonb_build_object(
    'id', v_payment_plan_id,
    'code', v_payment_plan_code,
    'name', v_payment_plan_name,
    'version', v_payment_plan_version,
    'method_code', v_payment_method_code,
    'method_name', v_payment_method_name,
    'terms', v_terms
  );

  SELECT jsonb_build_object('id', c.id, 'name', c.name, 'legal_name', c.legal_name, 'cnpj', c.cnpj)
  INTO v_client_snapshot
  FROM public.clients c WHERE c.id = v_client_id;

  SELECT jsonb_build_object('id', r.id, 'name', r.name, 'code', r.code)
  INTO v_rep_snapshot
  FROM public.representatives r WHERE r.id = v_representative_id;

  -- Resolve every line from the table item explicitly selected by the user.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
    v_item_index := v_item_index + 1;
    BEGIN
      v_product_id := NULLIF(coalesce(v_item->>'product_id', v_item->>'product_ref'), '')::uuid;
      v_price_table_item_id := NULLIF(v_item->>'price_table_item_id', '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_PRICE_SELECTION';
    END;

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'PRODUCT_REQUIRED';
    END IF;
    IF v_price_table_item_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'PRICE_SELECTION_REQUIRED';
    END IF;

    SELECT p.name, p.code, p.sku, p.unit, p.brand, p.manufacturer_id,
           p.price, p.min_price, p.commission_rate
    INTO v_product_name, v_product_code, v_product_sku, v_product_unit, v_product_brand,
         v_manufacturer_id, v_product_price, v_product_min_price, v_product_commission
    FROM public.products p
    WHERE p.id = v_product_id
      AND coalesce(p.status, 'active') = 'active'
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'PRODUCT_NOT_FOUND_OR_INACTIVE';
    END IF;

    BEGIN
      v_quantity := coalesce(NULLIF(v_item->>'quantity', '')::numeric, 0);
      v_requested_discount := coalesce(NULLIF(v_item->>'requested_discount_percent', '')::numeric, 0);
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ITEM_VALUES';
    END;

    IF v_quantity <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'QUANTITY_INVALID';
    END IF;
    IF v_requested_discount < 0 OR v_requested_discount > 100 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'DISCOUNT_INVALID';
    END IF;

    v_negotiated_id := NULL;
    v_rule_id := NULL;
    v_table_id := NULL;
    v_table_name := NULL;
    v_table_code := NULL;
    v_rule_type := NULL;
    v_rule_value := NULL;
    v_rule_max_discount := NULL;
    v_commission_rate := v_product_commission;
    v_pricing_source := 'price_table_item';
    v_base_pricing_source := 'price_table_item';

    SELECT pt.id, pt.name, pt.code, pti.unit_price,
           coalesce(pti.min_price, pti.unit_price), coalesce(pti.max_discount_percent, 0),
           coalesce(pti.commission_rate, v_product_commission)
    INTO v_table_id, v_table_name, v_table_code, v_base_unit_price,
         v_min_unit_price, v_max_discount, v_commission_rate
    FROM public.price_table_items pti
    JOIN public.price_tables pt ON pt.id = pti.price_table_id
    WHERE pti.id = v_price_table_item_id
      AND pti.product_id = v_product_id
      AND pt.status = 'active'
      AND (pt.valid_from IS NULL OR pt.valid_from <= now())
      AND (pt.valid_until IS NULL OR pt.valid_until >= now())
    FOR SHARE OF pti, pt;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'PRICE_TABLE_ITEM_NOT_AVAILABLE';
    END IF;
    IF coalesce(v_base_unit_price, 0) <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '22003', MESSAGE = 'PRODUCT_HAS_NO_VALID_PRICE';
    END IF;
    IF v_min_unit_price <= 0 OR v_min_unit_price > v_base_unit_price THEN
      RAISE EXCEPTION USING ERRCODE = '22003', MESSAGE = 'PRICE_TABLE_ITEM_INVALID_LIMITS';
    END IF;
    IF v_max_discount < 0 OR v_max_discount > 100 THEN
      RAISE EXCEPTION USING ERRCODE = '22003', MESSAGE = 'PRICE_TABLE_ITEM_INVALID_LIMITS';
    END IF;
    IF v_requested_discount > v_max_discount THEN
      RAISE EXCEPTION USING ERRCODE = '22003', MESSAGE = 'DISCOUNT_EXCEEDS_LIMIT';
    END IF;

    v_resolved_unit_price := round(v_base_unit_price * (1 - v_requested_discount / 100), 2);
    IF v_resolved_unit_price < v_min_unit_price THEN
      RAISE EXCEPTION USING ERRCODE = '22003', MESSAGE = 'PRICE_BELOW_MINIMUM';
    END IF;

    v_line_gross := round(v_quantity * v_base_unit_price, 2);
    v_line_subtotal := round(v_quantity * v_resolved_unit_price, 2);
    v_line_discount := round(v_line_gross - v_line_subtotal, 2);
    v_gross_subtotal := v_gross_subtotal + v_line_gross;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'index', v_item_index,
      'product_id', v_product_id,
      'product_name_snapshot', v_product_name,
      'product_code_snapshot', v_product_code,
      'product_sku_snapshot', v_product_sku,
      'unit_snapshot', v_product_unit,
      'brand_snapshot', v_product_brand,
      'manufacturer_id', v_manufacturer_id,
      'quantity', v_quantity,
      'list_unit_price', v_base_unit_price,
      'resolved_unit_price', v_resolved_unit_price,
      'min_unit_price', v_min_unit_price,
      'max_discount_percent', v_max_discount,
      'discount_percent', v_requested_discount,
      'discount_amount', v_line_discount,
      'subtotal', v_line_subtotal,
      'price_table_item_id', v_price_table_item_id,
      'price_table_id', v_table_id,
      'price_table_name', v_table_name,
      'price_table_code', v_table_code,
      'pricing_source', v_pricing_source,
      'base_pricing_source', v_base_pricing_source,
      'negotiated_price_id', NULL,
      'pricing_rule_id', v_rule_id,
      'commission_rate', v_commission_rate
    ));
  END LOOP;

  -- Apply at most one highest-priority order-value rule per line. The rule
  -- sees the gross subtotal calculated above, never the discounted total.
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_lines) LOOP
    v_rule_id := NULL;
    v_rule_type := NULL;
    v_rule_value := NULL;
    v_rule_max_discount := NULL;

    SELECT r.id, r.adjustment_type, r.adjustment_value, r.max_discount_percent
    INTO v_rule_id, v_rule_type, v_rule_value, v_rule_max_discount
    FROM public.order_value_pricing_rules r
    WHERE r.status = 'active'
      AND (r.valid_from IS NULL OR r.valid_from <= now())
      AND (r.valid_until IS NULL OR r.valid_until >= now())
      AND (r.client_id IS NULL OR r.client_id = v_client_id)
      AND (r.product_id IS NULL OR r.product_id = (v_item->>'product_id')::uuid)
      AND (r.manufacturer_id IS NULL OR r.manufacturer_id = NULLIF(v_item->>'manufacturer_id', '')::uuid)
      AND (r.price_table_id IS NULL OR r.price_table_id = NULLIF(v_item->>'price_table_id', '')::uuid)
      AND v_gross_subtotal >= r.min_order_value
      AND (r.max_order_value IS NULL OR v_gross_subtotal <= r.max_order_value)
    ORDER BY
      ((r.client_id IS NOT NULL)::integer + (r.product_id IS NOT NULL)::integer +
       (r.manufacturer_id IS NOT NULL)::integer + (r.price_table_id IS NOT NULL)::integer) DESC,
      r.priority DESC,
      r.valid_from DESC NULLS LAST,
      r.id
    LIMIT 1;

    IF v_rule_id IS NOT NULL AND (v_item->>'negotiated_price_id') IS NULL THEN
      v_base_unit_price := (v_item->>'resolved_unit_price')::numeric;
      v_min_unit_price := (v_item->>'min_unit_price')::numeric;
      v_requested_discount := coalesce((v_item->>'discount_percent')::numeric, 0);

      IF v_rule_type = 'percent' THEN
        v_resolved_unit_price := round(v_base_unit_price * (1 - v_rule_value / 100), 2);
      ELSE
        v_resolved_unit_price := round(v_base_unit_price - v_rule_value, 2);
      END IF;

      IF v_resolved_unit_price < v_min_unit_price THEN
        v_resolved_unit_price := v_min_unit_price;
      END IF;

      IF v_rule_max_discount IS NOT NULL AND v_base_unit_price > 0
         AND ((v_base_unit_price - v_resolved_unit_price) / v_base_unit_price * 100) > v_rule_max_discount THEN
        RAISE EXCEPTION USING ERRCODE = '22003', MESSAGE = 'ORDER_VALUE_RULE_EXCEEDS_LIMIT';
      END IF;

      v_quantity := (v_item->>'quantity')::numeric;
      v_line_gross := round(v_quantity * (v_item->>'list_unit_price')::numeric, 2);
      v_line_subtotal := round(v_quantity * v_resolved_unit_price, 2);
      v_line_discount := round(v_line_gross - v_line_subtotal, 2);

      v_item := v_item || jsonb_build_object(
        'resolved_unit_price', v_resolved_unit_price,
        'discount_amount', v_line_discount,
        'subtotal', v_line_subtotal,
        'pricing_rule_id', v_rule_id,
        'pricing_source', 'order_value_rule',
        'rule_adjustment_type', v_rule_type,
        'rule_adjustment_value', v_rule_value
      );

      v_lines := (
        SELECT coalesce(jsonb_agg(CASE WHEN (x->>'index')::integer = (v_item->>'index')::integer THEN v_item ELSE x END), '[]'::jsonb)
        FROM jsonb_array_elements(v_lines) x
      );
    END IF;
  END LOOP;

  SELECT coalesce(sum((x->>'list_unit_price')::numeric * (x->>'quantity')::numeric), 0),
         coalesce(sum((x->>'discount_amount')::numeric), 0)
  INTO v_subtotal, v_discount
  FROM jsonb_array_elements(v_lines) x;

  v_subtotal := round(v_subtotal, 2);
  v_discount := round(v_discount, 2);
  v_total := round(v_subtotal - v_discount, 2);
  IF v_total < 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22003', MESSAGE = 'ORDER_TOTAL_INVALID';
  END IF;

  v_pricing_snapshot := jsonb_build_object(
    'policy_version', '2026-09-02.1',
    'resolved_at', now(),
    'gross_subtotal', v_subtotal,
    'discount_total', v_discount,
    'lines', v_lines
  );

  INSERT INTO public.orders (
    client_id, representative_id, opportunity_id, status,
    subtotal_amount, discount_amount, total_amount,
    payment_method, payment_condition, payment_term,
    expected_delivery_date, commercial_notes, internal_notes, billing_notes,
    origin, created_by, updated_by, payment_plan_id, price_table_id,
    pricing_snapshot, payment_plan_snapshot, client_snapshot, representative_snapshot,
    pricing_policy_version
  ) VALUES (
    v_client_id, v_representative_id, v_opportunity_id, 'draft',
    v_subtotal, v_discount, v_total,
    v_payment_method_name, v_payment_plan_name, v_payment_plan_code,
    NULLIF(p_payload->>'expected_delivery_date', '')::date,
    p_payload->>'commercial_notes', p_payload->>'internal_notes', p_payload->>'billing_notes',
    coalesce(NULLIF(p_payload->>'origin', ''), 'Web'), v_user_id, v_user_id,
    v_payment_plan_id,
      CASE
        WHEN (SELECT count(DISTINCT line->>'price_table_id') FROM jsonb_array_elements(v_lines) AS line) = 1
          THEN NULLIF((v_lines->0)->>'price_table_id', '')::uuid
        ELSE NULL
      END,
    v_pricing_snapshot, v_payment_snapshot, v_client_snapshot, v_rep_snapshot,
    '2026-09-02.1'
  )
  RETURNING id, order_number, created_at INTO v_order_id, v_order_number, v_created_at;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_lines) LOOP
    INSERT INTO public.order_items (
      order_id, product_id, quantity, unit_price, discount_amount, subtotal,
      product_name_snapshot, product_code_snapshot, product_sku_snapshot, unit_snapshot,
      list_unit_price, resolved_unit_price, min_unit_price, max_discount_percent,
      pricing_source, pricing_rule_id, negotiated_price_id, price_table_id, price_table_item_id, pricing_snapshot
    ) VALUES (
      v_order_id, (v_item->>'product_id')::uuid, (v_item->>'quantity')::numeric,
      (v_item->>'resolved_unit_price')::numeric, (v_item->>'discount_amount')::numeric,
      (v_item->>'subtotal')::numeric, v_item->>'product_name_snapshot',
      v_item->>'product_code_snapshot', v_item->>'product_sku_snapshot', v_item->>'unit_snapshot',
      (v_item->>'list_unit_price')::numeric, (v_item->>'resolved_unit_price')::numeric,
      (v_item->>'min_unit_price')::numeric, (v_item->>'max_discount_percent')::numeric,
      v_item->>'pricing_source', NULLIF(v_item->>'pricing_rule_id', '')::uuid,
      NULLIF(v_item->>'negotiated_price_id', '')::uuid, NULLIF(v_item->>'price_table_id', '')::uuid,
      NULLIF(v_item->>'price_table_item_id', '')::uuid, v_item
    );
  END LOOP;

  FOR v_installment IN
    SELECT i.*
    FROM public.payment_plan_installments i
    WHERE i.payment_plan_id = v_payment_plan_id
    ORDER BY i.installment_number
  LOOP
    IF v_installment.installment_number = v_installment_count THEN
      v_payment_value := round(v_total - v_payment_sum, 2);
    ELSE
      v_payment_value := round(v_total * v_installment.percentage / 100, 2);
    END IF;

    INSERT INTO public.order_payments (
      order_id, installment_number, due_date, value, received_value, status,
      payment_plan_id, payment_plan_installment_id, percentage, term_snapshot
    ) VALUES (
      v_order_id, v_installment.installment_number,
      (v_created_at::date + v_installment.days_after_order), v_payment_value, 0, 'pending',
      v_payment_plan_id, v_installment.id, v_installment.percentage,
      jsonb_build_object('days_after_order', v_installment.days_after_order, 'percentage', v_installment.percentage)
    );

    v_payment_sum := v_payment_sum + v_payment_value;
  END LOOP;

  INSERT INTO public.order_history (order_id, user_id, action, new_status, details)
  VALUES (v_order_id, v_user_id, 'created', 'draft', jsonb_build_object('pricing_policy_version', '2026-09-02.1'));

  UPDATE public.order_requests
  SET order_id = v_order_id
  WHERE id = v_existing_request.id;

  SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.installment_number), '[]'::jsonb)
  INTO v_existing_payments
  FROM public.order_payments p WHERE p.order_id = v_order_id;

  SELECT coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
  INTO v_existing_items
  FROM public.order_items i WHERE i.order_id = v_order_id;

  RETURN jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'status', 'draft',
    'subtotal_amount', v_subtotal,
    'discount_amount', v_discount,
    'total_amount', v_total,
    'items', v_existing_items,
    'payments', v_existing_payments
  );
END;
$$;


REVOKE ALL ON FUNCTION public.create_order(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_order(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb) TO authenticated;
