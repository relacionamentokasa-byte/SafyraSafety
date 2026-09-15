import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

export const Route = createFileRoute('/campo/mapa')({
  component: RedirectToClientsMap,
});

function RedirectToClientsMap() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: '/clientes', search: { view: 'map' } as any });
  }, [navigate]);

  return null;
}
