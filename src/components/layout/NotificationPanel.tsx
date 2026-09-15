import { useState, useEffect } from 'react';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  ExternalLink, 
  Clock,
  Calendar,
  AlertCircle,
  FileText,
  TrendingUp,
  DollarSign,
  Package,
  X
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { 
  getNotifications, 
  getUnreadNotificationsCount, 
  markAsRead, 
  markAllAsRead 
} from '@/lib/notifications.services';
import { Notification } from '@/types/database.types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from '@tanstack/react-router';
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export function NotificationPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const loadNotifications = async () => {
    try {
      const [data, count] = await Promise.all([
        getNotifications(),
        getUnreadNotificationsCount()
      ]);
      setNotifications(data.slice(0, 5)); // Recent 5
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // Polling for demo, ideally use Realtime
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await markAsRead(id);
    loadNotifications();
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    loadNotifications();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'visita': return <Calendar className="h-4 w-4" />;
      case 'follow_up': return <Clock className="h-4 w-4" />;
      case 'oportunidade': return <TrendingUp className="h-4 w-4" />;
      case 'pedido': return <Package className="h-4 w-4" />;
      case 'meta': return <TrendingUp className="h-4 w-4" />;
      case 'comissao': return <DollarSign className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgente': return 'text-red-500 bg-red-50';
      case 'importante': return 'text-orange-500 bg-orange-50';
      case 'atencao': return 'text-blue-500 bg-blue-50';
      default: return 'text-slate-500 bg-slate-50';
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    setIsOpen(false);
    
    // Direct action logic
    if (notification.related_record_id && notification.related_record_type) {
      switch (notification.related_record_type) {
        case 'pedido':
          navigate({ to: '/comercial/pedidos' } as any);
          break;
        case 'oportunidade':
          navigate({ to: '/comercial/oportunidades/$id', params: { id: notification.related_record_id } as any });
          break;
        case 'cliente':
          navigate({ to: '/clientes/$id', params: { id: notification.related_record_id } as any });
          break;
      }
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] animate-in zoom-in"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-sm">Notificações</h3>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs h-8 px-2 gap-1 text-muted-foreground hover:text-primary"
            onClick={handleMarkAllAsRead}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Marcar todas
          </Button>
        </div>
        <ScrollArea className="h-80">
          {notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((n) => (
                <div 
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    "p-4 cursor-pointer hover:bg-muted transition-colors flex gap-3",
                    !n.is_read && "bg-primary/5"
                  )}
                >
                  <div className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                    getPriorityColor(n.priority)
                  )}>
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("text-xs font-semibold truncate", !n.is_read && "text-primary")}>
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {n.message}
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(n.created_at), "HH:mm '•' dd/MM", { locale: ptBR })}
                      </span>
                      {!n.is_read && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-5 w-5 rounded-full"
                          onClick={(e) => handleMarkAsRead(n.id, e)}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-2">
              <Bell className="h-8 w-8 text-muted-foreground opacity-20" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação por aqui.</p>
            </div>
          )}
        </ScrollArea>
        <div className="p-2 border-t text-center">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full text-xs text-primary font-medium"
            onClick={() => {
              setIsOpen(false);
              navigate({ to: '/notificacoes' });
            }}
          >
            Ver todas as notificações
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
