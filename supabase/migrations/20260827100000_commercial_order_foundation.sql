-- Safyra Safety: foundation for authoritative pricing, payment plans and orders.
-- This migration is intentionally forward-only. It does not rewrite historical orders.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Normalize the profile access status that was previously created as text with
-- an active/inactive constraint before later migrations introduced access_status.
DO $$
DECLARE
  constraint_record RECORD;
  status_type text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'access_status'
  ) THEN
    CREATE TYPE public.access_status AS ENUM ('pendente', 'ativo', 'bloqueado', 'inativo');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN status public.access_status NOT NULL DEFAULT 'pendente'::public.access_status;
  ELSE
    SELECT udt_name INTO status_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'status';

    IF status_type <> 'access_status' THEN
      -- Remove only checks that constrain this column. The old text default
      -- must also be removed before PostgreSQL can change the column type.
      FOR constraint_record IN
        SELECT DISTINCT c.conname
        FROM pg_constraint c
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid
         AND a.attnum = ANY (c.conkey)
        WHERE c.conrelid = 'public.profiles'::regclass
          AND c.contype = 'c'
          AND a.attname = 'status'
      LOOP
        EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
      END LOOP;

      ALTER TABLE public.profiles
        ALTER COLUMN status DROP DEFAULT;

      ALTER TABLE public.profiles
        ALTER COLUMN status TYPE public.access_status
        USING (
          CASE lower(trim(status::text))
            WHEN 'active' THEN 'ativo'
            WHEN 'inactive' THEN 'inativo'
            WHEN 'ativo' THEN 'ativo'
            WHEN 'bloqueado' THEN 'bloqueado'
            WHEN 'inativo' THEN 'inativo'
            ELSE 'pendente'
          END
        )::public.access_status;
    END IF;

    ALTER TABLE public.profiles
      ALTER COLUMN status SET DEFAULT 'pendente'::public.access_status;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.check_user_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND status::text = 'ativo'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.check_user_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_user_active() TO authenticated;

-- Configurable payment methods and plans. New orders reference a plan UUID;
-- legacy free-text payment columns remain available for old records only.
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payment_methods_validity CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

CREATE TABLE IF NOT EXISTS public.payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payment_plans_validity CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

CREATE TABLE IF NOT EXISTS public.payment_plan_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_plan_id UUID NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL CHECK (installment_number > 0),
  days_after_order INTEGER NOT NULL DEFAULT 0 CHECK (days_after_order >= 0),
  percentage NUMERIC(9, 4) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payment_plan_id, installment_number)
);

CREATE INDEX IF NOT EXISTS idx_payment_plans_active
  ON public.payment_plans (status, valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_payment_plan_installments_plan
  ON public.payment_plan_installments (payment_plan_id, installment_number);

-- Prices that override a table for one customer/product pair.
CREATE TABLE IF NOT EXISTS public.customer_product_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unit_price NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),
  min_price NUMERIC(15, 2) CHECK (min_price IS NULL OR min_price >= 0),
  max_discount_percent NUMERIC(7, 4) NOT NULL DEFAULT 0 CHECK (max_discount_percent >= 0 AND max_discount_percent <= 100),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  priority INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_product_prices_validity CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from),
  CONSTRAINT customer_product_prices_minimum CHECK (min_price IS NULL OR min_price <= unit_price)
);

CREATE INDEX IF NOT EXISTS idx_customer_product_prices_lookup
  ON public.customer_product_prices (client_id, product_id, status, valid_from, valid_until, priority DESC);

-- Order-value rules are evaluated against the gross subtotal before the rule
-- itself is applied, which avoids circular rule selection.
CREATE TABLE IF NOT EXISTS public.order_value_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  price_table_id UUID REFERENCES public.price_tables(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  manufacturer_id UUID REFERENCES public.manufacturers(id) ON DELETE CASCADE,
  min_order_value NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (min_order_value >= 0),
  max_order_value NUMERIC(15, 2) CHECK (max_order_value IS NULL OR max_order_value >= min_order_value),
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('percent', 'fixed')),
  adjustment_value NUMERIC(15, 4) NOT NULL CHECK (adjustment_value >= 0),
  max_discount_percent NUMERIC(7, 4) CHECK (max_discount_percent IS NULL OR (max_discount_percent >= 0 AND max_discount_percent <= 100)),
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT order_value_pricing_rules_validity CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

CREATE INDEX IF NOT EXISTS idx_order_value_pricing_rules_lookup
  ON public.order_value_pricing_rules (status, min_order_value, max_order_value, priority DESC);

-- Add immutable commercial context to new orders without touching historical
-- financial values.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_plan_id UUID REFERENCES public.payment_plans(id),
  ADD COLUMN IF NOT EXISTS price_table_id UUID REFERENCES public.price_tables(id),
  ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS payment_plan_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS client_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS representative_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS pricing_policy_version TEXT;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS product_code_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS product_sku_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS unit_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS list_unit_price NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS resolved_unit_price NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS min_unit_price NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS max_discount_percent NUMERIC(7, 4),
  ADD COLUMN IF NOT EXISTS pricing_source TEXT,
  ADD COLUMN IF NOT EXISTS pricing_rule_id UUID REFERENCES public.order_value_pricing_rules(id),
  ADD COLUMN IF NOT EXISTS negotiated_price_id UUID REFERENCES public.customer_product_prices(id),
  ADD COLUMN IF NOT EXISTS price_table_id UUID REFERENCES public.price_tables(id),
  ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB;

ALTER TABLE public.order_payments
  ADD COLUMN IF NOT EXISTS payment_plan_id UUID REFERENCES public.payment_plans(id),
  ADD COLUMN IF NOT EXISTS payment_plan_installment_id UUID REFERENCES public.payment_plan_installments(id),
  ADD COLUMN IF NOT EXISTS percentage NUMERIC(9, 4),
  ADD COLUMN IF NOT EXISTS term_snapshot JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.order_payments'::regclass
      AND conname = 'order_payments_order_installment_unique'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM public.order_payments
      GROUP BY order_id, installment_number
      HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'Não foi possível criar unicidade das parcelas: existem duplicidades em order_payments. Resolva os registros antes de aplicar esta migration.';
    END IF;

    ALTER TABLE public.order_payments
      ADD CONSTRAINT order_payments_order_installment_unique
      UNIQUE (order_id, installment_number);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.order_payments'::regclass
      AND conname = 'order_payments_installment_positive'
  ) THEN
    ALTER TABLE public.order_payments
      ADD CONSTRAINT order_payments_installment_positive
      CHECK (installment_number > 0 AND value >= 0 AND coalesce(received_value, 0) >= 0);
  END IF;
END $$;

ALTER TABLE public.representatives
  ADD COLUMN IF NOT EXISTS photo_path TEXT;

-- Keep the legacy column readable during migration, but only stable paths are
-- accepted for new representative photos. Existing non-URL values are copied
-- without converting or persisting signed URLs.
UPDATE public.representatives
SET photo_path = photo_url
WHERE photo_path IS NULL
  AND photo_url IS NOT NULL
  AND photo_url !~* '^https?://';

-- price_tables predates the commercial foundation. Priority is explicit so
-- pricing selection remains deterministic without relying on table name order.
ALTER TABLE public.price_tables
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_price_tables_priority
  ON public.price_tables (priority DESC, valid_from, id);

-- Idempotency protects against double-clicks and network retries.
CREATE TABLE IF NOT EXISTS public.order_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (actor_id, idempotency_key)
);

-- The order RPC is the only new-order write boundary for authenticated users.
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_payments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_history FROM authenticated;
GRANT SELECT ON public.orders, public.order_items, public.order_payments, public.order_history TO authenticated;
GRANT SELECT ON public.payment_methods, public.payment_plans, public.payment_plan_installments TO authenticated;
GRANT SELECT ON public.customer_product_prices, public.order_value_pricing_rules TO authenticated;
GRANT SELECT ON public.order_requests TO authenticated;

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_plan_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_value_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_methods_read_authenticated" ON public.payment_methods;
CREATE POLICY "payment_methods_read_authenticated"
  ON public.payment_methods FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "payment_plans_read_authenticated" ON public.payment_plans;
CREATE POLICY "payment_plans_read_authenticated"
  ON public.payment_plans FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "payment_plan_installments_read_authenticated" ON public.payment_plan_installments;
CREATE POLICY "payment_plan_installments_read_authenticated"
  ON public.payment_plan_installments FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "customer_product_prices_read_authenticated" ON public.customer_product_prices;
CREATE POLICY "customer_product_prices_read_authenticated"
  ON public.customer_product_prices FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "order_value_pricing_rules_read_authenticated" ON public.order_value_pricing_rules;
CREATE POLICY "order_value_pricing_rules_read_authenticated"
  ON public.order_value_pricing_rules FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "order_requests_own_rows" ON public.order_requests;
CREATE POLICY "order_requests_own_rows"
  ON public.order_requests FOR SELECT TO authenticated
  USING (actor_id = auth.uid());

-- Replace the old unconditional pricing write policies.
DROP POLICY IF EXISTS "Permitir inserção/atualização de price_tables" ON public.price_tables;
DROP POLICY IF EXISTS "Permitir inserção/atualização de price_table_items" ON public.price_table_items;
DROP POLICY IF EXISTS "price_tables_admin_manager_write" ON public.price_tables;
DROP POLICY IF EXISTS "price_table_items_admin_manager_write" ON public.price_table_items;

CREATE POLICY "price_tables_admin_manager_write"
  ON public.price_tables FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_comercial'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_comercial'));

CREATE POLICY "price_table_items_admin_manager_write"
  ON public.price_table_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_comercial'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_comercial'));

-- Seed configurable plans. These are data, not an application hardcoded list;
-- administrators can add plans such as 30/45/60 without code changes.
INSERT INTO public.payment_methods (code, name)
VALUES
  ('boleto', 'Boleto bancário'),
  ('pix', 'PIX'),
  ('cartao', 'Cartão de crédito'),
  ('transferencia', 'Transferência/TED'),
  ('dinheiro', 'Dinheiro')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.payment_plans (code, name, payment_method_id)
SELECT plan.code, plan.name, methods.id
FROM (VALUES
  ('avista', 'À vista', 'pix'),
  ('7dias', '7 dias', 'boleto'),
  ('14dias', '14 dias', 'boleto'),
  ('21dias', '21 dias', 'boleto'),
  ('28dias', '28 dias', 'boleto'),
  ('30dias', '30 dias', 'boleto'),
  ('28/35/42', '28/35/42 dias', 'boleto'),
  ('30/45/60', '30/45/60 dias', 'boleto'),
  ('30/60', '30/60 dias', 'boleto'),
  ('30/60/90', '30/60/90 dias', 'boleto'),
  ('28/35', '28/35 dias', 'boleto'),
  ('28/42/56', '28/42/56 dias', 'boleto')
) AS plan(code, name, method_code)
JOIN public.payment_methods methods ON methods.code = plan.method_code
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.payment_plan_installments (payment_plan_id, installment_number, days_after_order, percentage)
SELECT plans.id, terms.installment_number, terms.days_after_order, terms.percentage
FROM (
  VALUES
    ('avista', 1, 0, 100.0000::numeric),
    ('7dias', 1, 7, 100.0000::numeric),
    ('14dias', 1, 14, 100.0000::numeric),
    ('21dias', 1, 21, 100.0000::numeric),
    ('28dias', 1, 28, 100.0000::numeric),
    ('30dias', 1, 30, 100.0000::numeric),
    ('28/35/42', 1, 28, 33.3333::numeric),
    ('28/35/42', 2, 35, 33.3333::numeric),
    ('28/35/42', 3, 42, 33.3334::numeric),
    ('30/45/60', 1, 30, 33.3333::numeric),
    ('30/45/60', 2, 45, 33.3333::numeric),
    ('30/45/60', 3, 60, 33.3334::numeric),
    ('30/60', 1, 30, 50.0000::numeric),
    ('30/60', 2, 60, 50.0000::numeric),
    ('30/60/90', 1, 30, 33.3333::numeric),
    ('30/60/90', 2, 60, 33.3333::numeric),
    ('30/60/90', 3, 90, 33.3334::numeric),
    ('28/35', 1, 28, 50.0000::numeric),
    ('28/35', 2, 35, 50.0000::numeric),
    ('28/42/56', 1, 28, 33.3333::numeric),
    ('28/42/56', 2, 42, 33.3333::numeric),
    ('28/42/56', 3, 56, 33.3334::numeric)
) AS terms(code, installment_number, days_after_order, percentage)
JOIN public.payment_plans plans ON plans.code = terms.code
ON CONFLICT (payment_plan_id, installment_number) DO NOTHING;

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

  -- First resolve every line at list/table/negotiated price. The gross
  -- subtotal then becomes the stable base for order-value rules.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
    v_item_index := v_item_index + 1;
    BEGIN
      v_product_id := NULLIF(coalesce(v_item->>'product_id', v_item->>'product_ref'), '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'PRODUCT_ID_MUST_BE_UUID';
    END;

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'PRODUCT_REQUIRED';
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

    v_quantity := coalesce(NULLIF(v_item->>'quantity', '')::numeric, 0);
    IF v_quantity <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'QUANTITY_INVALID';
    END IF;

    v_requested_discount := coalesce(NULLIF(v_item->>'requested_discount_percent', '')::numeric, 0);
    IF v_requested_discount < 0 THEN
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
    v_pricing_source := 'product_base';
    v_base_pricing_source := 'product_base';

    SELECT cpp.id, cpp.unit_price, coalesce(cpp.min_price, cpp.unit_price), cpp.max_discount_percent
    INTO v_negotiated_id, v_base_unit_price, v_min_unit_price, v_max_discount
    FROM public.customer_product_prices cpp
    WHERE cpp.client_id = v_client_id
      AND cpp.product_id = v_product_id
      AND cpp.status = 'active'
      AND (cpp.valid_from IS NULL OR cpp.valid_from <= now())
      AND (cpp.valid_until IS NULL OR cpp.valid_until >= now())
    ORDER BY cpp.priority DESC, cpp.valid_from DESC NULLS LAST, cpp.id
    LIMIT 1;

    IF v_negotiated_id IS NOT NULL THEN
      v_pricing_source := 'customer_product_price';
      v_base_pricing_source := v_pricing_source;
    ELSE
      SELECT pt.id, pt.name, pt.code, pti.unit_price,
             coalesce(pti.min_price, pti.unit_price), coalesce(pti.max_discount_percent, 0),
             pti.commission_rate
      INTO v_table_id, v_table_name, v_table_code, v_base_unit_price,
           v_min_unit_price, v_max_discount, v_commission_rate
      FROM public.price_table_items pti
      JOIN public.price_tables pt ON pt.id = pti.price_table_id
      WHERE pti.product_id = v_product_id
        AND pt.status = 'active'
        AND (pt.valid_from IS NULL OR pt.valid_from <= now())
        AND (pt.valid_until IS NULL OR pt.valid_until >= now())
        AND (v_requested_table_id IS NOT NULL AND pt.id = v_requested_table_id
             OR v_requested_table_id IS NULL AND pt.id = v_client_table_id)
      ORDER BY pt.priority DESC NULLS LAST, pt.valid_from DESC NULLS LAST, pt.id
      LIMIT 1;

      IF v_table_id IS NULL THEN
        SELECT pt.id, pt.name, pt.code, pti.unit_price,
               coalesce(pti.min_price, pti.unit_price), coalesce(pti.max_discount_percent, 0),
               pti.commission_rate
        INTO v_table_id, v_table_name, v_table_code, v_base_unit_price,
             v_min_unit_price, v_max_discount, v_commission_rate
        FROM public.price_table_items pti
        JOIN public.price_tables pt ON pt.id = pti.price_table_id
        WHERE pti.product_id = v_product_id
          AND pt.status = 'active'
          AND pt.is_default = true
          AND (pt.manufacturer_id IS NULL OR pt.manufacturer_id = v_manufacturer_id)
          AND (pt.valid_from IS NULL OR pt.valid_from <= now())
          AND (pt.valid_until IS NULL OR pt.valid_until >= now())
        ORDER BY pt.priority DESC NULLS LAST, pt.valid_from DESC NULLS LAST, pt.id
        LIMIT 1;
      END IF;

      IF v_table_id IS NOT NULL THEN
        v_pricing_source := 'price_table_item';
        v_base_pricing_source := v_pricing_source;
      ELSE
        v_base_unit_price := coalesce(v_product_price, 0);
        v_min_unit_price := coalesce(v_product_min_price, v_base_unit_price);
        v_max_discount := 0;
      END IF;
    END IF;

    IF coalesce(v_base_unit_price, 0) <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '22003', MESSAGE = 'PRODUCT_HAS_NO_VALID_PRICE';
    END IF;

    IF v_min_unit_price IS NULL THEN
      v_min_unit_price := v_base_unit_price;
    END IF;

    IF v_requested_discount > coalesce(v_max_discount, 0) THEN
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
      'price_table_id', v_table_id,
      'price_table_name', v_table_name,
      'price_table_code', v_table_code,
      'pricing_source', v_pricing_source,
      'base_pricing_source', v_base_pricing_source,
      'negotiated_price_id', v_negotiated_id,
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
    'policy_version', '2026-08-27.1',
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
    v_payment_plan_id, NULLIF(coalesce((v_lines->0)->>'price_table_id', ''), '')::uuid,
    v_pricing_snapshot, v_payment_snapshot, v_client_snapshot, v_rep_snapshot,
    '2026-08-27.1'
  )
  RETURNING id, order_number, created_at INTO v_order_id, v_order_number, v_created_at;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_lines) LOOP
    INSERT INTO public.order_items (
      order_id, product_id, quantity, unit_price, discount_amount, subtotal,
      product_name_snapshot, product_code_snapshot, product_sku_snapshot, unit_snapshot,
      list_unit_price, resolved_unit_price, min_unit_price, max_discount_percent,
      pricing_source, pricing_rule_id, negotiated_price_id, price_table_id, pricing_snapshot
    ) VALUES (
      v_order_id, (v_item->>'product_id')::uuid, (v_item->>'quantity')::numeric,
      (v_item->>'resolved_unit_price')::numeric, (v_item->>'discount_amount')::numeric,
      (v_item->>'subtotal')::numeric, v_item->>'product_name_snapshot',
      v_item->>'product_code_snapshot', v_item->>'product_sku_snapshot', v_item->>'unit_snapshot',
      (v_item->>'list_unit_price')::numeric, (v_item->>'resolved_unit_price')::numeric,
      (v_item->>'min_unit_price')::numeric, (v_item->>'max_discount_percent')::numeric,
      v_item->>'pricing_source', NULLIF(v_item->>'pricing_rule_id', '')::uuid,
      NULLIF(v_item->>'negotiated_price_id', '')::uuid, NULLIF(v_item->>'price_table_id', '')::uuid,
      v_item
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
  VALUES (v_order_id, v_user_id, 'created', 'draft', jsonb_build_object('pricing_policy_version', '2026-08-27.1'));

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

CREATE OR REPLACE FUNCTION public.transition_order(p_order_id uuid, p_to_status public.order_status, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_current public.order_status;
  v_is_admin BOOLEAN := public.has_role(auth.uid(), 'admin');
  v_is_manager BOOLEAN := public.has_role(auth.uid(), 'gestor_comercial');
  v_is_supervisor BOOLEAN := public.has_role(auth.uid(), 'supervisor');
  v_is_rep BOOLEAN := public.has_role(auth.uid(), 'representante');
  v_order public.orders%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'NOT_AUTHENTICATED';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'ORDER_NOT_FOUND';
  END IF;

  IF v_is_rep AND NOT EXISTS (
    SELECT 1 FROM public.representatives WHERE id = v_order.representative_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'ORDER_NOT_IN_SCOPE';
  END IF;

  IF NOT (v_is_admin OR v_is_manager OR v_is_supervisor OR v_is_rep) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'ROLE_NOT_AUTHORIZED';
  END IF;

  IF p_to_status = 'cancelled' AND nullif(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CANCELLATION_REASON_REQUIRED';
  END IF;

  IF NOT (
    (v_order.status = 'draft' AND p_to_status IN ('sent', 'cancelled')) OR
    (v_order.status = 'sent' AND p_to_status IN ('analysis', 'approved', 'cancelled')) OR
    (v_order.status = 'analysis' AND p_to_status IN ('approved', 'cancelled')) OR
    (v_order.status = 'approved' AND p_to_status IN ('invoiced', 'cancelled')) OR
    (v_order.status = 'invoiced' AND p_to_status = 'delivered')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ORDER_TRANSITION';
  END IF;

  IF p_to_status IN ('approved', 'invoiced', 'delivered') AND NOT (v_is_admin OR v_is_manager OR v_is_supervisor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'STATUS_TRANSITION_NOT_AUTHORIZED';
  END IF;

  UPDATE public.orders
  SET status = p_to_status,
      cancellation_reason = CASE WHEN p_to_status = 'cancelled' THEN p_reason ELSE cancellation_reason END,
      rejection_reason = CASE WHEN p_to_status = 'cancelled' AND lower(coalesce(p_reason, '')) LIKE '%rejeit%' THEN p_reason ELSE rejection_reason END,
      updated_by = v_user_id,
      updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.order_history (order_id, user_id, action, previous_status, new_status, details)
  VALUES (
    p_order_id, v_user_id,
    CASE WHEN p_to_status = 'cancelled' THEN 'cancelled' ELSE 'status_changed' END,
    v_order.status, p_to_status,
    jsonb_build_object('reason', p_reason)
  );

  RETURN jsonb_build_object('id', p_order_id, 'status', p_to_status);
END;
$$;

REVOKE ALL ON FUNCTION public.transition_order(uuid, public.order_status, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transition_order(uuid, public.order_status, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.transition_order(uuid, public.order_status, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_order_payment_paid(p_payment_id uuid, p_received_value numeric DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_payment public.order_payments%ROWTYPE;
BEGIN
  IF v_user_id IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_comercial')) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PAYMENT_UPDATE_NOT_AUTHORIZED';
  END IF;

  SELECT * INTO v_payment FROM public.order_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'PAYMENT_NOT_FOUND';
  END IF;

  IF v_payment.status = 'paid' THEN
    RETURN jsonb_build_object('id', v_payment.id, 'status', 'paid', 'idempotent', true);
  END IF;

  UPDATE public.order_payments
  SET status = 'paid',
      received_value = coalesce(p_received_value, value),
      received_at = now(),
      updated_at = now()
  WHERE id = p_payment_id;

  RETURN jsonb_build_object(
    'id', p_payment_id,
    'status', 'paid',
    'received_value', coalesce(p_received_value, v_payment.value)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_order_payment_paid(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_order_payment_paid(uuid, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_order_payment_paid(uuid, numeric) TO authenticated;
