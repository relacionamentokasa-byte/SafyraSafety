ALTER TABLE public.manufacturers ADD COLUMN IF NOT EXISTS default_commission_rate NUMERIC DEFAULT 0;
COMMENT ON COLUMN public.manufacturers.default_commission_rate IS 'Taxa de comissão padrão para esta indústria/fabricante.';

GRANT SELECT, INSERT, UPDATE ON public.manufacturers TO authenticated;
GRANT ALL ON public.manufacturers TO service_role;
