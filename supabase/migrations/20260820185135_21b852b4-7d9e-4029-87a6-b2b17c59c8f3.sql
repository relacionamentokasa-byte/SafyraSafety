
-- 1. Garantir privilégios básicos
GRANT ALL ON public.representatives TO authenticated;
GRANT ALL ON public.representatives TO service_role;

-- 2. Corrigir políticas de RLS para a tabela representatives
-- Remover políticas antigas para evitar redundância
DROP POLICY IF EXISTS "Users can view their own representative profile" ON public.representatives;
DROP POLICY IF EXISTS "Admins can view all representatives" ON public.representatives;
DROP POLICY IF EXISTS "Admins can manage representatives" ON public.representatives;
DROP POLICY IF EXISTS "Managers can manage representatives" ON public.representatives;

-- SELECT: Admins, Gestores Comerciais e Supervisores podem ver tudo. Representantes veem a si mesmos.
CREATE POLICY "representatives_select_policy"
ON public.representatives FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'gestor_comercial') OR 
  has_role(auth.uid(), 'supervisor') OR
  (auth.uid() = user_id)
);

-- ALL: Apenas Admins e Gestores Comerciais podem inserir/atualizar/deletar
CREATE POLICY "representatives_manage_policy"
ON public.representatives FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'gestor_comercial')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'gestor_comercial')
);
