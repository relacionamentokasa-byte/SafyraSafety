
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_order_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.update_client_last_order_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.clients
  SET last_order_at = NEW.created_at,
      status = 'active'
  WHERE id = NEW.client_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_client_last_order ON public.orders;
CREATE TRIGGER trigger_update_client_last_order
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_client_last_order_at();

-- Atualizar dados retroativos se houver pedidos
UPDATE public.clients c
SET last_order_at = (
  SELECT MAX(created_at)
  FROM public.orders o
  WHERE o.client_id = c.id
)
WHERE EXISTS (
  SELECT 1 FROM public.orders o WHERE o.client_id = c.id
);
