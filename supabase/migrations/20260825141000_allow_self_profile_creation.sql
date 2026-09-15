-- Permite que o próprio usuário inicialize seu profile quando o registro ainda não existir.

GRANT INSERT ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;

CREATE POLICY "Users can create their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);
