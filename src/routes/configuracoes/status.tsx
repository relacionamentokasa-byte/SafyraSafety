import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings2, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";

const statusGroups = [
  {
    entity: 'Clientes',
    items: [
      { label: 'Prospect', color: 'bg-blue-500' },
      { label: 'Ativo', color: 'bg-green-500' },
      { label: 'Inativo', color: 'bg-gray-500' },
      { label: 'Bloqueado', color: 'bg-red-500' }
    ]
  },
  {
    entity: 'Pedidos',
    items: [
      { label: 'Rascunho', color: 'bg-gray-400' },
      { label: 'Enviado', color: 'bg-blue-400' },
      { label: 'Em análise', color: 'bg-orange-400' },
      { label: 'Aprovado', color: 'bg-green-600' },
      { label: 'Faturado', color: 'bg-purple-600' },
      { label: 'Cancelado', color: 'bg-red-600' }
    ]
  },
  {
    entity: 'Oportunidades',
    items: [
      { label: 'Lead', color: 'bg-blue-500' },
      { label: 'Qualificação', color: 'bg-indigo-500' },
      { label: 'Proposta', color: 'bg-orange-500' },
      { label: 'Ganha', color: 'bg-green-500' },
      { label: 'Perdida', color: 'bg-red-500' }
    ]
  }
];

export const Route = createFileRoute('/configuracoes/status')({
  component: StatusManagementPage,
});

function StatusManagementPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Status do Sistema</h1>
          <p className="text-muted-foreground">Administre os fluxos e estados das entidades do sistema.</p>
        </div>

        <div className="grid gap-6">
          {statusGroups.map((group) => (
            <Card key={group.entity}>
              <CardHeader>
                <CardTitle>{group.entity}</CardTitle>
                <CardDescription>Status configurados para o módulo de {group.entity.toLowerCase()}.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Identificador</TableHead>
                      <TableHead>Cor Visual</TableHead>
                      <TableHead>Permitir Ação Comercial</TableHead>
                      <TableHead>Visível no Mobile</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.items.map((item) => (
                      <TableRow key={item.label}>
                        <TableCell className="font-medium">{item.label}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`h-3 w-3 rounded-full ${item.color}`} />
                            <span className="text-xs">{item.color}</span>
                          </div>
                        </TableCell>
                        <TableCell><Switch checked /></TableCell>
                        <TableCell><Switch checked /></TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">Padrão do Sistema</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
