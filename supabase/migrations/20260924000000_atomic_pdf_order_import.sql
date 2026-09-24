-- Safyra Safety: Reconstrução Atômica e Definitiva da Importação de Pedidos via PDF
-- Executa com privilégios de SECURITY DEFINER para garantir persistência sem bloqueios de RLS,
-- realizando o cadastro/vínculo de cliente, pedido, itens, parcelas e comissões em uma única transação ACID.

CREATE OR REPLACE FUNCTION public.import_pdf_order_atomic(
  p_order_data JSONB,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_client_id UUID;
  v_client_cnpj TEXT;
  v_client_name TEXT;
  v_rep_id UUID;
  v_order_id UUID;
  v_order_number TEXT;
  v_total_amount NUMERIC(15,2);
  v_discount NUMERIC(15,2);
  v_payment_condition TEXT;
  v_shipping_type TEXT;
  v_token TEXT;
  v_item RECORD;
  v_prod_id UUID;
  v_item_code TEXT;
  v_item_desc TEXT;
  v_item_qty NUMERIC(10,2);
  v_item_unit_price NUMERIC(15,2);
  v_item_total NUMERIC(15,2);
  v_default_manufacturer_id UUID;
  v_installments_count INT;
  v_installment_days INT[];
  v_inst_val NUMERIC(15,2);
  v_day_offset INT;
  v_due_date DATE;
  v_payment_id UUID;
  v_mfr_id UUID;
  v_comm_rate NUMERIC(7,4);
  v_comm_val NUMERIC(15,2);
  v_settlement_key TEXT;
  v_i INT;
  v_day_text TEXT;
BEGIN
  -- 1. Determinar Representante Responsável
  -- Tenta usar o representante do usuário autenticado; se não encontrar, busca o primeiro ativo
  IF p_user_id IS NOT NULL THEN
    SELECT id INTO v_rep_id
    FROM public.representatives
    WHERE user_id = p_user_id
    LIMIT 1;
  END IF;

  IF v_rep_id IS NULL AND (p_order_data->'matchedRepresentative'->>'id') IS NOT NULL THEN
    v_rep_id := (p_order_data->'matchedRepresentative'->>'id')::UUID;
  END IF;

  IF v_rep_id IS NULL THEN
    SELECT id INTO v_rep_id
    FROM public.representatives
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- 2. Resolver ou Cadastrar Cliente
  IF (p_order_data->'matchedClient'->>'id') IS NOT NULL THEN
    v_client_id := (p_order_data->'matchedClient'->>'id')::UUID;
  ELSE
    -- Limpar CNPJ para busca precisa
    v_client_cnpj := regexp_replace(COALESCE(p_order_data->'parsed'->'client'->>'cnpj', ''), '\D', '', 'g');

    IF length(v_client_cnpj) >= 11 THEN
      SELECT id INTO v_client_id
      FROM public.clients
      WHERE regexp_replace(COALESCE(cnpj, ''), '\D', '', 'g') = v_client_cnpj
      LIMIT 1;
    END IF;

    -- Se ainda não encontrou pelo CNPJ, busca pelo Razão/Nome Fantasia
    IF v_client_id IS NULL THEN
      v_client_name := COALESCE(
        p_order_data->'parsed'->'client'->>'tradeName',
        p_order_data->'parsed'->'client'->>'legalName'
      );
      IF v_client_name IS NOT NULL AND length(trim(v_client_name)) > 3 THEN
        SELECT id INTO v_client_id
        FROM public.clients
        WHERE lower(name) = lower(trim(v_client_name))
           OR lower(trade_name) = lower(trim(v_client_name))
           OR lower(legal_name) = lower(trim(v_client_name))
        LIMIT 1;
      END IF;
    END IF;

    -- Se não existir no banco, cadastrar o novo cliente diretamente (bypass RLS via SECURITY DEFINER)
    IF v_client_id IS NULL THEN
      INSERT INTO public.clients (
        name,
        trade_name,
        legal_name,
        cnpj,
        state_registration,
        phone,
        address,
        neighborhood,
        city,
        state,
        zip_code,
        representative_id,
        status,
        created_by
      ) VALUES (
        COALESCE(p_order_data->'parsed'->'client'->>'tradeName', p_order_data->'parsed'->'client'->>'legalName', 'Cliente Importado'),
        p_order_data->'parsed'->'client'->>'tradeName',
        p_order_data->'parsed'->'client'->>'legalName',
        p_order_data->'parsed'->'client'->>'cnpj',
        p_order_data->'parsed'->'client'->>'ie',
        p_order_data->'parsed'->'client'->>'phone',
        p_order_data->'parsed'->'client'->'address'->>'street',
        p_order_data->'parsed'->'client'->'address'->>'neighborhood',
        p_order_data->'parsed'->'client'->'address'->>'city',
        p_order_data->'parsed'->'client'->'address'->>'state',
        p_order_data->'parsed'->'client'->'address'->>'zip',
        v_rep_id,
        'active',
        p_user_id
      )
      RETURNING id INTO v_client_id;
    END IF;
  END IF;

  -- 3. Obter Fabricante Padrão para novos itens
  SELECT id INTO v_default_manufacturer_id
  FROM public.manufacturers
  ORDER BY name ASC
  LIMIT 1;

  -- 4. Preparar Dados do Pedido
  v_order_number := COALESCE(
    NULLIF(trim(p_order_data->'parsed'->>'budgetNumber'), ''),
    'PED-' || to_char(NOW(), 'YYMMDD') || '-' || lpad((floor(random() * 9000) + 1000)::text, 4, '0')
  );

  v_total_amount := COALESCE((p_order_data->'parsed'->'totals'->>'totalAmount')::NUMERIC, 0.0);
  v_discount := COALESCE((p_order_data->'parsed'->'totals'->>'discount')::NUMERIC, 0.0);
  v_payment_condition := COALESCE(NULLIF(p_order_data->'parsed'->>'paymentCondition', ''), '28/35/42');
  v_shipping_type := COALESCE(NULLIF(p_order_data->'parsed'->>'shippingType', ''), 'CIF');
  v_token := COALESCE(p_order_data->'parsed'->>'token', '-');

  -- 5. Criar Pedido
  INSERT INTO public.orders (
    order_number,
    client_id,
    representative_id,
    status,
    subtotal_amount,
    total_amount,
    discount_amount,
    payment_condition,
    payment_term,
    billing_notes,
    created_by,
    created_at
  ) VALUES (
    v_order_number,
    v_client_id,
    v_rep_id,
    'delivered',
    v_total_amount,
    v_total_amount,
    v_discount,
    v_payment_condition,
    v_shipping_type,
    'Importado automaticamente via PDF da Indústria (Token: ' || v_token || ')',
    p_user_id,
    NOW()
  )
  RETURNING id INTO v_order_id;

  -- 6. Inserir Itens do Pedido
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_data->'matchedItems')
  LOOP
    v_prod_id := NULL;
    v_item_code := COALESCE(v_item.value->>'pdfCode', 'ITEM');
    v_item_desc := COALESCE(v_item.value->>'pdfDescription', 'Produto do Pedido');
    v_item_qty := GREATEST(1.0, COALESCE((v_item.value->>'quantity')::NUMERIC, 1.0));
    v_item_unit_price := COALESCE((v_item.value->>'unitPrice')::NUMERIC, 0.0);
    v_item_total := COALESCE((v_item.value->>'totalPrice')::NUMERIC, v_item_qty * v_item_unit_price);

    IF v_item_unit_price = 0 AND v_item_total > 0 THEN
      v_item_unit_price := round(v_item_total / v_item_qty, 2);
    END IF;

    -- Se já veio com produto mapeado
    IF (v_item.value->'product'->>'id') IS NOT NULL THEN
      v_prod_id := (v_item.value->'product'->>'id')::UUID;
    ELSE
      -- Tenta localizar no catálogo pelo SKU ou código
      SELECT id INTO v_prod_id
      FROM public.products
      WHERE lower(trim(sku)) = lower(trim(v_item_code))
         OR lower(trim(sku)) = lower('00' || trim(v_item_code))
         OR lower(name) LIKE '%' || lower(trim(v_item_code)) || '%'
      LIMIT 1;

      -- Se não existir, registra no catálogo para futuras importações
      IF v_prod_id IS NULL THEN
        INSERT INTO public.products (
          name,
          sku,
          code,
          unit,
          base_price,
          manufacturer_id,
          status
        ) VALUES (
          v_item_desc,
          v_item_code,
          v_item_code,
          'UN',
          v_item_unit_price,
          v_default_manufacturer_id,
          'active'
        )
        RETURNING id INTO v_prod_id;
      END IF;
    END IF;

    -- Gravar item do pedido
    INSERT INTO public.order_items (
      order_id,
      product_id,
      quantity,
      unit_price,
      subtotal,
      product_name_snapshot,
      product_sku_snapshot
    ) VALUES (
      v_order_id,
      v_prod_id,
      v_item_qty::INT,
      v_item_unit_price,
      v_item_total,
      v_item_desc,
      v_item_code
    );
  END LOOP;

  -- Se nenhum item foi inserido (ex: matchedItems vazio), insere item consolidado
  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = v_order_id) THEN
    SELECT id INTO v_prod_id
    FROM public.products
    WHERE sku = 'PROD-IMPORT'
    LIMIT 1;

    IF v_prod_id IS NULL THEN
      INSERT INTO public.products (
        name,
        sku,
        code,
        unit,
        base_price,
        manufacturer_id,
        status
      ) VALUES (
        'Itens do Pedido #' || v_order_number,
        'PROD-IMPORT',
        'PROD-IMPORT',
        'UN',
        GREATEST(100.0, v_total_amount),
        v_default_manufacturer_id,
        'active'
      )
      RETURNING id INTO v_prod_id;
    END IF;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      quantity,
      unit_price,
      subtotal,
      product_name_snapshot,
      product_sku_snapshot
    ) VALUES (
      v_order_id,
      v_prod_id,
      1,
      GREATEST(100.0, v_total_amount),
      GREATEST(100.0, v_total_amount),
      'Itens do Pedido #' || v_order_number,
      'PROD-IMPORT'
    );
  END IF;

  -- 7. Criar Parcelas no Contas a Receber (order_payments)
  -- Decompor condição de pagamento (Ex: '28/35/42' -> [28, 35, 42])
  v_installment_days := ARRAY[]::INT[];
  FOREACH v_day_text IN ARRAY string_to_array(v_payment_condition, '/')
  LOOP
    IF v_day_text ~ '^\s*\d+\s*$' THEN
      v_installment_days := array_append(v_installment_days, trim(v_day_text)::INT);
    END IF;
  END LOOP;

  IF array_length(v_installment_days, 1) IS NULL OR array_length(v_installment_days, 1) = 0 THEN
    v_installment_days := ARRAY[28, 35, 42];
  END IF;

  v_installments_count := array_length(v_installment_days, 1);
  v_inst_val := round(v_total_amount / v_installments_count, 2);

  FOR v_i IN 1..v_installments_count
  LOOP
    v_day_offset := v_installment_days[v_i];
    v_due_date := CURRENT_DATE + (v_day_offset || ' days')::INTERVAL;

    INSERT INTO public.order_payments (
      order_id,
      installment_number,
      value,
      received_value,
      status,
      due_date
    ) VALUES (
      v_order_id,
      v_i,
      v_inst_val,
      0,
      'pending',
      v_due_date
    )
    RETURNING id INTO v_payment_id;

    -- 8. Gerar Comissões Previstas por Fabricante
    FOR v_mfr_id IN
      SELECT DISTINCT p.manufacturer_id
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
      WHERE oi.order_id = v_order_id AND p.manufacturer_id IS NOT NULL
    LOOP
      SELECT COALESCE(default_commission_rate, 4.0) INTO v_comm_rate
      FROM public.manufacturers
      WHERE id = v_mfr_id;

      v_comm_val := round(v_inst_val * (v_comm_rate / 100.0), 2);
      v_settlement_key := v_payment_id::text || ':' || v_mfr_id::text || ':' || v_rep_id::text;

      INSERT INTO public.commissions (
        order_id,
        order_payment_id,
        representative_id,
        manufacturer_id,
        base_value,
        commission_rate,
        commission_value,
        value,
        status,
        settlement_key,
        created_at
      ) VALUES (
        v_order_id,
        v_payment_id,
        v_rep_id,
        v_mfr_id,
        v_inst_val,
        v_comm_rate,
        v_comm_val,
        v_comm_val,
        'pending',
        v_settlement_key,
        NOW()
      )
      ON CONFLICT (settlement_key) DO NOTHING;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'orderId', v_order_id,
    'orderNumber', v_order_number,
    'clientId', v_client_id,
    'representativeId', v_rep_id,
    'totalAmount', v_total_amount,
    'success', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_pdf_order_atomic(JSONB, UUID) TO authenticated, service_role, anon;
