import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

const preferencesSchema = z.object({
  date_format: z.string(),
  currency_code: z.string(),
  timezone: z.string(),
  default_pagination: z.number().min(1).max(100),
  language: z.string(),
});

type PreferencesFormValues = z.infer<typeof preferencesSchema>;

export const Route = createFileRoute('/configuracoes/preferencias')({
  component: SystemPreferencesPage,
});

function SystemPreferencesPage() {
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['system-preferences'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('system_preferences')
        .select('*')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  const form = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesSchema),
    values: preferences ? {
      date_format: preferences.date_format,
      currency_code: preferences.currency_code,
      timezone: preferences.timezone,
      default_pagination: preferences.default_pagination,
      language: preferences.language,
    } : {
      date_format: 'DD/MM/YYYY',
      currency_code: 'BRL',
      timezone: 'America/Sao_Paulo',
      default_pagination: 10,
      language: 'pt-BR',
    },
  });

  const updatePreferences = useMutation({
    mutationFn: async (values: PreferencesFormValues) => {
      const payload = {
        ...values,
        updated_at: new Date().toISOString(),
      };

      if (preferences?.id) {
        const { error } = await (supabase as any).from('system_preferences')
          .update(payload)
          .eq('id', preferences.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('system_preferences')
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-preferences'] });
      toast.success('Preferências salvas com sucesso');
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar: ' + error.message);
    },
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Preferências</h1>
          <p className="text-muted-foreground">
            Configure formatos e parâmetros globais do sistema.
          </p>
        </div>

        <form onSubmit={form.handleSubmit((v) => updatePreferences.mutate(v))} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Formatos e Localização</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Idioma Padrão</Label>
                  <Select 
                    value={form.watch('language')} 
                    onValueChange={(v) => form.setValue('language', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o idioma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                      <SelectItem value="en-US">English (US)</SelectItem>
                      <SelectItem value="es-ES">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Moeda Padrão</Label>
                  <Select 
                    value={form.watch('currency_code')} 
                    onValueChange={(v) => form.setValue('currency_code', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a moeda" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BRL">Real Brasileiro (R$)</SelectItem>
                      <SelectItem value="USD">Dólar Americano ($)</SelectItem>
                      <SelectItem value="EUR">Euro (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Formato de Data</Label>
                  <Select 
                    value={form.watch('date_format')} 
                    onValueChange={(v) => form.setValue('date_format', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o formato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (Brasil)</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (US)</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Fuso Horário</Label>
                  <Select 
                    value={form.watch('timezone')} 
                    onValueChange={(v) => form.setValue('timezone', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o fuso" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Sao_Paulo">Brasília (GMT-3)</SelectItem>
                      <SelectItem value="America/Manaus">Manaus (GMT-4)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default_pagination">Itens por Página (Padrão)</Label>
                  <Input 
                    id="default_pagination" 
                    type="number" 
                    {...form.register('default_pagination', { valueAsNumber: true })} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={updatePreferences.isPending}>
              {updatePreferences.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Preferências
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
