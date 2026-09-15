import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Plus, Target, TrendingUp, Users, AlertCircle, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GoalForm } from '@/components/metas/GoalForm';
import { toast } from 'sonner';
import { RepresentativeBadge } from '@/components/representantes/RepresentativeBadge';

const months = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

export const Route = createFileRoute('/comercial/metas/')({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Metas Comerciais" },
      { name: "description", content: "Acompanhamento de metas e performance comercial." },
    ],
  }),
  component: GoalsPage,
});

function GoalsPage() {
  const [open, setOpen] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<{ id: string; repName: string; period: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: goals, isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: async () => {
      const { data: goalsData, error: goalsError } = await supabase
        .from('goals')
        .select(`
          *,
          representative:representatives(
            id,
            name,
            code,
            photo_url,
            user_id
          )
        `)
        .order('created_at', { ascending: false });

      if (goalsError) throw goalsError;
      if (!goalsData || goalsData.length === 0) return [];

      // Busca pedidos confirmados em tempo real para sincronizar o realizado por representante, mês e ano
      const { data: ordersData } = await supabase
        .from('orders')
        .select('representative_id, total_amount, status, created_at')
        .not('status', 'in', '("cancelled","draft")');

      return goalsData.map((goal: any) => {
        const matchingOrders = (ordersData || []).filter((o: any) => {
          if (!o.created_at || o.representative_id !== goal.representative_id) return false;
          const orderDate = new Date(o.created_at);
          const orderMonth = orderDate.getMonth() + 1;
          const orderYear = orderDate.getFullYear();
          return orderMonth === Number(goal.month) && orderYear === Number(goal.year);
        });

        const realTimeSales = matchingOrders.reduce(
          (sum: number, o: any) => sum + (Number(o.total_amount) || 0),
          0
        );

        const finalAchieved = realTimeSales > 0 ? realTimeSales : (Number(goal.achieved_value) || 0);

        return {
          ...goal,
          achieved_value: finalAchieved,
          orders_count: matchingOrders.length,
        };
      });
    }
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', goalId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Meta comercial excluída com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setGoalToDelete(null);
    },
    onError: (err: any) => {
      toast.error(`Erro ao excluir meta: ${err.message || 'Falha na operação'}`);
    }
  });

  const totalTarget = goals?.reduce((acc, g) => acc + Number(g.target_value), 0) || 0;
  const totalAchieved = goals?.reduce((acc, g) => acc + Number(g.achieved_value), 0) || 0;
  const percent = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

  const aboveMeta = goals?.filter(g => Number(g.achieved_value) >= Number(g.target_value)).length || 0;
  const belowMeta = goals?.filter(g => Number(g.achieved_value) < Number(g.target_value)).length || 0;

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">Metas Comerciais</h1>
            <p className="text-sm text-slate-500 mt-1">Acompanhe a performance por representante, período e percentual atingido.</p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground font-semibold shadow-xs">
                <Plus className="h-4 w-4 mr-2" />
                Nova Meta
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Nova Meta Comercial</DialogTitle>
                <DialogDescription>
                  Defina um objetivo de vendas para um representante em um período específico.
                </DialogDescription>
              </DialogHeader>
              <GoalForm
                onSuccess={() => {
                  setOpen(false);
                  queryClient.invalidateQueries({ queryKey: ['goals'] });
                }}
                onCancel={() => setOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Painel Integrado Bento Grid: Indicadores de Metas */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden shrink-0">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Objetivos & Performance de Vendas
            </span>
            <span className="text-[11px] font-mono font-medium text-slate-400">
              {goals?.length || 0} metas ativas
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            {/* Meta Total */}
            <div className="p-5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Meta Total
                </span>
              </div>
              <div>
                <div className="text-2xl lg:text-3xl font-extrabold font-mono text-slate-900 tracking-tight">
                  {formatCurrency(totalTarget)}
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                  <span>Planejado para o período</span>
                </div>
              </div>
            </div>

            {/* Realizado */}
            <div className="p-5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Realizado ({percent.toFixed(1)}%)
                </span>
              </div>
              <div>
                <div className="text-2xl lg:text-3xl font-extrabold font-mono text-slate-900 tracking-tight">
                  {formatCurrency(totalAchieved)}
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                  <span>Volume consolidado de vendas</span>
                </div>
              </div>
            </div>

            {/* Acima da Meta */}
            <div className="p-5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Acima da Meta
                </span>
              </div>
              <div>
                <div className="text-2xl lg:text-3xl font-extrabold font-mono text-slate-900 tracking-tight">
                  {aboveMeta}
                  <span className="text-sm font-sans font-normal text-slate-400 ml-1.5">vendedores</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                  <span>Superando os objetivos</span>
                </div>
              </div>
            </div>

            {/* Abaixo da Meta */}
            <div className="p-5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Abaixo da Meta
                </span>
              </div>
              <div>
                <div className="text-2xl lg:text-3xl font-extrabold font-mono text-slate-900 tracking-tight">
                  {belowMeta}
                  <span className="text-sm font-sans font-normal text-slate-400 ml-1.5">vendedores</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                  <span>Necessitam acompanhamento</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900">Progresso por Representante</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="text-center py-8 text-sm text-slate-500">Carregando metas...</div>
            ) : goals?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma meta cadastrada.</div>
            ) : (
              goals?.map((goal) => {
                const goalPercent = Number(goal.target_value) > 0 ? (Number(goal.achieved_value) / Number(goal.target_value)) * 100 : 0;
                const remaining = Math.max(0, Number(goal.target_value) - Number(goal.achieved_value));
                const monthName = months.find(m => m.value === goal.month.toString())?.label || goal.month;
                const repName = goal.representative?.name || 'Representante não identificado';
                const periodLabel = `${monthName}/${goal.year}`;

                return (
                  <div key={goal.id} className="p-4 rounded-lg border border-slate-100 bg-slate-50/30 space-y-2.5 hover:border-slate-200 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-slate-800 text-sm flex items-center gap-3">
                        <RepresentativeBadge
                          name={repName}
                          photoUrl={goal.representative?.photo_url}
                          size="sm"
                        />
                        <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-100 rounded font-medium">
                          {periodLabel}
                        </span>
                        {goal.orders_count !== undefined && goal.orders_count > 0 && (
                          <span className="text-[11px] text-slate-400 font-normal">
                            ({goal.orders_count} {goal.orders_count === 1 ? 'pedido' : 'pedidos'})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm text-right">
                          <span className="font-bold text-slate-900">{formatCurrency(Number(goal.achieved_value))}</span>
                          <span className="text-slate-400 mx-1">/</span>
                          <span className="text-slate-500">{formatCurrency(Number(goal.target_value))}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Excluir meta"
                          onClick={() => setGoalToDelete({
                            id: goal.id,
                            repName,
                            period: periodLabel,
                          })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Progress value={goalPercent} className="h-2" />
                    <div className="flex justify-between text-xs text-slate-500">
                      <span className="font-mono">{goalPercent.toFixed(1)}% atingido</span>
                      {remaining > 0 ? (
                        <span>Faltam {formatCurrency(remaining)} para a meta</span>
                      ) : (
                        <span className="text-emerald-600 font-semibold">Meta batida!</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Confirmação de Exclusão de Meta */}
      <AlertDialog open={!!goalToDelete} onOpenChange={(open) => !open && setGoalToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Meta Comercial</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a meta de <strong className="text-slate-900">{goalToDelete?.repName}</strong> referente ao período <strong className="text-slate-900">{goalToDelete?.period}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteGoalMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
              disabled={deleteGoalMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (goalToDelete?.id) {
                  deleteGoalMutation.mutate(goalToDelete.id);
                }
              }}
            >
              {deleteGoalMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir Meta'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}