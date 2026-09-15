import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Loader2,
  Plus,
  MapPin,
  Edit2,
  Power,
  PowerOff,
  Save,
  Trash2,
  Building2,
  Users,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { getRegionsWithClientMetrics, PREDEFINED_REGIONS, RegionSummary } from '@/lib/regions.services';

export const Route = createFileRoute('/configuracoes/regioes/')({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Configuração de Regiões" },
      { name: "description", content: "Gerenciamento e parametrização de macrorregiões comerciais." },
    ],
  }),
  component: RegionsPage,
});

function RegionsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<RegionSummary | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: regions = [], isLoading } = useQuery<RegionSummary[]>({
    queryKey: ['regions-with-clients'],
    queryFn: () => getRegionsWithClientMetrics(),
    staleTime: 1000 * 60 * 2,
  });

  const form = useForm({
    defaultValues: {
      name: '',
      state: '',
      citiesText: '',
      status: 'active' as 'active' | 'inactive',
    },
  });

  const syncPredefinedToDatabase = async () => {
    try {
      setIsSyncing(true);
      for (const region of PREDEFINED_REGIONS) {
        await supabase.from('regions').upsert({
          name: region.name,
          state: region.state,
          cities: region.cities,
          status: region.status,
        } as any, { onConflict: 'name' });
      }
      queryClient.invalidateQueries({ queryKey: ['regions-with-clients'] });
      toast.success('Macrorregiões sincronizadas com o banco de dados!');
    } catch (err: any) {
      toast.error('Erro ao sincronizar regiões: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const saveRegion = useMutation({
    mutationFn: async (values: any) => {
      const citiesArray = values.citiesText
        ? values.citiesText.split(',').map((c: string) => c.trim()).filter(Boolean)
        : [];

      const payload = {
        name: values.name,
        state: values.state.toUpperCase().trim(),
        cities: citiesArray,
        status: values.status,
      };

      if (editingRegion && !editingRegion.id.startsWith('reg-')) {
        const { error } = await supabase
          .from('regions')
          .update(payload)
          .eq('id', editingRegion.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('regions')
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regions-with-clients'] });
      toast.success(editingRegion ? 'Região atualizada com sucesso' : 'Nova região cadastrada');
      setOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar região: ' + error.message);
    }
  });

  const deleteRegion = useMutation({
    mutationFn: async (id: string) => {
      if (id.startsWith('reg-')) {
        toast.info('Esta é uma região padrão do sistema.');
        return;
      }
      const { error } = await supabase.from('regions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regions-with-clients'] });
      toast.success('Região excluída');
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir: ' + error.message);
    }
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'inactive' }) => {
      if (!id.startsWith('reg-')) {
        const { error } = await supabase.from('regions').update({ status }).eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regions-with-clients'] });
      toast.success('Status da região atualizado');
    }
  });

  const handleEdit = (region: RegionSummary) => {
    setEditingRegion(region);
    form.reset({
      name: region.name,
      state: region.state || '',
      citiesText: (region.cities || []).join(', '),
      status: region.status || 'active',
    });
    setOpen(true);
  };

  const totalClients = regions.reduce((acc, r) => acc + r.totalClients, 0);
  const totalCities = new Set(regions.flatMap(r => r.cities)).size;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Regiões e Territórios</h1>
            <p className="text-muted-foreground">Configuração das 5 macrorregiões comerciais e municípios cobertos.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={syncPredefinedToDatabase}
              disabled={isSyncing}
              className="gap-1.5"
            >
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 text-primary" />}
              Sincronizar Territórios
            </Button>
            <Button onClick={() => {
              setEditingRegion(null);
              form.reset({ name: '', state: '', citiesText: '', status: 'active' });
              setOpen(true);
            }}>
              <Plus className="mr-2 h-4 w-4" /> Nova Região
            </Button>
          </div>
        </div>

        {/* Resumo Rápido */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> Macrorregiões
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold">{regions.length} territórios</p>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase">Estrutura comercial ativa</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-500" /> Municípios Atendidos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold">{totalCities} cidades</p>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase">Goiás, DF, MG, TO e Norte</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-green-500" /> Clientes Mapeados
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold">{totalClients} clientes</p>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase">Distribuídos por território</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Territórios Comerciais Cadastrados</CardTitle>
            <CardDescription>
              Acompanhamento de municípios e vinculação com a carteira de clientes Safyra.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary h-8 w-8" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Macrorregião</TableHead>
                    <TableHead>UF</TableHead>
                    <TableHead>Municípios Cobertos</TableHead>
                    <TableHead className="text-center">Clientes na Carteira</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regions.map((region) => (
                    <TableRow key={region.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-bold text-sm">{region.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-bold">{region.state}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                          {region.cities.map(city => (
                            <Badge key={city} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {city}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="font-bold text-xs bg-primary/10 text-primary hover:bg-primary/20">
                          {region.totalClients} clientes ({region.activeClients} ativos)
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={region.status === 'active' ? 'default' : 'secondary'}>
                          {region.status === 'active' ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(region)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {region.status === 'active' ? (
                          <Button variant="ghost" size="icon" onClick={() => toggleStatus.mutate({ id: region.id, status: 'inactive' })}>
                            <PowerOff className="h-4 w-4 text-orange-500" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" onClick={() => toggleStatus.mutate({ id: region.id, status: 'active' })}>
                            <Power className="h-4 w-4 text-green-500" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(region.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Modal de Criação / Edição */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingRegion ? 'Editar Território / Região' : 'Novo Território Comercial'}</DialogTitle>
              <DialogDescription>
                Informe o nome, estado e a lista de municípios pertencentes a esta macrorregião.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit((v) => saveRegion.mutate(v))} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Macrorregião</Label>
                <Input id="name" {...form.register('name', { required: true })} placeholder="Ex: Goiás - Sul & Sudoeste" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">Estado (UF Principal)</Label>
                <Input id="state" {...form.register('state', { required: true })} placeholder="Ex: GO" maxLength={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="citiesText">Municípios Atendidos (separados por vírgula)</Label>
                <Textarea
                  id="citiesText"
                  {...form.register('citiesText')}
                  placeholder="Ex: Rio Verde, Jataí, Itumbiara, Mineiros, Quirinópolis"
                  className="min-h-[100px]"
                />
                <p className="text-[11px] text-muted-foreground">
                  Clientes cadastrados nestas cidades serão associados automaticamente a esta região.
                </p>
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saveRegion.isPending}>
                  {saveRegion.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar Região
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal de Exclusão */}
        <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir Região</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir esta região? Esta ação não pode ser desfeita e pode desvincular clientes associados.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={() => deleteId && deleteRegion.mutate(deleteId)}
                disabled={deleteRegion.isPending}
              >
                {deleteRegion.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Confirmar Exclusão
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
