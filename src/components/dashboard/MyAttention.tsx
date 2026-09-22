import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Bell,
  ChevronRight,
  Package,
  Zap,
  DollarSign,
  Calendar,
  Clock,
  TrendingUp,
  Check,
  ExternalLink,
  ShieldAlert
} from "lucide-react";
import { Notification } from '@/types/database.types';
import { getNotifications, markAsRead } from '@/lib/notifications.services';
import { cn } from '@/lib/utils';
import { useNavigate, Link } from '@tanstack/react-router';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function MyAttention() {
  const [alerts, setAlerts] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadNotifications = async () => {
    try {
      const data = await getNotifications(15);
      // Filtra alertas não lidos de atenção ou prioritários
      const attentionItems = data.filter(n => !n.is_read).slice(0, 4);
      setAlerts(attentionItems);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await markAsRead(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return null;
  if (alerts.length === 0) return null;

  const getNotificationIcon = (type: string, title: string) => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('pedido') || type === 'pedido') {
      return <Package className="h-4 w-4 text-blue-600" />;
    }
    if (lowerTitle.includes('comissão') || lowerTitle.includes('faturamento') || type === 'comissao') {
      return <DollarSign className="h-4 w-4 text-emerald-600" />;
    }
    if (lowerTitle.includes('visita') || type === 'visita') {
      return <Calendar className="h-4 w-4 text-indigo-600" />;
    }
    if (lowerTitle.includes('push') || lowerTitle.includes('alerta') || type === 'alerta') {
      return <Zap className="h-4 w-4 text-amber-600" />;
    }
    return <Bell className="h-4 w-4 text-slate-600" />;
  };

  const getNotificationBadgeClass = (type: string, title: string) => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('pedido') || type === 'pedido') return 'bg-blue-50 border-blue-200/80';
    if (lowerTitle.includes('comissão') || type === 'comissao') return 'bg-emerald-50 border-emerald-200/80';
    if (lowerTitle.includes('visita') || type === 'visita') return 'bg-indigo-50 border-indigo-200/80';
    if (lowerTitle.includes('push') || type === 'alerta') return 'bg-amber-50 border-amber-200/80';
    return 'bg-slate-100 border-slate-200';
  };

  const cleanTitle = (rawTitle: string) => {
    // Remove emojis no início do texto para visual mais limpo e corporativo
    return rawTitle.replace(/^[\p{Emoji}\s]+/gu, '').trim();
  };

  return (
    <Card className="border border-slate-200/90 shadow-sm bg-white overflow-hidden rounded-xl">
      <CardHeader className="py-2.5 px-3.5 bg-slate-50/80 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell className="h-3.5 w-3.5 text-slate-700" />
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
            Avisos Pendentes
          </span>
          <span className="text-[10px] font-semibold bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">
            {alerts.length}
          </span>
        </div>

        <Link
          to="/notificacoes"
          className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-0.5"
        >
          Ver todas
          <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>

      <CardContent className="p-0 divide-y divide-slate-100">
        {alerts.map((alert) => {
          const timeAgo = formatDistanceToNow(new Date(alert.created_at), {
            addSuffix: true,
            locale: ptBR,
          });

          return (
            <div
              key={alert.id}
              onClick={() => {
                if (alert.link) {
                  navigate({ to: alert.link });
                } else {
                  navigate({ to: '/notificacoes' });
                }
              }}
              className="p-3 hover:bg-slate-50/80 cursor-pointer transition-colors group flex items-start justify-between gap-3 relative"
            >
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                {/* Ícone estilizado */}
                <div
                  className={cn(
                    "h-7 w-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5",
                    getNotificationBadgeClass(alert.type, alert.title)
                  )}
                >
                  {getNotificationIcon(alert.type, alert.title)}
                </div>

                {/* Conteúdo do Aviso */}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-900 truncate leading-snug">
                      {cleanTitle(alert.title)}
                    </p>
                    <span className="text-[10px] text-slate-600 shrink-0 font-medium font-mono">
                      {timeAgo}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 line-clamp-1 leading-relaxed">
                    {alert.message}
                  </p>
                </div>
              </div>

              {/* Ação rápida de marcar como lido */}
              <button
                type="button"
                onClick={(e) => handleDismiss(e, alert.id)}
                title="Marcar como lido"
                className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-emerald-600 p-1 rounded-md hover:bg-emerald-50 transition-all shrink-0 mt-0.5"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
