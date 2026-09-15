import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Play,
  Map as MapIcon,
  List,
  Navigation,
  Maximize2,
  Minimize2,
  ChevronRight,
  Info,
  Save,
  Loader2
} from 'lucide-react';
import { GoogleMap } from '@/components/campo/GoogleMap';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { AddClientsModal } from '@/components/routes/routing/AddClientsModal';
import { RouteStopItem } from '@/components/routes/routing/RouteStopItem';
import { Client } from '@/types/database.types';
import { toast } from 'sonner';
import { ScrollArea } from "@/components/ui/scroll-area";
import { calculateRoadRoute, RouteCoordinate } from '@/lib/routing.services';
import { RouteProspectsPanel } from '@/components/routes/routing/RouteProspectsDrawer';
import { RouteProspect } from '@/lib/prospects.services';

// GOOGLE_MAPS_API_KEY will be sourced dynamically from settings

export const Route = createFileRoute('/campo/roteirizacao')({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Planejamento de Rotas" },
      { name: "description", content: "Planeje suas visitas comerciais com roteirização inteligente e otimização de deslocamento." },
    ],
  }),
  component: RoteirizacaoPage,
});

function RoteirizacaoPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<'split' | 'map' | 'list'>('split');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedClients, setSelectedClients] = useState<Client[]>([]);
  const [routeInfo, setRouteInfo] = useState<{distance: string, duration: string} | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<RouteCoordinate[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [prospects, setProspects] = useState<RouteProspect[]>([]);

  const { data: settings } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/company_settings?select=google_maps_api_key&order=updated_at.desc&limit=1`, {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          }
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data?.[0] || null;
      } catch (e) {
        return null;
      }
    }
  });

  const GOOGLE_MAPS_API_KEY = (settings as any)?.google_maps_api_key || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyDRCuHwgeKPzmrCQJYU5UsHgoNdqYx3jhA";

  const handleAddClients = (clients: Client[]) => {
    setSelectedClients(prev => {
      const existingIds = new Set(prev.map(c => c.id));
      const newClients = clients.filter(c => !existingIds.has(c.id));
      return [...prev, ...newClients];
    });
    toast.success(`${clients.length} ${clients.length === 1 ? 'cliente adicionado' : 'clientes adicionados'} à rota.`);
  };

  const removeClient = (id: string) => {
    setSelectedClients(prev => prev.filter(c => c.id !== id));
    setRouteGeometry([]);
    setRouteInfo(null);
  };

  // Cálculo de rota rodoviária real (curvas, rodovias BR e tempo de direção)
  const calculateRouteMetrics = async (clientsList = selectedClients) => {
    if (clientsList.length < 2) {
      setRouteInfo(null);
      setRouteGeometry([]);
      return;
    }

    setIsCalculating(true);
    const stops: RouteCoordinate[] = clientsList
      .filter(c => c.latitude != null && c.longitude != null)
      .map(c => ({ lat: Number(c.latitude), lng: Number(c.longitude) }));

    const result = await calculateRoadRoute(stops);
    setIsCalculating(false);

    if (result) {
      setRouteInfo({
        distance: result.distanceFormatted,
        duration: result.durationFormatted
      });
      setRouteGeometry(result.geometry);
      toast.success(`Rota rodoviária calculada: ${result.distanceFormatted} (${result.durationFormatted})`);
    } else {
      toast.error("Não foi possível traçar o trajeto rodoviário.");
    }
  };

  const optimizeSequence = async () => {
    if (selectedClients.length <= 2) return;

    // Algoritmo Nearest Neighbor para ordenar sequência de visitas a partir do 1º cliente
    const remaining = [...selectedClients.slice(1)];
    const optimized = [selectedClients[0]];

    while (remaining.length > 0) {
      const current = optimized[optimized.length - 1];
      let nearestIdx = 0;
      let minDist = Infinity;

      remaining.forEach((candidate, idx) => {
        const dist = Math.hypot(
          (candidate.latitude || 0) - (current.latitude || 0),
          (candidate.longitude || 0) - (current.longitude || 0)
        );
        if (dist < minDist) {
          minDist = dist;
          nearestIdx = idx;
        }
      });

      optimized.push(remaining.splice(nearestIdx, 1)[0]);
    }

    setSelectedClients(optimized);
    await calculateRouteMetrics(optimized);
    toast.success("Sequência de visitas otimizada e trajeto recalculado!");
  };

  const markers = useMemo(() => {
    const clientMarkers = selectedClients.map((client, index) => ({
      id: client.id,
      position: { lat: client.latitude!, lng: client.longitude! },
      title: client.name,
      label: (index + 1).toString(),
      isProspect: false
    }));

    const prospectMarkers = prospects
      .filter(p => !selectedClients.some(c => c.id === p.id))
      .map(p => ({
        id: p.id,
        position: p.position,
        title: `[Prospect] ${p.name} (${p.detourFormatted})`,
        label: {
          text: '★',
          color: '#ffffff',
          fontSize: '11px',
          fontWeight: 'bold'
        },
        isProspect: true,
        category: p.category
      }));

    return [...clientMarkers, ...prospectMarkers];
  }, [selectedClients, prospects]);

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
        {/* Header de Ações */}
        <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 border-b bg-card shrink-0 gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Roteirização de Visitas</h1>
            <p className="text-sm text-muted-foreground">Planeje sua sequência de visitas e otimize seu tempo.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setIsAddModalOpen(true)}>
              <Plus size={16} /> Adicionar Clientes
            </Button>
            <Button
              size="sm"
              variant="default"
              className="bg-green-600 hover:bg-green-700 gap-2"
              disabled={selectedClients.length < 2 || isCalculating}
              onClick={() => calculateRouteMetrics(selectedClients)}
            >
              {isCalculating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {isCalculating ? "Calculando Rodovias..." : "Calcular Rota"}
            </Button>
            {selectedClients.length > 0 && (
              <Button size="sm" variant="secondary" className="gap-2">
                <Save size={16} /> Salvar
              </Button>
            )}
          </div>
        </div>

        {/* Layout Principal */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative">

          {/* Controles de Visualização Mobile (movido para fora para não sumir) */}
          <div className="absolute top-4 left-4 z-20 md:hidden">
            <Tabs value={view === 'split' ? 'list' : view} onValueChange={(v: any) => setView(v)}>
              <TabsList className="bg-background/90 backdrop-blur shadow-lg border">
                <TabsTrigger value="list" className="text-xs">Lista</TabsTrigger>
                <TabsTrigger value="map" className="text-xs">Mapa</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Lado Esquerdo: Lista de Paradas */}
          <div className={cn(
            "w-full md:w-80 lg:w-96 border-r bg-card flex flex-col transition-all duration-300",
            (view === 'map' || (view === 'split' && typeof window !== 'undefined' && window.innerWidth < 768))
              ? "hidden md:flex md:w-0 md:opacity-0 md:overflow-hidden"
              : "flex",
            view === 'split' ? "md:flex" : ""
          )}>
            <div className="p-4 border-b bg-muted/30">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Sequência da Rota</span>
                <span className="text-xs font-medium px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                  {selectedClients.length} paradas
                </span>
              </div>
              
              {/* Card de Resumo Rápido */}
              <Card className="bg-primary/5 border-primary/20 shadow-none">
                <CardContent className="p-3 grid grid-cols-2 gap-2">
                  <div className="text-center border-r border-primary/10">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Distância Total</p>
                    <p className="text-sm font-bold">{routeInfo?.distance || "-- km"}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Tempo Total</p>
                    <p className="text-sm font-bold">{routeInfo?.duration || "-- min"}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4">
                {selectedClients.length === 0 ? (
                  <div className="h-[300px] flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <List className="text-muted-foreground" size={24} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Nenhum cliente selecionado</p>
                      <p className="text-xs text-muted-foreground">
                        Clique em "+ Adicionar Clientes" para começar seu planejamento.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedClients.map((client, index) => (
                      <RouteStopItem
                        key={client.id}
                        index={index}
                        label={client.name}
                        address={`${client.address || ''}, ${client.city || ''}`}
                        phone={client.phone}
                        whatsapp={client.whatsapp}
                        isFirst={index === 0}
                        isLast={index === selectedClients.length - 1}
                        onRemove={() => removeClient(client.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
            
            <div className="p-4 border-t bg-muted/10 space-y-2">
              <Button
                variant="outline"
                className="w-full justify-between group h-10"
                disabled={selectedClients.length < 2}
                onClick={optimizeSequence}
              >
                <span className="flex items-center gap-2">
                  <Navigation size={14} className="text-blue-500" />
                  Otimizar Sequência
                </span>
                <ChevronRight size={14} className="opacity-50 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>

          {/* Lado Direito: Mapa */}
          <div className={cn(
            "flex-1 relative bg-muted flex-col",
            (view === 'list' || (view === 'split' && typeof window !== 'undefined' && window.innerWidth < 768))
              ? "hidden md:flex"
              : "flex",
            view === 'split' ? "md:flex" : ""
          )}>

            {/* Toggle Expandir Mapa (Desktop) */}
            <div className="absolute top-4 right-4 z-10 hidden md:block">
              <Button 
                variant="secondary" 
                size="icon" 
                className="bg-background/80 backdrop-blur shadow-lg border hover:bg-background"
                onClick={() => setView(view === 'split' ? 'map' : 'split')}
              >
                {view === 'map' ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </Button>
            </div>

            <div className="w-full h-full min-h-[400px]">
               <GoogleMap
                  apiKey={GOOGLE_MAPS_API_KEY}
                  markers={markers}
                  routeGeometry={routeGeometry}
                  showPolyline={selectedClients.length > 1}
                />
            </div>

            {/* Painel de Prospecção Flutuante sobre o Mapa */}
            {selectedClients.length >= 2 && (
              <div className="absolute bottom-4 left-4 right-4 z-10 max-w-3xl mx-auto">
                <RouteProspectsPanel
                  routeGeometry={
                    routeGeometry.length > 0
                      ? routeGeometry
                      : selectedClients
                          .filter(c => c.latitude != null && c.longitude != null)
                          .map(c => ({ lat: Number(c.latitude), lng: Number(c.longitude) }))
                  }
                  onAddProspectToRoute={async (newStop) => {
                    const updated = [...selectedClients, newStop];
                    setSelectedClients(updated);
                    toast.success(`Prospect ${newStop.name} adicionado à rota!`);
                    await calculateRouteMetrics(updated);
                  }}
                  onProspectsFound={(found) => setProspects(found)}
                />
              </div>
            )}

            {!GOOGLE_MAPS_API_KEY && (
               <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px] z-20 p-6 text-center">
                  <Card className="max-w-sm shadow-2xl border-2">
                    <CardHeader className="space-y-1">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                        <Info className="text-primary" size={24} />
                      </div>
                      <CardTitle className="text-lg">Configuração Necessária</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Para calcular rotas reais e visualizar o trânsito, é necessária a chave de API do Google Maps.
                      </p>
                    </CardContent>
                  </Card>
                </div>
            )}
          </div>
        </div>

        <AddClientsModal 
          open={isAddModalOpen} 
          onOpenChange={setIsAddModalOpen}
          onAdd={handleAddClients}
          selectedIds={selectedClients.map(c => c.id)}
        />
      </div>
    </AppLayout>
  );
}
