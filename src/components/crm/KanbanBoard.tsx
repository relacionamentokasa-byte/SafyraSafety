import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CRMStage, Opportunity } from '@/types/database.types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, DollarSign, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getCrmStages } from '@/lib/crm.services';
import { formatClientDisplayName } from '@/lib/format-name';
import { RepresentativeBadge } from '@/components/representantes/RepresentativeBadge';

interface KanbanBoardProps {
  searchTerm?: string;
  stageFilter?: string;
  dateFilter?: string;
}

export function KanbanBoard({ searchTerm, stageFilter, dateFilter }: KanbanBoardProps) {
  const queryClient = useQueryClient();

  const { data: stages } = useQuery({
    queryKey: ['crm-stages'],
    queryFn: async () => {
      return await getCrmStages();
    }
  });

  const { data: opportunities } = useQuery({
    queryKey: ['opportunities-kanban', searchTerm, stageFilter, dateFilter],
    queryFn: async () => {
      let query = supabase
        .from('opportunities')
        .select(`
          *,
          client:clients(name, trade_name, legal_name),
          representative:representatives(id, name, code, photo_url)
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

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    }
  });

  const moveOpportunity = useMutation({
    mutationFn: async ({ id, stageId }: { id: string, stageId: string }) => {
      const { error } = await supabase
        .from('opportunities')
        .update({ stage_id: stageId, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['crm-stats'] });
    }
  });

  if (!stages) return <div>Carregando funil...</div>;

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-320px)] min-h-[500px]">
      {stages.map(stage => {
        const stageOpps = opportunities?.filter(o => o.stage_id === stage.id) || [];
        const stageTotal = stageOpps.reduce((acc, curr) => acc + (Number(curr.estimated_value) || 0), 0);

        return (
          <div key={stage.id} className="flex-shrink-0 w-80 flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-sm bg-slate-400" />
                <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-700">{stage.name}</h3>
                <span className="font-mono text-xs font-semibold text-slate-400">({stageOpps.length})</span>
              </div>
            </div>

            <div className="text-[11px] font-mono text-slate-500 px-2">
              Total: R$ {stageTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>

            <div className="flex-1 bg-slate-100/70 border border-slate-200/70 rounded-xl p-2.5 space-y-3 overflow-y-auto">
              {stageOpps.map(opp => (
                <OpportunityCard key={opp.id} opportunity={opp} />
              ))}
              {stageOpps.length === 0 && (
                <div className="h-24 border-2 border-dashed rounded-lg flex items-center justify-center text-xs text-muted-foreground italic">
                  Sem oportunidades
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OpportunityCard({ opportunity }: { opportunity: any }) {
  const isOverdue = opportunity.next_action_date && new Date(opportunity.next_action_date) < new Date();
  
  return (
    <Card 
      className="cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all shadow-sm group"
      onClick={() => window.location.href = `/comercial/oportunidades/${opportunity.id}`}
    >
      <CardContent className="p-3 space-y-3">
        <div className="flex justify-between items-start gap-2">
          <h4 className="font-semibold text-sm group-hover:text-primary transition-colors line-clamp-2">
            {opportunity.title}
          </h4>
          {isOverdue && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
        </div>

        <div className="space-y-1">
          <div className="flex items-center text-xs text-muted-foreground">
            <User className="h-3 w-3 mr-1 shrink-0" />
            <span className="truncate font-medium text-foreground">
              {opportunity.client ? formatClientDisplayName(opportunity.client) : 'Cliente não informado'}
            </span>
          </div>
          <div className="flex items-center text-xs text-muted-foreground pt-0.5">
            <RepresentativeBadge
              name={opportunity.representative?.name}
              photoUrl={opportunity.representative?.photo_url}
              size="xs"
              fallbackText="Não atribuído"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center font-bold text-sm text-primary font-mono">
            <DollarSign className="h-3 w-3" />
            {Number(opportunity.estimated_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] font-mono font-semibold text-slate-500">
            {opportunity.probability}%
          </span>
        </div>

        {opportunity.next_action_description && (
          <div className={cn(
            "mt-2 p-2 rounded text-[10px] border",
            isOverdue ? "bg-red-50 border-red-100 text-red-700" : "bg-blue-50 border-blue-100 text-blue-700"
          )}>
            <p className="font-semibold uppercase text-[9px] mb-1">Próxima Ação:</p>
            <p className="line-clamp-1">{opportunity.next_action_description}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}