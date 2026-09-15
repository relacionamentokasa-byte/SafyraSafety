import { createFileRoute, Link } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, UserPlus, Shield, Power, PowerOff, UserCog } from 'lucide-react';
import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export const Route = createFileRoute('/configuracoes/usuarios/')({
  component: UsersManagementPage,
});

function UsersManagementPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          user_roles (
            role
          ),
          representatives (
            id,
            name
          ),
          regions (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const toggleUserStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'ativo' | 'inativo' | 'bloqueado' | 'pendente' }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Status do usuário atualizado');
    }
  });

  const filteredUsers = (users as any[])?.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u as any).email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Usuários</h1>
            <p className="text-muted-foreground">Gerencie os acessos e perfis do sistema.</p>
          </div>
          <Button asChild>
            <Link to="/configuracoes/usuarios/novo">
              <UserPlus className="mr-2 h-4 w-4" /> Novo Usuário
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Input 
            placeholder="Pesquisar por nome ou e-mail..." 
            className="max-w-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Representante</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último Acesso</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(filteredUsers as any[])?.map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar_url} />
                            <AvatarFallback>{user.full_name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{user.full_name}</span>
                            <span className="text-xs text-muted-foreground">{user.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {(() => {
                            const role = user.user_roles?.[0]?.role;
                            const roleMap: Record<string, string> = {
                              'admin': 'Administrador',
                              'manager': 'Gerente',
                              'representative': 'Representante',
                              'viewer': 'Visualizador',
                              'super_admin': 'Super Admin',
                            };
                            return role ? (roleMap[role] || role.replace('_', ' ')) : 'Sem perfil';
                          })()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {user.representatives?.name || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {user.regions?.name || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          user.status === 'ativo' ? 'default' : 
                          user.status === 'bloqueado' ? 'destructive' : 
                          user.status === 'inativo' ? 'secondary' : 'outline'
                        }>
                          {user.status || 'Pendente'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.last_access ? new Date(user.last_access).toLocaleDateString() : 'Nunca'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" title="Editar Permissões"><Shield className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" title="Configurar"><UserCog className="h-4 w-4" /></Button>
                        {user.status === 'ativo' ? (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-orange-500"
                            onClick={() => toggleUserStatus.mutate({ id: user.id, status: 'bloqueado' })}
                            title="Bloquear Acesso"
                          >
                            <PowerOff className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-green-500"
                            onClick={() => toggleUserStatus.mutate({ id: user.id, status: 'ativo' })}
                            title="Ativar Acesso"
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}