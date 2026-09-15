-- Corrigindo handle_representatives_audit
ALTER FUNCTION public.handle_representatives_audit() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_representatives_audit() FROM PUBLIC;

-- Corrigindo has_role (já tem search_path, mas garantindo permissões)
ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
