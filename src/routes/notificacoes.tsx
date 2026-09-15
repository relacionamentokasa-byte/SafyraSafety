import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { useState, useEffect } from 'react';
import { 
  getNotifications, 
  markAsRead, 
  markAllAsRead 
} from '@/lib/notifications.services';
import { Notification, NotificationType } from '@/types/database.types';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Filter, 
  Bell, 
  Calendar, 
  Clock, 
  TrendingUp, 
  Package, 
  DollarSign, 
  AlertCircle,
  Check,
  CheckCheck,
  ChevronRight
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

export const Route = createFileRoute('/notificacoes')({
  component: NotificationsPage,
});

function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const navigate = useNavigate();

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getNotifications();
      setNotifications(data);
    } catch (error: any) {
      toast.error("Erro ao carregar notificações: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    await markAsRead(id);
    loadData();
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    toast.success("Todas as notificações marcadas como lidas");
    loadData();
  };

  const filteredNotifications = notifications.filter(n => {
    const matchesType = filterType === 'all' || n.type === filterType;
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'unread' ? !n.is_read : n.is_read);
    return matchesType && matchesStatus;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'visita': return <Calendar className="h-5 w-5" />;
      case 'follow_up': return <Clock className="h-5 w-5" />;
      case 'oportunidade': return <TrendingUp className="h-5 w-5" />;
      case 'pedido': return <Package className="h-5 w-5" />;
      case 'meta': return <TrendingUp className="h-5 w-5" />;
      case 'comissao': return <DollarSign className="h-5 w-5" />;
      default: return <AlertCircle className="h-5 w-5" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgente': return 'text-red-500 bg-red-50 border-red-200';
      case 'importante': return 'text-orange-500 bg-orange-50 border-orange-200';
      case 'atencao': return 'text-blue-500 bg-blue-50 border-blue-200';
      default: return 'text-slate-500 bg-slate-50 border-slate-200';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Central de Notificações</h1>
            <p className="text-muted-foreground text-sm">Fique por dentro das últimas atualizações e alertas do sistema.</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleMarkAllAsRead} disabled={!notifications.some(n => !n.is_read)}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Marcar todas como lidas
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3 border-b">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar notificações..." className="pl-9" />
              </div>
              <div className="flex gap-2">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="visita">Visitas</SelectItem>
                    <SelectItem value="follow_up">Follow-ups</SelectItem>
                    <SelectItem value="oportunidade">Oportunidades</SelectItem>
                    <SelectItem value="pedido">Pedidos</SelectItem>
                    <SelectItem value="meta">Metas</SelectItem>
                    <SelectItem value="comissao">Comissões</SelectItem>
                    <SelectItem value="sistema">Sistema</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="unread">Não lidas</SelectItem>
                    <SelectItem value="read">Lidas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : filteredNotifications.length > 0 ? (
              <div className="divide-y divide-border">
                {filteredNotifications.map((n) => (
                  <div 
                    key={n.id}
                    className={cn(
                      "group p-4 flex gap-4 hover:bg-muted/50 transition-all cursor-pointer relative",
                      !n.is_read && "bg-primary/5 border-l-4 border-l-primary"
                    )}
                    onClick={() => {
                      if (!n.is_read) handleMarkAsRead(n.id);
                      if (n.related_record_id && n.related_record_type) {
                         // Ação direta dependendo do tipo
                      }
                    }}
                  >
                    <div className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center shrink-0 border",
                      getPriorityColor(n.priority)
                    )}>
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className={cn("text-sm font-semibold", !n.is_read && "text-primary")}>{n.title}</h4>
                          <Badge variant="outline" className="text-[10px] uppercase font-bold py-0 h-4">
                            {n.type}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(n.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 max-w-2xl">
                        {n.message}
                      </p>
                    </div>
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                       <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center space-y-4">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Bell className="h-8 w-8 text-muted-foreground opacity-20" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-medium">Nenhuma notificação encontrada</h3>
                  <p className="text-sm text-muted-foreground">Tente ajustar seus filtros ou volte mais tarde.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
