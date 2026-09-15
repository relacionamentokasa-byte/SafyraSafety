import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, ShoppingCart, Users, Target, Receipt, MapPin, Settings2 } from 'lucide-react';

const notificationSettings = [
  { id: 'orders', label: 'Novos Pedidos', description: 'Receber alertas quando um pedido for criado ou alterado', icon: ShoppingCart },
  { id: 'clients', label: 'Novos Clientes', description: 'Alertar sobre novos cadastros na carteira', icon: Users },
  { id: 'opportunities', label: 'Oportunidades', description: 'Alertas de alteração de estágio e data de fechamento', icon: Target },
  { id: 'visits', label: 'Visitas', description: 'Lembretes de visitas agendadas e confirmadas', icon: MapPin },
  { id: 'commissions', label: 'Comissões', description: 'Alertar quando novas comissões forem geradas ou pagas', icon: Receipt },
  { id: 'system', label: 'Alertas do Sistema', description: 'Notificações técnicas e administrativas', icon: Settings2 },
];

export const Route = createFileRoute('/configuracoes/notificacoes')({
  component: GlobalNotificationsSettingsPage,
});

function GlobalNotificationsSettingsPage() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações de Notificações</h1>
          <p className="text-muted-foreground">Gerencie quais eventos geram alertas no sistema para os usuários.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Alertas Globais</CardTitle>
            <CardDescription>Defina quais módulos possuem notificações automáticas ativas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {notificationSettings.map((setting) => (
              <div key={setting.id} className="flex items-center justify-between space-x-4">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-muted rounded-full">
                    <setting.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <Label className="text-base">{setting.label}</Label>
                    <p className="text-sm text-muted-foreground">{setting.description}</p>
                  </div>
                </div>
                <Switch defaultChecked />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
