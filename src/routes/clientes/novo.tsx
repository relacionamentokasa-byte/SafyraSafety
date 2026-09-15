import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { ClientForm } from '@/components/clientes/ClientForm';

export const Route = createFileRoute('/clientes/novo')({
  component: NewClientPage,
});

function NewClientPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Novo Cliente</h1>
          <p className="text-muted-foreground">Cadastre uma nova empresa em sua carteira ou prospecção.</p>
        </div>
        <ClientForm />
      </div>
    </AppLayout>
  );
}
