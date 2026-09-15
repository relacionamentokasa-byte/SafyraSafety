-- Garante que o agendamento possa materializar clientes canônicos e persistir visitas.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visits TO authenticated;
GRANT ALL ON public.clients TO service_role;
GRANT ALL ON public.visits TO service_role;

DROP POLICY IF EXISTS "Reps can see their own clients" ON public.clients;
DROP POLICY IF EXISTS "Managers and owners can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Managers and owners can update clients" ON public.clients;
DROP POLICY IF EXISTS "Managers can delete clients" ON public.clients;
DROP POLICY IF EXISTS "Reps and managers can view clients" ON public.clients;
DROP POLICY IF EXISTS "Users can view allowed clients" ON public.clients;
DROP POLICY IF EXISTS "Users can create allowed clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update allowed clients" ON public.clients;

CREATE POLICY "Users can view allowed clients"
ON public.clients FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor_comercial'::public.app_role)
  OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
  OR created_by = auth.uid()
  OR representative_id IN (
    SELECT id
    FROM public.representatives
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create allowed clients"
ON public.clients FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor_comercial'::public.app_role)
  OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
  OR (
    public.has_role(auth.uid(), 'representante'::public.app_role)
    AND representative_id IN (
      SELECT id
      FROM public.representatives
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update allowed clients"
ON public.clients FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor_comercial'::public.app_role)
  OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
  OR created_by = auth.uid()
  OR representative_id IN (
    SELECT id
    FROM public.representatives
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor_comercial'::public.app_role)
  OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
  OR created_by = auth.uid()
  OR representative_id IN (
    SELECT id
    FROM public.representatives
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Managers can delete clients"
ON public.clients FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor_comercial'::public.app_role)
);

DROP POLICY IF EXISTS "Reps can see their own visits" ON public.visits;
DROP POLICY IF EXISTS "Users can view allowed visits" ON public.visits;
DROP POLICY IF EXISTS "Users can create allowed visits" ON public.visits;
DROP POLICY IF EXISTS "Users can update allowed visits" ON public.visits;
DROP POLICY IF EXISTS "Managers can delete visits" ON public.visits;
DROP POLICY IF EXISTS "Users can delete allowed visits" ON public.visits;

CREATE POLICY "Users can view allowed visits"
ON public.visits FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor_comercial'::public.app_role)
  OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
  OR representative_id IN (
    SELECT id
    FROM public.representatives
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create allowed visits"
ON public.visits FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor_comercial'::public.app_role)
  OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
  OR representative_id IN (
    SELECT id
    FROM public.representatives
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update allowed visits"
ON public.visits FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor_comercial'::public.app_role)
  OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
  OR representative_id IN (
    SELECT id
    FROM public.representatives
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor_comercial'::public.app_role)
  OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
  OR representative_id IN (
    SELECT id
    FROM public.representatives
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Managers can delete visits"
ON public.visits FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor_comercial'::public.app_role)
);
