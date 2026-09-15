import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useMemo, useState, useDeferredValue } from "react";
import { cn } from "@/lib/utils";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Navigation,
  ChevronRight,
  User,
  BookOpen,
  FileText,
  Save,
  Loader2,
  CheckSquare,
  MessageSquare,
  Sparkles,
  Trash2
} from "lucide-react";
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
import { ClientMixPitchDrawer } from "@/components/mix/ClientMixPitchDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveModal } from "@/components/common/ResponsiveModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getClientById } from "@/lib/clients.services";
import { toast } from "sonner";
import { Visit } from "@/types/database.types";
import { formatClientDisplayName } from "@/lib/format-name";
import { RepresentativeBadge } from "@/components/representantes/RepresentativeBadge";
import { FieldQuickActions } from "@/components/common/FieldQuickActions";


export const Route = createFileRoute("/campo/visitas")({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Minhas Visitas" },
      { name: "description", content: "Agenda de visitas técnicas e comerciais." },
    ],
  }),
  component: VisitsPage,
});

function VisitsPage() {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];
  const [searchTerm, setSearchTerm] = useState('');
  const location = useLocation();
  const deferredSearch = useDeferredValue(searchTerm);

  // Estados do Caderno de Anotações e Diagnóstico de Mix
  const [isNotebookOpen, setIsNotebookOpen] = useState(false);
  const [activeVisit, setActiveVisit] = useState<any>(null);
  const [notebookContent, setNotebookContent] = useState('');
  const [meetingSummary, setMeetingSummary] = useState('');
  const [agreements, setAgreements] = useState('');
  const [visitStatus, setVisitStatus] = useState<'scheduled' | 'completed' | 'cancelled'>('scheduled');

  // Estado do Raio-X de Mix & Pitch de Visita
  const [pitchClientId, setPitchClientId] = useState<string | null>(null);
  const [isPitchDrawerOpen, setIsPitchDrawerOpen] = useState(false);

  // Estado de Exclusão de Visita
  const [visitToDelete, setVisitToDelete] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { data: visits, isLoading } = useQuery({
    queryKey: ['visits-list', deferredSearch],
    queryFn: async () => {
      let query = supabase
        .from('visits')
        .select(`
          *,
          client:clients(name, city, address),
          representative:representatives(name, code, photo_url)
        `)
        .order('scheduled_at', { ascending: false });

      const { data, error } = await query.limit(50);
      if (error) throw error;

      // Enriquecer dados do cliente se o join relacional do Supabase não retornou para clientes canônicos
      const enriched = await Promise.all((data || []).map(async (v: any) => {
        if (!v.client && v.client_id) {
          const clientData = await getClientById(v.client_id);
          return {
            ...v,
            client: clientData ? { name: clientData.name, city: clientData.city, address: clientData.address } : null
          };
        }
        return v;
      }));

      return enriched as any[];
    },
    staleTime: 1000 * 60 * 2,
  });

  const saveNotebookMutation = useMutation({
    mutationFn: async () => {
      if (!activeVisit) return;
      const { data: savedVisit, error } = await supabase
        .from('visits')
        .update({
          notes: notebookContent,
          meeting_summary: meetingSummary,
          agreements,
          status: visitStatus,
        })
        .eq('id', activeVisit.id)
        .select('id')
        .single();

      if (error) throw error;
      if (!savedVisit) throw new Error('O banco não confirmou a atualização');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits-list'] });
      toast.success('Caderno da visita salvo no banco com sucesso!');
      setIsNotebookOpen(false);
    },
    onError: (err: any) => {
      toast.error('Erro ao salvar anotações: ' + err.message);
    }
  });

  const deleteVisitMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('visits')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits-list'] });
      toast.success('Visita excluída com sucesso!');
      setIsDeleteDialogOpen(false);
      setVisitToDelete(null);
    },
    onError: (err: any) => {
      toast.error('Erro ao excluir visita: ' + err.message);
    }
  });

  const handleOpenNotebook = (visit: any) => {
    setActiveVisit(visit);
    setNotebookContent(visit.notes || '');
    setMeetingSummary(visit.meeting_summary || '');
    setAgreements(visit.agreements || '');
    setVisitStatus(visit.status || 'scheduled');
    setIsNotebookOpen(true);
  };

  const todayVisits = useMemo(() => {
    if (!visits) return [];
    return visits.filter(v =>
      v.scheduled_at.startsWith(today) && v.status !== 'cancelled'
    );
  }, [visits, today]);

  const nextVisit = useMemo(() => {
    if (todayVisits.length === 0) return null;
    const now = new Date();
    return todayVisits
      .filter(v => new Date(v.scheduled_at) > now)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0];
  }, [todayVisits]);


  const statusColors = {
    scheduled: "bg-blue-500",
    completed: "bg-green-500",
    cancelled: "bg-destructive"
  };

  const statusLabels = {
    scheduled: "Agendada",
    completed: "Concluída",
    cancelled: "Cancelada"
  };

  const isChildRoute = location.pathname !== '/campo/visitas';

  return (
    <AppLayout>
      {isChildRoute ? (
        <Outlet />
      ) : (
        <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Minhas Visitas</h1>
            <p className="text-muted-foreground">Planejamento e registro de atividades em campo.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link to="/campo/roteirizacao">
                <Navigation className="mr-2 h-4 w-4" />
                Roteirização
              </Link>
            </Button>
            <Button asChild>
              <Link to="/campo/visitas/novo" search={{ clientId: undefined }}>
                <Plus className="mr-2 h-4 w-4" />
                Agendar Visita
              </Link>
            </Button>
          </div>
        </div>

        {/* Painel Integrado: Operações de Campo */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden shrink-0">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Painel de Atendimento Externo & Rota
            </span>
            <span className="text-[11px] font-mono font-medium text-slate-400">
              {visits?.length || 0} visitas registradas
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            {/* Hoje */}
            <div className="p-5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-2">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Agenda de Hoje
                </span>
              </div>
              <div>
                <div className="text-2xl lg:text-3xl font-bold font-mono text-slate-900 tracking-tight">
                  {todayVisits.length}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {nextVisit
                    ? `Próxima às ${format(new Date(nextVisit.scheduled_at), "HH:mm")}`
                    : todayVisits.length > 0 ? "Visitas do dia concluídas" : "Sem visitas programadas"}
                </div>
              </div>
            </div>

            {/* Concluídas */}
            <div className="p-5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-2">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Realizadas
                </span>
              </div>
              <div>
                <div className="text-2xl lg:text-3xl font-bold font-mono text-slate-900 tracking-tight">
                  {visits?.filter(v => v.status === 'completed').length || 0}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Histórico de atendimentos
                </div>
              </div>
            </div>

            {/* Pendentes */}
            <div className="p-5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-2">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Agendadas
                </span>
              </div>
              <div>
                <div className="text-2xl lg:text-3xl font-bold font-mono text-slate-900 tracking-tight">
                  {visits?.filter(v => v.status === 'scheduled').length || 0}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Aguardando visita
                </div>
              </div>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por cliente ou status..." 
                  className="pl-9 h-10" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm" className="w-full md:w-auto">
                <Filter className="mr-2 h-4 w-4" /> Filtros
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center text-muted-foreground">Carregando agenda...</div>
            ) : visits && visits.length > 0 ? (
              <>
                {/* Tabela Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data e Hora</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Localização</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visits.map((visit) => (
                        <TableRow key={visit.id} className="group hover:bg-muted/50">
                          <TableCell className="font-medium whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold">
                                {format(new Date(visit.scheduled_at), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(visit.scheduled_at), "HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold">
                                {visit.client ? formatClientDisplayName(visit.client) : 'Cliente não informado'}
                              </span>
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Cliente</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 text-primary/70" />
                              {visit.client?.city || '-'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <RepresentativeBadge
                              name={visit.representative?.name}
                              photoUrl={visit.representative?.photo_url}
                              size="xs"
                              fallbackText="—"
                            />
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-semibold text-slate-700">
                              {statusLabels[visit.status as keyof typeof statusLabels]}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Ações Rápidas de 1 Toque (WhatsApp / Ligação / Waze / Maps) */}
                              <FieldQuickActions
                                phone={visit.client?.phone}
                                whatsapp={visit.client?.whatsapp}
                                location={{
                                  address: visit.client?.address,
                                  address_number: visit.client?.address_number,
                                  neighborhood: visit.client?.neighborhood,
                                  city: visit.client?.city,
                                  state: visit.client?.state,
                                  latitude: visit.client?.latitude,
                                  longitude: visit.client?.longitude,
                                }}
                                clientName={visit.client?.name}
                              />

                              {visit.client_id && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors"
                                  onClick={() => {
                                    setPitchClientId(visit.client_id);
                                    setIsPitchDrawerOpen(true);
                                  }}
                                >
                                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                                  Mix & Pitch
                                </Button>
                              )}
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-8 gap-1.5 text-xs font-semibold"
                                onClick={() => handleOpenNotebook(visit)}
                              >
                                <BookOpen className="h-3.5 w-3.5 text-primary" />
                                Caderno
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                title="Excluir visita"
                                onClick={() => {
                                  setVisitToDelete(visit);
                                  setIsDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" asChild className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <Link to="/clientes/$id" params={{ id: visit.client_id }}>
                                  Detalhes <ChevronRight className="ml-1 h-3 w-3" />
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Cards Verticais Mobile */}
                <div className="md:hidden divide-y divide-slate-100">
                  {visits.map((visit) => (
                    <div key={visit.id} className="p-4 bg-white hover:bg-slate-50/50 transition-colors flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                              {statusLabels[visit.status as keyof typeof statusLabels]}
                            </span>
                            <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(visit.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <Link to="/clientes/$id" params={{ id: visit.client_id }}>
                            <h4 className="font-bold text-sm text-slate-900 leading-snug hover:text-primary transition-colors">
                              {visit.client ? formatClientDisplayName(visit.client) : 'Cliente não informado'}
                            </h4>
                          </Link>
                          {visit.client?.city && (
                            <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3 w-3 text-slate-400" />
                              {visit.client?.city}/{visit.client?.state}
                            </span>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-400 hover:text-destructive shrink-0"
                          onClick={() => {
                            setVisitToDelete(visit);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Ações de Campo Mobile */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                        <FieldQuickActions
                          phone={visit.client?.phone}
                          whatsapp={visit.client?.whatsapp}
                          location={{
                            address: visit.client?.address,
                            address_number: visit.client?.address_number,
                            neighborhood: visit.client?.neighborhood,
                            city: visit.client?.city,
                            state: visit.client?.state,
                            latitude: visit.client?.latitude,
                            longitude: visit.client?.longitude,
                          }}
                          clientName={visit.client?.name}
                          variant="buttons"
                        />

                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 text-xs font-semibold gap-1 shrink-0 ml-auto"
                          onClick={() => handleOpenNotebook(visit)}
                        >
                          <BookOpen className="h-3.5 w-3.5 text-primary" />
                          Caderno
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="p-16 text-center space-y-4">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 border-2 border-dashed">
                  <Calendar className="h-8 w-8 text-muted-foreground/30" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-bold">Nenhuma visita agendada</p>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    Planeje suas atividades de campo agendando visitas ou criando roteiros inteligentes.
                  </p>
                </div>
                <Button className="mt-4" asChild>
                  <Link to="/campo/visitas/novo" search={{ clientId: undefined }}>Agendar Visita</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      )}

      {/* Caderno de Anotações Modal (Bottom Sheet no Mobile / Dialog no Desktop) */}
      <ResponsiveModal
        open={isNotebookOpen}
        onOpenChange={setIsNotebookOpen}
        maxContentClass="max-w-3xl"
        title={
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base sm:text-lg font-semibold block text-slate-900">Caderno de Anotações da Visita</span>
              <span className="text-xs text-slate-500 font-normal block">
                {activeVisit?.client?.name} {activeVisit?.scheduled_at ? `• ${format(new Date(activeVisit.scheduled_at), "dd/MM/yyyy 'às' HH:mm")}` : ''}
              </span>
            </div>
          </div>
        }
      >
        <div className="space-y-6 my-2">
          {/* Status Rápido */}
          <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg border">
            <Button
              type="button"
              variant={visitStatus === 'scheduled' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setVisitStatus('scheduled')}
              className={cn("flex-1", visitStatus === 'scheduled' && "bg-blue-500 hover:bg-blue-600")}
            >
              <Clock className="mr-2 h-4 w-4" /> Agendada
            </Button>
            <Button
              type="button"
              variant={visitStatus === 'completed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setVisitStatus('completed')}
              className={cn("flex-1", visitStatus === 'completed' && "bg-green-500 hover:bg-green-600")}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" /> Concluída
            </Button>
            <Button
              type="button"
              variant={visitStatus === 'cancelled' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setVisitStatus('cancelled')}
              className={cn("flex-1", visitStatus === 'cancelled' && "bg-red-500 hover:bg-red-600")}
            >
              <XCircle className="mr-2 h-4 w-4" /> Cancelada
            </Button>
          </div>

          {/* Campos do Caderno */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-sm">Resumo e Tópicos Conversados</h4>
              </div>
              <Textarea
                placeholder="Descreva os principais pontos abordados durante a reunião com o cliente..."
                className="min-h-[120px] resize-none"
                value={meetingSummary}
                onChange={(e) => setMeetingSummary(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-sm">Acordos e Próximos Passos (Follow-up)</h4>
              </div>
              <Textarea
                placeholder="Quais foram os acordos? O que precisa ser feito em seguida? Ex: Enviar tabela atualizada, agendar nova call..."
                className="min-h-[80px] resize-none border-primary/20"
                value={agreements}
                onChange={(e) => setAgreements(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-semibold text-sm text-muted-foreground">Observações Gerais Internas</h4>
              </div>
              <Textarea
                placeholder="Anotações adicionais, percepção sobre a compra, risco de churn, etc..."
                className="min-h-[80px] resize-none"
                value={notebookContent}
                onChange={(e) => setNotebookContent(e.target.value)}
              />
            </div>
          </div>

          <div className="border-t pt-4 flex flex-col sm:flex-row sm:justify-between items-center gap-3 w-full">
            <div>
              {activeVisit?.client_id && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 w-full sm:w-auto"
                  onClick={() => {
                    setPitchClientId(activeVisit.client_id);
                    setIsPitchDrawerOpen(true);
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Ver Raio-X de Mix & Sugestões
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button variant="outline" onClick={() => setIsNotebookOpen(false)} className="flex-1 sm:flex-initial">Cancelar</Button>
              <Button onClick={() => saveNotebookMutation.mutate()} disabled={saveNotebookMutation.isPending} className="flex-1 sm:flex-initial">
                {saveNotebookMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" /> Salvar Caderno</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </ResponsiveModal>

      {/* Modal / Dialog de Raio-X de Mix e Pitch de Visita */}
      <ResponsiveModal
        open={isPitchDrawerOpen}
        onOpenChange={setIsPitchDrawerOpen}
        maxContentClass="max-w-4xl"
        title={
          <div className="flex items-center gap-2 text-base sm:text-lg font-semibold">
            <Sparkles className="h-5 w-5 text-primary" />
            Inteligência de Mix & Preparação de Visita
          </div>
        }
        description="Diagnóstico de penetração por fabricante parceiro, hábitos de compra do cliente e gaps para cross-selling."
      >
        <div className="space-y-4">
          {pitchClientId && (
            <div className="py-2">
              <ClientMixPitchDrawer clientId={pitchClientId} />
            </div>
          )}

          <div className="border-t pt-4 flex justify-end">
            <Button variant="outline" onClick={() => setIsPitchDrawerOpen(false)} className="w-full sm:w-auto">
              Fechar
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      {/* Alerta de Confirmação de Exclusão da Visita */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Excluir Agendamento de Visita
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a visita com o cliente{" "}
              <strong className="text-slate-900">{visitToDelete?.client?.name || 'Cliente'}</strong>?
              Essa ação não pode ser desfeita e removerá o histórico desta visita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteVisitMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteVisitMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (visitToDelete?.id) {
                  deleteVisitMutation.mutate(visitToDelete.id);
                }
              }}
            >
              {deleteVisitMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Sim, excluir visita"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

