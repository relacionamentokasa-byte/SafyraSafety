import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCompanySettings, saveCompanySettings } from '@/lib/company.functions';
import { toast } from 'sonner';
import { Loader2, Upload, Save, Building2, Search, Database } from 'lucide-react';
import { useState } from 'react';
import { useServerFn } from "@tanstack/react-start";
import { getCompanyByCnpj } from "@/lib/cnpj.functions";
import { importBillingSpreadsheetItems } from "@/lib/billing-reconciliation.functions";
import { restoreCompleteHistory } from "@/lib/restore-history.functions";

const companySchema = z.object({
  company_name: z.string().min(1, 'Nome é obrigatório'),
  legal_name: z.string().nullish(),
  trade_name: z.string().nullish(),
  cnpj: z.string().nullish(),
  state_registration: z.string().nullish(),
  phone: z.string().nullish(),
  whatsapp: z.string().nullish(),
  email: z.string().nullish(),
  website: z.string().nullish(),
  zip_code: z.string().nullish(),
  address: z.string().nullish(),
  address_number: z.string().nullish(),
  address_complement: z.string().nullish(),
  neighborhood: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  primary_color: z.string().nullish(),
  secondary_color: z.string().nullish(),
  google_maps_api_key: z.string().nullish(),
});

type CompanyFormValues = z.infer<typeof companySchema>;

export const Route = createFileRoute('/configuracoes/empresa')({
  component: CompanySettingsPage,
});

function CompanySettingsPage() {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [isReconcilingBilling, setIsReconcilingBilling] = useState(false);
  const [isRestoringHistory, setIsRestoringHistory] = useState(false);
  const searchCnpj = useServerFn(getCompanyByCnpj);
  const saveSettingsFn = useServerFn(saveCompanySettings);
  const reconcileBillingFn = useServerFn(importBillingSpreadsheetItems);
  const restoreHistoryFn = useServerFn(restoreCompleteHistory);

  const handleRestoreHistory = async () => {
    try {
      setIsRestoringHistory(true);
      toast.info("Restaurando os 218 pedidos históricos e 623 comissões...", { duration: 6000 });
      const res = await restoreHistoryFn();
      if (res && res.success) {
        toast.success(res.message || "Base histórica restaurada com sucesso!");
        await queryClient.invalidateQueries();
      } else {
        toast.error(res?.message || "Falha na restauração da base histórica");
      }
    } catch (err: any) {
      toast.error("Erro na restauração: " + (err.message || "Erro interno"));
    } finally {
      setIsRestoringHistory(false);
    }
  };

  const handleReconcileBilling = async () => {
    try {
      setIsReconcilingBilling(true);
      toast.info("Processando itens e pedidos faturados da planilha...", { duration: 6000 });
      const res = await reconcileBillingFn();
      if (res && res.success) {
        toast.success(res.message || "Conciliação de faturamento concluída com sucesso!");
        await queryClient.invalidateQueries();
      } else {
        toast.error(res?.message || "Falha na conciliação da planilha");
      }
    } catch (err: any) {
      toast.error("Erro ao conciliar faturamento: " + (err.message || "Erro interno"));
    } finally {
      setIsReconcilingBilling(false);
    }
  };

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
        form.setValue("company_name", data.tradeName || data.legalName || "");
        form.setValue("legal_name", data.legalName || "");
        form.setValue("trade_name", data.tradeName || "");
        form.setValue("email", data.email || "");
        form.setValue("phone", data.phone || "");
        form.setValue("zip_code", data.cep || "");
        form.setValue("address", data.address || "");
        form.setValue("address_number", data.number || "");
        form.setValue("address_complement", data.complement || "");
        form.setValue("neighborhood", data.neighborhood || "");
        form.setValue("city", data.city || "");
        form.setValue("state", data.state || "");

        toast.success("Dados da empresa localizados!");
      } else {
        toast.error(result.message || "CNPJ não localizado");
      }
    } catch (error: any) {
      toast.error("Erro ao buscar CNPJ: " + error.message);
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  const { data: settings, isLoading } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    values: settings ? {
      company_name: settings.company_name,
      legal_name: settings.legal_name || '',
      trade_name: settings.trade_name || '',
      cnpj: settings.cnpj || '',
      state_registration: settings.state_registration || '',
      phone: settings.phone || '',
      whatsapp: settings.whatsapp || '',
      email: settings.email || '',
      website: settings.website || '',
      zip_code: settings.zip_code || '',
      address: settings.address || '',
      address_number: settings.address_number || '',
      address_complement: settings.address_complement || '',
      neighborhood: settings.neighborhood || '',
      city: settings.city || '',
      state: settings.state || '',
      primary_color: settings.primary_color || '#3b82f6',
      secondary_color: settings.secondary_color || '#1e293b',
      google_maps_api_key: settings.google_maps_api_key || '',
    } : {
      company_name: 'Safyra Safety',
      primary_color: '#3b82f6',
      secondary_color: '#1e293b',
      legal_name: '',
      trade_name: '',
      cnpj: '',
      state_registration: '',
      phone: '',
      whatsapp: '',
      email: '',
      website: '',
      zip_code: '',
      address: '',
      address_number: '',
      address_complement: '',
      neighborhood: '',
      city: '',
      state: '',
      google_maps_api_key: '',
    },
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveDirect = async () => {
    try {
      setIsSaving(true);
      const values = form.getValues();

      const payload: any = {
        company_name: values.company_name || 'Safyra Safety',
        legal_name: values.legal_name || null,
        trade_name: values.trade_name || null,
        cnpj: values.cnpj || null,
        state_registration: values.state_registration || null,
        phone: values.phone || null,
        whatsapp: values.whatsapp || null,
        email: values.email || null,
        website: values.website || null,
        zip_code: values.zip_code || null,
        address: values.address || null,
        address_number: values.address_number || null,
        address_complement: values.address_complement || null,
        neighborhood: values.neighborhood || null,
        city: values.city || null,
        state: values.state || null,
        google_maps_api_key: values.google_maps_api_key || null,
        updated_at: new Date().toISOString(),
      };

      if (settings?.id) {
        const { error } = await supabase
          .from('company_settings')
          .update(payload)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_settings')
          .insert([payload]);
        if (error) throw error;
      }

      await queryClient.invalidateQueries({ queryKey: ['company-settings'] });
      toast.success('Configurações salvas com sucesso!');
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error);
      toast.error('Erro ao salvar: ' + (error.message || error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logo_url' | 'logo_docs_url' | 'favicon_url') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(field);
      const fileExt = file.name.split('.').pop();
      const filePath = `${field}_${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('company_assets_v2')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('company_assets_v2')
        .getPublicUrl(filePath);

      const finalUrl = data.publicUrl;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const saveResult = settings?.id
        ? await supabase
            .from('company_settings')
            .update({ [field]: finalUrl, updated_by: user.id, updated_at: new Date().toISOString() } as any)
            .eq('id', settings.id)
            .select('id')
            .single()
        : await supabase
            .from('company_settings')
            .insert([{
              company_name: form.getValues('company_name') || 'Safyra Safety',
              [field]: finalUrl,
              updated_by: user.id,
              updated_at: new Date().toISOString(),
            }] as any)
            .select('id')
            .single();

      if (saveResult.error) throw saveResult.error;
      if (!saveResult.data) throw new Error('O banco não confirmou o salvamento do arquivo');

      await queryClient.invalidateQueries({ queryKey: ['company-settings'] });
      toast.success('Arquivo enviado e salvo com sucesso!');
    } catch (error: any) {
      toast.error('Erro no upload: ' + error.message);
    } finally {
      setIsUploading(null);
    }
  };

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
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dados da Empresa</h1>
          <p className="text-muted-foreground">
            Configure as informações institucionais e identidade visual.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveDirect();
          }}
          className="space-y-6"
        >
          <Card>
            <CardHeader>
              <CardTitle>Informações Gerais</CardTitle>
              <CardDescription>Dados cadastrais e contato da representação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Nome da Empresa</Label>
                  <Input id="company_name" {...form.register('company_name')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legal_name">Razão Social</Label>
                  <Input id="legal_name" {...form.register('legal_name')} />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <div className="flex gap-2">
                    <Input
                      id="cnpj"
                      {...form.register('cnpj')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSearchCnpj();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleSearchCnpj}
                      disabled={isSearchingCnpj}
                    >
                      {isSearchingCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state_registration">Inscrição Estadual</Label>
                  <Input id="state_registration" {...form.register('state_registration')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" {...form.register('phone')} />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input id="whatsapp" {...form.register('whatsapp')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" {...form.register('email')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Site</Label>
                  <Input id="website" {...form.register('website')} placeholder="https://..." />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Integrações</CardTitle>
              <CardDescription>Configurações de APIs externas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="google_maps_api_key">Google Maps API Key</Label>
                <div className="flex gap-2">
                  <Input 
                    id="google_maps_api_key" 
                    type="password" 
                    {...form.register('google_maps_api_key')} 
                    placeholder="Cole aqui sua chave do Google Maps" 
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      const input = document.getElementById('google_maps_api_key') as HTMLInputElement;
                      if (input) input.type = input.type === 'password' ? 'text' : 'password';
                    }}
                  >
                    Ver
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Necessário para os módulos de Mapa de Clientes e Roteirização.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Endereço</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-4 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input id="address" {...form.register('address')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address_number">Número</Label>
                  <Input id="address_number" {...form.register('address_number')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address_complement">Complemento</Label>
                  <Input id="address_complement" {...form.register('address_complement')} />
                </div>
              </div>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="neighborhood">Bairro</Label>
                  <Input id="neighborhood" {...form.register('neighborhood')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input id="city" {...form.register('city')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado</Label>
                  <Input id="state" {...form.register('state')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip_code">CEP</Label>
                  <Input id="zip_code" {...form.register('zip_code')} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-slate-700" />
                Base de Dados e Faturamento
              </CardTitle>
              <CardDescription>
                Restaure o histórico oficial completo de 2026 (218 pedidos, R$ 2.6M e comissões) ou concilie itens discriminados das 53 abas da planilha.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">Base Anterior Oficial Completa (Fev a Set/2026)</p>
                  <p className="text-xs text-slate-500 font-mono">218 pedidos faturados • 623 parcelas e comissões Nutriex e Libus</p>
                </div>
                <Button
                  type="button"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-medium shrink-0"
                  disabled={isRestoringHistory}
                  onClick={handleRestoreHistory}
                >
                  {isRestoringHistory ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Restaurando Base Anterior...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4 mr-2 text-slate-200" />
                      Restaurar Base Anterior Completa
                    </>
                  )}
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">Planilha do Sistema (Itens de Venda por Cliente)</p>
                  <p className="text-xs text-slate-500 font-mono">C:\Users\Ariel Matos\Desktop\Planilha sistema 10 9.xlsx</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="border-slate-300 hover:bg-slate-100 font-medium shrink-0"
                  disabled={isReconcilingBilling}
                  onClick={handleReconcileBilling}
                >
                  {isReconcilingBilling ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Conciliando Itens...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4 mr-2 text-slate-600" />
                      Conciliar Planilha com o Sistema
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="button"
              disabled={isSaving}
              onClick={handleSaveDirect}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Configurações
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
