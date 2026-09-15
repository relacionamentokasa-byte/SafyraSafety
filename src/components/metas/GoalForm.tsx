import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { getRepresentativeOptions, RepresentativeOption } from '@/lib/representatives.services';

const goalSchema = z.object({
  representative_id: z.string().min(1, 'Selecione um representante'),
  month: z.string().min(1, 'Selecione o mês'),
  year: z.string().min(1, 'Selecione o ano'),
  target_value: z.number().min(0.01, 'O valor deve ser maior que zero'),
});

type GoalFormValues = z.infer<typeof goalSchema>;

interface GoalFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function GoalForm({ onSuccess, onCancel }: GoalFormProps) {
  const [loading, setLoading] = useState(false);
  const [representatives, setRepresentatives] = useState<RepresentativeOption[]>([]);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      representative_id: '',
      month: currentMonth.toString(),
      year: currentYear.toString(),
      target_value: 0,
    },
  });

  useEffect(() => {
    async function loadRepresentatives() {
      const reps = await getRepresentativeOptions();
      setRepresentatives(reps);
    }
    loadRepresentatives();
  }, []);

  async function onSubmit(data: GoalFormValues) {
    setLoading(true);
    try {
      const { error } = await supabase.from('goals').insert([{
        representative_id: data.representative_id,
        month: parseInt(data.month),
        year: parseInt(data.year),
        target_value: data.target_value,
        achieved_value: 0,
      }]);

      if (error) throw error;

      toast.success('Meta cadastrada com sucesso!');
      onSuccess();
    } catch (error: any) {
      toast.error('Erro ao cadastrar meta: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

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

  const years = Array.from({ length: 5 }, (_, i) => (currentYear + i).toString());

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="representative_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Representante</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o representante" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {representatives.map((rep) => (
                    <SelectItem key={rep.id} value={rep.id}>
                      {rep.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="month"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mês</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="year"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ano</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="target_value"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Valor da Meta (R$)</FormLabel>
              <FormControl>
                <Input 
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Criar Meta'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
