import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { RepresentativeForm } from '@/components/representantes/RepresentativeForm';

export const Route = createFileRoute('/configuracoes/usuarios/novo')({
  component: NewUserPage,
});

function NewUserPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Novo Usuário / Representante</h1>
          <p className="text-muted-foreground">Cadastre um novo membro na equipe ou um representante comercial.</p>
        </div>
        <div className="bg-muted/30 p-4 rounded-lg border border-primary/10 mb-6 space-y-2">
          <p className="text-sm font-medium text-primary">
            Dica: Para cadastrar um representante comercial completo (com dados de endereço, comissão e metas), utilize o formulário abaixo. 
          </p>
          <p className="text-[11px] text-muted-foreground">
            A comissão do representante é geralmente baseada na Indústria. O campo de comissão abaixo deve ser usado apenas para definir uma taxa fixa que sobrescreve a padrão da indústria para este representante específico.
          </p>
        </div>
        <RepresentativeForm />
      </div>
    </AppLayout>
  );
}
