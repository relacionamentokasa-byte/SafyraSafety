import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  AlertCircle, 
  Clock, 
  Calendar, 
  TrendingUp,
  ChevronRight
} from "lucide-react";
import { Notification } from '@/types/database.types';
import { getNotifications } from '@/lib/notifications.services';
import { cn } from '@/lib/utils';
import { useNavigate } from '@tanstack/react-router';

export function MyAttention() {
  const [alerts, setAlerts] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const data = await getNotifications(10); // Limitamos a busca
        // Filter for "Attention" items: unread and priority >= attention
        const attentionItems = data.filter(n => 
          !n.is_read && (n.priority === 'urgente' || n.priority === 'importante' || n.priority === 'atencao')
        ).slice(0, 5);
        setAlerts(attentionItems);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return null;
  if (alerts.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-primary animate-pulse" />
          <CardTitle className="text-sm font-bold text-primary uppercase tracking-wider">Minha Atenção</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-primary/10">
          {alerts.map((alert) => (
            <div 
              key={alert.id}
              className="px-4 py-3 flex items-center justify-between hover:bg-primary/10 cursor-pointer transition-colors group"
              onClick={() => navigate({ to: '/notificacoes' })}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  "h-2 w-2 rounded-full shrink-0",
                  alert.priority === 'urgente' ? "bg-red-500" : "bg-primary"
                )} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{alert.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{alert.message}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-primary/40 group-hover:text-primary transition-colors" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
