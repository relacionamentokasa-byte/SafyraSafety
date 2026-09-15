-- Atualizar a chave de API em todos os registros de company_settings
UPDATE public.company_settings 
SET google_maps_api_key = 'AIzaSyCKbLyHj_Hs6DJ-7U2u4GxouvLlYdAOjA0',
    updated_at = now();

-- Se não houver nenhum registro, o insert anterior já cuidou do ID 00...00.
-- Mas vamos garantir que o registro com id real também tenha a chave.
