import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';

export const Route = createFileRoute('/configuracoes/implantacao/$id')({
  component: ImportDetail,
});

function ImportDetail() {
  return (
    <AppLayout>
      <div>Detalhes da Importação</div>
    </AppLayout>
  );
}
