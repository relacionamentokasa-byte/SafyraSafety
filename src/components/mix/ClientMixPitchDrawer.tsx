import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getClientMixDiagnostic, ClientMixDiagnostic } from '@/lib/mix-recommendations.services';
import {
  TrendingUp,
  Package,
  Building2,
  Check,
  Plus,
  Loader2,
  ReceiptText,
  Calendar,
  Layers
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ManufacturerLogo } from '@/components/manufacturers/ManufacturerLogo';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

  const manufacturerPenetration = diagnostic.manufacturerPenetration || [];
  const recentOrders = diagnostic.recentOrders || [];
  const frequentProducts = diagnostic.frequentProducts || [];
  const mixOpportunities = diagnostic.mixOpportunities || [];
  const buyingMfgs = manufacturerPenetration.filter(m => m.isBuying);

  return (
    <div className="space-y-6">
      {/* 1. CABEÇALHO SÓBRIO DO CLIENTE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-slate-900 text-white border border-slate-800">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Diagnóstico de Mix e Histórico Comercial
          </span>
          <h3 className="text-base font-bold mt-0.5">{diagnostic.clientName}</h3>
          <p className="text-xs text-slate-400">
            {diagnostic.city ? `${diagnostic.city} - ${diagnostic.state}` : 'Cliente Comercial'} • {diagnostic.ordersCount || 0} {(diagnostic.ordersCount || 0) === 1 ? 'pedido registrado' : 'pedidos registrados'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="p-2.5 rounded bg-slate-800 border border-slate-700 text-right">
            <span className="text-[10px] text-slate-400 block uppercase font-medium">Total Faturado</span>
            <span className="text-sm font-bold font-mono text-white">
              R$ {(diagnostic.totalSpent || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* 2. TABELA / GRID DE FABRICANTES PARCEIROS E LINHAS ADQUIRIDAS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-slate-600" /> Penetração por Fabricante & Linhas Adquiridas
          </h4>
          <span className="text-xs text-slate-500 font-medium font-mono">
            {buyingMfgs.length} de {manufacturerPenetration.length} indústrias ativas
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {manufacturerPenetration.map((mfg) => (
            <div
              key={mfg.manufacturerId}
              className="p-3.5 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-2.5 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <ManufacturerLogo name={mfg.manufacturerName} logoPath={mfg.logoPath} size="sm" className="h-8 w-8 rounded border border-slate-100" />
                    <div>
                      <h5 className="font-bold text-xs text-slate-900">{mfg.manufacturerName}</h5>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {mfg.isBuying ? `${mfg.itemsCount || 0} compra(s)` : 'Sem histórico de compras'}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded border font-mono ${
                      mfg.isBuying
                        ? 'bg-slate-100 text-slate-800 border-slate-200'
                        : 'bg-white text-slate-400 border-slate-200'
                    }`}
                  >
                    {mfg.isBuying ? 'Ativo' : 'Sem compras'}
                  </span>
                </div>

                {/* Linhas / Categorias Adquiridas */}
                {mfg.isBuying && mfg.acquiredLines && mfg.acquiredLines.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                      <Layers className="h-3 w-3 text-slate-400" /> Linhas adquiridas:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {mfg.acquiredLines.map((line, lIdx) => (
                        <span
                          key={lIdx}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium border border-slate-200"
                        >
                          {line}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline text-xs mt-2">
                <span className="text-[11px] text-slate-500">Volume Faturado:</span>
                <span className="font-bold font-mono text-slate-900">
                  {mfg.isBuying
                    ? `R$ ${(mfg.totalSpent || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    : 'R$ 0,00'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. HISTÓRICO DE PEDIDOS RECENTES DO CLIENTE */}
      <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <ReceiptText className="h-4 w-4 text-slate-600" /> Histórico de Pedidos & Faturamento
          </h4>
          <span className="text-[11px] text-slate-500 font-medium font-mono">
            {recentOrders.length} pedido(s)
          </span>
        </div>

        {recentOrders.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-3 text-center">
            Nenhum pedido faturado registrado no histórico.
          </p>
        ) : (
          <div className="space-y-2">
            {recentOrders.map((order) => {
              const formattedDate = order.createdAt
                ? format(new Date(order.createdAt), "dd 'de' MMM, yyyy", { locale: ptBR })
                : 'Data não informada';

              return (
                <div
                  key={order.id}
                  className="p-2.5 rounded border border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:border-slate-300 transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">{order.orderNumber}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200 font-medium">
                        {order.manufacturerName}
                      </span>
                      <span className="text-[10px] text-slate-400 capitalize">
                        • {order.status === 'invoiced' ? 'Faturado' : order.status === 'delivered' ? 'Entregue' : order.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-1">
                      {order.itemsSummary || 'Itens faturados'}
                    </p>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0 border-t sm:border-t-0 pt-1.5 sm:pt-0 border-slate-200">
                    <span className="font-mono font-bold text-slate-900">
                      R$ {(order.totalAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-slate-400" /> {formattedDate}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. BLOCO DUPLO: PRODUTOS MAIS COMPRADOS VS ITENS DO CATÁLOGO NÃO COMPRADOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* LADO ESQUERDO: Produtos mais recorrentes */}
        <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-slate-600" /> Itens Frequentes (Curva A do Cliente)
            </h4>
            <span className="text-[11px] text-slate-500 font-medium">Histórico</span>
          </div>

          {frequentProducts.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-4 text-center">
              Sem itens individualizados no histórico deste cliente.
            </p>
          ) : (
            <div className="space-y-2">
              {frequentProducts.map((prod, idx) => (
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
                        R$ {(prod.totalSpent || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
              <Package className="h-4 w-4 text-slate-600" /> Oportunidades de Mix & Expansão
            </h4>
          </div>

          {mixOpportunities.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-4 text-center">
              Todas as linhas principais já foram adquiridas por este cliente.
            </p>
          ) : (
            <div className="space-y-2">
              {mixOpportunities.map((opp, idx) => (
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
                      {(opp.estimatedTicket || 0) > 0 && (
                        <span className="font-semibold font-mono text-slate-900 text-xs block">
                          R$ {(opp.estimatedTicket || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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

