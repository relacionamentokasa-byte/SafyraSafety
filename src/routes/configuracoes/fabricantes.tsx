import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Receipt, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { createFileRoute } from '@tanstack/react-router';
import { cn } from "@/lib/utils";
import { uploadFile } from "@/lib/storage";
import { ManufacturerLogo } from "@/components/manufacturers/ManufacturerLogo";
import { useServerFn } from "@tanstack/react-start";
import { getCompanyByCnpj } from "@/lib/cnpj.functions";

const manufacturerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  legal_name: z.string().optional().nullable(),
  trade_name: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('E-mail inválido').optional().nullable().or(z.literal('')),
  responsible_name: z.string().optional().nullable(),
  default_commission_rate: z.coerce.number().min(0, 'Taxa mínima 0%').max(100, 'Taxa máxima 100%').default(4),
  payout_day_of_month: z.coerce.number().min(1, 'Dia mínimo 1').max(31, 'Dia máximo 31').default(20),
  observations: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']),
  logo_path: z.string().nullable().optional(),
});

const commissionRuleSchema = z.object({
  commission_rate: z.coerce.number().min(0, 'Taxa mínima 0%').max(100, 'Taxa máxima 100%'),
  valid_from: z.string().optional().nullable(),
  valid_until: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']),
  observations: z.string().optional().nullable(),
});

type ManufacturerFormValues = z.infer<typeof manufacturerSchema>;
type CommissionRuleFormValues = z.infer<typeof commissionRuleSchema>;

export const Route = createFileRoute('/configuracoes/fabricantes')({
  component: ManufacturersPage,
});

function ManufacturersPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('general');
  const queryClient = useQueryClient();
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const searchCnpj = useServerFn(getCompanyByCnpj);

  const handleSearchCnpj = async () => {
    const cnpjValue = form.getValues("cnpj");
    if (!cnpjValue) {
      toast.error("Digite um CNPJ para buscar");
      return;
    }
    
    const cleanCnpj = cnpjValue.replace(/\D/g, "");

    if (cleanCnpj.length !== 14) {
      toast.error("CNPJ deve conter 14 números");
      return;
    }

    try {
      setIsSearchingCnpj(true);
      const result = await searchCnpj({ data: { cnpj: cleanCnpj } });

      if (result.success && result.data) {
        const data = result.data;
        form.setValue("name", data.tradeName || data.legalName || "");
        form.setValue("legal_name", data.legalName || "");
        form.setValue("trade_name", data.tradeName || "");
        form.setValue("email", data.email || "");
        form.setValue("phone", data.phone || "");

        toast.success("Dados do fabricante localizados!");
      } else {
        toast.error(result.message || "CNPJ não localizado");
      }
    } catch (error: any) {
      toast.error("Erro ao buscar CNPJ: " + error.message);
    } finally {
      setIsSearchingCnpj(false);
    }
  };
  
  const { data: manufacturers, isLoading } = useQuery({
    queryKey: ['manufacturers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manufacturers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  const form = useForm<ManufacturerFormValues>({
    resolver: zodResolver(manufacturerSchema),
    defaultValues: {
      name: '',
      legal_name: '',
      trade_name: '',
      cnpj: '',
      phone: '',
      email: '',
      responsible_name: '',
      logo_path: null,
      default_commission_rate: 4,
      payout_day_of_month: 20,
      observations: '',
      status: 'active',
    }
  });

  const commissionForm = useForm<CommissionRuleFormValues>({
    resolver: zodResolver(commissionRuleSchema),
    defaultValues: {
      commission_rate: 0,
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: '',
      status: 'active',
      observations: '',
    }
  });

  const { data: commissionRule } = useQuery({
    queryKey: ['commission-rule', editing?.id],
    queryFn: async () => {
      if (!editing?.id) return null;
      const { data, error } = await supabase
        .from('commission_rules')
        .select('*')
        .eq('manufacturer_id', editing.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;

      if (data) {
        commissionForm.reset({
          commission_rate: Number(data.commission_rate),
          valid_from: data.valid_from ? data.valid_from.split('T')[0] : '',
          valid_until: data.valid_until ? data.valid_until.split('T')[0] : '',
          status: (data.status as any) || 'active',
          observations: data.observations || '',
        });
      } else {
        commissionForm.reset({
          commission_rate: Number(editing?.default_commission_rate || 5),
          valid_from: new Date().toISOString().split('T')[0],
          valid_until: '',
          status: 'active',
          observations: '',
        });
      }

      return data;
    },
    enabled: !!editing?.id && activeTab === 'commission'
  });

  const mutation = useMutation({
    mutationFn: async (values: ManufacturerFormValues) => {
      const payload = {
        name: values.name,
        legal_name: values.legal_name || null,
        trade_name: values.trade_name || null,
        cnpj: values.cnpj || null,
        phone: values.phone || null,
        email: values.email || null,
        responsible_name: values.responsible_name || null,
        default_commission_rate: values.default_commission_rate,
        payout_day_of_month: values.payout_day_of_month,
        observations: values.observations || null,
        status: values.status,
      };

      let manufacturerId = editing?.id as string | undefined;
      const isNewManufacturer = !manufacturerId;
      let uploadedLogoPath: string | null = null;

      if (!manufacturerId) {
        const { data, error } = await supabase
          .from('manufacturers')
          .insert([payload as any])
          .select('id')
          .single();
        if (error) throw error;
        manufacturerId = data.id;
      }

      try {
        if (logoFile) {
          setIsUploadingLogo(true);
          const upload = await uploadFile('company_assets_v2', logoFile, {
            folder: `manufacturers/${manufacturerId}`,
          });
          uploadedLogoPath = upload.filePath;
        }

        const updatePayload = uploadedLogoPath
          ? { ...payload, logo_path: uploadedLogoPath }
          : payload;
        const shouldUpdateRecord = !isNewManufacturer || Boolean(uploadedLogoPath);
        if (shouldUpdateRecord) {
          const { error } = await supabase
            .from('manufacturers')
            .update(updatePayload as any)
            .eq('id', manufacturerId);
          if (error) throw error;
        }

        const previousLogoPath = editing?.logo_path as string | null | undefined;
        if (uploadedLogoPath && previousLogoPath && previousLogoPath !== uploadedLogoPath) {
          const { error } = await supabase.storage.from('company_assets_v2').remove([previousLogoPath]);
          if (error) toast.warning('Fabricante salvo, mas a logo anterior não pôde ser removida.');
        }
      } catch (error) {
        if (uploadedLogoPath) {
          const { error: cleanupError } = await supabase.storage.from('company_assets_v2').remove([uploadedLogoPath]);
          if (cleanupError) console.error('Não foi possível remover a nova logo após a falha:', cleanupError);
        }
        throw error;
      } finally {
        setIsUploadingLogo(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturers'] });
      queryClient.invalidateQueries({ queryKey: ['manufacturers-list'] });
      toast.success(editing ? 'Fabricante atualizado!' : 'Fabricante criado!');
      setOpen(false);
      setEditing(null);
      setLogoFile(null);
      setLogoPreview(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast.error(`Não foi possível salvar o fabricante: ${error.message}`);
    },
  });

  const handleLogoChange = (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Envie uma imagem JPG, PNG ou WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A logo deve ter no máximo 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setLogoPreview(String(reader.result));
    reader.readAsDataURL(file);
    setLogoFile(file);
  };

  const commissionMutation = useMutation({
    mutationFn: async (values: CommissionRuleFormValues) => {
      if (!editing?.id) return;
      
      const payload = {
        ...values,
        manufacturer_id: editing.id,
        name: `Regra ${editing.name} - ${new Date().toLocaleDateString('pt-BR')}`,
      };

      // Em vez de atualizar a regra existente, desativamos as anteriores e criamos uma nova
      // para manter o histórico de percentuais ao longo do tempo.
      
      // 1. Desativar regras anteriores deste fabricante
      await supabase
        .from('commission_rules')
        .update({ status: 'inactive' } as any)
        .eq('manufacturer_id', editing.id);

      // 2. Inserir a nova regra
      const { error } = await supabase
        .from('commission_rules')
        .insert([payload as any]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commission-rule', editing?.id] });
      toast.success('Nova regra de comissão aplicada e histórico preservado!');
    }
  });


  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('manufacturers')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturers'] });
      toast.success('Fabricante removido!');
    }
  });

  const handleEdit = (m: any) => {
    setEditing(m);
    setLogoFile(null);
    setLogoPreview(null);
    form.reset({
      name: m.name,
      legal_name: m.legal_name || '',
      trade_name: m.trade_name || '',
      cnpj: m.cnpj || '',
      phone: m.phone || '',
      email: m.email || '',
      responsible_name: m.responsible_name || '',
      logo_path: m.logo_path || null,
      default_commission_rate: Number(m.default_commission_rate || 4),
      payout_day_of_month: Number(m.payout_day_of_month || (m.name?.toLowerCase().includes('nutriex') ? 15 : m.name?.toLowerCase().includes('libus') ? 25 : 20)),
      observations: m.observations || '',
      status: (m.status as any) || 'active',
    });
    setOpen(true);
    setActiveTab('general');
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Fabricantes</h1>
            <p className="text-muted-foreground">Gerencie os fabricantes e regras de comissão.</p>
          </div>
          
          <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (!val) {
              setEditing(null);
              setLogoFile(null);
              setLogoPreview(null);
              form.reset();
              setActiveTab('general');
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Fabricante
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? 'Editar Fabricante' : 'Novo Fabricante'}</DialogTitle>
              </DialogHeader>
              
              <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val)} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="general">Geral</TabsTrigger>
                  <TabsTrigger value="commission" disabled={!editing}>Comissão</TabsTrigger>
                </TabsList>
                
                <TabsContent value="general" className="mt-4">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
                      <div className="flex items-center gap-4 rounded-lg border p-4">
                        {logoPreview ? (
                          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-muted">
                            <img src={logoPreview} alt="Pré-visualização da logo" className="h-full w-full object-contain p-1" />
                          </div>
                        ) : (
                          <ManufacturerLogo name={form.watch('name')} logoPath={form.watch('logo_path')} size="lg" className="h-20 w-20" />
                        )}
                        <div className="space-y-2">
                          <div>
                            <p className="text-sm font-medium">Logo do fabricante</p>
                            <p className="text-xs text-muted-foreground">JPG, PNG ou WebP, com no máximo 5 MB.</p>
                          </div>
                          <Input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="max-w-sm"
                            onChange={(event) => handleLogoChange(event.target.files?.[0])}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome Fantasia</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: Fabricante A" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="trade_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome Comercial</FormLabel>
                              <FormControl>
                                <Input value={field.value || ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="legal_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Razão Social</FormLabel>
                              <FormControl>
                                <Input value={field.value || ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="cnpj"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CNPJ</FormLabel>
                              <div className="flex gap-2">
                                <FormControl>
                                  <Input 
                                    placeholder="00.000.000/0000-00" 
                                    value={field.value || ''} 
                                    onChange={field.onChange} 
                                    onBlur={field.onBlur} 
                                    name={field.name} 
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSearchCnpj();
                                      }
                                    }}
                                  />
                                </FormControl>
                                <Button 
                                  type="button" 
                                  variant="secondary"
                                  onClick={handleSearchCnpj}
                                  disabled={isSearchingCnpj}
                                >
                                  {isSearchingCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                </Button>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>E-mail</FormLabel>
                              <FormControl>
                                <Input type="email" value={field.value || ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Telefone</FormLabel>
                              <FormControl>
                                <Input value={field.value || ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="default_commission_rate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Comissão Padrão (%)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" placeholder="4.00" value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="payout_day_of_month"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Dia de Pagamento (Mês Seguinte)</FormLabel>
                              <FormControl>
                                <Input type="number" min={1} max={31} placeholder="Ex: 15 Nutriex / 25 Libus" value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="responsible_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Responsável</FormLabel>
                              <FormControl>
                                <Input value={field.value || ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="active">Ativo</SelectItem>
                                  <SelectItem value="inactive">Inativo</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="observations"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Observações</FormLabel>
                            <FormControl>
                              <Textarea value={field.value || ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <DialogFooter>
                        <Button type="submit" disabled={mutation.isPending || isUploadingLogo}>
                          {mutation.isPending || isUploadingLogo ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Criar Fabricante'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </TabsContent>

                <TabsContent value="commission" className="mt-4">
                  <Form {...commissionForm}>
                    <form onSubmit={commissionForm.handleSubmit((v) => commissionMutation.mutate(v))} className="space-y-4">
                      <div className="bg-muted/50 p-4 rounded-lg flex items-center gap-3 mb-4 border border-primary/20">
                        <Receipt className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm font-semibold">Regra de Comissão por Liquidez</p>
                          <p className="text-xs text-muted-foreground">A comissão é liberada quando o cliente efetua o pagamento da fatura diretamente ao fabricante (liquidez financeira).</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={commissionForm.control}
                          name="commission_rate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Percentual de Comissão (%)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={commissionForm.control}
                          name="valid_from"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Data Início</FormLabel>
                              <FormControl>
                                <Input type="date" value={field.value || ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={commissionForm.control}
                          name="valid_until"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Data Término</FormLabel>
                              <FormControl>
                                <Input type="date" value={field.value || ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={commissionForm.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status da Regra</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="active">Ativo</SelectItem>
                                <SelectItem value="inactive">Inativo</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={commissionForm.control}
                        name="observations"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Observações da Regra</FormLabel>
                            <FormControl>
                              <Textarea value={field.value || ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <DialogFooter>
                        <Button type="submit" disabled={commissionMutation.isPending}>
                          Salvar Regra de Comissão
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fabricante</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>Dia Repasse</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center">Carregando...</TableCell></TableRow>
              ) : manufacturers?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum fabricante cadastrado.</TableCell></TableRow>
              ) : (
                manufacturers?.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <ManufacturerLogo name={m.name} logoPath={m.logo_path} />
                        <div>
                          <div className="font-medium">{m.name}</div>
                          <div className="text-xs text-muted-foreground">{m.trade_name}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{m.cnpj || '-'}</TableCell>
                    <TableCell><span className="font-semibold text-primary">{Number(m.default_commission_rate || 4).toFixed(1)}%</span></TableCell>
                    <TableCell>
                      <span className="text-xs font-medium bg-muted px-2 py-1 rounded">
                        Dia {m.payout_day_of_month || (m.name?.toLowerCase().includes('nutriex') ? 15 : m.name?.toLowerCase().includes('libus') ? 25 : 20)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        m.status === 'active' ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      )}>
                        {m.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(m)}>
                          <Pencil className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => {
                          if (confirm('Deseja remover este fabricante?')) {
                            deleteMutation.mutate(m.id);
                          }
                        }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppLayout>
  );
}
