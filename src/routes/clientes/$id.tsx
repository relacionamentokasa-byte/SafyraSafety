import { createFileRoute, Link, useParams } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { ClientOpportunitiesTab } from '@/components/clientes/ClientOpportunitiesTab';
import { ClientVisitsTab } from '@/components/clientes/ClientVisitsTab';
import { ClientOrdersTab } from '@/components/clientes/ClientOrdersTab';
import { ClientHistoryTab } from '@/components/clientes/ClientHistoryTab';
import { ClientForm } from '@/components/clientes/ClientForm';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { formatClientDisplayName, formatDisplayName } from '@/lib/format-name';
import { getClientById } from '@/lib/clients.services';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  MapPin,
  Phone,
  Mail,
  ShoppingBag,
  Calendar,
  FileText,
  TrendingUp,
  MessageSquare,
  Users,
  Plus,
  Clock,
  ClipboardCheck,
  Edit,
  Loader2
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RepresentativeBadge } from "@/components/representantes/RepresentativeBadge";
import { FieldQuickActions } from "@/components/common/FieldQuickActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveModal } from "@/components/common/ResponsiveModal";

export const Route = createFileRoute('/clientes/$id')({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Perfil do Cliente" },
      { name: "description", content: "Informações detalhadas, histórico comercial, contatos e atividades do cliente." },
      { property: "og:title", content: "Safyra Safety | Perfil do Cliente" },
      { property: "og:description", content: "Informações detalhadas, histórico comercial, contatos e atividades do cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClientProfilePage,
});

function ClientProfilePage() {
  const { id } = useParams({ from: '/clientes/$id' });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Consulta do Cliente
  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('*, representatives(id, name, photo_url)')
          .eq('id', id)
          .single();

        if (data && !error) return data;
      } catch (err) {}

      const found = await getClientById(id);
      if (found) return found;

      throw new Error('Cliente não encontrado');
    },
  });

  // Estatísticas e contagens reais
  const { data: clientStats } = useQuery({
    queryKey: ['client-profile-stats', id],
    queryFn: async () => {
      const [visitsRes, ordersRes, oppsRes, followUpsRes] = await Promise.all([
        supabase.from('visits').select('scheduled_at, status').eq('client_id', id).order('scheduled_at', { ascending: false }).limit(1),
        supabase.from('orders').select('created_at, total_amount, status').eq('client_id', id).order('created_at', { ascending: false }),
        supabase.from('opportunities').select('id, status').eq('client_id', id),
        supabase.from('follow_ups').select('scheduled_at').eq('client_id', id).order('scheduled_at', { ascending: false }).limit(1),
      ]);

      const lastVisit = visitsRes.data?.[0]?.scheduled_at
        ? format(new Date(visitsRes.data[0].scheduled_at), 'dd/MM/yyyy', { locale: ptBR })
        : 'Nenhuma';

      const lastOrder = ordersRes.data?.[0]?.created_at
        ? format(new Date(ordersRes.data[0].created_at), 'dd/MM/yyyy', { locale: ptBR })
        : 'Nenhum';

      const nextFollowUp = followUpsRes.data?.[0]?.scheduled_at
        ? format(new Date(followUpsRes.data[0].scheduled_at), 'dd/MM/yyyy', { locale: ptBR })
        : 'Sem agendamento';

      const openOpportunities = oppsRes.data?.filter(o => o.status === 'open').length || 0;
      const totalOrders = ordersRes.data?.length || 0;

      return {
        lastVisit,
        lastOrder,
        nextFollowUp,
        openOpportunities,
        totalOrders,
      };
    }
  });

  // Lista de contatos adicionais vinculados
  const { data: contacts = [] } = useQuery({
    queryKey: ['client-contacts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_contacts')
        .select('*')
        .eq('client_id', id);

      if (error) throw error;
      return data || [];
    }
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!client) {
    return (
      <AppLayout>
        <div className="p-8 text-center space-y-4">
          <p className="text-lg font-medium text-destructive">Cliente não encontrado</p>
          <Button variant="outline" asChild>
            <Link to="/clientes">Voltar para Clientes</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const clientName = formatClientDisplayName(client) || "Cliente";
  const repName = (client.representatives as any)?.name || 'Sem representante';

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-muted/10">
        {/* Header do Perfil */}
        <div className="p-4 md:p-8 bg-card border-b space-y-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-4">
            <Button variant="ghost" size="sm" asChild className="-ml-2">
              <Link to="/clientes">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Voltar
              </Link>
            </Button>
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            <Avatar className="h-20 w-20 rounded-xl">
              <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                {clientName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{clientName}</h1>
                <Badge
                  variant={client.status === 'active' ? 'default' : 'secondary'}
                >
                  {client.status === 'active' ? 'Ativo' : client.status === 'prospect' ? 'Prospecto' : client.status === 'inactive' ? 'Inativo' : client.status}
                </Badge>
                <Badge variant="outline" className="border-primary/50 text-primary">
                  Potencial {client.purchase_potential === 'alto' ? 'Alto' : client.purchase_potential === 'medio' ? 'Médio' : client.purchase_potential === 'baixo' ? 'Baixo' : client.purchase_potential || 'Médio'}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-primary" />
                  {client.cnpj || 'CNPJ não informado'}
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  {client.city ? `${client.city}/${client.state || 'GO'}` : 'Localização não informada'}
                </div>
                <div className="flex items-center gap-1.5">
                  <RepresentativeBadge
                    name={(client.representatives as any)?.name}
                    photoUrl={(client.representatives as any)?.photo_url}
                    size="xs"
                    fallbackText="Sem representante"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <FieldQuickActions
                phone={client.phone}
                whatsapp={client.whatsapp}
                location={{
                  address: client.address,
                  address_number: client.address_number,
                  neighborhood: client.neighborhood,
                  city: client.city,
                  state: client.state,
                  latitude: client.latitude,
                  longitude: client.longitude,
                }}
                clientName={formatClientDisplayName(client)}
                variant="buttons"
              />
              <Button size="sm" variant="outline" onClick={() => setIsEditDialogOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar Cliente
              </Button>
              <Button size="sm" className="flex-1 md:flex-none" asChild>
                <Link to="/campo/visitas/novo" search={{ clientId: client.id }}>
                  <Calendar className="mr-2 h-4 w-4" />
                  Agendar Visita
                </Link>
              </Button>
              <Button size="sm" variant="outline" className="flex-1 md:flex-none" asChild>
                <Link to="/comercial/pedidos/novo" search={{ client_id: client.id, opportunity_id: "" }}>
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  Novo Pedido
                </Link>
              </Button>
            </div>
          </div>

          {/* Indicadores Reais */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Última Visita', value: clientStats?.lastVisit || '-', icon: Calendar },
              { label: 'Última Compra', value: clientStats?.lastOrder || '-', icon: ShoppingBag },
              { label: 'Follow-up', value: clientStats?.nextFollowUp || '-', icon: Clock },
              { label: 'Oportunidades', value: (clientStats?.openOpportunities || 0).toString(), icon: TrendingUp },
              { label: 'Total Pedidos', value: (clientStats?.totalOrders || 0).toString(), icon: ClipboardCheck },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col p-3 rounded-xl border bg-background/50 items-center text-center space-y-1">
                <stat.icon className="h-4 w-4 text-primary/70 mb-1" />
                <span className="text-[10px] uppercase font-bold text-muted-foreground">{stat.label}</span>
                <span className="text-sm font-bold">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Modal / Bottom Sheet Responsivo de Edição de Cliente */}
        <ResponsiveModal
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          title="Editar Cliente"
          description="Atualize as informações cadastrais e comerciais do cliente."
          maxContentClass="max-w-3xl"
        >
          <ClientForm
            clientId={client.id}
            initialData={client}
            onSuccess={() => setIsEditDialogOpen(false)}
          />
        </ResponsiveModal>

        {/* Conteúdo Principal (Abas) */}
        <div className="flex-1">
          <Tabs defaultValue="overview" className="h-full flex flex-col">
            <div className="px-4 md:px-8 bg-card border-b overflow-x-auto no-scrollbar">
              <TabsList className="h-12 bg-transparent gap-6">
                <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Visão Geral</TabsTrigger>
                <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Histórico</TabsTrigger>
                <TabsTrigger value="contacts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Contatos</TabsTrigger>
                <TabsTrigger value="orders" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Pedidos</TabsTrigger>
                <TabsTrigger value="visits" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Visitas</TabsTrigger>
                <TabsTrigger value="opportunities" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Oportunidades</TabsTrigger>
              </TabsList>
            </div>

            <div className="p-4 md:p-8 flex-1">
              <TabsContent value="overview" className="m-0 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Dados de Contato */}
                  <Card className="lg:col-span-1">
                    <CardHeader>
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Phone className="h-4 w-4 text-primary" />
                        Contato e Localização
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Telefone</p>
                        <p className="text-sm font-medium">{client.phone || 'Não informado'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">WhatsApp</p>
                        <p className="text-sm font-medium">{client.whatsapp || 'Não informado'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">E-mail</p>
                        <p className="text-sm font-medium">{client.email || 'Não informado'}</p>
                      </div>
                      <div className="space-y-1 pt-2 border-t">
                        <p className="text-xs text-muted-foreground">Endereço</p>
                        <p className="text-sm font-medium">{client.address || 'Endereço não informado'}{client.address_number ? `, ${client.address_number}` : ''}</p>
                        <p className="text-sm text-muted-foreground">{client.neighborhood ? `${client.neighborhood}, ` : ''}{client.city || ''} - {client.state || ''}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Atividades e Observações */}
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Observações Comerciais</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground italic bg-muted/30 p-4 rounded-lg">
                        {client.notes || "Nenhuma observação comercial registrada para este cliente."}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="history" className="m-0">
                <ClientHistoryTab clientId={id} />
              </TabsContent>

              <TabsContent value="contacts" className="m-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Contato Principal vindo da tabela clients */}
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="space-y-0.5">
                          <p className="font-bold text-sm">{client.contact_name || 'Contato Principal'}</p>
                          <p className="text-xs text-muted-foreground">{client.contact_role || 'Responsável'}</p>
                        </div>
                        <Badge variant="secondary" className="text-[10px]">Principal</Badge>
                      </div>
                      <div className="flex gap-2">
                        {client.phone && (
                          <Button size="icon" variant="outline" className="h-8 w-8" asChild>
                            <a href={`tel:${client.phone}`}><Phone className="h-3 w-3" /></a>
                          </Button>
                        )}
                        {client.whatsapp && (
                          <Button size="icon" variant="outline" className="h-8 w-8 text-green-600" asChild>
                            <a href={`https://wa.me/55${client.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                              <MessageSquare className="h-3 w-3" />
                            </a>
                          </Button>
                        )}
                        {client.email && (
                          <Button size="icon" variant="outline" className="h-8 w-8" asChild>
                            <a href={`mailto:${client.email}`}><Mail className="h-3 w-3" /></a>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Contatos adicionais cadastrados na tabela client_contacts */}
                  {contacts.map((contact) => (
                    <Card key={contact.id}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-0.5">
                            <p className="font-bold text-sm">{contact.name}</p>
                            <p className="text-xs text-muted-foreground">{contact.role || 'Contato'}</p>
                          </div>
                          {contact.is_main && <Badge variant="secondary" className="text-[10px]">Principal</Badge>}
                        </div>
                        <div className="flex gap-2">
                          {contact.phone && (
                            <Button size="icon" variant="outline" className="h-8 w-8" asChild>
                              <a href={`tel:${contact.phone}`}><Phone className="h-3 w-3" /></a>
                            </Button>
                          )}
                          {contact.whatsapp && (
                            <Button size="icon" variant="outline" className="h-8 w-8 text-green-600" asChild>
                              <a href={`https://wa.me/55${contact.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                                <MessageSquare className="h-3 w-3" />
                              </a>
                            </Button>
                          )}
                          {contact.email && (
                            <Button size="icon" variant="outline" className="h-8 w-8" asChild>
                              <a href={`mailto:${contact.email}`}><Mail className="h-3 w-3" /></a>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="orders" className="m-0">
                <ClientOrdersTab clientId={id} />
              </TabsContent>

              <TabsContent value="visits" className="m-0">
                <ClientVisitsTab clientId={id} />
              </TabsContent>

              <TabsContent value="opportunities" className="m-0">
                <ClientOpportunitiesTab clientId={id} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
