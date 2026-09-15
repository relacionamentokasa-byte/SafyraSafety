ALTER TABLE public.representatives ADD COLUMN IF NOT EXISTS name text;

UPDATE public.representatives r
SET name = p.full_name
FROM public.profiles p
WHERE p.id = r.user_id AND r.name IS NULL;

CREATE INDEX IF NOT EXISTS representatives_name_idx ON public.representatives (name);