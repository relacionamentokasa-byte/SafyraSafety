import { useState, Fragment } from 'react';
import * as React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Search,
  MapPin,
  Users,
  MoreVertical,
  Edit,
  Trash2,
  Loader2,
  Building2,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  DollarSign
} from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';
import { getDetailedRegionalAnalytics } from '@/lib/regions.services';
import { BrazilRegionsMap } from '@/components/regioes/BrazilRegionsMap';

export const Route = createFileRoute('/regioes/')({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Regiões e Territórios" },
      { name: "description", content: "Distribuição geográfica, faturamento por estado/cidade e monitoramento de carteira." },
    ],
  }),
  component: RegionsPage,
});

function RegionsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUf, setSelectedUf] = useState<string | null>(null);
  const [expandedRegions, setExpandedRegions] = useState<Record<string, boolean>>({});

  const { data: regionalData, isLoading } = useQuery({
    queryKey: ['regional-analytics-detailed'],
    queryFn: () => getDetailedRegionalAnalytics(),
    staleTime: 1000 * 60 * 3,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('regions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regional-analytics-detailed'] });
      toast.success('Região excluída com sucesso');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir região: ' + error.message);
    }
  });

  const toggleRegionExpand = (id: string) => {
    setExpandedRegions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const regions = regionalData?.regions || [];
  const statesMetrics = regionalData?.statesMetrics || {};
  const totalRevenue = regionalData?.totalNationalRevenue || 0;
  const totalClients = regionalData?.totalNationalClients || 0;
  const totalCitiesCovered = Object.values(statesMetrics).reduce((sum, s) => sum + s.citiesCount, 0);

  const filteredRegions = regions.filter(region =>
    region.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    region.state.toLowerCase().includes(searchTerm.toLowerCase()) ||
    region.cities.some(city => city.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 w-full mx-auto">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Regiões e Territórios</h1>
            <p className="text-muted-foreground text-sm">
              Visão geográfica da carteira comercial, faturamento por estado/cidade e clientes prioritários.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button className="w-full md:w-auto gap-2 shadow-xs" asChild>
              <Link to="/configuracoes/regioes">
                <Plus className="h-4 w-4" /> Nova Região
              </Link>
            </Button>
          </div>
        </div>

        {/* KPIs Gerais de Cobertura (Hero Mobile + Grid 2x2) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {/* Faturamento Total (Hero em tela cheia no mobile para não cortar o valor longo) */}
          <div className="col-span-2 lg:col-span-1 p-4 md:p-5 rounded-xl border bg-card flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] md:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Faturamento Total
              </span>
              <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
                <MapPin className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 md:mt-3">
              <div className="text-xl md:text-2xl font-bold font-mono text-foreground tracking-tight">
                R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] md:text-xs text-muted-foreground mt-0.5 block">
                Volume acumulado da carteira
              </span>
            </div>
          </div>

          {/* Municípios Atendidos */}
          <div className="col-span-1 p-3.5 md:p-5 rounded-xl border bg-card flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                Municípios
              </span>
              <div className="p-1 rounded-md bg-slate-100 text-slate-700">
                <Building2 className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 md:mt-3">
              <div className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
                {totalCitiesCovered}
              </div>
              <span className="text-[10px] md:text-xs text-muted-foreground mt-0.5 block truncate">
                Cidades atendidas
              </span>
            </div>
          </div>

          {/* Total de Clientes */}
          <div className="col-span-1 p-3.5 md:p-5 rounded-xl border bg-card flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                Clientes
              </span>
              <div className="p-1 rounded-md bg-slate-100 text-slate-700">
                <Users className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 md:mt-3">
              <div className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
                {totalClients}
              </div>
              <span className="text-[10px] md:text-xs text-muted-foreground mt-0.5 block truncate">
                Base cadastrada
              </span>
            </div>
          </div>

          {/* Comissão Projetada */}
          <div className="col-span-2 sm:col-span-1 p-3.5 md:p-5 rounded-xl border bg-card flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                Comissão Projetada
              </span>
              <div className="p-1 rounded-md bg-emerald-50 text-emerald-700">
                <DollarSign className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 md:mt-3">
              <div className="text-xl md:text-2xl font-bold font-mono text-emerald-700 tracking-tight">
                R$ {(totalRevenue * 0.04).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] md:text-xs text-muted-foreground mt-0.5 block truncate">
                Estimativa média de 4%
              </span>
            </div>
          </div>
        </div>

        {/* MAPA DO BRASIL INTERATIVO COM DRILLDOWN DE FATURAMENTO E CIDADES */}
        <BrazilRegionsMap
          statesMetrics={statesMetrics}
          selectedUf={selectedUf}
          onSelectUf={setSelectedUf}
        />

        {/* DETALHAMENTO DAS MACRORREGIÕES COM CIDADES & CLIENTES */}
        <Card className="shadow-xs border-slate-200">
          <CardHeader className="py-3 px-4 sm:px-5 border-b bg-slate-50/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2 text-slate-900">
                  <MapPin className="h-4 w-4 text-primary" /> Polos Comerciais & Detalhamento
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Resumo das macrorregiões com cidades e clientes atendidos.
                </CardDescription>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Filtrar região, UF ou cidade..."
                  className="pl-8 h-8 text-xs bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 flex justify-center items-center gap-2 text-slate-500 text-xs">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span>Carregando dados territoriais...</span>
              </div>
            ) : (
              <>
                {/* Visualização em Cards Compactos para Mobile */}
                <div className="md:hidden divide-y divide-slate-100">
                  {filteredRegions.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      Nenhuma região encontrada com os filtros aplicados.
                    </div>
                  ) : (
                    filteredRegions.map((region) => {
                      const isExpanded = !!expandedRegions[region.id];
                      const sharePercent = totalRevenue > 0 ? ((region.totalRevenue / totalRevenue) * 100).toFixed(1) : '0.0';

                      return (
                        <div key={region.id} className="p-3 space-y-2 bg-white hover:bg-slate-50/50 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                {region.statesCovered.map((st) => (
                                  <Badge key={st} variant="outline" className="font-bold text-[9px] px-1 py-0 bg-slate-50 h-4">
                                    {st}
                                  </Badge>
                                ))}
                                <span className="text-[10px] font-semibold text-slate-500">
                                  {region.citiesMetrics.length} cidades
                                </span>
                              </div>
                              <h4 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight truncate">
                                {region.name}
                              </h4>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                                <span>{region.totalClients} clientes ({region.activeClients} ativos)</span>
                                {region.warningClients.length > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="text-amber-600 font-medium">{region.warningClients.length} inativos</span>
                                  </>
                                )}
                              </div>
                            </div>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 shrink-0">
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link to="/configuracoes/regioes" search={{ id: region.id }}>
                                    <Edit className="mr-2 h-4 w-4" /> Editar Região
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    if (confirm('Tem certeza que deseja excluir esta região?')) {
                                      deleteMutation.mutate(region.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 gap-2">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-xs font-extrabold font-mono text-primary">
                                R$ {region.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({sharePercent}%)
                              </span>
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[11px] font-semibold gap-1 text-slate-600 hover:text-slate-900 shrink-0"
                              onClick={() => toggleRegionExpand(region.id)}
                            >
                              {isExpanded ? (
                                <>Ocultar <ChevronDown className="h-3 w-3" /></>
                              ) : (
                                <>Ver Cidades ({region.citiesMetrics.length}) <ChevronRight className="h-3 w-3" /></>
                              )}
                            </Button>
                          </div>

                          {/* Detalhamento de Cidades e Top Clientes no Mobile */}
                          {isExpanded && (
                            <div className="pt-2.5 border-t border-slate-100 space-y-2.5 bg-slate-50/60 -mx-3 -mb-3 p-3 rounded-b-lg">
                              <div className="space-y-1.5">
                                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                                  Municípios Atendidos:
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  {region.citiesMetrics.map((city, cIdx) => (
                                    <div key={cIdx} className="p-2 rounded-md bg-white border border-slate-200 shadow-2xs text-[11px] space-y-0.5">
                                      <div className="flex justify-between items-start">
                                        <span className="font-semibold text-slate-800 truncate">{city.name}</span>
                                        <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-1">
                                          {city.totalClients} cli.
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-baseline">
                                        <span className="text-[9px] text-slate-400">Total:</span>
                                        <span className="font-bold font-mono text-primary text-[11px]">
                                          R$ {city.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                      {city.topClient && (
                                        <p className="text-[9px] text-slate-500 truncate pt-0.5 border-t border-slate-100">
                                          Líder: <strong className="text-slate-700">{city.topClient.name}</strong>
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Top Clientes da Região */}
                              {region.topClients.length > 0 && (
                                <div className="p-2 bg-white rounded-md border border-slate-200 text-xs space-y-1">
                                  <span className="font-bold text-slate-800 block text-[10px]">
                                    Top Clientes:
                                  </span>
                                  {region.topClients.slice(0, 3).map((cl, cIdx) => (
                                    <div key={cl.id} className="flex justify-between items-center py-0.5 border-b border-slate-100 last:border-0 text-[10px]">
                                      <span className="truncate pr-2 text-slate-700">{cIdx + 1}º {cl.name}</span>
                                      <span className="font-mono font-bold text-primary shrink-0">
                                        R$ {cl.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Tabela Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <Table className="min-w-[700px]">
                  <TableHeader className="bg-slate-50/75">
                    <TableRow>
                      <TableHead className="w-12 text-center font-bold">#</TableHead>
                      <TableHead className="font-bold">Macrorregião / Território</TableHead>
                      <TableHead className="w-24 text-center font-bold">UF(s)</TableHead>
                      <TableHead className="w-24 text-center font-bold">Cidades</TableHead>
                      <TableHead className="w-32 text-center font-bold">Clientes</TableHead>
                      <TableHead className="w-36 text-right font-bold">Faturamento Total</TableHead>
                      <TableHead className="w-24 text-right font-bold">% Share</TableHead>
                      <TableHead className="w-16 text-right font-bold">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-xs">
                          Nenhuma região encontrada com os filtros aplicados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRegions.map((region, idx) => {
                        const isExpanded = !!expandedRegions[region.id];
                        const sharePercent = totalRevenue > 0 ? ((region.totalRevenue / totalRevenue) * 100).toFixed(1) : '0.0';

                        return (
                          <Fragment key={region.id}>
                            <TableRow className="hover:bg-slate-50/70 transition-colors">
                              <TableCell className="text-center font-bold text-xs">
                                <button
                                  type="button"
                                  onClick={() => toggleRegionExpand(region.id)}
                                  className="p-1 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-100 transition-colors"
                                  title="Ver cidades e clientes da região"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-primary" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </button>
                              </TableCell>
                              <TableCell className="font-medium text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800">{region.name}</span>
                                  {region.warningClients.length > 0 && (
                                    <span className="text-[10px] text-slate-500 font-medium">
                                      ({region.warningClients.length} inativos)
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex justify-center gap-1">
                                  {region.statesCovered.map(st => (
                                    <Badge key={st} variant="outline" className="font-bold text-[10px] px-1.5">
                                      {st}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-center text-xs font-semibold text-slate-700">
                                {region.citiesMetrics.length} cidades
                              </TableCell>
                              <TableCell className="text-center font-mono text-xs text-slate-700">
                                <span className="font-bold text-slate-900">{region.totalClients}</span>
                                <span className="text-slate-400 text-[11px] ml-1">({region.activeClients} ativos)</span>
                              </TableCell>
                              <TableCell className="text-right text-xs font-bold text-primary font-mono whitespace-nowrap">
                                R$ {region.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right text-xs font-bold text-slate-700">
                                {sharePercent}%
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                      <MoreVertical className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                      <Link to="/configuracoes/regioes" search={{ id: region.id }}>
                                        <Edit className="mr-2 h-4 w-4" /> Editar
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => {
                                        if (confirm('Tem certeza que deseja excluir esta região?')) {
                                          deleteMutation.mutate(region.id);
                                        }
                                      }}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>

                            {/* LINHAS DE DETALHAMENTO: CIDADES E CLIENTES DA MACRORREGIÃO */}
                            {isExpanded && (
                              <TableRow className="bg-slate-50/80 border-l-2 border-l-primary">
                                <TableCell colSpan={8} className="p-4 space-y-4">
                                  {/* Cidades e seus Faturamentos */}
                                  <div className="space-y-2">
                                    <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                      <Building2 className="h-3.5 w-3.5 text-primary" /> Faturamento por Município em {region.name}:
                                    </h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                      {region.citiesMetrics.map((city, cIdx) => (
                                        <div key={cIdx} className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-1 text-xs">
                                          <div className="flex justify-between items-start">
                                            <span className="font-bold text-slate-800">{city.name}</span>
                                            <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-slate-100 text-slate-600">
                                              {city.totalClients} {city.totalClients === 1 ? 'cliente' : 'clientes'}
                                            </Badge>
                                          </div>
                                          <div className="flex justify-between items-baseline pt-1">
                                            <span className="text-[11px] text-muted-foreground">Faturamento:</span>
                                            <span className="font-bold font-mono text-primary text-xs">
                                              R$ {city.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                          </div>
                                          {city.topClient && (
                                            <p className="text-[10px] text-slate-500 truncate pt-0.5 border-t border-slate-100">
                                              Líder: <strong className="text-slate-700">{city.topClient.name}</strong>
                                            </p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Top Clientes e Alertas da Região */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                    {/* Top Clientes */}
                                    <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-2">
                                      <h6 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <TrendingUp className="h-3.5 w-3.5 text-amber-500" /> Principais Clientes da Região:
                                      </h6>
                                      <div className="space-y-1.5 text-xs">
                                        {region.topClients.map((cl, cIdx) => (
                                          <div key={cl.id} className="flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
                                            <div className="min-w-0 pr-2">
                                              <p className="font-semibold text-slate-800 truncate">{cIdx + 1}º {cl.name}</p>
                                              <p className="text-[10px] text-muted-foreground">{cl.city}/{cl.state}</p>
                                            </div>
                                            <span className="font-bold font-mono text-primary whitespace-nowrap text-xs">
                                              R$ {cl.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Clientes sem compra recente */}
                                    <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-2">
                                      <h6 className="text-xs font-bold text-slate-800 flex items-center justify-between">
                                        <span>Clientes sem compra (+60 dias):</span>
                                        <span className="text-[10px] text-slate-500 font-mono font-normal">
                                          {region.warningClients.length} identificados
                                        </span>
                                      </h6>
                                      {region.warningClients.length === 0 ? (
                                        <p className="text-xs text-slate-500 italic py-2">Nenhum cliente sem compra recente nesta região.</p>
                                      ) : (
                                        <div className="space-y-1.5 text-xs">
                                          {region.warningClients.map((cl) => (
                                            <div key={cl.id} className="flex justify-between items-center py-1.5 border-b border-slate-100 last:border-0">
                                              <div className="min-w-0 pr-2">
                                                <p className="font-medium text-slate-900 truncate">{cl.name}</p>
                                                <p className="text-[10px] text-slate-500">{cl.city}/{cl.state}</p>
                                              </div>
                                              <div className="text-right">
                                                <span className="font-mono text-slate-800 text-xs block">
                                                  R$ {cl.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                                <span className="text-[10px] font-mono text-slate-500">
                                                  {cl.daysSinceLastOrder ? `${cl.daysSinceLastOrder}d sem compra` : 'Sem histórico'}
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
