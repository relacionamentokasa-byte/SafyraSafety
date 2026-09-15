import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function ClientOpportunitiesTab({ clientId }: { clientId: string }) {
  const { data: opportunities, isLoading } = useQuery({
    queryKey: ['client-opportunities', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          *,
          stage:crm_stages(name, color),
          representative:representatives(name)
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as any[];
    }
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando oportunidades...</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Oportunidade</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Representante</TableHead>
              <TableHead>Previsão</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {opportunities?.map((opp) => (
              <TableRow key={opp.id}>
                <TableCell className="font-medium">{opp.title}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    style={{ borderColor: opp.stage?.color, color: opp.stage?.color }}
                  >
                    {opp.stage?.name || 'Proposta'}
                  </Badge>
                </TableCell>
                <TableCell>R$ {Number(opp.estimated_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>{opp.representative?.name || '-'}</TableCell>
                <TableCell>
                  {opp.expected_closing_date ? format(new Date(opp.expected_closing_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                </TableCell>
                <TableCell>
                  <Badge variant={opp.status === 'won' ? 'default' : opp.status === 'lost' ? 'destructive' : 'secondary'}>
                    {opp.status === 'open' ? 'Aberta' : opp.status === 'won' ? 'Ganha' : 'Perdida'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {opportunities?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground italic">
                  Nenhuma oportunidade para este cliente.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
