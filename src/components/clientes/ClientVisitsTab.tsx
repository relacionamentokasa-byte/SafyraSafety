import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, MapPin, User, Calendar, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/utils';

export function ClientVisitsTab({ clientId }: { clientId: string }) {
  const { data: visits, isLoading } = useQuery({
    queryKey: ['client-visits', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visits')
        .select(`
          *,
          representative:representatives(name)
        `)
        .eq('client_id', clientId)
        .order('scheduled_at', { ascending: false });

      if (error) throw error;
      return data as any[];
    }
  });

  const statusColors = {
    scheduled: "bg-blue-500",
    completed: "bg-green-500",
    cancelled: "bg-destructive"
  };

  const statusLabels = {
    scheduled: "Agendada",
    completed: "Concluída",
    cancelled: "Cancelada"
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando histórico de visitas...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" asChild>
          <Link to="/campo/visitas/novo" search={{ clientId }}>
            <Plus className="mr-2 h-4 w-4" />
            Agendar Visita
          </Link>
        </Button>
      </div>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data e Hora</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Observações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visits?.map((visit) => (
              <TableRow key={visit.id}>
                <TableCell className="font-medium whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {visit.scheduled_at ? format(new Date(visit.scheduled_at), "dd/MM/yyyy", { locale: ptBR }) : '-'}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      {visit.scheduled_at ? format(new Date(visit.scheduled_at), "HH:mm", { locale: ptBR }) : '-'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-medium">
                      {visit.representative?.name || 'Representante'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={cn("text-[10px] px-2 py-0.5", statusColors[visit.status as keyof typeof statusColors])}>
                    {statusLabels[visit.status as keyof typeof statusLabels] || visit.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                  {visit.notes || <span className="italic opacity-50">Sem observações</span>}
                </TableCell>
              </TableRow>
            ))}
            {visits?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground space-y-2">
                    <MapPin className="h-8 w-8 opacity-20" />
                    <p className="text-sm italic">Nenhuma visita registrada para este cliente.</p>
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
