import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ResponsiveModal } from '@/components/common/ResponsiveModal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Wallet, CheckCircle2, Clock, AlertTriangle, Check, Calendar, Loader2, ShieldCheck, DollarSign } from 'lucide-react';
import { ManufacturerLogo } from '@/components/manufacturers/ManufacturerLogo';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { formatClientDisplayName } from '@/lib/format-name';
import { RepresentativeBadge } from '@/components/representantes/RepresentativeBadge';
import { fetchCommissionsServer } from '@/lib/orders.functions';

export const Route = createFileRoute('/comercial/comissoes/')({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Comissões" },
      { name: "description", content: "Gestão e extrato de comissões de vendas por mês, fabricante e liquidação." },
    ],
  }),
  component: CommissionsPage,
});

const statusMap = {
  pending: {
    label: 'Aguardando Liquidação',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    icon: Clock,
  },
  approved: {
    label: 'Liberada para Repasse',
    badgeClass: 'bg-primary/10 text-primary border-primary/20 font-semibold',
    icon: CheckCircle2,
  },
  scheduled: {
    label: 'Repasse Agendado',
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    icon: Calendar,
  },
  paid: {
    label: 'Comissão Paga',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    icon: CheckCircle2,
  },
  cancelled: {
    label: 'Cancelada',
    badgeClass: 'bg-destructive/10 text-destructive border-destructive/20',
    icon: AlertTriangle,
  },
};

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function CommissionsPage() {
  const queryClient = useQueryClient();
  const currentDate = new Date();

  // Filtros
  const [selectedMonth, setSelectedMonth] = useState<string>(String(currentDate.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState<string>(String(currentDate.getFullYear()));
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [manufacturerFilter, setManufacturerFilter] = useState<string>('all');

  // Estado para modal de pagamento da comissão ao representante
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState<any | null>(null);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>('PIX');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  const { data: manufacturers } = useQuery({
    queryKey: ['manufacturers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manufacturers')
        .select('id, name, logo_path, default_commission_rate, payout_day_of_month')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  const { data: commissions, isLoading } = useQuery({
    queryKey: ['commissions'],
    queryFn: async () => {
      try {
        const res = await fetchCommissionsServer({ data: {} });
        if (res && res.length > 0) return res;
      } catch (err) {
        console.warn("fetchCommissionsServer fallback:", err);
      }

      const { data, error } = await supabase
        .from('commissions')
        .select(`
          *,
          representative:representatives(
            id,
            name,
            photo_url
          ),
          order_payment:order_payment_id(
            id,
            installment_number,
            due_date,
            received_at,
            order:orders(
              id,
              order_number,
              created_at,
              client:clients(name, trade_name, legal_name)
            )
          ),
          manufacturer:manufacturers(id, name, logo_path, default_commission_rate, payout_day_of_month)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as any[];
    }
  });

  // Mutation para registrar pagamento de comissão ao representante
  const markAsPaidMutation = useMutation({
    mutationFn: async ({ id, paymentDate, paymentMethod, paymentNotes }: { id: string, paymentDate: string, paymentMethod: string, paymentNotes: string }) => {
      const { data, error } = await supabase
        .from('commissions')
        .update({
          status: 'paid',
          payment_date: paymentDate,
          payment_method: paymentMethod,
          payment_notes: paymentNotes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Comissão marcada como paga com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      setPayModalOpen(false);
      setSelectedCommission(null);
      setPaymentNotes('');
    },
    onError: (err: any) => {
      toast.error(`Erro ao registrar pagamento: ${err.message || 'Falha na operação'}`);
    }
  });

  // Filtros aplicados
  const filteredCommissions = useMemo(() => {
    if (!commissions) return [];

    return commissions.filter((c) => {
      // No modelo de liquidez, a data de referência para competência é a data de vencimento/recebimento da duplicata
      const refDateStr = c.order_payment?.due_date || c.order_payment?.received_at || c.created_at;
      const refDate = new Date(refDateStr);

      if (selectedYear !== 'all') {
        if (refDate.getFullYear() !== Number(selectedYear)) return false;
      }

      if (selectedMonth !== 'all') {
        if (refDate.getMonth() + 1 !== Number(selectedMonth)) return false;
      }

      if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }

      if (manufacturerFilter !== 'all' && c.manufacturer_id !== manufacturerFilter) {
        return false;
      }

      return true;
    });
  }, [commissions, selectedMonth, selectedYear, statusFilter, manufacturerFilter]);

  // Totais do período filtrado
  const totalPending = filteredCommissions.filter(c => c.status === 'pending').reduce((acc, c) => acc + Number(c.commission_value || 0), 0);
  const totalReleased = filteredCommissions.filter(c => c.status === 'approved' || c.status === 'scheduled').reduce((acc, c) => acc + Number(c.commission_value || 0), 0);
  const totalPaid = filteredCommissions.filter(c => c.status === 'paid').reduce((acc, c) => acc + Number(c.commission_value || 0), 0);
  const totalPeriod = totalPending + totalReleased + totalPaid;

  const years = useMemo(() => {
    const currentY = new Date().getFullYear();
    return [String(currentY - 1), String(currentY), String(currentY + 1)];
  }, []);

  const handleOpenPayModal = (commission: any) => {
    setSelectedCommission(commission);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('PIX');
    setPaymentNotes('');
    setPayModalOpen(true);
  };

  const handleConfirmPayment = () => {
    if (!selectedCommission) return;
    markAsPaidMutation.mutate({
      id: selectedCommission.id,
      paymentDate,
      paymentMethod,
      paymentNotes
    });
  };

  const currentMonthLabel = selectedMonth === 'all' ? 'Todos os meses' : MONTH_NAMES[Number(selectedMonth) - 1];

  return (
    <AppLayout>
      <div className="space-y-6 w-full mx-auto">
        {/* Header com Identidade Safyra */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
              Extrato de Comissões & Repasses
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Acompanhamento de liquidez por fabricante e repasses aos representantes comerciais.
            </p>
          </div>
        </div>

        {/* Painel Integrado: Indicadores de Liquidez e Comissões */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden shrink-0">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Balanço de Comissões & Liquidez
            </span>
            <span className="text-[11px] font-mono font-medium text-slate-400">
              {filteredCommissions.length} lançamentos apurados
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            {/* Liberado para Repasse */}
            <div className="p-3.5 sm:p-5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-1.5 sm:mb-2">
                <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate block">
                  Liberado p/ Repasse
                </span>
              </div>
              <div>
                <div className="text-lg sm:text-2xl lg:text-3xl font-bold font-mono text-slate-900 tracking-tight truncate">
                  {formatCurrency(totalReleased)}
                </div>
                <div className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-slate-400 truncate">
                  Faturas liquidadas
                </div>
              </div>
            </div>

            {/* Aguardando Liquidação */}
            <div className="p-3.5 sm:p-5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-1.5 sm:mb-2">
                <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate block">
                  Aguardando Liq.
                </span>
              </div>
              <div>
                <div className="text-lg sm:text-2xl lg:text-3xl font-bold font-mono text-slate-900 tracking-tight truncate">
                  {formatCurrency(totalPending)}
                </div>
                <div className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-slate-400 truncate">
                  Parcelas a vencer
                </div>
              </div>
            </div>

            {/* Comissões Pagas */}
            <div className="p-3.5 sm:p-5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-1.5 sm:mb-2">
                <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate block">
                  Comissões Pagas
                </span>
              </div>
              <div>
                <div className="text-lg sm:text-2xl lg:text-3xl font-bold font-mono text-slate-900 tracking-tight truncate">
                  {formatCurrency(totalPaid)}
                </div>
                <div className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-slate-400 truncate">
                  Repasses efetuados
                </div>
              </div>
            </div>

            {/* Total Geral Apurado */}
            <div className="p-3.5 sm:p-5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-1.5 sm:mb-2">
                <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate block">
                  Total Apurado
                </span>
              </div>
              <div>
                <div className="text-lg sm:text-2xl lg:text-3xl font-bold font-mono text-slate-900 tracking-tight truncate">
                  {formatCurrency(totalPeriod)}
                </div>
                <div className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-slate-400 truncate">
                  {filteredCommissions.length} lançamentos
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Filtros Refinada */}
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div className="space-y-1.5 w-full">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Mês de Competência
              </Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-9.5 text-xs font-medium w-full">
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {MONTH_NAMES.map((name, index) => (
                    <SelectItem key={index + 1} value={String(index + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 w-full">
              <Label className="text-xs font-semibold text-muted-foreground">Ano</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="h-9.5 text-xs font-medium w-full">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os anos</SelectItem>
                  {years.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 w-full">
              <Label className="text-xs font-semibold text-muted-foreground">Status do Repasse</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9.5 text-xs font-medium w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="approved">Liberado para Repasse</SelectItem>
                  <SelectItem value="pending">Aguardando Pagamento do Cliente</SelectItem>
                  <SelectItem value="paid">Comissão Paga</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 w-full">
              <Label className="text-xs font-semibold text-muted-foreground">Fabricante</Label>
              <Select value={manufacturerFilter} onValueChange={setManufacturerFilter}>
                <SelectTrigger className="h-9.5 text-xs font-medium w-full">
                  <SelectValue placeholder="Fabricante" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os fabricantes</SelectItem>
                  {manufacturers?.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="flex items-center gap-2">
                        <ManufacturerLogo name={m.name} logoPath={m.logo_path} size="sm" />
                        {m.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:col-span-2 lg:col-span-1">
              <Button
                variant="outline"
                size="sm"
                className="h-9.5 w-full text-xs font-semibold"
                onClick={() => {
                  setSelectedMonth('all');
                  setSelectedYear('all');
                  setStatusFilter('all');
                  setManufacturerFilter('all');
                }}
              >
                Limpar Filtros
              </Button>
            </div>
          </div>
        </div>

        {/* Tabela de Extrato de Comissões com Estilo Fintech */}
        <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Extrato Analítico de Liquidez</h2>
              <Badge variant="outline" className="text-[11px] font-semibold">
                {filteredCommissions.length} registro(s)
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline-block">
              Repasses fixos: Nutriex (dia 15) • Libus (dia 25)
            </span>
          </div>

          <div>
            {isLoading ? (
              <div className="text-center py-12 flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Carregando extrato de comissões...
              </div>
            ) : filteredCommissions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Clock className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="font-medium text-foreground">Nenhuma comissão registrada para este período</p>
                <p className="text-xs text-muted-foreground mt-1">Ajuste os filtros de mês e ano para visualizar outros períodos.</p>
              </div>
            ) : (
              <>
                {/* Mobile Commission Cards (Otimizado para Celular) */}
                <div className="md:hidden divide-y divide-slate-100">
                  {filteredCommissions.map((c) => {
                    const status = statusMap[c.status as keyof typeof statusMap] || statusMap.pending;
                    const order = c.order_payment?.order || c.order;
                    const isPayable = c.status === 'approved' || c.status === 'scheduled';
                    const refDateStr = c.order_payment?.received_at || c.created_at;
                    const refDate = new Date(refDateStr);
                    const payoutDay = c.manufacturer?.payout_day_of_month || (c.manufacturer?.name?.toLowerCase().includes('nutriex') ? 15 : c.manufacturer?.name?.toLowerCase().includes('libus') ? 25 : 20);
                    const nextMonthDate = new Date(refDate.getFullYear(), refDate.getMonth() + 1, payoutDay);
                    const formattedPayoutDate = formatDate(nextMonthDate);

                    return (
                      <div key={c.id} className="p-3.5 space-y-2.5 bg-card hover:bg-slate-50/50 transition-colors">
                        {/* Linha 1: Pedido + Parcela + Fabricante + Status */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200/80">
                              {order?.order_number ? `#${order.order_number}` : 'Sem Ped.'}
                            </span>
                            {c.order_payment?.installment_number && (
                              <span className="text-[10px] font-medium font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                                {c.order_payment.installment_number}ª Parc.
                              </span>
                            )}
                            {c.manufacturer?.name && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700">
                                <ManufacturerLogo name={c.manufacturer.name} logoPath={c.manufacturer.logo_path} size="sm" />
                                {c.manufacturer.name}
                              </span>
                            )}
                          </div>
                          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0", status.badgeClass)}>
                            {status.label}
                          </span>
                        </div>

                        {/* Linha 2: Cliente & Representante */}
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-slate-900 line-clamp-1">
                            {order?.client ? formatClientDisplayName(order.client) : 'Cliente não informado'}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span className="truncate max-w-[120px]">Rep: {c.representative?.name || '-'}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400 shrink-0">
                              <Calendar className="h-3 w-3 text-slate-400" />
                              Prev: {formattedPayoutDate}
                            </span>
                          </div>
                        </div>

                        {/* Linha 3: Valores e Ação */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-medium block">
                              Base {formatCurrency(Number(c.base_value || 0))} ({Number(c.commission_rate || 0).toFixed(1)}%)
                            </span>
                            <span className="text-sm font-extrabold font-mono text-slate-900">
                              {formatCurrency(Number(c.commission_value || 0))}
                            </span>
                          </div>

                          <div className="shrink-0">
                            {isPayable ? (
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7.5 px-2.5 text-xs font-semibold gap-1.5 shadow-xs"
                                onClick={() => handleOpenPayModal(c)}
                              >
                                <Wallet className="h-3.5 w-3.5" />
                                Pagar
                              </Button>
                            ) : c.status === 'paid' ? (
                              <span className="text-[11px] text-emerald-600 font-semibold inline-flex items-center gap-1">
                                <Check className="h-3.5 w-3.5" /> Pago em {formatDate(c.payment_date || c.updated_at)}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                Aguardando liq.
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table (Oculta no Mobile) */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pedido</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Representante</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Fabricante</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cliente</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Base de Cálculo</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center">Taxa</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Valor Comissão</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Prev. Repasse</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCommissions.map((c) => {
                        const status = statusMap[c.status as keyof typeof statusMap] || statusMap.pending;
                        const order = c.order_payment?.order || c.order;
                        const isPayable = c.status === 'approved' || c.status === 'scheduled';

                        const refDateStr = c.order_payment?.received_at || c.created_at;
                        const refDate = new Date(refDateStr);
                        const payoutDay = c.manufacturer?.payout_day_of_month || (c.manufacturer?.name?.toLowerCase().includes('nutriex') ? 15 : c.manufacturer?.name?.toLowerCase().includes('libus') ? 25 : 20);

                        const nextMonthDate = new Date(refDate.getFullYear(), refDate.getMonth() + 1, payoutDay);
                        const formattedPayoutDate = formatDate(nextMonthDate);

                        return (
                          <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-semibold text-foreground">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted">
                                  {order?.order_number || '-'}
                                </span>
                                {c.order_payment?.installment_number && (
                                  <span className="text-[10px] font-medium font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                                    {c.order_payment.installment_number}ª Parc.
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium text-xs">
                              <RepresentativeBadge
                                name={c.representative?.name}
                                photoUrl={c.representative?.photo_url}
                                size="xs"
                                fallbackText="-"
                              />
                            </TableCell>
                            <TableCell>
                              <div className="inline-flex items-center gap-2">
                                <ManufacturerLogo name={c.manufacturer?.name} logoPath={c.manufacturer?.logo_path} size="sm" />
                                <span className="text-xs font-semibold text-foreground">
                                  {c.manufacturer?.name || '-'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                              {order?.client ? formatClientDisplayName(order.client) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-medium text-xs">
                              {formatCurrency(Number(c.base_value || 0))}
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs font-semibold text-slate-700">
                              {Number(c.commission_rate || 0).toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right font-bold text-sm text-foreground">
                              {formatCurrency(Number(c.commission_value || 0))}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs font-semibold text-slate-700">
                                {status.label}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-foreground flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-muted-foreground" />
                                  {formattedPayoutDate}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  Dia {payoutDay} do mês seg.
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {isPayable ? (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-8 text-xs font-semibold gap-1.5 shadow-xs"
                                  onClick={() => handleOpenPayModal(c)}
                                >
                                  <Wallet className="h-3.5 w-3.5" />
                                  Pagar Repasse
                                </Button>
                              ) : c.status === 'paid' ? (
                                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">
                                  <Check className="h-3.5 w-3.5" /> Pago em {formatDate(c.payment_date || c.updated_at)}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">
                                  Aguardando liquidação
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Modal de Registro de Pagamento de Comissão ao Representante (Bottom Sheet no mobile) */}
        <ResponsiveModal
          open={payModalOpen}
          onOpenChange={setPayModalOpen}
          maxContentClass="max-w-md"
          title={
            <div className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Wallet className="h-5 w-5 text-primary" />
              Confirmar Repasse ao Representante
            </div>
          }
        >
          {selectedCommission && (
            <div className="space-y-4 py-1">
              <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200/80 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Representante:</span>
                  <span className="font-semibold text-slate-900">{selectedCommission.representative?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fabricante:</span>
                  <span className="font-semibold text-slate-900">{selectedCommission.manufacturer?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pedido:</span>
                  <span className="font-semibold text-slate-900">{selectedCommission.order_payment?.order?.order_number || selectedCommission.order?.order_number}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-slate-200 font-bold">
                  <span>Valor do Repasse:</span>
                  <span className="text-primary font-mono">{formatCurrency(Number(selectedCommission.commission_value || 0))}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="payDate" className="text-xs font-semibold">Data do Pagamento</Label>
                  <Input
                    id="payDate"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="h-10 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="payMethod" className="text-xs font-semibold">Forma de Pagamento</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger id="payMethod" className="h-10 text-xs">
                      <SelectValue placeholder="Forma de Pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="TED">Transferência Bancária (TED/DOC)</SelectItem>
                      <SelectItem value="Boleto">Boleto</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="payNotes" className="text-xs font-semibold">Observações / Comprovante</Label>
                  <Textarea
                    id="payNotes"
                    placeholder="Chave PIX, código de autenticação bancária ou observações..."
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    rows={3}
                    className="text-xs resize-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPayModalOpen(false)}
                  disabled={markAsPaidMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmPayment}
                  disabled={markAsPaidMutation.isPending}
                  className="gap-2"
                >
                  {markAsPaidMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirmar Pagamento
                </Button>
              </div>
            </div>
          )}
        </ResponsiveModal>
      </div>
    </AppLayout>
  );
}
