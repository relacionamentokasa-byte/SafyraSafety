-- Register the commercial manufacturers and associate imported products.

INSERT INTO public.manufacturers (name, trade_name, status)
SELECT target.name, target.trade_name, 'active'
FROM (
  VALUES
    ('Libus', 'Libus'),
    ('Nutriex Profissional', 'Nutriex Profissional'),
    ('Medix', 'Medix')
) AS target(name, trade_name)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers existing
  WHERE lower(trim(existing.name)) = lower(target.name)
     OR lower(trim(existing.trade_name)) = lower(target.trade_name)
);

UPDATE public.products p
SET manufacturer_id = m.id,
    updated_at = now()
FROM public.manufacturers m
WHERE p.manufacturer_id IS NULL
  AND lower(trim(m.name)) = 'libus'
  AND lower(trim(p.brand)) = 'libus';

UPDATE public.products p
SET manufacturer_id = m.id,
    updated_at = now()
FROM public.manufacturers m
WHERE p.manufacturer_id IS NULL
  AND lower(trim(m.name)) = 'nutriex profissional'
  AND lower(trim(p.brand)) IN ('nutriex', 'nutriex profissional');

UPDATE public.products p
SET manufacturer_id = m.id,
    updated_at = now()
FROM public.manufacturers m
WHERE p.manufacturer_id IS NULL
  AND lower(trim(m.name)) = 'medix'
  AND lower(trim(p.brand)) = 'medix';

UPDATE public.price_tables pt
SET manufacturer_id = m.id,
    updated_at = now()
FROM public.manufacturers m
WHERE pt.manufacturer_id IS NULL
  AND (
    (lower(trim(m.name)) = 'libus' AND lower(trim(pt.name)) LIKE 'libus%')
    OR (
      lower(trim(m.name)) = 'nutriex profissional'
      AND lower(trim(pt.name)) LIKE 'nutriex%'
    )
    OR (lower(trim(m.name)) = 'medix' AND lower(trim(pt.name)) LIKE 'medix%')
  );

GRANT SELECT ON public.manufacturers TO authenticated;
