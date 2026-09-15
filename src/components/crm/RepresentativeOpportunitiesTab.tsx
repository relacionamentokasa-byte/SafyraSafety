import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatClientDisplayName } from '@/lib/format-name';

export function RepresentativeOpportunitiesTab({ representativeId }: { representativeId: string }) {
  const { data: opportunities, isLoading } = useQuery({
    queryKey: ['representative-opportunities', representativeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          *,
          stage:crm_stages(name, color),
          client:clients(name)
        `)
        .eq('representative_id', representativeId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as any[];
    }
  });

  if (isLoading) return <div className="p-4 text-center">Carregando oportunidades...</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Oportunidade</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Previsão</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {opportunities?.map((opp) => (
              <TableRow key={opp.id}>
                <TableCell className="font-medium">{opp.title}</TableCell>
                <TableCell>{opp.client ? formatClientDisplayName(opp.client) : '-'}</TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    style={{ borderColor: opp.stage?.color, color: opp.stage?.color }}
                  >
                    {opp.stage?.name}
                  </Badge>
                </TableCell>
                <TableCell>R$ {Number(opp.estimated_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
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
                  Nenhuma oportunidade para este representante.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}