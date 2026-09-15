import { createFileRoute, Link } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Building2,
  Users,
  ShieldCheck,
  Map,
  Receipt,
  Target,
  Bell,
  Globe,
  UploadCloud,
  FileSpreadsheet
} from 'lucide-react';

const settingsMenus = [
  {
    title: 'Dados da Empresa',
    description: 'Razão social, CNPJ, logomarca oficial e chave Google Maps',
    icon: Building2,
    href: '/configuracoes/empresa',
    color: 'text-blue-500',
    category: 'Geral'
  },
  {
    title: 'Fabricantes & Fornecedores',
    description: 'Cadastro de indústrias, marcas e regras de comissão por liquidez',
    icon: Building2,
    href: '/configuracoes/fabricantes',
    color: 'text-cyan-500',
    category: 'Comercial'
  },
  {
    title: 'Regiões e Territórios',
    description: 'Divisão de macrorregiões e distribuição de municípios atendidos',
    icon: Map,
    href: '/configuracoes/regioes/',
    color: 'text-orange-500',
    category: 'Comercial'
  },
  {
    title: 'Usuários e Acessos',
    description: 'Gestão de contas de usuários e representantes comerciais',
    icon: Users,
    href: '/configuracoes/usuarios/',
    color: 'text-green-500',
    category: 'Segurança'
  },
  {
    title: 'Tabelas de Preço',
    description: 'Configuração de tabelas de preço por fabricante ou região',
    icon: FileSpreadsheet,
    href: '/comercial/tabelas-de-preco',
    color: 'text-emerald-500',
    category: 'Comercial'
  },
  {
    title: 'Metas Comerciais',
    description: 'Definição de metas mensais e anuais por representante',
    icon: Target,
    href: '/comercial/metas',
    color: 'text-red-500',
    category: 'Comercial'
  },
  {
    title: 'Carga e Implantação',
    description: 'Importação de planilhas de pedidos históricos, clientes e produtos',
    icon: UploadCloud,
    href: '/configuracoes/implantacao/',
    color: 'text-indigo-600',
    category: 'Sistema'
  },
];

export const Route = createFileRoute('/configuracoes/')({
  component: SettingsIndex,
});

function SettingsIndex() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações do Sistema</h1>
          <p className="text-muted-foreground">Módulos operacionais e parâmetros ativos da sua organização.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {settingsMenus.map((item) => (
            <Link key={item.href} to={item.href}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full border border-border/80 hover:border-primary/40 shadow-sm">
                <CardHeader className="flex flex-row items-center space-x-4 space-y-0">
                  <div className={`p-2.5 rounded-xl bg-muted/60 border ${item.color}`}>
                    <item.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold">{item.title}</CardTitle>
                    <CardDescription className="text-xs line-clamp-2 mt-1">{item.description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
