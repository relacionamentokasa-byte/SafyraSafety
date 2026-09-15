import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, Save, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const modules = [
  { id: 'dashboard', name: 'Dashboard' },
  { id: 'clients', name: 'Clientes' },
  { id: 'representatives', name: 'Representantes' },
  { id: 'products', name: 'Produtos' },
  { id: 'orders', name: 'Pedidos' },
  { id: 'commissions', name: 'Comissões' },
  { id: 'crm', name: 'CRM / Pipeline' },
  { id: 'regions', name: 'Regiões' },
  { id: 'manufacturers', name: 'Fabricantes' },
  { id: 'settings', name: 'Configurações' },
];

const roles: { id: AppRole; name: string }[] = [
  { id: 'admin', name: 'Administrador' },
  { id: 'gestor_comercial', name: 'Gestor' },
  { id: 'supervisor', name: 'Supervisor' },
  { id: 'representante', name: 'Representante' },
];

export const Route = createFileRoute('/configuracoes/permissoes')({
  component: PermissionsPage,
});

function PermissionsPage() {
  const queryClient = useQueryClient();
  const [activeRole, setActiveRole] = useState<AppRole>('representante');

  const { data: permissions, isLoading } = useQuery({
    queryKey: ['permission_matrix', activeRole],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permission_matrix')
        .select('*')
        .eq('role', activeRole);
      
      if (error) throw error;
      return data || [];
    }
  });

  const updatePermission = useMutation({
    mutationFn: async ({ module, field, value }: { module: string, field: string, value: boolean }) => {
      const existing = permissions?.find(p => p.module === module);
      
      if (existing) {
        const updateData: any = {};
        updateData[field] = value;
        
        const { error } = await supabase
          .from('permission_matrix')
          .update(updateData)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const insertData: any = {
          role: activeRole,
          module: module
        };
        insertData[field] = value;

        const { error } = await supabase
          .from('permission_matrix')
          .insert(insertData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission_matrix'] });
      toast.success('Permissão atualizada');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao atualizar permissão');
    }
  });

  const getPermissionValue = (module: string, field: string) => {
    const perm = permissions?.find(p => p.module === module);
    return perm ? (perm as any)[field] : false;
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              Matriz de Permissões
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure o que cada nível de acesso pode visualizar e operar no sistema.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => (
              <Button
                key={role.id}
                variant={activeRole === role.id ? 'default' : 'outline'}
                onClick={() => setActiveRole(role.id)}
                size="sm"
              >
                {role.name}
              </Button>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Módulos do Sistema - Perfil: {roles.find(r => r.id === activeRole)?.name}</CardTitle>
                <CardDescription>
                  Marque as ações permitidas para este perfil em cada módulo.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['permission_matrix'] })}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Recarregar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando permissões...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[200px] font-bold">Módulo</TableHead>
                    <TableHead className="text-center font-bold">Visualizar</TableHead>
                    <TableHead className="text-center font-bold">Criar</TableHead>
                    <TableHead className="text-center font-bold">Editar</TableHead>
                    <TableHead className="text-center font-bold">Excluir</TableHead>
                    <TableHead className="text-center font-bold">Aprovar</TableHead>
                    <TableHead className="text-center font-bold">Exportar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modules.map((module) => (
                    <TableRow key={module.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{module.name}</TableCell>
                      <TableCell className="text-center">
                        <Checkbox 
                          checked={getPermissionValue(module.id, 'can_view')} 
                          onCheckedChange={(checked) => updatePermission.mutate({ module: module.id, field: 'can_view', value: !!checked })}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox 
                          checked={getPermissionValue(module.id, 'can_create')} 
                          onCheckedChange={(checked) => updatePermission.mutate({ module: module.id, field: 'can_create', value: !!checked })}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox 
                          checked={getPermissionValue(module.id, 'can_edit')} 
                          onCheckedChange={(checked) => updatePermission.mutate({ module: module.id, field: 'can_edit', value: !!checked })}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox 
                          checked={getPermissionValue(module.id, 'can_delete')} 
                          onCheckedChange={(checked) => updatePermission.mutate({ module: module.id, field: 'can_delete', value: !!checked })}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox 
                          checked={getPermissionValue(module.id, 'can_approve')} 
                          onCheckedChange={(checked) => updatePermission.mutate({ module: module.id, field: 'can_approve', value: !!checked })}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox 
                          checked={getPermissionValue(module.id, 'can_export')} 
                          onCheckedChange={(checked) => updatePermission.mutate({ module: module.id, field: 'can_export', value: !!checked })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {activeRole === 'admin' && (
          <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-orange-800 dark:text-orange-300">Atenção</p>
              <p className="text-sm text-orange-700 dark:text-orange-400">
                Alterações no perfil de Administrador podem afetar sua própria capacidade de gerenciar o sistema.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
