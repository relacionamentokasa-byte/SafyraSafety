import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Search,
  Filter,
  Users,
  UserCheck,
  Calendar,
  MoreVertical,
  Eye,
  Edit,
  History,
  FileText,
  ShoppingBag,
  Navigation,
  Loader2,
  ChevronLeft,
  ChevronRight,
  List,
  Map as MapIcon
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useDeferredValue, useMemo } from 'react';
import { getClients, getClientsStats, getMapClients } from '@/lib/clients.services';
import { formatClientDisplayName, formatDisplayName } from '@/lib/format-name';
import { RepresentativeBadge } from '@/components/representantes/RepresentativeBadge';
import { ClientForm } from '@/components/clientes/ClientForm';
import { FieldQuickActions } from '@/components/common/FieldQuickActions';
import { ResponsiveModal } from '@/components/common/ResponsiveModal';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { GoogleMap } from '@/components/campo/GoogleMap';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute('/clientes/')({
  validateSearch: (search: Record<string, unknown>): { view?: string } => {
    return {
      view: search.view as string | undefined,
    }
  },
  head: () => ({
    meta: [
      { title: "Safyra Safety | Clientes" },
      { name: "description", content: "Gestão da carteira de clientes, filtros avançados e busca rápida." },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const searchParams = Route.useSearch();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'map'>(searchParams.view === 'map' ? 'map' : 'list');

  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: clientsData, isLoading, refetch } = useQuery({
    queryKey: ['clients-list', deferredSearch, page, statusFilter, pageSize],
    queryFn: () => getClients({
      search: deferredSearch,
      status: statusFilter,
      page,
      pageSize
    }),
    staleTime: 1000 * 60 * 5,
  });

  const { data: mapClientsData = [], isLoading: isLoadingMap } = useQuery({
    queryKey: ['clients-map-all', deferredSearch, statusFilter],
    queryFn: async () => {
      const res = await getMapClients(deferredSearch);
      if (statusFilter !== 'all') {
        return res.filter(c => c.status === statusFilter);
      }
      return res;
    },
    enabled: viewMode === 'map',
    staleTime: 1000 * 60 * 5,
  });

  const { data: settings } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/company_settings?select=google_maps_api_key&order=updated_at.desc&limit=1`, {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      return data?.[0] || null;
    }
  });

  const GOOGLE_MAPS_API_KEY = (settings as any)?.google_maps_api_key || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

  // Agrupar clientes por cidade para o mapa de densidade
  const cityClusters = useMemo(() => {
    if (!mapClientsData.length) return [];

    const clusters = new Map<string, { lat: number, lng: number, count: number, city: string, state: string }>();

    mapClientsData.forEach(client => {
      if (!client.latitude || !client.longitude || !client.city) return;

      const cityKey = `${client.city.toLowerCase()}-${client.state?.toLowerCase()}`;

      if (clusters.has(cityKey)) {
        const existing = clusters.get(cityKey)!;
        existing.count += 1;
      } else {
        clusters.set(cityKey, {
          lat: Number(client.latitude),
          lng: Number(client.longitude),
          count: 1,
          city: client.city,
          state: client.state || ''
        });
      }
    });

    return Array.from(clusters.values()).map(c => ({
      id: `cluster-${c.city}`,
      position: { lat: c.lat, lng: c.lng },
      title: `${c.city}, ${c.state}`,
      label: {
        text: c.count.toString(),
        color: 'white',
        fontWeight: 'bold',
        fontSize: '14px'
      }
    }));
  }, [mapClientsData]);

  const { data: statsData } = useQuery({
    queryKey: ['clients-stats'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc('get_dashboard_stats');
        if (!error && data) return data as any;
      } catch (e) {}
      return {};
    }
  });

  const clients = clientsData?.data || [];
  const totalCount = clientsData?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const { data: clientsAll } = useQuery({
    queryKey: ['clients-all-simple'],
    queryFn: () => getClientsStats(),
  });

  const stats = [
    { label: 'Total de Clientes', value: (clientsAll?.total || 0).toString(), icon: Users, color: 'text-blue-500' },
    { label: 'Clientes Ativos', value: (clientsAll?.active || 0).toString(), icon: UserCheck, color: 'text-green-500' },
    { label: 'Novos (Mês)', value: statsData?.new_clients_month?.toString() || '0', icon: Plus, color: 'text-purple-500' },
    { label: 'Pendentes', value: (clientsAll?.prospect || 0).toString(), icon: ShoppingBag, color: 'text-orange-500' },
    { label: 'Sem Visita', value: '0', icon: Calendar, color: 'text-red-500' },
  ];

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 h-full flex flex-col">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-5 shrink-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">Clientes</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie contas ativas, prospects e inteligência geográfica de atendimento.</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Tabs value={viewMode} onValueChange={(v: any) => {
              setViewMode(v);
              navigate({ to: '/clientes', search: v === 'map' ? { view: 'map' } : {} as any, replace: true });
            }} className="mr-2">
              <TabsList className="grid w-[200px] grid-cols-2">
                <TabsTrigger value="list" className="gap-2"><List size={14}/> Lista</TabsTrigger>
                <TabsTrigger value="map" className="gap-2"><MapIcon size={14}/> Mapa</TabsTrigger>
              </TabsList>
            </Tabs>

            <Button variant="outline" className="hidden lg:flex" asChild>
              <Link to="/campo/roteirizacao">
                <Navigation className="mr-2 h-4 w-4" />
                Planejar Rota
              </Link>
            </Button>
            <Button className="flex-1 md:flex-none bg-primary text-primary-foreground font-semibold shadow-xs" asChild>
              <Link to="/clientes/novo">
                <Plus className="mr-2 h-4 w-4" />
                Novo Cliente
              </Link>
            </Button>
          </div>
        </div>

        {/* Indicadores Integrados (Bento Grid) */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden shrink-0">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Saúde da Carteira de Clientes
            </span>
            <span className="text-[11px] font-mono font-medium text-slate-400">
              {clientsAll?.total || 0} contas mapeadas
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            {/* Total Clientes */}
            <div className="p-4.5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Total Clientes
                </span>
              </div>
              <div>
                <div className="text-xl font-extrabold font-mono text-slate-900 tracking-tight">
                  {clientsAll?.total || 0}
                </div>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Base cadastrada</span>
              </div>
            </div>

            {/* Ativos */}
            <div className="p-4.5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Ativos
                </span>
              </div>
              <div>
                <div className="text-xl font-extrabold font-mono text-slate-900 tracking-tight">
                  {clientsAll?.active || 0}
                </div>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Comprando regularmente</span>
              </div>
            </div>

            {/* Novos (Mês) */}
            <div className="p-4.5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Novos (Mês)
                </span>
              </div>
              <div>
                <div className="text-xl font-extrabold font-mono text-slate-900 tracking-tight">
                  {statsData?.new_clients_month || 0}
                </div>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Prospecções recentes</span>
              </div>
            </div>

            {/* Prospects */}
            <div className="p-4.5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Prospects
                </span>
              </div>
              <div>
                <div className="text-xl font-extrabold font-mono text-slate-900 tracking-tight">
                  {clientsAll?.prospect || 0}
                </div>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Em qualificação</span>
              </div>
            </div>

            {/* Sem Visita */}
            <div className="p-4.5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors col-span-2 md:col-span-1">
              <div className="mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Sem Visita
                </span>
              </div>
              <div>
                <div className="text-xl font-extrabold font-mono text-slate-900 tracking-tight">
                  0
                </div>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Nenhum cliente esquecido</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="flex flex-col md:flex-row gap-4 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CNPJ, cidade ou contato..."
              className="pl-10 bg-card"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Filtros
                  {statusFilter !== 'all' && (
                    <Badge variant="secondary" className="ml-2 px-1 h-4 min-w-4 rounded-full bg-primary text-primary-foreground">
                      !
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none">Filtros de Clientes</h4>
                  <p className="text-sm text-muted-foreground">Refine sua lista de carteira.</p>
                </div>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(0); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos os status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os status</SelectItem>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="inactive">Inativo</SelectItem>
                        <SelectItem value="prospect">Prospect</SelectItem>
                        <SelectItem value="blocked">Bloqueado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      setStatusFilter('all');
                      setPage(0);
                    }}
                  >
                    Limpar Filtros
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="outline" className="hidden md:flex">Exportar</Button>
          </div>
        </div>

        {viewMode === 'map' ? (
          <div className="flex-1 min-h-[500px] border rounded-lg bg-card overflow-hidden relative">
            {isLoadingMap ? (
               <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                 <Loader2 className="h-8 w-8 animate-spin text-primary" />
                 <p className="text-sm text-muted-foreground">Carregando mapa de densidade...</p>
               </div>
            ) : (
              <GoogleMap
                apiKey={GOOGLE_MAPS_API_KEY}
                markers={cityClusters}
              />
            )}

            <div className="absolute bottom-6 right-6 z-10 bg-background/90 backdrop-blur p-4 rounded-lg shadow-lg border max-w-sm hidden md:block">
              <h3 className="text-sm font-bold mb-2 flex items-center gap-2"><MapIcon size={16}/> Distribuição Geográfica</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Os círculos no mapa representam a quantidade de clientes concentrados em cada município.
              </p>
              <div className="flex items-center justify-between text-xs font-medium">
                <span>Total mapeado:</span>
                <Badge variant="secondary">{mapClientsData.length} clientes</Badge>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border bg-card shadow-xs flex flex-col flex-1 overflow-hidden">
            {/* Tabela Desktop */}
            <div className="hidden md:block overflow-x-auto flex-1">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/40 z-10">
                  <TableRow className="hover:bg-muted/40 border-b">
                    <TableHead className="min-w-[220px] text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cliente / Razão Social</TableHead>
                    <TableHead className="hidden md:table-cell text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cidade/UF</TableHead>
                    <TableHead className="hidden lg:table-cell text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Segmento</TableHead>
                    <TableHead className="hidden md:table-cell text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Representante</TableHead>
                    <TableHead className="hidden lg:table-cell text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Última Compra</TableHead>
                    <TableHead className="hidden lg:table-cell text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Última Visita</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                    <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y">
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : clients.length > 0 ? (
                    clients.map((client) => (
                      <TableRow key={client.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <Link to="/clientes/$id" params={{ id: client.id }}>
                            <div className="flex flex-col cursor-pointer">
                              <span className="font-semibold text-sm text-foreground hover:text-primary transition-colors">
                                {formatClientDisplayName(client)}
                              </span>
                              <span className="font-mono text-xs text-muted-foreground">{client.cnpj}</span>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm font-medium text-foreground">
                          {client.city}/{client.state}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-slate-600">
                          {client.segment || '-'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-slate-700 font-medium">
                          {client.representatives?.name ? (
                            <RepresentativeBadge
                              name={client.representatives.name}
                              photoUrl={client.representatives.photo_url}
                              size="xs"
                            />
                          ) : client.representative_id ? (
                            <span className="text-slate-700">Representante Vinculado</span>
                          ) : (
                            <span className="text-slate-400 font-normal">Direto</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-center text-sm text-slate-400 font-mono">
                          -
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-center text-sm text-slate-400 font-mono">
                          -
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-semibold text-slate-700">
                            {client.status === 'active' ? 'Ativo' : client.status === 'prospect' ? 'Prospect' : 'Inativo'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuItem asChild>
                                <Link to="/clientes/$id" params={{ id: client.id }}>
                                  <Eye className="mr-2 h-4 w-4 text-primary" /> Visualizar
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditingClient(client)}>
                                <Edit className="mr-2 h-4 w-4 text-primary" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link to="/clientes/$id" params={{ id: client.id }}>
                                  <History className="mr-2 h-4 w-4 text-primary" /> Histórico
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <Link to="/campo/visitas/novo" search={{ clientId: client.id }}>
                                  <Calendar className="mr-2 h-4 w-4 text-primary" /> Agendar Visita
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link to="/clientes/$id" params={{ id: client.id }}>
                                  <FileText className="mr-2 h-4 w-4 text-primary" /> Follow-up
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link to="/comercial/pedidos/novo" search={{ client_id: client.id, opportunity_id: "" }}>
                                  <ShoppingBag className="mr-2 h-4 w-4 text-primary" /> Novo Pedido
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                        Nenhum cliente encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Cards Verticais Mobile */}
            <div className="md:hidden divide-y divide-slate-100">
              {isLoading ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                </div>
              ) : clients.length > 0 ? (
                clients.map((client) => {
                  return (
                    <div key={client.id} className="p-3.5 bg-white hover:bg-slate-50/50 transition-colors flex flex-col gap-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                              {client.status === 'active' ? 'Ativo' : client.status === 'prospect' ? 'Prospect' : 'Inativo'}
                            </span>
                            {client.city && (
                              <span className="text-xs font-medium text-slate-500 truncate">
                                {client.city}/{client.state}
                              </span>
                            )}
                          </div>
                          <Link to="/clientes/$id" params={{ id: client.id }}>
                            <h4 className="font-bold text-sm text-slate-900 leading-snug hover:text-primary transition-colors line-clamp-1">
                              {formatClientDisplayName(client)}
                            </h4>
                          </Link>
                          <span className="font-mono text-[11px] text-slate-400 block mt-0.5">
                            {client.cnpj}
                          </span>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 shrink-0 -mr-1">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem asChild>
                              <Link to="/clientes/$id" params={{ id: client.id }}>
                                <Eye className="mr-2 h-4 w-4 text-primary" /> Visualizar Perfil
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditingClient(client)}>
                              <Edit className="mr-2 h-4 w-4 text-primary" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to="/campo/visitas/novo" search={{ clientId: client.id }}>
                                <Calendar className="mr-2 h-4 w-4 text-primary" /> Agendar Visita
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to="/comercial/pedidos/novo" search={{ client_id: client.id, opportunity_id: "" }}>
                                <ShoppingBag className="mr-2 h-4 w-4 text-primary" /> Novo Pedido
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                        <FieldQuickActions
                          phone={client.phone}
                          whatsapp={client.whatsapp}
                          location={{
                            address: client.address,
                            address_number: client.address_number,
                            neighborhood: client.neighborhood,
                            city: client.city,
                            state: client.state,
                            latitude: client.latitude,
                            longitude: client.longitude,
                          }}
                          clientName={formatClientDisplayName(client)}
                          variant="buttons"
                        />

                        <Button variant="outline" size="sm" className="h-7.5 px-2.5 text-xs font-semibold shrink-0 ml-auto" asChild>
                          <Link to="/clientes/$id" params={{ id: client.id }}>
                            Ver Perfil
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Nenhum cliente encontrado.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-4 py-4 border-t bg-muted/20 shrink-0">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Mostrando <strong>{clients.length}</strong> de <strong>{totalCount}</strong> clientes cadastrados</span>
                <div className="flex items-center gap-1.5 hidden sm:flex">
                  <span>Exibir:</span>
                  <select
                    className="bg-background border rounded px-1.5 py-0.5 text-xs text-foreground cursor-pointer"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(0);
                    }}
                  >
                    <option value={10}>10 por página</option>
                    <option value={25}>25 por página</option>
                    <option value={50}>50 por página</option>
                    <option value={100}>Ver todos (77)</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-xs font-medium">
                  Página {page + 1} de {totalPages || 1}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal / Bottom Sheet Responsivo de Edição de Cliente */}
        <ResponsiveModal
          open={!!editingClient}
          onOpenChange={(open) => !open && setEditingClient(null)}
          title="Editar Cliente"
          description="Atualize os dados cadastrais e de contato do cliente."
          maxContentClass="max-w-3xl"
        >
          {editingClient && (
            <ClientForm
              clientId={editingClient.id}
              initialData={editingClient}
              onSuccess={() => {
                setEditingClient(null);
                refetch();
              }}
            />
          )}
        </ResponsiveModal>
      </div>
    </AppLayout>
  );
}

