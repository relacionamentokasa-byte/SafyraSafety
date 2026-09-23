import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Plus, Target, TrendingUp, Users, AlertCircle, Trash2, Loader2, Factory, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { useState, useMemo } from 'react';
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
import { fetchGoalsServer, deleteGoalServer } from '@/lib/orders.functions';
import { ManufacturerLogo } from '@/components/manufacturers/ManufacturerLogo';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
      { name: "description", content: "Acompanhamento de metas e performance comercial por representante e fabricante." },
    ],
  }),
  component: GoalsPage,
});

function GoalsPage() {
  const [open, setOpen] = useState(false);
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('ALL');
  const [goalToDelete, setGoalToDelete] = useState<{ id: string; repName: string; period: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: goals, isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: async () => {
      try {
        const res = await fetchGoalsServer();
        if (res && res.length > 0) return res;
      } catch (err) {
        console.warn("fetchGoalsServer fallback:", err);
      }

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

      if (goalsError) {
        console.error("Goals client fetch error:", goalsError);
        return [];
      }
      if (!goalsData || goalsData.length === 0) return [];

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
      try {
        const res = await deleteGoalServer({ data: { goalId } });
        if (res && res.success) return res;
      } catch (errServer) {
        console.warn("[deleteGoalMutation] Server function fallback:", errServer);
      }

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

  // Filtro de metas por Fabricante
  const filteredGoals = useMemo(() => {
    if (!goals) return [];
    if (selectedManufacturer === 'ALL') return goals;
    if (selectedManufacturer === 'GENERAL') return goals.filter(g => !g.manufacturer_id);
    return goals.filter(g => g.manufacturer_id === selectedManufacturer);
  }, [goals, selectedManufacturer]);

  const totalTarget = filteredGoals.reduce((acc, g) => acc + Number(g.target_value || 0), 0);
  const totalAchieved = filteredGoals.reduce((acc, g) => acc + Number(g.achieved_value || 0), 0);
  const percent = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

  const aboveMeta = filteredGoals.filter(g => Number(g.achieved_value) >= Number(g.target_value)).length;
  const belowMeta = filteredGoals.filter(g => Number(g.achieved_value) < Number(g.target_value)).length;

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">Metas Comerciais</h1>
            <p className="text-sm text-slate-500 mt-1">Acompanhe a performance por representante, fabricante e período em tempo real.</p>
          </div>

          <div className="flex items-center gap-3">
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
                    Defina um objetivo de vendas por representante e fabricante (Libus, Medix, Nutriex).
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
        </div>

        {/* Painel Integrado Bento Grid: Indicadores de Metas */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden shrink-0">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Objetivos & Performance de Vendas
              </span>
              <span className="text-[11px] font-mono font-medium text-slate-400">
                ({filteredGoals.length} {filteredGoals.length === 1 ? 'meta ativa' : 'metas ativas'})
              </span>
            </div>

            {/* Filtro Rápido por Fabricante */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Filtrar por Linha:</span>
              <Select value={selectedManufacturer} onValueChange={setSelectedManufacturer}>
                <SelectTrigger className="h-8 text-xs w-[200px] bg-white">
                  <SelectValue placeholder="Todos os Fabricantes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Fabricantes</SelectItem>
                  <SelectItem value="GENERAL">Geral (Sem Fabricante Específico)</SelectItem>
                  <SelectItem value="8273b7a2-d5af-4486-80ae-b649266099d4">Nutriex Profissional</SelectItem>
                  <SelectItem value="e901d2b0-fb01-4f4b-98a3-2e59939067c2">Libus do Brasil</SelectItem>
                  <SelectItem value="cf9b3a9d-9ff6-4d6f-86be-02457c7f7f0f">Medix Brasil</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            {/* Meta Total */}
            <div className="p-5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Meta Total
                </span>
              </div>
              <div className="space-y-1">
                <div className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900 tracking-tight whitespace-nowrap">
                  {formatCurrency(totalTarget)}
                </div>
                <div className="text-xs text-slate-500">
                  Planejado para o filtro atual
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
              <div className="space-y-1">
                <div className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900 tracking-tight whitespace-nowrap">
                  {formatCurrency(totalAchieved)}
                </div>
                <div className="text-xs text-slate-500">
                  Faturamento apurado nos pedidos
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
              <div className="space-y-1">
                <div className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900 tracking-tight">
                  {aboveMeta}
                  <span className="text-sm font-sans font-normal text-slate-400 ml-1.5">metas batidas</span>
                </div>
                <div className="text-xs text-slate-500">
                  Superando os objetivos
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
              <div className="space-y-1">
                <div className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900 tracking-tight">
                  {belowMeta}
                  <span className="text-sm font-sans font-normal text-slate-400 ml-1.5">metas pendentes</span>
                </div>
                <div className="text-xs text-slate-500">
                  Necessitam acompanhamento
                </div>
              </div>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-bold text-slate-900">Progresso Detalhado por Representante & Fabricante</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8 text-sm text-slate-500">Carregando metas comerciais...</div>
            ) : filteredGoals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhuma meta encontrada para o filtro selecionado.
              </div>
            ) : (
              filteredGoals.map((goal: any) => {
                const goalPercent = Number(goal.target_value) > 0 ? (Number(goal.achieved_value) / Number(goal.target_value)) * 100 : 0;
                const remaining = Math.max(0, Number(goal.target_value) - Number(goal.achieved_value));
                const monthName = months.find(m => m.value === goal.month.toString())?.label || goal.month;
                const repName = goal.representative?.name || 'Representante não identificado';
                const periodLabel = `${monthName}/${goal.year}`;
                const manufacturerName = goal.manufacturer?.trade_name || goal.manufacturer?.name;

                return (
                  <div key={goal.id} className="p-4 rounded-xl border border-slate-200/80 bg-white space-y-3 hover:border-slate-300 hover:shadow-xs transition-all">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <RepresentativeBadge
                          name={repName}
                          photoUrl={goal.representative?.photo_url}
                          size="sm"
                          nameClassName="truncate text-xs sm:text-sm font-semibold max-w-[140px] sm:max-w-none text-slate-900"
                        />

                        {/* Badge de Fabricante */}
                        {goal.manufacturer ? (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-blue-800 text-[11px] font-medium shrink-0">
                            <ManufacturerLogo
                              logoPath={goal.manufacturer.logo_path}
                              name={manufacturerName}
                              className="h-3.5 w-3.5"
                              imageClassName="max-h-3 max-w-3"
                            />
                            <span className="truncate max-w-[120px]">{manufacturerName}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-600 px-2 py-0.5 bg-slate-100 rounded-md font-medium shrink-0">
                            Meta Geral
                          </span>
                        )}

                        <span className="text-[11px] text-slate-500 px-1.5 py-0.5 bg-slate-50 border border-slate-200/60 rounded font-mono shrink-0">
                          {periodLabel}
                        </span>

                        {goal.orders_count !== undefined && goal.orders_count > 0 && (
                          <span className="text-[11px] text-slate-400 font-normal shrink-0">
                            ({goal.orders_count} {goal.orders_count === 1 ? 'pedido' : 'pedidos'})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                        <div className="text-xs sm:text-sm font-mono whitespace-nowrap">
                          <span className="font-bold text-slate-900">{formatCurrency(Number(goal.achieved_value))}</span>
                          <span className="text-slate-400 mx-1.5">/</span>
                          <span className="text-slate-500">{formatCurrency(Number(goal.target_value))}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                          title="Excluir meta"
                          onClick={() => setGoalToDelete({
                            id: goal.id,
                            repName: `${repName}${manufacturerName ? ` (${manufacturerName})` : ''}`,
                            period: periodLabel,
                          })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <Progress value={goalPercent} className="h-2" />
                    <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-500">
                      <span className="font-mono font-semibold text-slate-700">{goalPercent.toFixed(1)}% atingido</span>
                      {remaining > 0 ? (
                        <span className="truncate">Faltam {formatCurrency(remaining)} para a meta</span>
                      ) : (
                        <span className="text-emerald-600 font-semibold">Meta batida com sucesso! 🎉</span>
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
      <AlertDialog open={!!goalToDelete} onOpenChange={(isOpen) => { if (!isOpen) setGoalToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Meta Comercial</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a meta de <strong className="text-slate-900">{goalToDelete?.repName}</strong> referente ao período <strong className="text-slate-900">{goalToDelete?.period}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteGoalMutation.isPending}
              onClick={() => setGoalToDelete(null)}
            >
              Cancelar
            </AlertDialogCancel>
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