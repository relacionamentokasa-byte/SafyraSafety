import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ShoppingBag, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@tanstack/react-router';

export function ClientOrdersTab({ clientId }: { clientId: string }) {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['client-orders', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          representative:representatives(name)
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as any[];
    }
  });

  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    draft: { label: 'Rascunho', variant: 'secondary' },
    pending_approval: { label: 'Pendente', variant: 'outline' },
    approved: { label: 'Aprovado', variant: 'default' },
    processing: { label: 'Em Processamento', variant: 'secondary' },
    invoiced: { label: 'Faturado', variant: 'default' },
    shipped: { label: 'Enviado', variant: 'default' },
    delivered: { label: 'Entregue', variant: 'default' },
    cancelled: { label: 'Cancelado', variant: 'destructive' },
    rejected: { label: 'Rejeitado', variant: 'destructive' },
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando histórico de pedidos...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" asChild>
          <Link to="/comercial/pedidos/novo" search={{ client_id: clientId, opportunity_id: "" }}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Pedido
          </Link>
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número / ID</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Representante</TableHead>
              <TableHead>Valor Total</TableHead>
              <TableHead>Condição</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders?.map((order) => (
              <TableRow key={order.id} className="hover:bg-muted/50">
                <TableCell className="font-mono text-xs font-bold">
                  <Link to="/comercial/pedidos/$id" params={{ id: order.id }} className="hover:underline text-primary">
                    {order.order_number || order.id.substring(0, 8)}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">
                  {order.created_at ? format(new Date(order.created_at), "dd/MM/yyyy", { locale: ptBR }) : '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {order.representative?.name || '-'}
                </TableCell>
                <TableCell className="text-sm font-semibold">
                  R$ {Number(order.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {order.payment_condition || order.payment_method || '-'}
                </TableCell>
                <TableCell>
                  <Badge variant={statusMap[order.status]?.variant || "secondary"} className="text-[10px]">
                    {statusMap[order.status]?.label || order.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {orders?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground space-y-2">
                    <ShoppingBag className="h-8 w-8 opacity-20" />
                    <p className="text-sm italic">Nenhum pedido registrado para este cliente.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
