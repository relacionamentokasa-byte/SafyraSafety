import { createFileRoute, Link, useNavigate, useParams } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ChevronLeft, 
  Calendar, 
  DollarSign, 
  User, 
  Building2,
  Clock,
  History,
  CheckCircle2,
  AlertCircle,
  FileText,
  Truck,
  Package,
  CreditCard,
  MoreVertical,
  Printer,
  Copy,
  Trash2,
  MessageSquare,
  Check
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { OrderStatus } from '@/types/database.types';
import { getOrderWhatsAppUrl, generateOrderPayments, getOrderErrorMessage, deleteOrderPermanentlyDirect } from '@/lib/orders.services';
import { useCurrentProfile } from '@/hooks/useCurrentProfile';
import { formatPaymentPlanSchedule } from '@/lib/payment-plans';
import { formatDisplayName } from '@/lib/format';
import { formatClientDisplayName } from '@/lib/format-name';
import { RepresentativeBadge } from '@/components/representantes/RepresentativeBadge';
import type { Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
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
import { Label } from '@/components/ui/label';


export const Route = createFileRoute('/comercial/pedidos/$id')({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Detalhes do Pedido" },
    ],
  }),
  component: OrderDetailsPage,
});

const statusBadges: Record<OrderStatus, { label: string; dotColor: string; className: string }> = {
  draft: { label: "Rascunho", dotColor: "bg-slate-400", className: "bg-slate-50 text-slate-700 border-slate-200" },
  sent: { label: "Enviado", dotColor: "bg-blue-500", className: "bg-blue-50 text-blue-700 border-blue-200" },
  analysis: { label: "Em Análise", dotColor: "bg-amber-500", className: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "Aprovado", dotColor: "bg-emerald-500", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  invoiced: { label: "Faturado", dotColor: "bg-indigo-500", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  delivered: { label: "Entregue", dotColor: "bg-teal-500", className: "bg-teal-50 text-teal-700 border-teal-200" },
  cancelled: { label: "Cancelado", dotColor: "bg-rose-500", className: "bg-rose-50 text-rose-700 border-rose-200" },
};

function OrderDetailsPage() {
  const { id } = useParams({ from: '/comercial/pedidos/$id' });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: currentProfile } = useCurrentProfile();
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [settlementPayment, setSettlementPayment] = useState<any>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  const { data: currentUserRoles = [] } = useQuery({
    queryKey: ['current-user-roles', currentProfile?.id],
    enabled: Boolean(currentProfile?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentProfile!.id);

      if (error) throw error;
      return data.map(({ role }) => role);
    },
  });

  const canApprove = currentUserRoles.some((role) =>
    ['admin', 'gestor_comercial', 'supervisor'].includes(role),
  );
  const canSettlePayment = currentUserRoles.some((role) =>
    ['admin', 'gestor_comercial'].includes(role),
  );

  const transitionOrderMutation = useMutation({
    mutationFn: async ({ status, reason }: { status: OrderStatus; reason?: string }) => {
      const rpcClient = supabase as unknown as {
        rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: Json | null; error: { code?: string; message?: string } | null }>;
      };
      const { data, error } = await rpcClient.rpc('transition_order', {
        p_order_id: id,
        p_to_status: status,
        p_reason: reason || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      setIsCancelDialogOpen(false);
      setIsApproveDialogOpen(false);
      setCancellationReason('');
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      const successMessages: Partial<Record<OrderStatus, string>> = {
        sent: 'Pedido enviado para aprovação.',
        approved: 'Pedido aprovado.',
        cancelled: 'Pedido cancelado.',
        invoiced: 'Pedido faturado.',
        delivered: 'Pedido marcado como entregue.',
      };
      toast.success(successMessages[variables.status] || 'Status do pedido atualizado.');
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      toast.error(getOrderErrorMessage(error));
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async () => {
      await deleteOrderPermanentlyDirect(id);
    },
    onSuccess: () => {
      setIsDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders-all-stats'] });
      toast.success('Pedido excluído com sucesso.');
      navigate({ to: '/comercial/pedidos' });
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir pedido: ' + (error.message || error));
    }
  });

  const { data: order, isLoading, error: orderError } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients(*),
          representative:representatives(id, name, photo_url),
          opportunity:opportunities(title),
          items:order_items(
            *,
            product:products(name, code, sku, unit)
          ),
          history:order_history(*),
          payments:order_payments(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      const history = (data.history || []) as Array<{ user_id?: string | null }>;
      const userIds = [...new Set(history.flatMap((item) => item.user_id ? [item.user_id] : []))];

      if (userIds.length === 0) return data as any;

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
      return {
        ...data,
        history: history.map((item) => ({
          ...item,
          user: item.user_id ? profileById.get(item.user_id) ?? null : null,
        })),
      } as any;
    }
  });

  const generatePaymentsMutation = useMutation({
    mutationFn: async () => {
      if (!order) return;
      if (order.payment_plan_id || order.payment_plan_snapshot) {
        throw new Error('Este pedido já possui uma condição publicada; as parcelas devem ser geradas pela operação segura.');
      }
      return generateOrderPayments(order.id, Number(order.total_amount), order.payment_condition || '1x');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      toast.success('Parcelas geradas com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao gerar parcelas: ' + error.message);
    }
  });

  const updatePaymentStatusMutation = useMutation({
    mutationFn: async ({ paymentId, status }: { paymentId: string, status: string }) => {
      if (status !== 'paid') throw new Error('Status de pagamento não suportado.');

      const rpcClient = supabase as unknown as {
        rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: Json | null; error: Error | null }>;
      };
      const { data, error } = await rpcClient.rpc('settle_order_payment_and_commissions', {
        p_payment_id: paymentId,
        p_received_value: null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setSettlementPayment(null);
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      toast.success('Pagamento baixado e comissão liberada.');
    },
    onError: (error) => {
      toast.error(getOrderErrorMessage(error));
    }
  });


  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando detalhes do pedido...</div>;
  if (orderError) return <div className="p-8 text-center text-destructive">Não foi possível carregar o pedido. Tente novamente.</div>;
  if (!order) return <div className="p-8 text-center text-destructive">Pedido não encontrado.</div>;

  const whatsappUrl = getOrderWhatsAppUrl(order);
  const paymentSnapshot = order.payment_plan_snapshot as {
    method_name?: string;
    name?: string;
    code?: string;
    terms?: Array<{ days_after_order?: number; percentage?: number }>;
  } | null;
  const snapshotPlan = paymentSnapshot?.terms
    ? {
        id: order.payment_plan_id,
        code: paymentSnapshot.code || "",
        name: paymentSnapshot.name || "",
        payment_method_id: null,
        status: "active",
        version: 1,
        valid_from: null,
        valid_until: null,
        installments: paymentSnapshot.terms.map((term, index) => ({
          id: `${order.id}-term-${index}`,
          payment_plan_id: order.payment_plan_id,
          installment_number: index + 1,
          days_after_order: Number(term.days_after_order || 0),
          percentage: Number(term.percentage || 0),
        })),
      }
    : undefined;

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-muted/10">
        <div className="p-4 md:p-8 bg-card border-b space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" asChild className="-ml-2">
              <Link to="/comercial/pedidos">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Voltar para Pedidos
              </Link>
            </Button>
            <div className="flex gap-2">
              {whatsappUrl ? (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="text-green-600 border-green-200 hover:bg-green-50"
                >
                  <a href={whatsappUrl} target="_blank" rel="noreferrer">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    WhatsApp
                  </a>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-green-600 border-green-200 hover:bg-green-50"
                  onClick={() => toast.error('O cliente não possui telefone ou WhatsApp cadastrado.')}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
              <Button variant="outline" size="sm">
                <Copy className="h-4 w-4 mr-2" />
                Duplicar
              </Button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xl md:text-2xl font-black tracking-tight text-foreground bg-muted/60 px-3 py-1 rounded-lg border">
                  {order.order_number}
                </span>
                {(() => {
                  const badge = statusBadges[order.status as OrderStatus] || { label: order.status };
                  return (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md border text-slate-700 bg-slate-50 border-slate-200">
                      {badge.label}
                    </span>
                  );
                })()}
                {order.opportunity && (
                  <span className="text-xs font-medium text-slate-600">
                    Oportunidade: {order.opportunity.title}
                  </span>
                )}
              </div>
              
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-primary" />
                  {order.client ? formatClientDisplayName(order.client) : 'Cliente não informado'}
                </div>
                <div className="flex items-center gap-1.5">
                  <RepresentativeBadge
                    name={order.representative?.name}
                    photoUrl={order.representative?.photo_url}
                    size="xs"
                    fallbackText="Sistema"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-primary" />
                  {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {order.status === 'draft' && (
                <Button
                  className="bg-primary text-white flex-1 md:flex-none"
                  onClick={() => transitionOrderMutation.mutate({ status: 'sent' })}
                  disabled={transitionOrderMutation.isPending}
                >
                  {transitionOrderMutation.isPending ? 'Enviando...' : 'Enviar para Aprovação'}
                </Button>
              )}
              {(order.status === 'sent' || order.status === 'analysis') && canApprove && (
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white flex-1 md:flex-none"
                  onClick={() => setIsApproveDialogOpen(true)}
                  disabled={transitionOrderMutation.isPending}
                >
                  Aprovar Pedido
                </Button>
              )}
              {order.status === 'approved' && canApprove && (
                <Button
                  className="bg-purple-600 hover:bg-purple-700 text-white flex-1 md:flex-none"
                  onClick={() => transitionOrderMutation.mutate({ status: 'invoiced' })}
                  disabled={transitionOrderMutation.isPending}
                >
                  {transitionOrderMutation.isPending ? 'Faturando...' : 'Faturar Pedido'}
                </Button>
              )}
              {order.status === 'invoiced' && canApprove && (
                <Button
                  className="bg-teal-600 hover:bg-teal-700 text-white flex-1 md:flex-none"
                  onClick={() => transitionOrderMutation.mutate({ status: 'delivered' })}
                  disabled={transitionOrderMutation.isPending}
                >
                  {transitionOrderMutation.isPending ? 'Registrando...' : 'Marcar como Entregue'}
                </Button>
              )}
              {order.status !== 'cancelled' && order.status !== 'delivered' && order.status !== 'invoiced' && (
                <Button
                  variant="outline"
                  className="text-destructive border-destructive/20 hover:bg-destructive/10 flex-1 md:flex-none"
                  onClick={() => setIsCancelDialogOpen(true)}
                  disabled={transitionOrderMutation.isPending}
                >
                  Cancelar Pedido
                </Button>
              )}
              <Button
                variant="outline"
                className="text-destructive border-destructive/20 hover:bg-destructive/10 flex-1 md:flex-none"
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={deleteOrderMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Excluir
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border bg-card shadow-2xs space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Subtotal Bruto</span>
              <p className="text-lg font-bold text-muted-foreground line-through">
                R$ {Number(order.subtotal_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-4 rounded-xl border bg-card shadow-2xs space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Desconto Aplicado</span>
              <p className="text-lg font-bold text-destructive">
                - R$ {Number(order.discount_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="relative overflow-hidden p-4 rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-primary">Valor Total Líquido</span>
                <span className="h-2 w-2 rounded-full bg-primary" />
              </div>
              <p className="text-2xl md:text-3xl font-black tracking-tight text-primary">
                R$ {Number(order.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-4 rounded-xl border bg-card shadow-2xs space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Previsão Entrega</span>
              <p className="text-lg font-bold text-foreground">
                {order.expected_delivery_date ? format(new Date(order.expected_delivery_date), 'dd/MM/yyyy', { locale: ptBR }) : 'Não informada'}
              </p>
            </div>
          </div>
        </div>

        <AlertDialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Aprovar pedido</AlertDialogTitle>
              <AlertDialogDescription>
                O pedido será aprovado e ficará disponível para faturamento e baixa financeira.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={transitionOrderMutation.isPending}>Voltar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-green-600 text-white hover:bg-green-700"
                disabled={transitionOrderMutation.isPending}
                onClick={(event) => {
                  event.preventDefault();
                  transitionOrderMutation.mutate({ status: 'approved' });
                }}
              >
                {transitionOrderMutation.isPending ? 'Aprovando...' : 'Confirmar aprovação'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar pedido</AlertDialogTitle>
              <AlertDialogDescription>
                O cancelamento será registrado no histórico e não poderá ser desfeito por esta tela.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="cancellation-reason">Motivo do cancelamento</Label>
              <Textarea
                id="cancellation-reason"
                value={cancellationReason}
                onChange={(event) => setCancellationReason(event.target.value)}
                placeholder="Informe por que este pedido está sendo cancelado"
                disabled={transitionOrderMutation.isPending}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={transitionOrderMutation.isPending}>Voltar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={!cancellationReason.trim() || transitionOrderMutation.isPending}
                onClick={(event) => {
                  event.preventDefault();
                  transitionOrderMutation.mutate({
                    status: 'cancelled',
                    reason: cancellationReason.trim(),
                  });
                }}
              >
                {transitionOrderMutation.isPending ? 'Cancelando...' : 'Confirmar cancelamento'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir pedido definitivamente?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação removerá completamente o pedido <strong>{order.order_number}</strong> e todos os seus itens, histórico e parcelas associadas. Esta operação é irreversível.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteOrderMutation.isPending}>Voltar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteOrderMutation.isPending}
                onClick={(event) => {
                  event.preventDefault();
                  deleteOrderMutation.mutate();
                }}
              >
                {deleteOrderMutation.isPending ? 'Excluindo...' : 'Excluir definitivamente'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={Boolean(settlementPayment)}
          onOpenChange={(open) => {
            if (!open && !updatePaymentStatusMutation.isPending) {
              setSettlementPayment(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar recebimento</AlertDialogTitle>
              <AlertDialogDescription>
                Confirme o recebimento da {settlementPayment?.installment_number}ª parcela no valor de{' '}
                {formatCurrency(Number(settlementPayment?.value || 0))}. A comissão correspondente será gerada após a confirmação do recebimento.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={updatePaymentStatusMutation.isPending}>Voltar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-green-600 text-white hover:bg-green-700"
                disabled={!settlementPayment || updatePaymentStatusMutation.isPending}
                onClick={(event) => {
                  event.preventDefault();
                  if (!settlementPayment) return;
                  updatePaymentStatusMutation.mutate({
                    paymentId: settlementPayment.id,
                    status: 'paid',
                  });
                }}
              >
                {updatePaymentStatusMutation.isPending ? 'Registrando...' : 'Confirmar recebimento'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex-1">
          <Tabs defaultValue="products" className="h-full flex flex-col">
            <div className="px-4 md:px-8 bg-card border-b">
              <TabsList className="h-12 bg-transparent gap-6">
                <TabsTrigger value="products" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Produtos</TabsTrigger>
                <TabsTrigger value="commercial" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Condições Comerciais</TabsTrigger>
                <TabsTrigger value="notes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Observações</TabsTrigger>
                <TabsTrigger value="payments" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 text-primary font-bold">Parcelas e Recebimentos</TabsTrigger>
                <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Histórico</TabsTrigger>
              </TabsList>
            </div>

            <div className="p-4 md:p-8 flex-1">
              <TabsContent value="products" className="m-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      Itens do Pedido
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="relative overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/40 border-b">
                          <tr>
                            <th className="px-4 py-3">Cód</th>
                            <th className="px-4 py-3">Produto & Tabela</th>
                            <th className="px-4 py-3 text-center">Qtd</th>
                            <th className="px-4 py-3 text-right">Preço Un.</th>
                            <th className="px-4 py-3 text-right">Desconto</th>
                            <th className="px-4 py-3 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {order.items?.map((item: any) => (
                            <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground font-semibold">{item.product?.code || item.product?.sku}</td>
                              <td className="px-4 py-3">
                                <p className="font-semibold text-foreground">{formatDisplayName(item.product?.name)}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-muted-foreground uppercase font-bold bg-muted px-1.5 py-0.5 rounded">{item.product?.unit}</span>
                                  {(() => {
                                    const pricingSnapshot = item.pricing_snapshot as {
                                      price_table_name?: string;
                                      price_table_code?: string | null;
                                      price_table_item_id?: string | null;
                                    } | null;
                                    const tableName = pricingSnapshot?.price_table_name;
                                    const tableCode = pricingSnapshot?.price_table_code;
                                    return tableName ? (
                                      <span className="text-[11px] font-semibold text-primary inline-flex items-center gap-1">
                                        • Tabela: {tableName}{tableCode ? ` (${tableCode})` : ""}
                                      </span>
                                    ) : null;
                                  })()}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-foreground">{Number(item.quantity)}</td>
                              <td className="px-4 py-3 text-right font-medium text-foreground">R$ {Number(item.unit_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              <td className="px-4 py-3 text-right text-destructive font-medium">- R$ {Number(item.discount_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              <td className="px-4 py-3 text-right font-extrabold text-foreground">R$ {Number(item.subtotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-muted/30 border-t">
                          <tr>
                            <td colSpan={5} className="px-4 py-3.5 text-right font-bold text-muted-foreground uppercase tracking-wider text-xs">Total do Pedido</td>
                            <td className="px-4 py-3.5 text-right font-extrabold text-primary text-lg">
                              R$ {Number(order.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="commercial" className="m-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary" />
                        Pagamento
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Forma de Pagamento</p>
                        <p className="text-sm font-medium">{paymentSnapshot?.method_name || order.payment_method || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Condição de Pagamento</p>
                        <p className="text-sm font-medium">{paymentSnapshot?.name || paymentSnapshot?.code || order.payment_condition || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Vencimentos</p>
                        <p className="text-sm font-medium">
                          {snapshotPlan ? formatPaymentPlanSchedule(snapshotPlan) : order.payment_term || '-'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Truck className="h-4 w-4 text-primary" />
                        Entrega
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Data Prevista</p>
                        <p className="text-sm font-medium">
                          {order.expected_delivery_date ? format(new Date(order.expected_delivery_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="notes" className="m-0 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Comercial</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.commercial_notes || 'Nenhuma observação.'}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-primary/5 border-primary/20">
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Interna (Não visível ao cliente)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.internal_notes || 'Nenhuma observação interna.'}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.billing_notes || 'Nenhuma observação para faturamento.'}</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="payments" className="m-0 space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      Parcelas do Pedido
                    </CardTitle>
                    {(order.status === 'invoiced' || order.status === 'approved') && !order.payment_plan_id && !order.payment_plan_snapshot && (!order.payments || order.payments.length === 0) && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => generatePaymentsMutation.mutate()}
                        disabled={generatePaymentsMutation.isPending}
                      >
                        {generatePaymentsMutation.isPending ? 'Gerando...' : 'Gerar Parcelas'}
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {order.payments && order.payments.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/40 border-b">
                            <tr>
                              <th className="px-4 py-3">Parc.</th>
                              <th className="px-4 py-3">Vencimento</th>
                              <th className="px-4 py-3 text-right">Valor</th>
                              <th className="px-4 py-3 text-center">Status</th>
                              <th className="px-4 py-3 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {order.payments.sort((a: any, b: any) => a.installment_number - b.installment_number).map((pay: any) => (
                              <tr key={pay.id} className="hover:bg-muted/20 transition-colors">
                                <td className="px-4 py-3 font-bold text-foreground">{pay.installment_number}ª Parcela</td>
                                <td className="px-4 py-3 font-medium text-foreground">{formatDate(pay.due_date)}</td>
                                <td className="px-4 py-3 text-right font-extrabold text-foreground">{formatCurrency(Number(pay.value))}</td>
                                <td className="px-4 py-3 text-center">
                                  {pay.status === 'paid' ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                      Pago
                                    </span>
                                  ) : pay.status === 'pending' ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                      Pendente
                                    </span>
                                  ) : (
                                    <Badge variant="secondary">
                                      {pay.status}
                                    </Badge>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {canSettlePayment
                                    && ['approved', 'invoiced', 'delivered'].includes(order.status)
                                    && ['pending', 'overdue'].includes(pay.status) && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 h-8 px-2.5 font-semibold text-xs"
                                      onClick={() => setSettlementPayment(pay)}
                                      disabled={updatePaymentStatusMutation.isPending}
                                    >
                                      <Check className="h-3.5 w-3.5 mr-1" />
                                      Registrar recebimento
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground italic">
                        Nenhuma parcela gerada para este pedido.
                        <br/>
                        {order.payment_plan_id || order.payment_plan_snapshot
                          ? 'A condição publicada deve gerar as parcelas automaticamente na criação do pedido.'
                          : order.status === 'approved' || order.status === 'invoiced'
                            ? 'Clique em "Gerar Parcelas" para iniciar o controle de recebimentos.'
                            : 'Aguarde a aprovação/faturamento do pedido para gerar as parcelas.'}
                      </div>
                    )}
                  </CardContent>
                </Card>

              </TabsContent>

              <TabsContent value="history" className="m-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <History className="h-4 w-4 text-primary" />
                      Linha do Tempo do Pedido
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {order.history?.map((item: any, i: number) => (
                        <div key={item.id} className="flex gap-4 relative">
                          {i !== order.history.length - 1 && <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-muted" />}
                          <div className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center text-white shrink-0 z-10 bg-muted-foreground/30"
                          )}>
                            <Clock className="h-4 w-4" />
                          </div>
                          <div className="flex-1 pb-4">
                            <p className="text-sm font-bold">{item.action}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">{item.user?.full_name || 'Sistema'}</span>
                              <span className="text-xs text-muted-foreground">•</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                              </span>
                            </div>
                            {item.new_status && (
                              <div className="mt-2">
                                {(() => {
                                  const badge = statusBadges[item.new_status as OrderStatus] || { label: item.new_status, dotColor: "bg-slate-400", className: "bg-slate-50 text-slate-700 border-slate-200" };
                                  return (
                                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shadow-2xs", badge.className)}>
                                      <span className={cn("h-1.5 w-1.5 rounded-full", badge.dotColor)} />
                                      {badge.label}
                                    </span>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {(!order.history || order.history.length === 0) && (
                        <div className="text-center py-8 text-muted-foreground italic">Nenhum histórico registrado.</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
