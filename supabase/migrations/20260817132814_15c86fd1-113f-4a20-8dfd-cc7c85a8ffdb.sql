-- 1. Políticas para user_roles (apenas admins podem ver tudo, usuários veem a si mesmos)
create policy "Users can view their own roles" on public.user_roles
    for select to authenticated using (auth.uid() = user_id);

-- 2. Políticas para representatives
create policy "Users can view their own representative profile" on public.representatives
    for select to authenticated using (auth.uid() = user_id);

create policy "Admins can view all representatives" on public.representatives
    for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- 3. Políticas para products
create policy "Authenticated users can view products" on public.products
    for select to authenticated using (true);

-- 4. Políticas para visits
create policy "Reps can see their own visits" on public.visits
    for select to authenticated
    using (
        public.has_role(auth.uid(), 'admin') or 
        public.has_role(auth.uid(), 'gestor_comercial') or
        representative_id in (select id from public.representatives where user_id = auth.uid())
    );

-- 5. Revogar acesso público à função has_role
revoke execute on function public.has_role(uuid, public.app_role) from public;
revoke execute on function public.has_role(uuid, public.app_role) from anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to service_role;
