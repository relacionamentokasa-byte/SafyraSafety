
DO $$ BEGIN
    CREATE TYPE public.import_status AS ENUM ('pending', 'processing', 'completed', 'completed_with_errors', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.data_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    data_type TEXT NOT NULL,
    status public.import_status DEFAULT 'pending' NOT NULL,
    mapping JSONB,
    summary JSONB DEFAULT '{}'::jsonb,
    errors_log JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.import_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    data_type TEXT NOT NULL,
    mapping JSONB NOT NULL,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE ON public.data_imports TO authenticated;
GRANT ALL ON public.data_imports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_templates TO authenticated;
GRANT ALL ON public.import_templates TO service_role;

ALTER TABLE public.data_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all imports" ON public.data_imports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view their own imports" ON public.data_imports FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create imports" ON public.data_imports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Everyone authenticated can view templates" ON public.import_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage templates" ON public.import_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
