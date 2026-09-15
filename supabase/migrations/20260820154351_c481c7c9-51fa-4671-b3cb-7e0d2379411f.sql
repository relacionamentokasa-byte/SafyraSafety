-- Grants para tabela de regiões
GRANT DELETE ON public.regions TO authenticated;
GRANT ALL ON public.regions TO service_role;

-- Grants para tabela de representantes
GRANT DELETE ON public.representatives TO authenticated;
GRANT ALL ON public.representatives TO service_role;
