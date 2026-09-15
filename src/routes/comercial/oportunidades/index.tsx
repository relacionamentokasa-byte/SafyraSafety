import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LayoutGrid, List, Plus, Filter, Search, X } from 'lucide-react';
import { CRMIndicators } from '@/components/crm/CRMIndicators';
import { KanbanBoard } from '@/components/crm/KanbanBoard';
import { OpportunityList } from '@/components/crm/OpportunityList';
import { OpportunityForm } from '@/components/crm/OpportunityForm';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCrmStages } from '@/lib/crm.services';

export const Route = createFileRoute('/comercial/oportunidades/')({
  head: () => ({
    meta: [
      { title: "Safyra Safety | CRM e Oportunidades" },
      { name: "description", content: "Gestão do funil comercial e oportunidades de vendas." },
    ],
  }),
  component: OpportunitiesPage,
});

function OpportunitiesPage() {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados dos filtros
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  const { data: stages } = useQuery({
    queryKey: ['crm-stages-list'],
    queryFn: async () => {
      return await getCrmStages();
    }
  });

  const activeFiltersCount = (stageFilter !== 'all' ? 1 : 0) + (dateFilter !== 'all' ? 1 : 0);


  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">Oportunidades</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie seu funil de vendas, etapas de negociação e previsão de fechamentos.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar oportunidade..."
                className="pl-9 h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary" className="ml-2 px-1.5 h-5 min-w-5 rounded-full bg-primary text-primary-foreground">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none">Filtrar Funil</h4>
                  <p className="text-xs text-muted-foreground">Refine as oportunidades exibidas.</p>
                </div>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>Etapa do Funil</Label>
                    <Select value={stageFilter} onValueChange={setStageFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas as etapas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as etapas</SelectItem>
                        {stages?.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Previsão de Fechamento</Label>
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Qualquer data" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Qualquer data</SelectItem>
                        <SelectItem value="this-month">Este Mês</SelectItem>
                        <SelectItem value="next-month">Próximo Mês</SelectItem>
                        <SelectItem value="overdue">Atrasadas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs h-8"
                    onClick={() => {
                      setStageFilter('all');
                      setDateFilter('all');
                    }}
                  >
                    Limpar Filtros
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-1 bg-white shadow-xs">
              <Button
                variant={view === 'kanban' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('kanban')}
                className={view === 'kanban' ? "h-8 px-3 font-semibold text-xs bg-slate-900 text-white" : "h-8 px-3 font-medium text-xs text-slate-600 hover:text-slate-900"}
              >
                <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
                Kanban
              </Button>
              <Button
                variant={view === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('list')}
                className={view === 'list' ? "h-8 px-3 font-semibold text-xs bg-slate-900 text-white" : "h-8 px-3 font-medium text-xs text-slate-600 hover:text-slate-900"}
              >
                <List className="h-3.5 w-3.5 mr-1.5" />
                Lista
              </Button>
            </div>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground font-semibold shadow-xs">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Oportunidade
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <OpportunityForm onSuccess={() => setIsFormOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <CRMIndicators />

        {view === 'kanban' ? (
          <KanbanBoard 
            searchTerm={searchTerm} 
            stageFilter={stageFilter} 
            dateFilter={dateFilter} 
          />
        ) : (
          <OpportunityList 
            searchTerm={searchTerm} 
            stageFilter={stageFilter} 
            dateFilter={dateFilter} 
          />
        )}
      </div>
    </AppLayout>
  );
}
