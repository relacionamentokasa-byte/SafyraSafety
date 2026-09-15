import {
  TrendingUp,
  ShieldCheck,
  Calendar,
  Clock,
  CheckCircle2,
  DollarSign,
  Briefcase,
  Users,
  MapPin,
  ChevronRight
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { MyAttention } from "./MyAttention";
import { useQuery } from "@tanstack/react-query";
import { getDashboardData } from "@/lib/dashboard.services";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";

export function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-real-stats'],
    queryFn: () => getDashboardData(),
    staleTime: 1000 * 60 * 3,
  });

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const { commissionForecast } = stats;

  return (
    <div className="space-y-6 pb-8 w-full">
      {/* Topo do Dashboard */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Painel Comercial
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Acompanhamento de vendas, faturamento e fluxo de comissões.
          </p>
        </div>
        <div className="w-full md:w-80">
          <MyAttention />
        </div>
      </div>

      {/* BLOCO 1: Indicadores Principais de Vendas e Carteira */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Faturamento Total */}
        <div className="p-5 rounded-xl border bg-card flex flex-col justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Faturamento Total
          </span>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-foreground tracking-tight">
              R$ {stats.totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-xs text-muted-foreground mt-1 block">
              {stats.totalOrders} {stats.totalOrders === 1 ? 'pedido faturado' : 'pedidos faturados'}
            </span>
          </div>
        </div>

        {/* 2. Pedidos no Mês */}
        <div className="p-5 rounded-xl border bg-card flex flex-col justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Volume de Pedidos
          </span>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-foreground tracking-tight">
              {stats.totalOrders}
            </div>
            <span className="text-xs text-muted-foreground mt-1 block">
              {stats.ordersToday} {stats.ordersToday === 1 ? 'pedido hoje' : 'pedidos hoje'}
            </span>
          </div>
        </div>

        {/* 3. Carteira de Clientes */}
        <div className="p-5 rounded-xl border bg-card flex flex-col justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Carteira Ativa
          </span>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-foreground tracking-tight">
              {stats.activeClients}
              <span className="text-sm font-normal text-muted-foreground ml-1">/ {stats.totalClients}</span>
            </div>
            <span className="text-xs text-muted-foreground mt-1 block">
              Clientes cadastrados
            </span>
          </div>
        </div>

        {/* 4. Atendimentos de Campo */}
        <div className="p-5 rounded-xl border bg-card flex flex-col justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Visitas Comerciais
          </span>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-foreground tracking-tight">
              {stats.completedVisits}
              <span className="text-sm font-normal text-muted-foreground ml-1">concluídas</span>
            </div>
            <span className="text-xs text-muted-foreground mt-1 block">
              {stats.pendingVisits} {stats.pendingVisits === 1 ? 'visita agendada' : 'visitas agendadas'}
            </span>
          </div>
        </div>
      </div>

      {/* BLOCO 2: Previsão Mensal de Comissionamento */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              Previsão de Comissões por Mês
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Projeção de repasses com base na liquidez das parcelas e datas de pagamento das indústrias.
            </p>
          </div>
          <Link
            to="/comercial/comissoes"
            className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1 self-start sm:self-auto"
          >
            Ver Extrato Detalhado <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x border-b">
          {commissionForecast.monthlyBreakdown.map((item, index) => {
            const isCurrent = index === 0;
            const isNext = index === 1;

            return (
              <div key={item.monthKey} className="p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-foreground">
                      {item.monthLabel}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-semibold text-primary">Mês Atual</span>
                    )}
                    {isNext && (
                      <span className="text-[10px] font-semibold text-muted-foreground">Próximo Mês</span>
                    )}
                  </div>

                  <div className="text-xl font-bold font-mono text-foreground">
                    R$ {item.totalForecast.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex justify-between items-center">
                      <span>Liberado/Repasse:</span>
                      <span className="font-mono font-medium text-foreground">
                        R$ {item.approved.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Aguardando Liquidez:</span>
                      <span className="font-mono font-medium text-muted-foreground">
                        R$ {item.pending.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {item.paid > 0 && (
                      <div className="flex justify-between items-center text-emerald-600 font-medium">
                        <span>Pago:</span>
                        <span className="font-mono">
                          R$ {item.paid.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {item.manufacturers.length > 0 && (
                  <div className="mt-4 pt-3 border-t text-[11px] text-muted-foreground space-y-1">
                    {item.manufacturers.map((m) => (
                      <div key={m.name} className="flex justify-between items-center">
                        <span className="truncate max-w-[110px]">{m.name}</span>
                        <span className="font-mono font-medium">
                          R$ {m.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* BLOCO 3: Gráfico de Evolução */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-sm font-bold text-foreground">Evolução do Faturamento</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Valores faturados nos últimos meses</p>
          </div>
        </div>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.salesByPeriod} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#001942" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#001942" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
              <XAxis
                dataKey="period"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={11}
                tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Faturamento']}
                labelFormatter={(label) => `Período: ${label}`}
                contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Area
                type="monotone"
                dataKey="vendas"
                stroke="#001942"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorVendas)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
