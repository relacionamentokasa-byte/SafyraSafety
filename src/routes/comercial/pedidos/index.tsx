import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AppLayout } from '@/components/layout/AppLayout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, Search, Filter, ShoppingCart, TrendingUp, Clock, CheckCircle2, Truck, XCircle, FileText, ChevronLeft, ChevronRight, Loader2, ShieldCheck, ArrowUpRight, Eye, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useDeferredValue } from 'react';
import { OrderStatus } from '@/types/database.types';
import { cn } from '@/lib/utils';
import { ManufacturerLogo } from '@/components/manufacturers/ManufacturerLogo';
import { resolveOrderManufacturer } from '@/lib/order-manufacturers.utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchOrdersServer } from '@/lib/orders.functions';
import { deleteOrderPermanentlyDirect } from '@/lib/orders.services';
import { formatClientDisplayName } from '@/lib/format-name';
import { OrderPDFImportModal } from '@/components/pedidos/OrderPDFImportModal';
import { UploadCloud } from 'lucide-react';
import { RepresentativeBadge } from '@/components/representantes/RepresentativeBadge';
import { FieldQuickActions } from '@/components/common/FieldQuickActions';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export const Route = createFileRoute('/comercial/pedidos/')({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Pedidos de Venda" },
      { name: "description", content: "Gestão completa de pedidos, faturamento e entregas." },
    ],
  }),
  component: OrdersPage,
});

const statusStyles: Record<OrderStatus, { label: string; badgeClass: string; dotClass: string }> = {
  draft: {
    label: "Rascunho",
    badgeClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
    dotClass: "bg-slate-400"
  },
  sent: {
    label: "Enviado",
    badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    dotClass: "bg-blue-500"
  },
  analysis: {
    label: "Em Análise",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    dotClass: "bg-amber-500"
  },
  approved: {
    label: "Aprovado",
    badgeClass: "bg-primary/10 text-primary border-primary/20 font-semibold",
    dotClass: "bg-primary"
  },
  invoiced: {
    label: "Faturado",
    badgeClass: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20 font-semibold",
    dotClass: "bg-purple-500"
  },
  delivered: {
    label: "Entregue",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-semibold",
    dotClass: "bg-emerald-500"
  },
  cancelled: {
    label: "Cancelado",
    badgeClass: "bg-destructive/10 text-destructive border-destructive/20",
    dotClass: "bg-destructive"
  }
};

function OrdersPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const currentMonthNum = new Date().getMonth() + 1;
  const currentYearNum = new Date().getFullYear();

  // Estados dos filtros - Padrão: Mês e Ano vigentes
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [manufacturerFilter, setManufacturerFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>(String(currentMonthNum));
  const [yearFilter, setYearFilter] = useState<string>(String(currentYearNum));

  const [orderToDelete, setOrderToDelete] = useState<{ id: string; order_number: string } | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await deleteOrderPermanentlyDirect(orderId);
    },
    onSuccess: () => {
      setOrderToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders-all-stats'] });
      toast.success('Pedido excluído com sucesso.');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir pedido: ' + (error.message || error));
    }
  });

  const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const currentYear = new Date().getFullYear();
  const availableYears = [String(currentYear - 1), String(currentYear), String(currentYear + 1)];

  // Carregar fabricantes para o filtro
  const { data: manufacturers } = useQuery({
    queryKey: ['manufacturers-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('manufacturers').select('id, name, logo_path').order('name');
      if (error) throw error;
      return data;
    }
  });

  const { data: allOrdersData } = useQuery({
    queryKey: ['orders-all-stats', deferredSearch, manufacturerFilter, monthFilter, yearFilter],
    queryFn: async () => {
      try {
        const res = await fetchOrdersServer({
          data: {
            pageSize: 1,
            search: deferredSearch,
            month: monthFilter,
            year: yearFilter,
            manufacturerId: manufacturerFilter,
          }
        });
        if (res && res.stats) {
          return res.stats;
        }
      } catch (e) {
        console.warn("fetchOrdersServer stats fallback:", e);
      }

      let query = supabase
        .from('orders')
        .select('total_amount, status, created_at, order_number, billing_notes');

      if (deferredSearch) {
        query = query.or(`order_number.ilike.%${deferredSearch}%,billing_notes.ilike.%${deferredSearch}%`);
      }

      if (manufacturerFilter !== 'all') {
        const { data: comms } = await supabase
          .from('commissions')
          .select('order_id')
          .eq('manufacturer_id', manufacturerFilter);

        const { data: items } = await supabase
          .from('order_items')
          .select('order_id, product:products(manufacturer_id)');

        const orderIdsSet = new Set<string>();
        comms?.forEach(c => {
          if (c.order_id) orderIdsSet.add(c.order_id);
        });
        items?.forEach(it => {
          if ((it.product as any)?.manufacturer_id === manufacturerFilter && it.order_id) {
            orderIdsSet.add(it.order_id);
          }
        });

        const matchedOrderIds = Array.from(orderIdsSet);
        if (matchedOrderIds.length > 0) {
          query = query.in('id', matchedOrderIds);
        } else {
          query = query.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      }

      if (yearFilter !== 'all' && monthFilter !== 'all') {
        const y = Number(yearFilter);
        const m = Number(monthFilter);
        const startDate = new Date(y, m - 1, 1).toISOString();
        const endDate = new Date(y, m, 0, 23, 59, 59, 999).toISOString();
        query = query.gte('created_at', startDate).lte('created_at', endDate);
      } else if (yearFilter !== 'all') {
        const y = Number(yearFilter);
        const startDate = new Date(y, 0, 1).toISOString();
        const endDate = new Date(y, 11, 31, 23, 59, 59, 999).toISOString();
        query = query.gte('created_at', startDate).lte('created_at', endDate);
      } else if (monthFilter !== 'all') {
        const y = new Date().getFullYear();
        const m = Number(monthFilter);
        const startDate = new Date(y, m - 1, 1).toISOString();
        const endDate = new Date(y, m, 0, 23, 59, 59, 999).toISOString();
        query = query.gte('created_at', startDate).lte('created_at', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 2,
  });

  const { data: ordersData, isLoading, error: ordersError } = useQuery({
    queryKey: ['orders', deferredSearch, page, statusFilter, manufacturerFilter, monthFilter, yearFilter],
    queryFn: async () => {
      // 1. Tentar primeiro via Server Function (Garante dados sem bloqueio de RLS)
      try {
        const res = await fetchOrdersServer({
          data: {
            search: deferredSearch,
            status: statusFilter,
            page,
            pageSize,
            month: monthFilter,
            year: yearFilter,
            manufacturerId: manufacturerFilter
          }
        });
        if (res && res.data && res.data.length > 0) {
          return { data: res.data, count: res.count };
        }
      } catch (errServer) {
        console.warn("fetchOrdersServer fallback:", errServer);
      }

      // 2. Fallback direto Supabase client
      let query = supabase
        .from('orders')
        .select(`
          *,
          client:clients(id, name, trade_name, legal_name),
          representative:representatives(id, name, photo_url, user_id),
          items:order_items(
            id,
            product_name_snapshot,
            product_sku_snapshot,
            product:products(
              id,
              name,
              sku,
              manufacturer_id,
              manufacturer:manufacturers(id, name, logo_path)
            )
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      if (deferredSearch) {
        query = query.or(`order_number.ilike.%${deferredSearch}%,billing_notes.ilike.%${deferredSearch}%`);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as any);
      }

      // Filtro por Fabricante
      if (manufacturerFilter !== 'all') {
        const { data: comms } = await supabase
          .from('commissions')
          .select('order_id')
          .eq('manufacturer_id', manufacturerFilter);

        const { data: items } = await supabase
          .from('order_items')
          .select('order_id, product:products(manufacturer_id)');

        const orderIdsSet = new Set<string>();
        comms?.forEach(c => {
          if (c.order_id) orderIdsSet.add(c.order_id);
        });
        items?.forEach(it => {
          if ((it.product as any)?.manufacturer_id === manufacturerFilter && it.order_id) {
            orderIdsSet.add(it.order_id);
          }
        });

        const matchedOrderIds = Array.from(orderIdsSet);
        if (matchedOrderIds.length > 0) {
          query = query.in('id', matchedOrderIds);
        } else {
          query = query.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      }

      // Filtro por Mês e Ano
      if (yearFilter !== 'all' && monthFilter !== 'all') {
        const y = Number(yearFilter);
        const m = Number(monthFilter);
        const startDate = new Date(y, m - 1, 1).toISOString();
        const endDate = new Date(y, m, 0, 23, 59, 59, 999).toISOString();
        query = query.gte('created_at', startDate).lte('created_at', endDate);
      } else if (yearFilter !== 'all') {
        const y = Number(yearFilter);
        const startDate = new Date(y, 0, 1).toISOString();
        const endDate = new Date(y, 11, 31, 23, 59, 59, 999).toISOString();
        query = query.gte('created_at', startDate).lte('created_at', endDate);
      } else if (monthFilter !== 'all') {
        const y = new Date().getFullYear();
        const m = Number(monthFilter);
        const startDate = new Date(y, m - 1, 1).toISOString();
        const endDate = new Date(y, m, 0, 23, 59, 59, 999).toISOString();
        query = query.gte('created_at', startDate).lte('created_at', endDate);
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    staleTime: 1000 * 60 * 2,
  });

  const getOrderManufacturerInfo = (order: any): { name: string; logoPath?: string } => {
    const mfg = resolveOrderManufacturer(order, manufacturers || []);
    return {
      name: mfg.name,
      logoPath: mfg.logo_path || undefined,
    };
  };

  const orders = ordersData?.data || [];
  const totalCount = ordersData?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const totalSold = allOrdersData?.reduce((acc, o) => acc + Number(o.total_amount || 0), 0) || 0;
  const countPending = allOrdersData?.filter(o => o.status === 'sent' || o.status === 'analysis').length || 0;
  const countApproved = allOrdersData?.filter(o => o.status === 'approved').length || 0;
  const countInvoiced = allOrdersData?.filter(o => o.status === 'invoiced').length || 0;
  const countDelivered = allOrdersData?.filter(o => o.status === 'delivered').length || 0;
  const countCancelled = allOrdersData?.filter(o => o.status === 'cancelled').length || 0;

  return (
    <AppLayout>
      <div className="space-y-6 w-full">
        {/* Header com Identidade Safyra */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
              Pedidos de Venda
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Gestão de pedidos, análise comercial, faturamento e acompanhamento de entregas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsPdfModalOpen(true)}
              className="h-10 px-4 gap-2 font-semibold border-primary/20 text-primary hover:bg-primary/5 shadow-xs"
            >
              <UploadCloud className="h-4 w-4" />
              Importar via PDF
            </Button>
            <Button asChild className="h-10 px-4 gap-2 font-semibold shadow-xs">
              <Link to="/comercial/pedidos/novo" search={{ opportunity_id: "" }}>
                <Plus className="h-4 w-4" />
                Novo Pedido
              </Link>
            </Button>
          </div>
        </div>

        {/* Barra de Filtro de Competência Rápida (Mês / Ano / Indústria) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Filtros:
            </span>
            <Select value={manufacturerFilter} onValueChange={(v) => { setManufacturerFilter(v); setPage(0); }}>
              <SelectTrigger className="h-9 flex-1 sm:w-[170px] text-xs font-medium bg-slate-50 border-slate-200">
                <SelectValue placeholder="Todas as Indústrias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Indústrias</SelectItem>
                {manufacturers?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={monthFilter} onValueChange={(v) => { setMonthFilter(v); setPage(0); }}>
              <SelectTrigger className="h-9 flex-1 sm:w-[140px] text-xs font-medium bg-slate-50 border-slate-200">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Ano Inteiro (Todos)</SelectItem>
                {MONTH_NAMES.map((name, index) => (
                  <SelectItem key={index + 1} value={String(index + 1)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={yearFilter} onValueChange={(v) => { setYearFilter(v); setPage(0); }}>
              <SelectTrigger className="h-9 w-[90px] text-xs font-medium bg-slate-50 border-slate-200">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(monthFilter !== 'all' || yearFilter !== 'all' || manufacturerFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-slate-500 hover:text-slate-900 w-full sm:w-auto justify-center"
                onClick={() => {
                  setMonthFilter('all');
                  setYearFilter('all');
                  setManufacturerFilter('all');
                  setPage(0);
                }}
              >
                Limpar Filtros
              </Button>
            )}
          </div>

          <div className="text-xs text-slate-500 font-mono">
            {monthFilter !== 'all' && yearFilter !== 'all'
              ? `${MONTH_NAMES[Number(monthFilter) - 1]} / ${yearFilter}`
              : monthFilter !== 'all'
              ? `${MONTH_NAMES[Number(monthFilter) - 1]}`
              : yearFilter !== 'all'
              ? `Ano ${yearFilter}`
              : 'Histórico Completo'} • {totalCount} {totalCount === 1 ? 'pedido listado' : 'pedidos listados'}
          </div>
        </div>

        {/* Resumo Integrado de Status dos Pedidos */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="px-4 py-2.5 sm:px-5 sm:py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Status & Fluxo da Carteira
            </span>
            <span className="text-[11px] font-mono font-medium text-slate-400">
              {allOrdersData?.length || 0} pedidos no filtro
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            {/* Total Vendido (Destaque em 2 colunas no mobile) */}
            <div className="col-span-2 sm:col-span-1 p-3.5 sm:p-4.5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors bg-slate-50/30 sm:bg-transparent">
              <div className="mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Total Vendido
                </span>
              </div>
              <div>
                <div className="text-xl sm:text-lg lg:text-xl font-extrabold font-mono text-slate-900 tracking-tight">
                  R$ {totalSold.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 block">Volume comercial</span>
              </div>
            </div>

            {/* Pendentes */}
            <div className="p-3 sm:p-4.5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate block">
                  Pendentes
                </span>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-extrabold font-mono text-slate-900 tracking-tight">
                  {countPending}
                </div>
                <span className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 block truncate">Em validação</span>
              </div>
            </div>

            {/* Aprovados */}
            <div className="p-3 sm:p-4.5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate block">
                  Aprovados
                </span>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-extrabold font-mono text-slate-900 tracking-tight">
                  {countApproved}
                </div>
                <span className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 block truncate">Liberados</span>
              </div>
            </div>

            {/* Faturados */}
            <div className="p-3 sm:p-4.5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate block">
                  Faturados
                </span>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-extrabold font-mono text-slate-900 tracking-tight">
                  {countInvoiced}
                </div>
                <span className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 block truncate">Liquidados</span>
              </div>
            </div>

            {/* Entregues */}
            <div className="p-3 sm:p-4.5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate block">
                  Entregues
                </span>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-extrabold font-mono text-slate-900 tracking-tight">
                  {countDelivered}
                </div>
                <span className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 block truncate">Finalizados</span>
              </div>
            </div>

            {/* Cancelados */}
            <div className="p-3 sm:p-4.5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate block">
                  Cancelados
                </span>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-extrabold font-mono text-slate-900 tracking-tight">
                  {countCancelled}
                </div>
                <span className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 block truncate">Recusados</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabela de Pedidos */}
        <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
          <div className="p-4 border-b flex flex-col md:flex-row gap-3 justify-between items-center bg-muted/20">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por pedido ou cliente..."
                className="pl-9 h-9.5 text-xs bg-background"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9.5 text-xs font-semibold gap-1.5">
                    <Filter className="h-3.5 w-3.5" />
                    Filtrar Status
                    {statusFilter !== 'all' && (
                      <span className="ml-1 h-2 w-2 rounded-full bg-primary" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 space-y-3 p-4" align="end">
                  <div className="space-y-1">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">Status do Pedido</h4>
                    <p className="text-xs text-muted-foreground">Filtre por etapa da venda.</p>
                  </div>
                  <div className="grid gap-3">
                    <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                      <SelectTrigger className="h-8.5 text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os status</SelectItem>
                        <SelectItem value="draft">Rascunho</SelectItem>
                        <SelectItem value="sent">Enviado</SelectItem>
                        <SelectItem value="analysis">Em Análise</SelectItem>
                        <SelectItem value="approved">Aprovado</SelectItem>
                        <SelectItem value="invoiced">Faturado</SelectItem>
                        <SelectItem value="delivered">Entregue</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>

                    {statusFilter !== 'all' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs font-semibold h-8"
                        onClick={() => {
                          setStatusFilter('all');
                          setPage(0);
                        }}
                      >
                        Limpar Filtro de Status
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div>
            {isLoading ? (
              <div className="p-12 text-center text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Carregando pedidos...
              </div>
            ) : ordersError ? (
              <div className="p-12 text-center space-y-2 text-destructive">
                <p className="text-base font-semibold">Não foi possível carregar os pedidos</p>
                <p className="text-xs text-muted-foreground">Tente novamente em instantes.</p>
              </div>
            ) : orders && orders.length > 0 ? (
              <>
                {/* Visualização em Tabela (Desktop) */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Número</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Fabricante / Indústria</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cliente</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Representante</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Data de Emissão</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Valor Total</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => {
                        const style = statusStyles[order.status as OrderStatus] || statusStyles.draft;
                        const mfg = getOrderManufacturerInfo(order);

                        return (
                          <TableRow
                            key={order.id}
                            onClick={() => navigate({ to: '/comercial/pedidos/$id', params: { id: order.id } })}
                            className="hover:bg-muted/50 transition-colors cursor-pointer group"
                          >
                            <TableCell className="font-semibold text-foreground">
                              <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                {order.order_number}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs">
                              {mfg ? (
                                <div className="flex items-center gap-2">
                                  <ManufacturerLogo
                                    name={mfg.name}
                                    logoPath={mfg.logoPath}
                                    size="xs"
                                    className="h-6 w-6 rounded border border-slate-200 shrink-0"
                                  />
                                  <span className="font-semibold text-slate-900 truncate max-w-[150px]" title={mfg.name}>
                                    {mfg.name}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400 font-medium">-</span>
                              )}
                            </TableCell>
                            <TableCell className="font-medium text-xs text-foreground">
                              {order.client ? formatClientDisplayName(order.client) : '-'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              <RepresentativeBadge
                                name={order.representative?.name}
                                photoUrl={order.representative?.photo_url}
                                size="xs"
                                fallbackText="Sistema"
                              />
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {order.created_at ? format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-bold text-sm text-foreground">
                              R$ {Number(order.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs font-semibold text-slate-700">
                                {style.label}
                              </span>
                            </TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" className="h-8 text-xs font-semibold gap-1" asChild>
                                  <Link to="/comercial/pedidos/$id" params={{ id: order.id }}>
                                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                    Detalhes
                                  </Link>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => setOrderToDelete({ id: order.id, order_number: order.order_number })}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Visualização em Cards Verticais (Mobile First) */}
                <div className="md:hidden divide-y divide-slate-100">
                  {orders.map((order) => {
                    const style = statusStyles[order.status as OrderStatus] || statusStyles.draft;
                    const clientName = order.client ? formatClientDisplayName(order.client) : 'Cliente sem identificação';
                    const mfg = getOrderManufacturerInfo(order);

                    return (
                      <div key={order.id} className="p-3.5 bg-white hover:bg-slate-50/50 transition-colors flex flex-col gap-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200/80">
                                {order.order_number}
                              </span>
                              {mfg && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-50 border border-slate-200">
                                  <ManufacturerLogo
                                    name={mfg.name}
                                    logoPath={mfg.logoPath}
                                    size="xs"
                                    className="h-3.5 w-3.5 rounded-xs"
                                  />
                                  <span className="text-[10px] font-bold text-slate-700 truncate max-w-[120px]">
                                    {mfg.name}
                                  </span>
                                </div>
                              )}
                              <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                                {style.label}
                              </span>
                            </div>
                            <Link to="/comercial/pedidos/$id" params={{ id: order.id }}>
                              <h4 className="font-bold text-sm text-slate-900 leading-snug hover:text-primary transition-colors line-clamp-1">
                                {clientName}
                              </h4>
                            </Link>
                            {order.created_at && (
                              <span className="text-[11px] text-slate-400 block mt-0.5">
                                {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </span>
                            )}
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-destructive shrink-0 -mr-1"
                            onClick={() => setOrderToDelete({ id: order.id, order_number: order.order_number })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                              Total
                            </span>
                            <span className="text-sm font-extrabold font-mono text-slate-900">
                              R$ {Number(order.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 ml-auto">
                            <FieldQuickActions
                              phone={order.client?.phone}
                              whatsapp={order.client?.whatsapp}
                              location={{
                                address: order.client?.address,
                                address_number: order.client?.address_number,
                                neighborhood: order.client?.neighborhood,
                                city: order.client?.city,
                                state: order.client?.state,
                              }}
                              clientName={clientName}
                              variant="compact"
                            />
                            <Button variant="outline" size="sm" className="h-7.5 px-2.5 text-xs font-semibold" asChild>
                              <Link to="/comercial/pedidos/$id" params={{ id: order.id }}>
                                Detalhes
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3.5 border-t bg-muted/20">
                    <div className="text-xs text-muted-foreground font-medium">
                      Mostrando <span className="font-semibold text-foreground">{orders.length}</span> de <span className="font-semibold text-foreground">{totalCount}</span> pedidos
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
                      <div className="text-xs font-semibold">
                        Página {page + 1} de {totalPages}
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
                )}
              </>
            ) : (
              <div className="p-12 text-center text-muted-foreground">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <ShoppingCart className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="font-medium text-foreground">Nenhum pedido encontrado</p>
                <p className="text-xs text-muted-foreground mt-1">Crie um novo pedido ou altere os filtros de busca.</p>
              </div>
            )}
          </div>
        </div>

        <AlertDialog open={Boolean(orderToDelete)} onOpenChange={(open) => { if (!open && !deleteOrderMutation.isPending) setOrderToDelete(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir pedido definitivamente?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação removerá completamente o pedido <strong>{orderToDelete?.order_number}</strong> e todos os seus itens, histórico e parcelas associadas. Esta operação é irreversível.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteOrderMutation.isPending}>Voltar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={!orderToDelete || deleteOrderMutation.isPending}
                onClick={(event) => {
                  event.preventDefault();
                  if (!orderToDelete) return;
                  deleteOrderMutation.mutate(orderToDelete.id);
                }}
              >
                {deleteOrderMutation.isPending ? 'Excluindo...' : 'Excluir definitivamente'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Modal de Importação de Pedido via PDF da Indústria */}
        <OrderPDFImportModal
          open={isPdfModalOpen}
          onOpenChange={setIsPdfModalOpen}
        />
      </div>
    </AppLayout>
  );
}
