-- RPC para exclusão permanente e em cascata de pedidos de venda

CREATE OR REPLACE FUNCTION public.delete_order_permanently(
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_admin BOOLEAN;
  v_is_manager BOOLEAN;
  v_is_rep BOOLEAN;
  v_order public.orders%ROWTYPE;
  v_payment_ids UUID[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'NOT_AUTHENTICATED';
  END IF;

  v_is_admin := public.has_role(v_user_id, 'admin');
  v_is_manager := public.has_role(v_user_id, 'gestor_comercial');
  v_is_rep := public.has_role(v_user_id, 'representante');

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'ORDER_NOT_FOUND';
  END IF;

  -- Representante só pode excluir seus próprios pedidos em rascunho
  IF v_is_rep AND NOT (v_is_admin OR v_is_manager) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.representatives
      WHERE id = v_order.representative_id
        AND user_id = v_user_id
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'ORDER_NOT_IN_SCOPE';
    END IF;

    IF v_order.status != 'draft' THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'REP_CAN_ONLY_DELETE_DRAFT';
    END IF;
  ELSIF NOT (v_is_admin OR v_is_manager) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'ROLE_NOT_AUTHORIZED';
  END IF;

  -- 1. Obter IDs dos pagamentos do pedido
  SELECT ARRAY_AGG(id) INTO v_payment_ids
  FROM public.order_payments
  WHERE order_id = p_order_id;

  -- 2. Limpar comissões vinculadas aos pagamentos e ao pedido
  IF v_payment_ids IS NOT NULL AND ARRAY_LENGTH(v_payment_ids, 1) > 0 THEN
    DELETE FROM public.commissions
    WHERE order_payment_id = ANY(v_payment_ids);
  END IF;

  DELETE FROM public.commissions
  WHERE order_id = p_order_id;

  -- 3. Limpar pagamentos
  DELETE FROM public.order_payments
  WHERE order_id = p_order_id;

  -- 4. Limpar itens do pedido
  DELETE FROM public.order_items
  WHERE order_id = p_order_id;

  -- 5. Limpar histórico do pedido
  DELETE FROM public.order_history
  WHERE order_id = p_order_id;

  -- 6. Excluir o pedido definitivamente
  DELETE FROM public.orders
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'order_number', v_order.order_number
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_order_permanently(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_order_permanently(uuid) TO service_role;
