import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search, History, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useDeferredValue } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute('/configuracoes/auditoria')({
  component: AuditLogPage,
});

function AuditLogPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [moduleFilter, setModuleFilter] = useState('all');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data: auditData, isLoading } = useQuery({
    queryKey: ['audit-logs', moduleFilter, deferredSearch, page],
    queryFn: async () => {
      let query = supabase
        .from('activity_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (moduleFilter !== 'all') {
        query = query.eq('entity_type', moduleFilter);
      }

      if (deferredSearch) {
        query = query.or(`action.ilike.%${deferredSearch}%,entity_type.ilike.%${deferredSearch}%`);
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data, count };
    },
    staleTime: 1000 * 60 * 5,
  });

  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const logs = auditData?.data || [];
  const totalCount = auditData?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const getActionBadge = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
      case 'insert':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Criação</Badge>;
      case 'update':
      case 'edit':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Edição</Badge>;
      case 'delete':
      case 'deactivate':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Exclusão</Badge>;
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  const handleViewDetails = (log: any) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Auditoria</h1>
          <p className="text-muted-foreground">
            Rastreabilidade de ações e logs do sistema Safyra Safety.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle>Histórico de Atividades</CardTitle>
                <CardDescription>Visualização detalhada da rastreabilidade</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar logs..."
                    className="pl-8 w-full sm:w-[250px]"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={moduleFilter} onValueChange={setModuleFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Módulo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="client">Clientes</SelectItem>
                    <SelectItem value="order">Pedidos</SelectItem>
                    <SelectItem value="product">Produtos</SelectItem>
                    <SelectItem value="opportunity">Oportunidades</SelectItem>
                    <SelectItem value="representative">Representantes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : logs && logs.length > 0 ? (
              <div className="space-y-4">
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Identificador</TableHead>
                        <TableHead>Módulo</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Detalhes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow
                          key={log.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleViewDetails(log)}
                        >
                          <TableCell className="text-sm text-nowrap">
                            {log.created_at && format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {log.user_id ? log.user_id.substring(0, 8) + '...' : 'Sistema'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {(() => {
                                const entityMap: Record<string, string> = {
                                  'client': 'Cliente', 'clients': 'Clientes',
                                  'order': 'Pedido', 'orders': 'Pedidos',
                                  'product': 'Produto', 'products': 'Produtos',
                                  'representative': 'Representante', 'representatives': 'Representantes',
                                  'region': 'Região', 'regions': 'Regiões',
                                  'visit': 'Visita', 'visits': 'Visitas',
                                  'user': 'Usuário', 'users': 'Usuários',
                                  'commission': 'Comissão', 'commissions': 'Comissões',
                                  'opportunity': 'Oportunidade', 'opportunities': 'Oportunidades',
                                  'material': 'Material', 'materials': 'Materiais',
                                  'manufacturer': 'Fabricante', 'manufacturers': 'Fabricantes',
                                  'category': 'Categoria', 'categories': 'Categorias',
                                  'price_table': 'Tabela de Preço',
                                  'company_settings': 'Configurações',
                                };
                                return entityMap[log.entity_type] || log.entity_type;
                              })()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {getActionBadge(log.action)}
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate text-sm">
                            {log.details ?
                              (typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details))
                              : 'Sem detalhes'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2 bg-muted/20 rounded-md">
                    <div className="text-xs text-muted-foreground">
                      Total: {totalCount} registros
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
                      <span className="text-xs font-medium">
                        {page + 1} / {totalPages}
                      </span>
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
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                <History className="h-10 w-10 text-muted-foreground opacity-20" />
                <p className="text-muted-foreground">Não existem registros de auditoria para este período.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes da Atividade</DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Data/Hora</p>
                    <p className="font-medium">{selectedLog.created_at && format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Módulo</p>
                    <Badge variant="outline">{(() => {
                      const entityMap: Record<string, string> = {
                        'client': 'Cliente', 'clients': 'Clientes',
                        'order': 'Pedido', 'orders': 'Pedidos',
                        'product': 'Produto', 'products': 'Produtos',
                        'representative': 'Representante',
                        'region': 'Região', 'visit': 'Visita',
                        'user': 'Usuário', 'commission': 'Comissão',
                        'opportunity': 'Oportunidade',
                        'material': 'Material', 'manufacturer': 'Fabricante',
                        'category': 'Categoria', 'price_table': 'Tabela de Preço',
                        'company_settings': 'Configurações',
                      };
                      return entityMap[selectedLog.entity_type] || selectedLog.entity_type;
                    })()}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ação</p>
                    <p>{getActionBadge(selectedLog.action)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">ID do Usuário</p>
                    <p className="font-mono text-xs">{selectedLog.user_id || 'Sistema'}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium border-b pb-1">Alterações Detalhadas</p>
                  <pre className="p-4 bg-muted rounded-md text-xs overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
