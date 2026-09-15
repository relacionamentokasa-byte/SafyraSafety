import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getClientMixDiagnostic, ClientMixDiagnostic } from '@/lib/mix-recommendations.services';
import {
  TrendingUp,
  Package,
  Building2,
  Check,
  Plus,
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ManufacturerLogo } from '@/components/manufacturers/ManufacturerLogo';

interface ClientMixPitchDrawerProps {
  clientId: string;
  onSelectProductToPitch?: (productId: string) => void;
  className?: string;
}

export function ClientMixPitchDrawer({ clientId, onSelectProductToPitch, className }: ClientMixPitchDrawerProps) {
  const { data: diagnostic, isLoading } = useQuery({
    queryKey: ['client-mix-diagnostic', clientId],
    queryFn: () => getClientMixDiagnostic(clientId),
    enabled: !!clientId,
    staleTime: 1000 * 60 * 5, // 5 min
  });

  if (isLoading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-xs">Carregando histórico e produtos do cliente...</p>
      </div>
    );
  }

  if (!diagnostic) {
    return (
      <div className="p-6 text-center text-xs text-slate-500">
        Nenhum dado comercial encontrado para este cliente.
      </div>
    );
  }

  const buyingMfgs = diagnostic.manufacturerPenetration.filter(m => m.isBuying);

  return (
    <div className="space-y-6">
      {/* 1. CABEÇALHO SÓBRIO DO CLIENTE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-slate-900 text-white border border-slate-800">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Diagnóstico de Mix de Produtos
          </span>
          <h3 className="text-base font-bold mt-0.5">{diagnostic.clientName}</h3>
          <p className="text-xs text-slate-400">
            {diagnostic.city ? `${diagnostic.city} - ${diagnostic.state}` : 'Cliente Comercial'} • {diagnostic.ordersCount} pedidos realizados
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="p-2.5 rounded bg-slate-800 border border-slate-700 text-right">
            <span className="text-[10px] text-slate-400 block uppercase font-medium">Total Faturado</span>
            <span className="text-sm font-bold font-mono text-white">
              R$ {diagnostic.totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* 2. TABELA / GRID DE FABRICANTES PARCEIROS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-slate-600" /> Fabricantes Ativos no Cliente
          </h4>
          <span className="text-xs text-slate-500 font-medium font-mono">
            {buyingMfgs.length} de {diagnostic.manufacturerPenetration.length} indústrias
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {diagnostic.manufacturerPenetration.map((mfg) => (
            <div
              key={mfg.manufacturerId}
              className="p-3.5 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <ManufacturerLogo name={mfg.manufacturerName} logoPath={mfg.logoPath} size="sm" className="h-8 w-8 rounded border border-slate-100" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">{mfg.manufacturerName}</h5>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {mfg.isBuying ? (mfg.topCategory || 'Com compras registradas') : 'Sem histórico de compras'}
                    </p>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded border font-mono ${
                    mfg.isBuying
                      ? 'bg-slate-100 text-slate-800 border-slate-200'
                      : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  {mfg.isBuying ? 'Ativo' : 'Disponível'}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline text-xs">
                <span className="text-[11px] text-slate-500">Volume acumulado:</span>
                <span className="font-bold font-mono text-slate-900">
                  {mfg.isBuying
                    ? `R$ ${mfg.totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    : 'R$ 0,00'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. BLOCO DUPLO: PRODUTOS MAIS COMPRADOS VS ITENS DO CATÁLOGO NÃO COMPRADOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* LADO ESQUERDO: Produtos mais recorrentes */}
        <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-slate-600" /> Histórico de Recompra
            </h4>
            <span className="text-[11px] text-slate-500 font-medium">Itens frequentes</span>
          </div>

          {diagnostic.frequentProducts.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-4 text-center">
              Sem histórico de pedidos anteriores para este cliente.
            </p>
          ) : (
            <div className="space-y-2">
              {diagnostic.frequentProducts.map((prod, idx) => (
                <div key={idx} className="p-2.5 rounded border border-slate-100 bg-slate-50/60 space-y-1.5 text-xs">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="font-semibold text-slate-900 block">{prod.productName}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Cód: {prod.sku} • {prod.manufacturerName}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold font-mono text-slate-900 block">
                        R$ {prod.totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {prod.totalQuantity} un
                      </span>
                    </div>
                  </div>

                  {prod.repurchaseAlert && (
                    <div className="flex items-center justify-between text-[11px] text-slate-600 bg-white px-2.5 py-1 rounded border border-slate-200">
                      <span>Ciclo médio:</span>
                      <span className="font-mono text-slate-800">{prod.repurchaseAlert}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* LADO DIREITO: Outros produtos do portfólio para apresentação */}
        <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Package className="h-4 w-4 text-slate-600" /> Linhas Complementares do Catálogo
            </h4>
          </div>

          {diagnostic.mixOpportunities.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-4 text-center">
              Todas as linhas principais já foram adquiridas por este cliente.
            </p>
          ) : (
            <div className="space-y-2">
              {diagnostic.mixOpportunities.map((opp, idx) => (
                <div key={idx} className="p-3 rounded border border-slate-200 bg-white space-y-2 text-xs">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium mb-1 inline-block">
                        {opp.reason}
                      </span>
                      <h5 className="font-semibold text-slate-900">{opp.productName}</h5>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Cód: {opp.sku} • {opp.manufacturerName}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      {opp.estimatedTicket > 0 && (
                        <span className="font-semibold font-mono text-slate-900 text-xs block">
                          R$ {opp.estimatedTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  </div>

                  {opp.potentialPitch && (
                    <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                      {opp.potentialPitch}
                    </p>
                  )}

                  {onSelectProductToPitch && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-8 text-xs font-medium gap-1.5"
                      onClick={() => onSelectProductToPitch(opp.productId)}
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar ao Pedido / Cotação
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
