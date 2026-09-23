import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CRMStage, OpportunityOrigin } from '@/types/database.types';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { formatClientDisplayName } from '@/lib/format-name';
import { getRepresentativeOptions } from '@/lib/representatives.services';
import { getCrmStages, createOpportunityServer } from '@/lib/crm.services';

const formSchema = z.object({
  title: z.string().min(3, 'Título deve ter no mínimo 3 caracteres'),
  client_id: z.string().min(1, 'Selecione um cliente'),
  representative_id: z.string().min(1, 'Selecione um representante'),
  stage_id: z.string().min(1, 'Selecione uma etapa'),
  estimated_value: z.coerce.number().min(0),
  probability: z.coerce.number().min(0).max(100),
  origin: z.enum(['Prospecção', 'Indicação', 'Visita', 'WhatsApp', 'Telefone', 'Site', 'Cliente atual', 'Outro']),
  expected_closing_date: z.string().optional(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function OpportunityForm({ onSuccess }: { onSuccess: () => void }) {
  const queryClient = useQueryClient();

  const { data: clients } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, trade_name, legal_name, city, state, cnpj')
        .order('name');
      if (error) throw error;
      return (data || []).map((c: any) => {
        const loc = [c.city, c.state].filter(Boolean).join(' - ');
        const cnpjFormatted = c.cnpj && c.cnpj.length === 14
          ? c.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
          : c.cnpj;
        const details = [loc, cnpjFormatted].filter(Boolean).join(' • ');
        const baseName = formatClientDisplayName(c);
        return {
          id: c.id,
          name: details ? `${baseName} (${details})` : baseName,
        };
      });
    }
  });

  const { data: representatives } = useQuery({
    queryKey: ['representatives-options-crm'],
    queryFn: async () => {
      return await getRepresentativeOptions();
    }
  });

  const { data: stages } = useQuery({
    queryKey: ['crm-stages'],
    queryFn: async () => {
      return await getCrmStages();
    }
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      estimated_value: 0,
      probability: 50,
      origin: 'Prospecção',
    }
  });

  const createOpportunity = useMutation({
    mutationFn: async (values: FormValues) => {
      return await createOpportunityServer({ data: values });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['crm-stats'] });
      toast.success('Oportunidade criada com sucesso!');
      onSuccess();
    },
    onError: (error: any) => {
      console.error(error);
      toast.error(error?.message || 'Erro ao criar oportunidade.');
    }
  });

  function onSubmit(values: FormValues) {
    createOpportunity.mutate(values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Título da Oportunidade</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Venda de EPIs para Unidade X" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="client_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cliente</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {clients?.map(client => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="representative_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Responsável</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o representante" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {representatives?.map(rep => (
                      <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="stage_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Etapa Inicial</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a etapa" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {stages?.map(stage => (
                      <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="origin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Origem</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a origem" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {['Prospecção', 'Indicação', 'Visita', 'WhatsApp', 'Telefone', 'Site', 'Cliente atual', 'Outro'].map(origin => (
                      <SelectItem key={origin} value={origin}>{origin}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="estimated_value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor Estimado (R$)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="probability"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Probabilidade (%)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="expected_closing_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Previsão de Fechamento</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea placeholder="Detalhes adicionais sobre a negociação..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onSuccess}>Cancelar</Button>
          <Button type="submit" disabled={createOpportunity.isPending}>
            {createOpportunity.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar Oportunidade
          </Button>
        </div>
      </form>
    </Form>
  );
}