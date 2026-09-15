GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;

CREATE POLICY "Managers and owners can insert clients"
ON public.clients FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor_comercial'::app_role)
  OR created_by = auth.uid()
  OR representative_id IN (SELECT id FROM representatives WHERE user_id = auth.uid())
);

CREATE POLICY "Managers and owners can update clients"
ON public.clients FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor_comercial'::app_role)
  OR created_by = auth.uid()
  OR representative_id IN (SELECT id FROM representatives WHERE user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor_comercial'::app_role)
  OR created_by = auth.uid()
  OR representative_id IN (SELECT id FROM representatives WHERE user_id = auth.uid())
);

CREATE POLICY "Managers can delete clients"
ON public.clients FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor_comercial'::app_role)
);

DROP POLICY IF EXISTS "Reps can see their own clients" ON public.clients;
CREATE POLICY "Reps and managers can view clients"
ON public.clients FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor_comercial'::app_role)
  OR created_by = auth.uid()
  OR representative_id IN (SELECT id FROM representatives WHERE user_id = auth.uid())
);