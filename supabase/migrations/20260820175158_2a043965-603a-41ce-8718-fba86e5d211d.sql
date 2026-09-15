INSERT INTO public.company_settings (id, company_name, google_maps_api_key, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'Safyra Safety', 'AIzaSyCKbLyHj_Hs6DJ-7U2u4GxouvLlYdAOjA0', now())
ON CONFLICT (id) DO UPDATE 
SET google_maps_api_key = EXCLUDED.google_maps_api_key,
    company_name = COALESCE(company_settings.company_name, EXCLUDED.company_name),
    updated_at = now();