import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, Target, CheckCircle2, Calculator } from 'lucide-react';

export function CRMIndicators() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['crm-stats'],
    queryFn: async () => {
      const { data: opportunities, error } = await supabase
        .from('opportunities')
        .select('estimated_value, status, probability');

      if (error) throw error;

      const total = opportunities.length;
      const open = opportunities.filter(o => o.status === 'open');
      const won = opportunities.filter(o => o.status === 'won');
      const lost = opportunities.filter(o => o.status === 'lost');

      const valInProgress = open.reduce((acc, curr) => acc + (Number(curr.estimated_value) || 0), 0);
      const valWon = won.reduce((acc, curr) => acc + (Number(curr.estimated_value) || 0), 0);

      const convRate = total > 0 ? (won.length / total) * 100 : 0;
      const avgValue = total > 0 ? (opportunities.reduce((acc, curr) => acc + (Number(curr.estimated_value) || 0), 0) / total) : 0;

      return {
        total,
        open: open.length,
        valInProgress,
        won: won.length,
        valWon,
        lost: lost.length,
        convRate,
        avgValue
      };
    }
  });

  if (isLoading) {
    return (
      <div className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
          Funil de Oportunidades & Pipeline
        </span>
        <span className="text-[11px] font-mono font-medium text-slate-400">
          {stats?.total || 0} negociações rastreadas
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        {/* 1. Valor em Negociação */}
        <div className="p-5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
          <div className="mb-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Pipeline Aberto
            </span>
          </div>
          <div>
            <div className="text-2xl lg:text-3xl font-bold font-mono text-slate-900 tracking-tight">
              R$ {stats?.valInProgress.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {stats?.open} oportunidades ativas
            </div>
          </div>
        </div>

        {/* 2. Taxa de Conversão */}
        <div className="p-5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
          <div className="mb-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Taxa de Conversão
            </span>
          </div>
          <div>
            <div className="text-2xl lg:text-3xl font-bold font-mono text-slate-900 tracking-tight">
              {stats?.convRate.toFixed(1)}%
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {stats?.won} convertidas de {stats?.total}
            </div>
          </div>
        </div>

        {/* 3. Valor Ganho */}
        <div className="p-5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
          <div className="mb-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Fechamentos Ganhos
            </span>
          </div>
          <div>
            <div className="text-2xl lg:text-3xl font-bold font-mono text-slate-900 tracking-tight">
              R$ {stats?.valWon.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Receita líquida ganha
            </div>
          </div>
        </div>

        {/* 4. Ticket Médio */}
        <div className="p-5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
          <div className="mb-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Ticket Médio
            </span>
          </div>
          <div>
            <div className="text-2xl lg:text-3xl font-bold font-mono text-slate-900 tracking-tight">
              R$ {stats?.avgValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Média por oportunidade
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}