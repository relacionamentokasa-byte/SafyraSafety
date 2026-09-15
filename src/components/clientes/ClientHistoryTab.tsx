import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MapPin, ShoppingBag, CheckCircle2, History } from 'lucide-react';
import { cn } from "@/lib/utils";

export function ClientHistoryTab({ clientId }: { clientId: string }) {
  const { data: historyItems = [], isLoading } = useQuery({
    queryKey: ['client-history-timeline', clientId],
    queryFn: async () => {
      // Buscar visitas, pedidos e follow-ups em paralelo
      const [visitsRes, ordersRes, followUpsRes] = await Promise.all([
        supabase.from('visits').select('id, scheduled_at, status, notes, representative:representatives(name)').eq('client_id', clientId),
        supabase.from('orders').select('id, order_number, total_amount, status, created_at, representative:representatives(name)').eq('client_id', clientId),
        supabase.from('follow_ups').select('id, scheduled_at, description, status, representative:representatives(name)').eq('client_id', clientId)
      ]);

      const events: Array<{
        id: string;
        type: 'visit' | 'order' | 'followup';
        title: string;
        date: Date;
        user: string;
        icon: any;
        color: string;
        details?: string;
      }> = [];

      visitsRes.data?.forEach((v: any) => {
        if (v.scheduled_at) {
          events.push({
            id: v.id,
            type: 'visit',
            title: `Visita (${v.status === 'completed' ? 'Realizada' : v.status === 'scheduled' ? 'Agendada' : 'Cancelada'})`,
            date: new Date(v.scheduled_at),
            user: v.representative?.name || 'Representante',
            icon: MapPin,
            color: v.status === 'completed' ? 'bg-green-500' : 'bg-blue-500',
            details: v.notes || ''
          });
        }
      });

      ordersRes.data?.forEach((o: any) => {
        if (o.created_at) {
          events.push({
            id: o.id,
            type: 'order',
            title: `Pedido ${o.order_number || o.id.substring(0, 8)} - R$ ${Number(o.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            date: new Date(o.created_at),
            user: o.representative?.name || 'Comercial',
            icon: ShoppingBag,
            color: 'bg-primary',
            details: `Status: ${o.status}`
          });
        }
      });

      followUpsRes.data?.forEach((f: any) => {
        if (f.scheduled_at) {
          events.push({
            id: f.id,
            type: 'followup',
            title: 'Follow-up Registrado',
            date: new Date(f.scheduled_at),
            user: f.representative?.name || 'Comercial',
            icon: CheckCircle2,
            color: 'bg-purple-500',
            details: f.description || ''
          });
        }
      });

      // Ordenar do mais recente para o mais antigo
      events.sort((a, b) => b.date.getTime() - a.date.getTime());
      return events;
    }
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando linha do tempo...</div>;

  if (historyItems.length === 0) {
    return (
      <Card className="bg-card">
        <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-2">
          <History className="h-8 w-8 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground italic">Nenhuma atividade registrada no histórico deste cliente.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Linha do Tempo de Atividades</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {historyItems.map((item, i) => (
            <div key={item.id} className="flex gap-4 relative">
              {i !== historyItems.length - 1 && <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-muted" />}
              <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-white shrink-0 z-10 shadow-sm", item.color)}>
                <item.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 pb-4">
                <p className="text-sm font-bold text-foreground">{item.title}</p>
                {item.details && <p className="text-xs text-muted-foreground mt-0.5">{item.details}</p>}
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs font-medium text-muted-foreground">{item.user}</span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">
                    {format(item.date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
