import { createFileRoute, Link, useParams } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { formatClientDisplayName, formatDisplayName } from '@/lib/format-name';
import { RepresentativeOpportunitiesTab } from '@/components/crm/RepresentativeOpportunitiesTab';
import { RepresentativeForm } from '@/components/representantes/RepresentativeForm';
import { Button } from '@/components/ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchRepresentativeDetailServer } from '@/lib/orders.functions';
import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import {
  MapPin,
  Users,
  TrendingUp,
  ChevronLeft,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  ClipboardCheck,
  Target,
  FileText,
  Clock,
  Edit,
  Loader2,
  ShoppingBag
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute('/representantes/$id')({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Perfil do Representante" },
      { name: "description", content: "Indicadores de performance, metas, carteira e histórico do representante." },
    ],
  }),
  component: RepresentativeProfilePage,
});

function RepresentativeProfilePage() {
  const { id } = useParams({ from: '/representantes/$id' });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const queryClient = useQueryClient();

  // Consulta do Representante com Server Function
  const { data: serverRepData, isLoading } = useQuery({
    queryKey: ['representative-detail-server', id],
    queryFn: async () => {
      try {
        const res = await fetchRepresentativeDetailServer({ data: { representativeId: id } });
        if (res) return res;
      } catch (errServer) {
        console.warn("[fetchRepresentativeDetailServer] fallback:", errServer);
      }
      return null;
    }
  });

  const rep = serverRepData?.representative;
  const repClients = serverRepData?.clients || [];
  const repOrders = serverRepData?.orders || [];
  const repCommissions = serverRepData?.commissions || [];
  const repVisits = serverRepData?.visits || [];
  const repFollowUps = serverRepData?.followUps || [];
  const repGoals = serverRepData?.goals || [];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin h-8 w-8 text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!rep) {
    return (
      <AppLayout>
        <div className="p-8 text-center space-y-4">
          <p className="text-lg font-medium text-destructive">Representante não encontrado.</p>
          <Button variant="outline" asChild>
            <Link to="/representantes">Voltar para Representantes</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  // Cálculos de métricas
  const totalSales = repOrders.reduce((acc, order) => acc + (Number(order.total_amount) || 0), 0);
  const totalCommission = repCommissions.length > 0
    ? repCommissions.reduce((acc, comm) => acc + (Number(comm.commission_value) || 0), 0)
    : totalSales * 0.05;
  const monthlyGoal = Number(rep.monthly_goal) || (repGoals[0]?.target_value ? Number(repGoals[0].target_value) : 0);
  const goalPercent = monthlyGoal > 0 ? Math.min(100, Math.round((totalSales / monthlyGoal) * 100)) : 0;

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-muted/10">
        {/* Header */}
        <div className="p-4 md:p-8 bg-card border-b space-y-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-4">
            <Button variant="ghost" size="sm" asChild className="-ml-2">
              <Link to="/representantes">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Voltar
              </Link>
            </Button>
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            <Avatar className="h-20 w-20 md:h-24 md:w-24">
              <AvatarImage src={rep.photo_url || rep.profiles?.avatar_path || ''} />
              <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                {(rep.name || rep.profiles?.full_name)?.charAt(0) || 'R'}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{(rep.name || rep.profiles?.full_name) ?? '—'}</h1>
                <Badge variant={rep.status === 'active' ? 'default' : 'secondary'}>
                  {rep.status === 'active' ? 'Ativo' : 'Inativo'}
                </Badge>
                {rep.code && (
                  <Badge variant="outline" className="font-mono">
                    {rep.code}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  {(rep.regions as any)?.name || 'Sem Região'}
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="h-4 w-4 text-primary" />
                  {rep.phone || 'Sem telefone'}
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-primary" />
                  {rep.email || 'Sem e-mail'}
                </div>
              </div>
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <Button variant="outline" className="flex-1 md:flex-none" onClick={() => setIsEditDialogOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button className="flex-1 md:flex-none" asChild>
                <Link to="/campo/roteirizacao">Planejar Rota</Link>
              </Button>
            </div>
          </div>

          {/* Indicadores Rápidos Reais */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[
              { label: 'Clientes', value: repClients.length.toString(), icon: Users },
              { label: 'Vendas', value: `R$ ${totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingUp },
              { label: 'Pedidos', value: repOrders.length.toString(), icon: ClipboardCheck },
              { label: 'Visitas', value: repVisits.length.toString(), icon: MapPin },
              { label: 'Follow-ups', value: repFollowUps.length.toString(), icon: FileText },
              { label: 'Meta', value: `R$ ${monthlyGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: Target },
              { label: 'Comissão', value: `R$ ${totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col p-3 rounded-xl border bg-background items-center text-center space-y-1">
                <stat.icon className="h-4 w-4 text-primary/70 mb-1" />
                <span className="text-[10px] uppercase font-bold text-muted-foreground">{stat.label}</span>
                <span className="text-sm font-bold truncate max-w-[130px]">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Modal de Edição de Representante */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Representante</DialogTitle>
            </DialogHeader>
            <RepresentativeForm
              representativeId={rep.id}
              initialData={rep}
              onSuccess={() => setIsEditDialogOpen(false)}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Abas de Detalhes */}
        <div className="flex-1 bg-muted/30">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="px-4 md:px-8 bg-card border-b overflow-x-auto no-scrollbar">
              <TabsList className="h-12 bg-transparent gap-6">
                <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Visão Geral</TabsTrigger>
                <TabsTrigger value="goals" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Metas & Fabricantes</TabsTrigger>
                <TabsTrigger value="clients" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Clientes</TabsTrigger>
                <TabsTrigger value="orders" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Pedidos</TabsTrigger>
                <TabsTrigger value="visits" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Visitas</TabsTrigger>
                <TabsTrigger value="opportunities" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Oportunidades</TabsTrigger>
                <TabsTrigger value="commissions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Comissões</TabsTrigger>
              </TabsList>
            </div>

            <div className="p-4 md:p-8 flex-1">
              <TabsContent value="overview" className="m-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Desempenho da Meta Mensal</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <span className="text-2xl font-bold">{goalPercent}%</span>
                          <p className="text-xs text-muted-foreground">
                            R$ {totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de R$ {monthlyGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <Badge variant="outline" className={goalPercent >= 100 ? "text-green-500 bg-green-500/10" : "text-primary bg-primary/10"}>
                          {goalPercent >= 100 ? "Meta Atingida" : "Em andamento"}
                        </Badge>
                      </div>
                      <Progress value={goalPercent} className="h-2" />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Carteira de Clientes</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center text-sm">
                        <span>Total de Clientes</span>
                        <span className="font-bold">{repClients.length}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span>Clientes Ativos</span>
                        <span className="font-bold text-green-600">{repClients.filter(c => c.status === 'active').length}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span>Prospects</span>
                        <span className="font-bold text-orange-600">{repClients.filter(c => c.status === 'prospect').length}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Informações de Contato</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>
                        <span className="text-xs text-muted-foreground">Telefone / WhatsApp</span>
                        <p className="font-medium">{rep.phone || rep.whatsapp || 'Não informado'}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">E-mail Comercial</span>
                        <p className="font-medium">{rep.email || 'Não informado'}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Endereço</span>
                        <p className="font-medium text-xs text-muted-foreground">{rep.address ? `${rep.address}, ${rep.number || 'S/N'} - ${rep.city || ''}/${rep.state || ''}` : 'Não informado'}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Aba de Metas por Fabricante */}
              <TabsContent value="goals" className="m-0 space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-medium text-foreground">Metas Definidas por Período e Fabricante</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">Acompanhamento dos objetivos comerciais estipulados para este representante.</p>
                    </div>
                    <Button size="sm" asChild>
                      <Link to="/comercial/metas">Gerenciar Metas</Link>
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Período</TableHead>
                          <TableHead>Fabricante</TableHead>
                          <TableHead>Meta Estipulada</TableHead>
                          <TableHead>Realizado</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {repGoals.map((goal: any) => {
                          const achieved = Number(goal.achieved_value) || 0;
                          const target = Number(goal.target_value) || 0;
                          const pct = target > 0 ? (achieved / target) * 100 : 0;
                          return (
                            <TableRow key={goal.id}>
                              <TableCell className="font-mono text-xs font-semibold">
                                {goal.month}/{goal.year}
                              </TableCell>
                              <TableCell>
                                {goal.manufacturer ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                                    {goal.manufacturer.trade_name || goal.manufacturer.name}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                                    Geral
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-sm font-medium">
                                R$ {target.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="font-mono text-sm font-bold text-slate-900">
                                R$ {achieved.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell>
                                <Badge variant={pct >= 100 ? "default" : "secondary"} className="text-[10px]">
                                  {pct.toFixed(0)}% batido
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {repGoals.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground italic">
                              Nenhuma meta individual ou por fabricante cadastrada para este representante.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Aba de Clientes */}
              <TabsContent value="clients" className="m-0 space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium text-foreground">Carteira do Representante</CardTitle>
                    <Button size="sm" asChild>
                      <Link to="/clientes">Ver Todos os Clientes</Link>
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Cidade / UF</TableHead>
                          <TableHead>Segmento</TableHead>
                          <TableHead>Contato</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {repClients.map((client) => (
                          <TableRow key={client.id} className="hover:bg-muted/50">
                            <TableCell>
                              <Link to="/clientes/$id" params={{ id: client.id }} className="hover:underline font-medium text-sm text-primary">
                                {formatClientDisplayName(client)}
                              </Link>
                            </TableCell>
                            <TableCell className="text-sm">{client.city || '-'}/{client.state || '-'}</TableCell>
                            <TableCell className="text-sm">{client.segment || '-'}</TableCell>
                            <TableCell className="text-sm">{client.contact_name || client.phone || '-'}</TableCell>
                            <TableCell>
                              <Badge variant={client.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                                {client.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {repClients.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground italic">
                              Nenhum cliente vinculado a este representante.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Aba de Pedidos */}
              <TabsContent value="orders" className="m-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-foreground">Pedidos do Representante</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Número / ID</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Valor Total</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {repOrders.map((order) => (
                          <TableRow key={order.id} className="hover:bg-muted/50">
                            <TableCell className="font-mono text-xs font-bold">
                              <Link to="/comercial/pedidos/$id" params={{ id: order.id }} className="text-primary hover:underline">
                                {order.order_number || order.id.substring(0, 8)}
                              </Link>
                            </TableCell>
                            <TableCell className="text-sm font-medium">{formatDisplayName((order.client as any)?.name) || '-'}</TableCell>
                            <TableCell className="text-sm">
                              {order.created_at ? format(new Date(order.created_at), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                            </TableCell>
                            <TableCell className="text-sm font-semibold">
                              R$ {Number(order.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              <Badge variant={order.status === 'invoiced' ? 'default' : 'secondary'} className="text-[10px]">
                                {order.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {repOrders.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground italic">
                              Nenhum pedido emitido por este representante.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Aba de Visitas */}
              <TabsContent value="visits" className="m-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-foreground">Visitas Registradas</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Data e Hora</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Observações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {repVisits.map((v) => (
                          <TableRow key={v.id}>
                            <TableCell className="font-medium text-sm">{formatDisplayName((v.client as any)?.name) || '-'}</TableCell>
                            <TableCell className="text-sm">
                              {v.scheduled_at ? format(new Date(v.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={v.status === 'completed' ? 'default' : 'secondary'} className="text-[10px]">
                                {v.status === 'completed' ? 'Concluída' : v.status === 'scheduled' ? 'Agendada' : 'Cancelada'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                              {v.notes || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                        {repVisits.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground italic">
                              Nenhuma visita registrada para este representante.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Aba de Oportunidades */}
              <TabsContent value="opportunities" className="m-0">
                <RepresentativeOpportunitiesTab representativeId={id} />
              </TabsContent>

              {/* Aba de Comissões */}
              <TabsContent value="commissions" className="m-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="p-4 flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total de Vendas</CardTitle>
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-xl font-bold">R$ {totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="p-4 flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Taxa de Comissão</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-xl font-bold">{rep.commission_rate || 5}%</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="p-4 flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Comissão Total Estimada</CardTitle>
                      <DollarSign className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-xl font-bold text-green-500">R$ {totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Extrato de Comissões por Pedido</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pedido</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Valor da Venda</TableHead>
                          <TableHead>Alíquota</TableHead>
                          <TableHead>Comissão</TableHead>
                          <TableHead>Status Pedido</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {repOrders.map((order) => {
                          const orderCommission = (Number(order.total_amount) || 0) * ((Number(rep.commission_rate) || 5) / 100);
                          return (
                            <TableRow key={order.id}>
                              <TableCell className="font-mono text-xs font-bold">
                                {order.order_number || order.id.substring(0, 8)}
                              </TableCell>
                              <TableCell className="text-sm font-medium">{(order.client as any)?.name || '-'}</TableCell>
                              <TableCell className="text-sm">R$ {Number(order.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-sm">{rep.commission_rate || 5}%</TableCell>
                              <TableCell className="font-bold text-primary text-sm">
                                R$ {orderCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell>
                                <Badge variant={order.status === 'invoiced' ? 'default' : 'secondary'} className="text-[10px]">
                                  {order.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {repOrders.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground italic">
                              Nenhum pedido para cálculo de comissão.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Modal de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Representante</DialogTitle>
          </DialogHeader>
          <RepresentativeForm
            representativeId={id}
            initialData={rep}
            onSuccess={() => {
              setIsEditDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ['representative-detail', id] });
              queryClient.invalidateQueries({ queryKey: ['representatives-list'] });
            }}
            onCancel={() => setIsEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
