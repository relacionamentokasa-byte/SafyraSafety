import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  UserCheck, 
  UserMinus, 
  Key, 
  Trash2, 
  Shield, 
  Clock, 
  Calendar,
  ChevronLeft
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { auditService } from '@/lib/audit';
import { toast } from 'sonner';

export const Route = createFileRoute('/configuracoes/usuarios/$id')({
  component: UserDetailPage,
});

function UserDetailPage() {
  // Mock data matching the prompt requirements
  const user = {
    id: '1',
    name: 'João Silva',
    email: 'joao@safyra.com',
    phone: '(62) 99999-9999',
    role: 'Administrador',
    repLinked: '-',
    region: 'Goiânia - GO',
    status: 'ativo',
    lastAccess: '10/08/2026 14:30',
    createdAt: '01/01/2026',
    avatar: 'https://github.com/shadcn.png',
    firstLoginDone: true,
    provisionalPasswordActive: false
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus } as any)
        .eq('id', user.id);
      
      if (error) throw error;
      
      await auditService.log(`user_status_changed_${newStatus}`, user.id);
      toast.success(`Status alterado para ${newStatus}`);
      // Em uma app real, usaríamos refetch do TanStack Query
    } catch (error: any) {
      toast.error("Erro ao alterar status: " + error.message);
    }
  };

  const handleResetPassword = async () => {
    try {
      // Nota: Em um fluxo admin, o admin pode solicitar o reset via e-mail 
      // ou definir uma senha provisória via service role (Edge Function).
      toast.info("Funcionalidade de reset administrativo simulada via auditoria.");
      await auditService.log('admin_requested_password_reset', user.id);
    } catch (error: any) {
      toast.error("Erro ao solicitar reset.");
    }
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-2">
          <ChevronLeft className="h-4 w-4" />
          <Link to="/configuracoes/usuarios" className="text-sm font-medium">Voltar para usuários</Link>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-2 border-primary/10">
              <AvatarImage src={user.avatar} />
              <AvatarFallback className="text-2xl">{user.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{user.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant={user.status === 'ativo' ? 'default' : 'secondary'}
                >
                  {user.status === 'ativo' ? 'Ativo' : user.status === 'bloqueado' ? 'Bloqueado' : 'Inativo'}
                </Badge>
                <span className="text-muted-foreground text-sm">{user.email}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {user.status !== 'ativo' ? (
              <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleStatusChange('ativo')}>
                <UserCheck className="mr-2 h-4 w-4" /> Liberar Acesso
              </Button>
            ) : (
              <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10" onClick={() => handleStatusChange('bloqueado')}>
                <UserMinus className="mr-2 h-4 w-4" /> Bloquear Acesso
              </Button>
            )}
            <Button variant="outline" onClick={handleResetPassword}>
              <Key className="mr-2 h-4 w-4" /> Redefinir Senha
            </Button>
            <Button variant="destructive" onClick={() => handleStatusChange('inativo')}>
              <Trash2 className="mr-2 h-4 w-4" /> Desativar Usuário
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Dados Pessoais & Vinculação</CardTitle>
              <CardDescription>Informações cadastrais do perfil</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Nome Completo</p>
                <p className="text-base font-semibold">{user.name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">E-mail</p>
                <p className="text-base font-semibold">{user.email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Telefone</p>
                <p className="text-base font-semibold">{user.phone}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Perfil de Acesso</p>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <p className="text-base font-semibold">{user.role}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Representante Vinculado</p>
                <p className="text-base font-semibold">{user.repLinked}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Região</p>
                <p className="text-base font-semibold">{user.region}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status de Acesso</CardTitle>
              <CardDescription>Segurança e histórico</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Último Acesso</p>
                  <p className="text-xs text-muted-foreground">{user.lastAccess}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Data de Criação</p>
                  <p className="text-xs text-muted-foreground">{user.createdAt}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <UserCheck className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Primeiro Acesso Realizado</p>
                  <p className="text-xs text-muted-foreground">{user.firstLoginDone ? 'Sim' : 'Não'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Key className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Senha Provisória Ativa</p>
                  <p className="text-xs text-muted-foreground">{user.provisionalPasswordActive ? 'Sim' : 'Não'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
