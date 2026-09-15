import React from 'react';
import { StateMapMetric } from '@/lib/regions.services';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { MapPin, TrendingUp, Building2, AlertTriangle } from 'lucide-react';
import brazilStatesData from './brazilStatesData.json';
import { StateFlag } from './StateFlag';
import { formatDisplayName, formatClientDisplayName } from '@/lib/format-name';

interface BrazilRegionsMapProps {
  statesMetrics: Record<string, StateMapMetric>;
  selectedUf: string | null;
  onSelectUf: (uf: string | null) => void;
  className?: string;
}

interface StateGeoInfo {
  name: string;
  d: string;
  center: [number, number];
}

const typedBrazilStatesData = brazilStatesData as Record<string, StateGeoInfo>;

// Ajustes finos manuais nas siglas para ficarem perfeitamente legíveis no centro visual de estados menores
const UF_LABEL_OFFSETS: Record<string, [number, number]> = {
  PA: [-6, 40],
  RN: [12, -2],
  PB: [15, 2],
  PE: [18, 5],
  AL: [14, 8],
  SE: [10, 8],
  DF: [0, 0],
  ES: [8, 0],
  RJ: [10, 4],
};

export function BrazilRegionsMap({ statesMetrics, selectedUf, onSelectUf, className }: BrazilRegionsMapProps) {
  const [hoveredUf, setHoveredUf] = React.useState<string | null>(null);

  // Calcular maior faturamento para intensidade da cor
  const maxRevenue = React.useMemo(() => {
    return Math.max(...Object.values(statesMetrics).map(s => s.totalRevenue), 1);
  }, [statesMetrics]);

  return (
    <div className={cn("relative rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50/60 to-slate-100/30 p-4 md:p-6 shadow-sm overflow-hidden", className)}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200/80">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" /> Mapa Oficial do Brasil - Territórios de Atendimento
          </h3>
          <p className="text-xs text-slate-500">
            Passe o mouse ou clique no estado no contorno real do mapa para detalhar faturamento, cidades e clientes.
          </p>
        </div>

        {/* Legenda de Atendimento */}
        <div className="flex items-center gap-4 text-xs font-medium self-start md:self-auto flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-[#001942]" />
            <span className="text-slate-700 font-semibold">Polo Principal (+40% fat.)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-[#0284c7]" />
            <span className="text-slate-600 font-semibold">Ativo / Expansão</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-[#bae6fd]" />
            <span className="text-slate-600">Com Clientes (Sem Vendas)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-[#f1f5f9] border border-slate-300" />
            <span className="text-slate-400">Sem Presença</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 pt-2 md:pt-4">
        {/* MAPA VETORIAL REAL DO BRASIL OTIMIZADO PARA MOBILE E DESKTOP */}
        <div className="w-full flex justify-center items-center relative min-h-[460px] md:min-h-[640px] p-1 sm:p-2 md:p-4 bg-white/70 rounded-2xl border border-slate-200/80 shadow-inner overflow-hidden">
          <svg
            viewBox="40 0 520 610"
            className="w-full max-w-full md:max-w-[840px] h-auto max-h-[80vh] drop-shadow-xl select-none"
            aria-label="Mapa Oficial do Brasil com Contornos dos Estados"
          >
            {/* Definições de filtros */}
            <defs>
              <filter id="glow-select" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#001942" floodOpacity="0.45" />
              </filter>
            </defs>

            {/* Renderização de todos os estados brasileiros com curvas geográficas reais */}
            {Object.entries(typedBrazilStatesData).map(([uf, geo]) => {
              const stateData = statesMetrics[uf];
              const isSelected = selectedUf === uf;
              const isHovered = hoveredUf === uf;
              const hasSales = stateData && stateData.totalRevenue > 0;
              const hasClients = stateData && stateData.totalClients > 0;

              // Cor baseada no faturamento real
              let fillColor = '#f1f5f9'; // Sem presença
              let strokeColor = '#cbd5e1';
              let textColor = '#64748b';

              if (hasSales) {
                const ratio = stateData.totalRevenue / maxRevenue;
                if (ratio >= 0.35) {
                  fillColor = isSelected ? '#001433' : '#001942'; // Safyra Azul Noturno
                  textColor = '#ffffff';
                  strokeColor = '#000c1e';
                } else {
                  fillColor = isSelected ? '#0369a1' : '#0284c7'; // Azul Expansão
                  textColor = '#ffffff';
                  strokeColor = '#075985';
                }
              } else if (hasClients) {
                fillColor = isSelected ? '#7dd3fc' : '#bae6fd';
                textColor = '#0369a1';
                strokeColor = '#38bdf8';
              }

              if (isHovered && !isSelected) {
                fillColor = '#38bdf8';
                textColor = '#ffffff';
                strokeColor = '#0284c7';
              }

              const offset = UF_LABEL_OFFSETS[uf] || [0, 0];
              const labelX = geo.center[0] + offset[0];
              const labelY = geo.center[1] + offset[1];

              return (
                <g
                  key={uf}
                  onClick={() => onSelectUf(selectedUf === uf ? null : uf)}
                  onMouseEnter={() => setHoveredUf(uf)}
                  onMouseLeave={() => setHoveredUf(null)}
                  className="cursor-pointer transition-all duration-150 group"
                  filter={isSelected ? "url(#glow-select)" : undefined}
                >
                  {/* Contorno Real do Estado */}
                  <path
                    d={geo.d}
                    fill={fillColor}
                    stroke={isSelected ? '#f59e0b' : strokeColor}
                    strokeWidth={isSelected ? 2.5 : isHovered ? 1.5 : 0.8}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    className="transition-colors duration-150"
                  />

                  {/* Sigla do Estado */}
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={textColor}
                    fontSize={uf === 'DF' ? 9 : ['SP', 'RJ', 'ES', 'SE', 'AL', 'PB', 'RN', 'SC'].includes(uf) ? 10 : 12}
                    fontWeight="800"
                    className="tracking-wider pointer-events-none select-none drop-shadow-sm"
                  >
                    {uf}
                  </text>

                  {/* Indicador pulsante em polos de maior faturamento */}
                  {hasSales && (
                    <circle
                      cx={labelX + 9}
                      cy={labelY - 7}
                      r="3.5"
                      fill="#10b981"
                      className="animate-pulse pointer-events-none"
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* PAINEL DE DETALHES DO ESTADO SELECIONADO / HOVER EM LINHA/GRID ABAIXO DO MAPA */}
        <div className="w-full">
          {(() => {
            const activeUf = selectedUf || hoveredUf || 'GO';
            const geoInfo = typedBrazilStatesData[activeUf];
            const stateInfo = statesMetrics[activeUf] || {
              uf: activeUf,
              name: geoInfo?.name || activeUf,
              regionName: 'Região Comercial',
              totalRevenue: 0,
              ordersCount: 0,
              totalClients: 0,
              activeClients: 0,
              citiesCount: 0,
              cities: [],
              topClients: [],
              warningClients: []
            };

            return (
              <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b pb-2.5">
                  <div className="flex items-center gap-2">
                    <StateFlag uf={stateInfo.uf} name={stateInfo.name} className="h-5 w-7 rounded shadow-2xs" />
                    <div>
                      <h4 className="font-bold text-sm sm:text-base text-slate-800 leading-tight">{stateInfo.name}</h4>
                      <p className="text-[10px] text-slate-400">
                        {stateInfo.citiesCount} {stateInfo.citiesCount === 1 ? 'município' : 'municípios'} atendidos
                      </p>
                    </div>
                  </div>
                  <Badge variant={stateInfo.totalRevenue > 0 ? "default" : "outline"} className="text-[10px] font-semibold h-5 px-2">
                    {stateInfo.totalRevenue > 0 ? 'Polo Ativo' : 'Sem Vendas'}
                  </Badge>
                </div>

                {/* Métricas Principais do Estado Compactas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 sm:p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block truncate">Faturamento Real</span>
                    <span className="font-bold font-mono text-xs sm:text-sm text-primary block truncate">
                      R$ {stateInfo.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-2 sm:p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block truncate">Pedidos Faturados</span>
                    <span className="font-bold font-mono text-xs sm:text-sm text-slate-800 block truncate">
                      {stateInfo.ordersCount} pedidos
                    </span>
                  </div>
                  <div className="p-2 sm:p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block truncate">Clientes</span>
                    <span className="font-bold font-mono text-xs sm:text-sm text-slate-800 block truncate">
                      {stateInfo.totalClients} ({stateInfo.activeClients} ativos)
                    </span>
                  </div>
                  <div className="p-2 sm:p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200">
                    <span className="text-[9px] uppercase font-bold text-emerald-700 block truncate">Comissão Est.</span>
                    <span className="font-bold font-mono text-xs sm:text-sm text-emerald-800 block truncate">
                      R$ {(stateInfo.totalRevenue * 0.04).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Seção com Cidades, Top Clientes e Alertas em 3 colunas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 border-t border-slate-100">
                  {/* Top Cidades do Estado */}
                  <div className="p-2.5 rounded-lg bg-slate-50/70 border border-slate-100 space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-primary" /> Principais Cidades ({stateInfo.uf}):
                    </span>
                    {stateInfo.cities.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic py-1">Nenhuma cidade registrada</p>
                    ) : (
                      <div className="max-h-[140px] overflow-y-auto space-y-1 pr-1 text-xs">
                        {stateInfo.cities.slice(0, 5).map((city, cIdx) => (
                          <div key={cIdx} className="flex justify-between items-center p-1.5 rounded bg-white border border-slate-100 shadow-2xs text-[11px]">
                            <span className="font-medium text-slate-800 truncate">{formatDisplayName(city.name)}</span>
                            <span className="font-mono font-semibold text-primary shrink-0 ml-2">
                              R$ {city.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Top Clientes do Estado */}
                  <div className="p-2.5 rounded-lg bg-slate-50/70 border border-slate-100 space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-amber-500" /> Top Clientes ({stateInfo.uf}):
                    </span>
                    {stateInfo.topClients.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic py-1">Nenhum cliente com compras</p>
                    ) : (
                      <div className="max-h-[140px] overflow-y-auto space-y-1 pr-1 text-xs">
                        {stateInfo.topClients.slice(0, 3).map((cl, idx) => {
                          const displayName = formatClientDisplayName({
                            trade_name: cl.tradeName,
                            name: cl.name,
                          }) || cl.name;
                          const location = cl.city ? `${formatDisplayName(cl.city)} - ${cl.state || stateInfo.uf}` : (cl.state || stateInfo.uf);

                          return (
                            <div key={cl.id} className="flex justify-between items-center p-1.5 rounded bg-white border border-slate-100 shadow-2xs gap-1.5 text-[11px]">
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-slate-900 truncate text-[11px]" title={displayName}>
                                  <span className="text-slate-400 font-mono mr-1">{idx + 1}º</span>
                                  {displayName}
                                </div>
                                <div className="text-[9px] text-slate-400 truncate">
                                  {location}
                                </div>
                              </div>
                              <span className="font-bold font-mono text-primary text-[10px] shrink-0">
                                R$ {cl.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Clientes Sem Compra Recente */}
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-800">
                        Sem compra (+60d):
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {stateInfo.warningClients.length}
                      </span>
                    </div>
                    {stateInfo.warningClients.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic py-1">Nenhum cliente inativo.</p>
                    ) : (
                      <div className="max-h-[140px] overflow-y-auto space-y-1 pr-1 text-xs">
                        {stateInfo.warningClients.slice(0, 3).map((cl) => {
                          const displayName = formatClientDisplayName({
                            trade_name: cl.tradeName,
                            name: cl.name,
                          }) || cl.name;
                          const location = cl.city ? `${formatDisplayName(cl.city)} - ${cl.state || stateInfo.uf}` : (cl.state || stateInfo.uf);

                          return (
                            <div key={cl.id} className="flex justify-between items-center p-1.5 rounded bg-white border border-slate-200 text-slate-700 shadow-2xs gap-1.5">
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-slate-900 truncate text-[11px]" title={displayName}>
                                  {displayName}
                                </div>
                                <div className="text-[9px] text-slate-400 truncate">
                                  {location}
                                </div>
                              </div>
                              <span className="text-slate-500 text-[9px] font-mono whitespace-nowrap shrink-0">
                                {cl.daysSinceLastOrder ? `${cl.daysSinceLastOrder}d` : 'S/ compras'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
