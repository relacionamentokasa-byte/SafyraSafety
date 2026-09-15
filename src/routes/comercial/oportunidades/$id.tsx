import { createFileRoute, useParams, Link } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ChevronLeft, 
  Calendar, 
  DollarSign, 
  Target, 
  TrendingUp, 
  User, 
  Building2,
  Clock,
  History,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  ShoppingCart
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { formatClientDisplayName } from '@/lib/format-name';
import { RepresentativeBadge } from '@/components/representantes/RepresentativeBadge';

export const Route = createFileRoute('/comercial/oportunidades/$id')({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Detalhes da Oportunidade" },
    ],
  }),
  component: OpportunityDetailsPage,
});

function OpportunityDetailsPage() {
  const { id } = useParams({ from: '/comercial/oportunidades/$id' });

  const { data: opp, isLoading } = useQuery({
    queryKey: ['opportunity', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          *,
          client:clients(*),
          representative:representatives(id, name, code, photo_url),
          stage:crm_stages(*),
          items:opportunity_items(
            *,
            product:products(name)
          )
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as any;
    }
  });

  if (isLoading) return <div className="p-8 text-center">Carregando detalhes...</div>;
  if (!opp) return <div className="p-8 text-center text-destructive">Oportunidade não encontrada.</div>;

  const weightedValue = (Number(opp.estimated_value) * (opp.probability / 100));

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-muted/10">
        <div className="p-4 md:p-8 bg-card border-b space-y-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Button variant="ghost" size="sm" asChild className="-ml-2">
              <Link to="/comercial/oportunidades">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Voltar para CRM
              </Link>
            </Button>
          </div>

          <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{opp.title}</h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded border text-slate-700 bg-slate-50 border-slate-200">
                  {opp.stage?.name}
                </span>
                <span className="text-xs font-semibold text-slate-700">
                  {opp.status === 'open' ? 'Em Aberto' : opp.status === 'won' ? 'Ganha' : 'Perdida'}
                </span>
              </div>
              
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-primary" />
                  {opp.client ? formatClientDisplayName(opp.client) : 'Cliente não informado'}
                </div>
                <div className="flex items-center gap-1.5">
                  <RepresentativeBadge
                    name={opp.representative?.name}
                    photoUrl={opp.representative?.photo_url}
                    size="xs"
                    fallbackText="Não informado"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Origem: {opp.origin}
                </div>
              </div>
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              {opp.status === 'won' && (
                <Button 
                  className="bg-primary text-white flex-1 md:flex-none"
                  asChild
                >
                  <Link to="/comercial/pedidos/novo" search={{ opportunity_id: opp.id }}>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Criar Pedido
                  </Link>
                </Button>
              )}
              {opp.status === 'open' && (
                <>
                  <Button className="bg-green-600 hover:bg-green-700 text-white">Marcar como Ganha</Button>
                  <Button variant="destructive">Marcar como Perdida</Button>
                </>
              )}
              <Button variant="outline">Editar</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-xl border bg-background/50 space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Valor Estimado</span>
              <p className="text-lg font-bold">R$ {Number(opp.estimated_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-3 rounded-xl border bg-background/50 space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Probabilidade</span>
              <p className="text-lg font-bold">{opp.probability}%</p>
            </div>
            <div className="p-3 rounded-xl border bg-background/50 space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Valor Ponderado</span>
              <p className="text-lg font-bold text-primary">R$ {weightedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-3 rounded-xl border bg-background/50 space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Previsão</span>
              <p className="text-lg font-bold">
                {opp.expected_closing_date ? format(new Date(opp.expected_closing_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1">
          <Tabs defaultValue="overview" className="h-full flex flex-col">
            <div className="px-4 md:px-8 bg-card border-b">
              <TabsList className="h-12 bg-transparent gap-6">
                <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Visão Geral</TabsTrigger>
                <TabsTrigger value="activities" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Atividades</TabsTrigger>
                <TabsTrigger value="items" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Produtos</TabsTrigger>
                <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Histórico</TabsTrigger>
              </TabsList>
            </div>

            <div className="p-4 md:p-8 flex-1">
              <TabsContent value="overview" className="m-0 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Descrição e Observações</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {opp.description || 'Nenhuma observação registrada.'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        Próxima Ação
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {opp.next_action_description ? (
                        <>
                          <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg">
                            <p className="text-sm font-medium">{opp.next_action_description}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              Agendado para: {opp.next_action_date ? format(new Date(opp.next_action_date), "dd/MM 'às' HH:mm", { locale: ptBR }) : '-'}
                            </p>
                          </div>
                          <Button variant="outline" size="sm" className="w-full">Concluir Ação</Button>
                        </>
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-sm text-muted-foreground mb-4">Nenhuma ação pendente</p>
                          <Button size="sm">Agendar Próxima Ação</Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="items" className="m-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Produtos na Oportunidade</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="relative overflow-x-auto">
                      <table className="w-full text-sm text-left text-muted-foreground">
                        <thead className="text-xs uppercase bg-muted/50">
                          <tr>
                            <th className="px-4 py-3">Produto</th>
                            <th className="px-4 py-3 text-center">Qtd</th>
                            <th className="px-4 py-3 text-right">Preço Est.</th>
                            <th className="px-4 py-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {opp.items?.map((item: any) => (
                            <tr key={item.id} className="border-b">
                              <td className="px-4 py-3 font-medium text-foreground">{item.product?.name}</td>
                              <td className="px-4 py-3 text-center">{item.quantity}</td>
                              <td className="px-4 py-3 text-right">R$ {Number(item.estimated_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              <td className="px-4 py-3 text-right font-bold text-foreground">R$ {Number(item.total_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                          {(!opp.items || opp.items.length === 0) && (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center italic">Nenhum produto vinculado.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="activities" className="m-0">
                <div className="flex items-center justify-center h-40 border-2 border-dashed rounded-lg text-muted-foreground">
                  Aba de atividades será alimentada pelo módulo de campo.
                </div>
              </TabsContent>

              <TabsContent value="history" className="m-0">
                 <div className="flex items-center justify-center h-40 border-2 border-dashed rounded-lg text-muted-foreground">
                  Log de alterações em desenvolvimento.
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}