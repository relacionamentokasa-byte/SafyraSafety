import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DollarSign, User, Building2, Calendar, Target } from 'lucide-react';
import { formatClientDisplayName } from '@/lib/format-name';
import { RepresentativeBadge } from '@/components/representantes/RepresentativeBadge';

interface OpportunityListProps {
  searchTerm?: string;
  stageFilter?: string;
  dateFilter?: string;
}

export function OpportunityList({ searchTerm, stageFilter, dateFilter }: OpportunityListProps) {
  const { data: opportunities, isLoading } = useQuery({
    queryKey: ['opportunities-list', searchTerm, stageFilter, dateFilter],
    queryFn: async () => {
      let query = supabase
        .from('opportunities')
        .select(`
          *,
          client:clients(name, trade_name, legal_name),
          representative:representatives(id, name, code, photo_url),
          stage:crm_stages(name, color)
        `);

      if (searchTerm) {
        query = query.ilike('title', `%${searchTerm}%`);
      }
      
      if (stageFilter && stageFilter !== 'all') {
        query = query.eq('stage_id', stageFilter);
      }

      if (dateFilter && dateFilter !== 'all') {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
        const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
        const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59).toISOString();

        if (dateFilter === 'this-month') {
          query = query.gte('expected_closing_date', startOfMonth).lte('expected_closing_date', endOfMonth);
        } else if (dateFilter === 'next-month') {
          query = query.gte('expected_closing_date', startOfNextMonth).lte('expected_closing_date', endOfNextMonth);
        } else if (dateFilter === 'overdue') {
          query = query.lt('expected_closing_date', now.toISOString());
        }
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    }
  });

  if (isLoading) return <div className="h-64 flex items-center justify-center">Carregando oportunidades...</div>;

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Oportunidade</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead>Representante</TableHead>
            <TableHead className="text-right">Valor Estimado</TableHead>
            <TableHead className="text-center">Probab.</TableHead>
            <TableHead>Previsão</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {opportunities?.map((opp) => (
            <TableRow 
              key={opp.id} 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => window.location.href = `/comercial/oportunidades/${opp.id}`}
            >
              <TableCell className="font-medium">
                <div className="flex flex-col">
                  <span>{opp.title}</span>
                  <span className="text-[10px] text-muted-foreground uppercase">{opp.origin}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Building2 className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm font-medium">{opp.client ? formatClientDisplayName(opp.client) : '-'}</span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-xs font-semibold text-slate-700">
                  {opp.stage?.name}
                </span>
              </TableCell>
              <TableCell>
                <RepresentativeBadge
                  name={opp.representative?.name}
                  photoUrl={opp.representative?.photo_url}
                  size="xs"
                />
              </TableCell>
              <TableCell className="text-right font-semibold">
                R$ {Number(opp.estimated_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Target className="h-3 w-3 text-muted-foreground" />
                  <span>{opp.probability}%</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  {opp.expected_closing_date ? format(new Date(opp.expected_closing_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {opportunities?.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic">
                Nenhuma oportunidade encontrada.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}