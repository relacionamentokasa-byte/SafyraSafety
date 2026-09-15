import https from 'https';

const query = `
DO $$
DECLARE
  r RECORD;
  v_canonical_id UUID;
  v_dup_id UUID;
BEGIN
  -- Para cada grupo de CNPJ duplicado (considerando apenas os dígitos)
  FOR r IN
    SELECT regexp_replace(cnpj, '[^0-9]', '', 'g') AS clean_cnpj
    FROM public.clients
    WHERE cnpj IS NOT NULL AND regexp_replace(cnpj, '[^0-9]', '', 'g') <> ''
    GROUP BY regexp_replace(cnpj, '[^0-9]', '', 'g')
    HAVING count(*) > 1
  LOOP
    -- Escolhe como canônico o cliente que tem pedidos vinculados, ou o mais antigo
    SELECT id INTO v_canonical_id
    FROM public.clients c
    WHERE regexp_replace(c.cnpj, '[^0-9]', '', 'g') = r.clean_cnpj
    ORDER BY (SELECT count(*) FROM public.orders o WHERE o.client_id = c.id) DESC, c.created_at ASC
    LIMIT 1;

    -- Para cada duplicata diferente do canônico
    FOR v_dup_id IN
      SELECT id
      FROM public.clients c
      WHERE regexp_replace(c.cnpj, '[^0-9]', '', 'g') = r.clean_cnpj
        AND c.id <> v_canonical_id
    LOOP
      -- Migrar referências para o canônico
      UPDATE public.orders SET client_id = v_canonical_id WHERE client_id = v_dup_id;
      UPDATE public.visits SET client_id = v_canonical_id WHERE client_id = v_dup_id;
      UPDATE public.opportunities SET client_id = v_canonical_id WHERE client_id = v_dup_id;
      UPDATE public.follow_ups SET client_id = v_canonical_id WHERE client_id = v_dup_id;
      UPDATE public.client_contacts SET client_id = v_canonical_id WHERE client_id = v_dup_id;

      -- Deletar registro duplicado
      DELETE FROM public.clients WHERE id = v_dup_id;
    END LOOP;

    -- Padronizar CNPJ do canônico para apenas números
    UPDATE public.clients
    SET cnpj = r.clean_cnpj
    WHERE id = v_canonical_id;
  END LOOP;

  -- Padronizar todos os CNPJs restantes para apenas números
  UPDATE public.clients
  SET cnpj = regexp_replace(cnpj, '[^0-9]', '', 'g')
  WHERE cnpj IS NOT NULL;
END $$;
`;

const data = JSON.stringify({ query });

const req = https.request({
  hostname: 'api.supabase.com',
  path: '/v1/projects/hxogosqpcewvtwdyerru/database/query',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sbp_891e4f494957e84cb936279f649bf55d9beea392',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
  });
});

req.on('error', (e) => {
  console.error('Error:', e);
});

req.write(data);
req.end();
