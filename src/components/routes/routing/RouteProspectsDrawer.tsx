import { useState } from 'react';
import { RouteProspect, PROSPECT_CATEGORIES, searchProspectsAlongRoute } from '@/lib/prospects.services';
import { RouteCoordinate } from '@/lib/routing.services';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Building2,
  Plus,
  Compass,
  MapPin,
  Star,
  Loader2,
  Filter,
  Check,
  ChevronDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from 'sonner';
import { Client } from '@/types/database.types';

interface RouteProspectsProps {
  routeGeometry: RouteCoordinate[];
  onAddProspectToRoute: (client: Client) => void;
  onProspectsFound?: (prospects: RouteProspect[]) => void;
}

export function RouteProspectsPanel({
  routeGeometry,
  onAddProspectToRoute,
  onProspectsFound,
}: RouteProspectsProps) {
  const [selectedCategory, setSelectedCategory] = useState(PROSPECT_CATEGORIES[0]);
  const [maxDistanceKm, setMaxDistanceKm] = useState(25);
  const [prospects, setProspects] = useState<RouteProspect[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const handleSearch = async (cat = selectedCategory, maxDist = maxDistanceKm) => {
    if (!routeGeometry || routeGeometry.length === 0) {
      toast.error('Selecione ao menos 2 paradas para buscar oportunidades no trajeto.');
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchProspectsAlongRoute(routeGeometry, cat.id, cat.label, maxDist);
      setProspects(results);
      if (onProspectsFound) onProspectsFound(results);

      if (results.length > 0) {
        toast.success(`${results.length} oportunidades encontradas no segmento "${cat.label}"!`);
      } else {
        toast.info(`Nenhuma oportunidade encontrada no segmento "${cat.label}".`);
      }
    } catch (err: any) {
      toast.error('Erro ao buscar estabelecimentos: ' + (err.message || 'Verifique a conexão'));
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddStop = (prospect: RouteProspect) => {
    const newClient: Client = {
      id: prospect.id,
      name: prospect.name,
      trade_name: prospect.tradeName || prospect.name,
      address: prospect.address,
      city: prospect.city || '',
      state: prospect.state || '',
      latitude: prospect.position.lat,
      longitude: prospect.position.lng,
      status: 'prospect',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any;

    onAddProspectToRoute(newClient);
    setAddedIds(prev => new Set(prev).add(prospect.id));
    toast.success(`${prospect.name} adicionado como parada na rota!`);
  };

  if (!routeGeometry || routeGeometry.length === 0) {
    return null;
  }

  return (
    <Card className="border shadow-md bg-card/95 backdrop-blur">
      <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-secondary/15 flex items-center justify-center text-secondary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              Oportunidades no Caminho
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                Prospecção
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Empresas do segmento ao longo da rota traçada
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <Filter className="h-3 w-3" />
                {selectedCategory.label.split('&')[0]}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {PROSPECT_CATEGORIES.map((cat) => (
                <DropdownMenuItem
                  key={cat.id}
                  className="text-xs cursor-pointer"
                  onClick={() => {
                    setSelectedCategory(cat);
                    handleSearch(cat, maxDistanceKm);
                  }}
                >
                  {cat.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="sm"
            className="h-8 text-xs bg-secondary hover:bg-secondary/90 text-secondary-foreground font-medium gap-1.5"
            disabled={isSearching}
            onClick={() => handleSearch()}
          >
            {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Compass className="h-3.5 w-3.5" />}
            {isSearching ? 'Buscando...' : 'Escanear Rota'}
          </Button>
        </div>
      </CardHeader>

      {prospects.length > 0 && (
        <CardContent className="p-4 pt-0">
          <ScrollArea className="h-56 pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {prospects.map((prospect) => {
                const isAdded = addedIds.has(prospect.id);
                return (
                  <div
                    key={prospect.id}
                    className="p-2.5 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors flex flex-col justify-between gap-2"
                  >
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-semibold text-xs text-foreground line-clamp-1">
                          {prospect.name}
                        </span>
                        <Badge variant="outline" className="text-[10px] shrink-0 text-amber-600 border-amber-500/30">
                          {prospect.detourFormatted}
                        </Badge>
                      </div>

                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 line-clamp-1">
                        <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                        {prospect.address || 'Endereço na rodovia'}
                      </p>

                      {prospect.rating && (
                        <div className="flex items-center gap-1 text-[11px] text-amber-500 font-medium">
                          <Star className="h-3 w-3 fill-amber-500" />
                          <span>{prospect.rating}</span>
                          {prospect.userRatingsTotal && (
                            <span className="text-[10px] text-muted-foreground">({prospect.userRatingsTotal})</span>
                          )}
                        </div>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant={isAdded ? "secondary" : "default"}
                      className="w-full h-7 text-xs gap-1"
                      disabled={isAdded}
                      onClick={() => handleAddStop(prospect)}
                    >
                      {isAdded ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      {isAdded ? 'Na Rota' : 'Encaixar na Rota'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}
