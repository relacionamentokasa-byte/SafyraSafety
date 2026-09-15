import { createFileRoute, Link } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Plus, Search, MapPin, Users, TrendingUp, MoreVertical, Eye, Edit, UserX, Trash2, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RepresentativeForm } from '@/components/representantes/RepresentativeForm';
import { ResponsiveModal } from '@/components/common/ResponsiveModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute('/representantes/')({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Equipe de Representantes" },
      { name: "description", content: "Gestão da equipe comercial, metas e regiões de atuação." },
    ],
  }),
  component: RepresentativesPage,
});

function RepresentativesPage() {
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingRepresentative, setEditingRepresentative] = useState<any | null>(null);
  const queryClient = useQueryClient();

  const { data: representatives, isLoading } = useQuery({
    queryKey: ['representatives-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('representatives')
        .select(`
          *,
          regions(name)
        `)
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const repIds = data.map((r: any) => r.id);
      const userIds = data.map((r: any) => r.user_id).filter(Boolean);

      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      // Buscar perfis, clientes, pedidos e metas em paralelo
      const [profilesRes, clientsRes, ordersRes, goalsRes] = await Promise.all([
        userIds.length
          ? supabase.from('profiles').select('id, full_name, avatar_path').in('id', userIds)
          : { data: [] },
        supabase.from('clients').select('id, representative_id'),
        supabase.from('orders').select('representative_id, total_amount, status, created_at').not('status', 'in', '("cancelled","draft")'),
        supabase.from('goals').select('representative_id, target_value, achieved_value, month, year').eq('month', String(currentMonth)).eq('year', String(currentYear)),
      ]);

      const profileMap: Record<string, { full_name: string | null; avatar_path: string | null }> = {};
      (profilesRes.data ?? []).forEach((p: any) => { profileMap[p.id] = p; });

      return data.map((r: any) => {
        // Quantidade de clientes vinculados
        const repClients = (clientsRes.data || []).filter((c: any) => c.representative_id === r.id);
        const clientsCount = repClients.length;

        // Vendas do mês atual
        const monthOrders = (ordersRes.data || []).filter((o: any) => {
          if (o.representative_id !== r.id || !o.created_at) return false;
          const dt = new Date(o.created_at);
          return dt.getMonth() + 1 === currentMonth && dt.getFullYear() === currentYear;
        });

        const currentSales = monthOrders.reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0);

        // Meta do mês atual
        const repGoal = (goalsRes.data || []).find((g: any) => g.representative_id === r.id);
        const targetValue = repGoal ? Number(repGoal.target_value) : (Number(r.monthly_goal) || 0);

        const goalPercent = targetValue > 0 ? Math.min(100, Math.round((currentSales / targetValue) * 100)) : 0;

        return {
          ...r,
          profiles: profileMap[r.user_id] ?? null,
          clients_count: clientsCount,
          current_sales: currentSales,
          target_value: targetValue,
          goal_percent: goalPercent,
        };
      });
    },
  });

  const deleteRep = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('representatives').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['representatives-list'] });
      toast.success('Representante excluído com sucesso');
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir: ' + error.message);
    }
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.from('representatives').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['representatives-list'] });
      toast.success('Status atualizado');
    }
  });

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Representantes</h1>
            <p className="text-muted-foreground">Gerencie sua equipe de vendas e regiões.</p>
          </div>
          <Button className="w-full md:w-auto" asChild>
            <Link to="/configuracoes/usuarios/novo">
              <Plus className="mr-2 h-4 w-4" />
              Novo representante
            </Link>
          </Button>

        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar representante..." className="pl-10" />
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as 'table' | 'cards')} className="w-full md:w-auto">
            <TabsList className="grid w-full grid-cols-2 md:w-auto">
              <TabsTrigger value="table">Tabela</TabsTrigger>
              <TabsTrigger value="cards">Cards</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
        ) : view === 'table' ? (
          <>
            {/* Tabela para Desktop */}
            <div className="hidden md:block border rounded-lg bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Representante</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead>Clientes</TableHead>
                    <TableHead>Vendas / Meta</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(representatives as any[])?.map((rep) => (
                    <TableRow key={rep.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={rep.photo_url || rep.profiles?.avatar_path} />
                            <AvatarFallback>{(rep.name || rep.profiles?.full_name)?.charAt(0) ?? '?'}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm">{(rep.name || rep.profiles?.full_name) ?? '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {rep.regions?.name || 'Sem Região'}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {rep.clients_count || 0}
                      </TableCell>
                      <TableCell className="w-[200px]">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span className="font-mono">
                              R$ {(rep.current_sales || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="font-mono">{rep.goal_percent || 0}%</span>
                          </div>
                          <Progress value={rep.goal_percent || 0} className="h-1.5" />
                          {rep.target_value > 0 && (
                            <div className="text-[10px] text-slate-400 font-mono text-right">
                              Meta: R$ {rep.target_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-semibold text-slate-700">
                          {rep.status === 'active' ? 'Ativo' : 'Inativo'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to="/representantes/$id" params={{ id: rep.id }}>
                                <Eye className="mr-2 h-4 w-4" /> Visualizar
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditingRepresentative(rep)}>
                              <Edit className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteId(rep.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateStatus.mutate({ id: rep.id, status: rep.status === 'active' ? 'inactive' : 'active' })}
                            >
                              <UserX className="mr-2 h-4 w-4" /> {rep.status === 'active' ? 'Desativar' : 'Ativar'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Cards Verticais Mobile */}
            <div className="md:hidden divide-y divide-slate-100 rounded-xl border bg-card overflow-hidden">
              {(representatives as any[])?.map((rep) => (
                <div key={rep.id} className="p-4 bg-white flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={rep.photo_url || rep.profiles?.avatar_path} />
                        <AvatarFallback>{(rep.name || rep.profiles?.full_name)?.charAt(0) ?? '?'}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <Link to="/representantes/$id" params={{ id: rep.id }}>
                          <h4 className="font-bold text-sm text-slate-900 leading-snug hover:text-primary transition-colors truncate">
                            {(rep.name || rep.profiles?.full_name) ?? '—'}
                          </h4>
                        </Link>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{rep.regions?.name || 'Sem Região'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                        {rep.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to="/representantes/$id" params={{ id: rep.id }}>
                              <Eye className="mr-2 h-4 w-4" /> Visualizar
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditingRepresentative(rep)}>
                            <Edit className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(rep.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateStatus.mutate({ id: rep.id, status: rep.status === 'active' ? 'inactive' : 'active' })}
                          >
                            <UserX className="mr-2 h-4 w-4" /> {rep.status === 'active' ? 'Desativar' : 'Ativar'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Clientes</span>
                      <span className="text-sm font-semibold text-slate-800">{rep.clients_count || 0}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Vendas do Mês</span>
                      <span className="text-sm font-semibold font-mono text-slate-900">
                        R$ {(rep.current_sales || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-muted-foreground">Meta atingida</span>
                      <span className="font-mono font-semibold text-slate-800">{rep.goal_percent || 0}%</span>
                    </div>
                    <Progress value={rep.goal_percent || 0} className="h-2" />
                    {rep.target_value > 0 && (
                      <div className="text-[11px] text-slate-400 font-mono text-right">
                        Meta: R$ {rep.target_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(representatives as any[])?.map((rep) => (
              <Card key={rep.id} className="overflow-hidden">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={rep.photo_url || rep.profiles?.avatar_path} />
                    <AvatarFallback>{(rep.name || rep.profiles?.full_name)?.charAt(0) ?? '?'}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <CardTitle className="text-lg">{(rep.name || rep.profiles?.full_name) ?? '—'}</CardTitle>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {rep.regions?.name || 'Sem Região'}
                    </div>
                  </div>
                  <span className="ml-auto text-xs font-semibold text-slate-700">
                    {rep.status === 'active' ? 'Ativo' : 'Inativo'}
                  </span>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Clientes</span>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">{rep.clients_count || 0}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Vendas</span>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold font-mono">
                          R$ {(rep.current_sales || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span>Progresso da Meta</span>
                      <span className="font-mono">{rep.goal_percent || 0}%</span>
                    </div>
                    <Progress value={rep.goal_percent || 0} />
                    {rep.target_value > 0 && (
                      <div className="text-[11px] text-slate-500 font-mono text-right">
                        Meta: R$ {rep.target_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>
                  <Button asChild variant="outline" className="w-full mt-4">
                    <Link to="/representantes/$id" params={{ id: rep.id }}>Ver Perfil Completo</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Edição de Representante */}
      <ResponsiveModal
        open={!!editingRepresentative}
        onOpenChange={(open) => !open && setEditingRepresentative(null)}
        title="Editar Representante"
        description="Atualize as informações cadastrais e regiões do representante."
        className="max-w-3xl"
      >
        <div className="p-4 md:p-6 overflow-y-auto max-h-[80vh]">
          {editingRepresentative && (
            <RepresentativeForm
              representativeId={editingRepresentative.id}
              initialData={editingRepresentative}
              onSuccess={() => {
                setEditingRepresentative(null);
                queryClient.invalidateQueries({ queryKey: ['representatives-list'] });
              }}
              onCancel={() => setEditingRepresentative(null)}
            />
          )}
        </div>
      </ResponsiveModal>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Representante</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este representante? Esta ação removerá o vínculo com regiões e clientes, mas manterá o histórico financeiro se houver.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteRep.mutate(deleteId)}
            >
              {deleteRep.isPending ? "Excluindo..." : "Confirmar Exclusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
