import { createFileRoute } from '@tanstack/react-router';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { AppLayout } from '@/components/layout/AppLayout';

export const Route = createFileRoute('/dashboard')({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Dashboard" },
      { name: "description", content: "Painel de controle e indicadores de performance Safyra Safety." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <Dashboard />
      </div>
    </AppLayout>
  );
}