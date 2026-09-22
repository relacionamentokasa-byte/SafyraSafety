import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Search, Loader2, MapPin, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getCompanyByCnpj } from "@/lib/cnpj.functions";
import { getAddressByCep, geocodeAddress } from "@/lib/geocoding.functions";
import { createClient, updateClient } from "@/lib/clients.functions";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const clientSchema = z.object({
  // Dados da Empresa
  legalName: z.string().min(1, "Razão Social é obrigatória"),
  tradeName: z.string().min(1, "Nome Fantasia é obrigatório"),
  cnpj: z.string().optional().nullable().refine(
    (val) => !val || val.replace(/\D/g, "").length === 14,
    { message: "CNPJ deve conter 14 dígitos" }
  ),
  stateRegistration: z.string().optional().nullable(),
  segment: z.string().optional().nullable(),
  clientType: z.string().optional().nullable(),
  status: z.enum(["prospect", "active", "inactive", "blocked"]).default("active"),

  // Contato
  contactName: z.string().optional().nullable(),
  contactRole: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().optional().nullable().refine(
    (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    { message: "E-mail inválido" }
  ),

  // Endereço
  cep: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  number: z.string().optional().nullable(),
  complement: z.string().optional().nullable(),
  neighborhood: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),

  // Localização
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),

  // Comercial
  representativeId: z.string().optional().nullable(),
  regionId: z.string().optional().nullable(),
  priceTableId: z.string().optional().nullable(),
  purchasePotential: z.enum(["alto", "medio", "baixo"]),
  notes: z.string().optional().nullable(),
});

const FIELD_LABELS: Record<string, string> = {
  legalName: "Razão Social",
  tradeName: "Nome Fantasia",
  cnpj: "CNPJ",
  segment: "Segmento",
  clientType: "Tipo de Cliente",
  contactName: "Nome do Contato",
  phone: "Telefone",
  email: "E-mail",
  cep: "CEP",
  address: "Endereço",
  number: "Número",
  neighborhood: "Bairro",
  city: "Cidade",
  state: "UF",
};

interface ClientFormProps {
  initialData?: any;
  clientId?: string;
  onSuccess?: () => void;
}

export function ClientForm({ initialData, clientId, onSuccess }: ClientFormProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("company");
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchCnpj = useServerFn(getCompanyByCnpj);
  const searchCep = useServerFn(getAddressByCep);
  const getCoordinates = useServerFn(geocodeAddress);
  const saveClient = useServerFn(createClient);
  const editClient = useServerFn(updateClient);

  const form = useForm<z.infer<typeof clientSchema>>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      status: initialData?.status || "prospect",
      purchasePotential: initialData?.purchase_potential || initialData?.purchasePotential || "medio",
      cnpj: initialData?.cnpj || "",
      legalName: initialData?.legal_name || initialData?.legalName || initialData?.name || "",
      tradeName: initialData?.trade_name || initialData?.tradeName || initialData?.name || "",
      stateRegistration: initialData?.state_registration || initialData?.stateRegistration || "",
      segment: initialData?.segment || "varejo",
      clientType: initialData?.client_type || initialData?.clientType || "pj",
      contactName: initialData?.contact_name || initialData?.contactName || "",
      contactRole: initialData?.contact_role || initialData?.contactRole || "",
      phone: initialData?.phone || "",
      whatsapp: initialData?.whatsapp || "",
      email: initialData?.email || "",
      cep: initialData?.zip_code || initialData?.cep || "",
      address: initialData?.address || "",
      number: initialData?.address_number || initialData?.number || "",
      complement: initialData?.address_complement || initialData?.complement || "",
      neighborhood: initialData?.neighborhood || "",
      city: initialData?.city || "",
      state: initialData?.state || "GO",
      representativeId: initialData?.representative_id || initialData?.representativeId || "",
      regionId: initialData?.region_id || initialData?.regionId || "",
      priceTableId: initialData?.price_table_id || initialData?.priceTableId || "",
      notes: initialData?.notes || "",
      latitude: initialData?.latitude || undefined,
      longitude: initialData?.longitude || undefined,
    },
  });

  // Atualizar valores do form caso initialData mude
  useEffect(() => {
    if (initialData) {
      form.reset({
        status: initialData.status || "prospect",
        purchasePotential: initialData.purchase_potential || initialData.purchasePotential || "medio",
        cnpj: initialData.cnpj || "",
        legalName: initialData.legal_name || initialData.legalName || initialData.name || "",
        tradeName: initialData.trade_name || initialData.tradeName || initialData.name || "",
        stateRegistration: initialData.state_registration || initialData.stateRegistration || "",
        segment: initialData.segment || "varejo",
        clientType: initialData.client_type || initialData.clientType || "pj",
        contactName: initialData.contact_name || initialData.contactName || "",
        contactRole: initialData.contact_role || initialData.contactRole || "",
        phone: initialData.phone || "",
        whatsapp: initialData.whatsapp || "",
        email: initialData.email || "",
        cep: initialData.zip_code || initialData.cep || "",
        address: initialData.address || "",
        number: initialData.address_number || initialData.number || "",
        complement: initialData.address_complement || initialData.complement || "",
        neighborhood: initialData.neighborhood || "",
        city: initialData.city || "",
        state: initialData.state || "GO",
        representativeId: initialData.representative_id || initialData.representativeId || "",
        regionId: initialData.region_id || initialData.regionId || "",
        priceTableId: initialData.price_table_id || initialData.priceTableId || "",
        notes: initialData.notes || "",
        latitude: initialData.latitude || undefined,
        longitude: initialData.longitude || undefined,
      });
    }
  }, [initialData, form]);

  const { data: representatives = [] } = useQuery({
    queryKey: ["representatives", "options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("representatives")
        .select("id, name, code")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: regions = [] } = useQuery({
    queryKey: ["regions", "options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("regions")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: priceTables = [] } = useQuery({
    queryKey: ["price-tables", "options"],
    queryFn: async () => {
      const { data } = await supabase
        .from("price_tables" as any)
        .select("id, name, target_audience")
        .eq("status", "active")
        .order("name");
      return (data || []) as any[];
    },
  });

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
        form.setValue("legalName", data.legalName || "");
        form.setValue("tradeName", data.tradeName || "");
        form.setValue("cep", data.cep || "");
        form.setValue("address", data.address || "");
        form.setValue("number", data.number || "");
        form.setValue("complement", data.complement || "");
        form.setValue("neighborhood", data.neighborhood || "");
        form.setValue("city", data.city || "");
        form.setValue("state", (data.state as any) || "");
        form.setValue("email", data.email || "");
        form.setValue("phone", data.phone || "");
        if (data.latitude && data.longitude) {
          form.setValue("latitude", data.latitude);
          form.setValue("longitude", data.longitude);
        }

        toast.success("Dados da empresa e localização preenchidos com sucesso!");
      } else {
        toast.error(result.message || "CNPJ não localizado");
      }
    } catch (error: any) {
      toast.error("Erro ao buscar CNPJ: " + error.message);
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  const handleSearchCep = async () => {
    const cepValue = form.getValues("cep");
    if (!cepValue) {
      toast.error("Digite um CEP para buscar");
      return;
    }
    const cleanCep = cepValue.replace(/\D/g, "");
    if (cleanCep.length !== 8) {
      toast.error("CEP deve conter 8 números");
      return;
    }

    try {
      setIsSearchingCep(true);
      const result = await searchCep({ data: { cep: cleanCep } });
      if (result.success && result.data) {
        const data = result.data;
        if (data.address) form.setValue("address", data.address);
        if (data.neighborhood) form.setValue("neighborhood", data.neighborhood);
        if (data.city) form.setValue("city", data.city);
        if (data.state) form.setValue("state", data.state);
        if (data.latitude && data.longitude) {
          form.setValue("latitude", data.latitude);
          form.setValue("longitude", data.longitude);
          toast.success("Endereço e coordenadas GPS localizados!");
        } else {
          toast.success("Endereço preenchido!");
        }
      } else {
        toast.error(result.message || "CEP não localizado");
      }
    } catch (err: any) {
      toast.error("Erro ao buscar CEP: " + err.message);
    } finally {
      setIsSearchingCep(false);
    }
  };

  const handleGeocodeCurrentAddress = async () => {
    const city = form.getValues("city");
    const state = form.getValues("state");
    if (!city || !state) {
      toast.error("Preencha ao menos a Cidade e o Estado (UF) para obter as coordenadas.");
      return;
    }

    try {
      setIsGeocoding(true);
      const result = await getCoordinates({
        data: {
          address: form.getValues("address") || undefined,
          number: form.getValues("number") || undefined,
          neighborhood: form.getValues("neighborhood") || undefined,
          city,
          state,
        }
      });

      if (result.success && result.latitude && result.longitude) {
        form.setValue("latitude", result.latitude);
        form.setValue("longitude", result.longitude);
        toast.success(`Coordenadas GPS capturadas: ${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`);
      } else {
        toast.error(result.message || "Não foi possível obter coordenadas para este endereço");
      }
    } catch (err: any) {
      toast.error("Erro ao buscar coordenadas: " + err.message);
    } finally {
      setIsGeocoding(false);
    }
  };

  async function onSubmit(values: z.infer<typeof clientSchema>) {
    try {
      setIsSubmitting(true);
      const cleanCnpj = values.cnpj ? values.cnpj.replace(/\D/g, "") : null;
      const cleanState = values.state ? values.state.trim().toUpperCase() : "GO";
      const repId = values.representativeId && values.representativeId !== "" && values.representativeId !== "none"
        ? values.representativeId
        : null;
      const regId = values.regionId && values.regionId !== "" && values.regionId !== "none"
        ? values.regionId
        : null;
      const priceId = values.priceTableId && values.priceTableId !== "" && values.priceTableId !== "none"
        ? values.priceTableId
        : null;

      if (clientId) {
        // Atualização de cliente existente via Supabase Client direto (com fallback de segurança)
        const updatePayload: any = {
          name: values.tradeName || values.legalName,
          legal_name: values.legalName,
          trade_name: values.tradeName,
          cnpj: cleanCnpj,
          state_registration: values.stateRegistration || null,
          segment: values.segment,
          client_type: values.clientType,
          status: values.status,
          contact_name: values.contactName || null,
          contact_role: values.contactRole || null,
          phone: values.phone || null,
          whatsapp: values.whatsapp || null,
          email: values.email || null,
          zip_code: values.cep || null,
          address: values.address || null,
          address_number: values.number || null,
          address_complement: values.complement || null,
          neighborhood: values.neighborhood || null,
          city: values.city || null,
          state: cleanState,
          latitude: values.latitude || null,
          longitude: values.longitude || null,
          representative_id: repId,
          region_id: regId,
          price_table_id: priceId,
          purchase_potential: values.purchasePotential,
          notes: values.notes || null,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('clients')
          .update(updatePayload)
          .eq('id', clientId);

        if (error) {
          console.warn("Falha no update direto do Supabase, tentando server fn:", error);
          await editClient({
            data: {
              id: clientId,
              ...values,
              cnpj: cleanCnpj,
              state: cleanState,
              representativeId: repId,
              regionId: regId,
              priceTableId: priceId,
            }
          });
        }

        toast.success("Cliente atualizado com sucesso!");
        queryClient.invalidateQueries({ queryKey: ["client", clientId] });
        queryClient.invalidateQueries({ queryKey: ["clients-list"] });
      } else {
        // Criação de novo cliente
        const { data: userSession } = await supabase.auth.getSession();
        const userId = userSession?.session?.user?.id || null;

        const insertPayload: any = {
          name: values.tradeName || values.legalName,
          legal_name: values.legalName,
          trade_name: values.tradeName,
          cnpj: cleanCnpj,
          state_registration: values.stateRegistration || null,
          segment: values.segment,
          client_type: values.clientType,
          status: values.status,
          contact_name: values.contactName || null,
          contact_role: values.contactRole || null,
          phone: values.phone || null,
          whatsapp: values.whatsapp || null,
          email: values.email || null,
          zip_code: values.cep || null,
          address: values.address || null,
          address_number: values.number || null,
          address_complement: values.complement || null,
          neighborhood: values.neighborhood || null,
          city: values.city || null,
          state: cleanState,
          latitude: values.latitude || null,
          longitude: values.longitude || null,
          representative_id: repId,
          region_id: regId,
          price_table_id: priceId,
          purchase_potential: values.purchasePotential,
          notes: values.notes || null,
          created_by: userId,
        };

        const { error, data: inserted } = await supabase
          .from('clients')
          .insert([insertPayload])
          .select('id')
          .single();

        if (error) {
          console.warn("Falha no insert direto do Supabase, tentando server fn:", error);
          await saveClient({
            data: {
              ...values,
              cnpj: cleanCnpj,
              state: cleanState,
              representativeId: repId,
              regionId: regId,
              priceTableId: priceId,
            },
          });
        }

        toast.success("Cliente cadastrado com sucesso!");
        queryClient.invalidateQueries({ queryKey: ["clients-list"] });
      }

      if (onSuccess) {
        onSuccess();
      } else {
        navigate({ to: "/clientes" });
      }
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar cliente: " + (error?.message ?? "erro desconhecido"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function onInvalid(errors: Record<string, unknown>) {
    const errorKeys = Object.keys(errors);
    const missing = errorKeys.map((k) => FIELD_LABELS[k] ?? k);

    // Mapear primeiro campo com erro para sua respectiva aba
    const companyFields = ["legalName", "tradeName", "cnpj", "stateRegistration", "segment", "clientType", "status"];
    const contactFields = ["contactName", "contactRole", "phone", "whatsapp", "email"];
    const addressFields = ["cep", "address", "number", "complement", "neighborhood", "city", "state", "latitude", "longitude"];
    const commercialFields = ["representativeId", "regionId", "priceTableId", "purchasePotential", "notes"];

    const firstError = errorKeys[0];
    if (companyFields.includes(firstError)) {
      setActiveTab("company");
    } else if (contactFields.includes(firstError)) {
      setActiveTab("contact");
    } else if (addressFields.includes(firstError)) {
      setActiveTab("address");
    } else if (commercialFields.includes(firstError)) {
      setActiveTab("commercial");
    }

    toast.error(
      `Preencha os campos obrigatórios: ${missing.slice(0, 6).join(", ")}${missing.length > 6 ? "…" : ""}`,
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-4">
            <TabsTrigger value="company" type="button">Empresa</TabsTrigger>
            <TabsTrigger value="contact" type="button">Contato</TabsTrigger>
            <TabsTrigger value="address" type="button">Endereço</TabsTrigger>
            <TabsTrigger value="commercial" type="button">Comercial</TabsTrigger>
          </TabsList>

          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>Dados da Empresa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="legalName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Razão Social</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Silva & Silva Ltda" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tradeName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Fantasia</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Ferragista Silva" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                              {...field}
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
                  <FormField
                    control={form.control}
                    name="stateRegistration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Inscrição Estadual</FormLabel>
                        <FormControl>
                          <Input placeholder="Isento ou Número" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="segment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Segmento</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "varejo"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="varejo">Varejo</SelectItem>
                            <SelectItem value="industria">Indústria</SelectItem>
                            <SelectItem value="servicos">Serviços</SelectItem>
                            <SelectItem value="farmacia">Farmácia</SelectItem>
                            <SelectItem value="construcao">Construção</SelectItem>
                            <SelectItem value="seguranca">Segurança do Trabalho</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="clientType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Cliente</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "pj"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pf">Pessoa Física</SelectItem>
                            <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                          </SelectContent>
                        </Select>
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
                        <Select onValueChange={field.onChange} value={field.value || "prospect"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="prospect">Prospect</SelectItem>
                            <SelectItem value="active">Ativo</SelectItem>
                            <SelectItem value="inactive">Inativo</SelectItem>
                            <SelectItem value="blocked">Bloqueado</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contact">
            <Card>
              <CardHeader>
                <CardTitle>Contato Principal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Contato</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: João Souza" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contactRole"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cargo</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Comprador" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input placeholder="(00) 0000-0000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="whatsapp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp</FormLabel>
                        <FormControl>
                          <Input placeholder="(00) 00000-0000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail comercial</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="email@cliente.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="address">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Endereço e Localização</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Preencha o CEP ou endereço para busca automática de coordenadas GPS
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGeocodeCurrentAddress}
                  disabled={isGeocoding}
                  className="gap-1.5 text-xs h-8"
                >
                  {isGeocoding ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                  )}
                  Capturar Coordenadas GPS
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="cep"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEP</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input
                              placeholder="00000-000"
                              {...field}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSearchCep();
                                }
                              }}
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleSearchCep}
                            disabled={isSearchingCep}
                            title="Buscar endereço por CEP"
                          >
                            {isSearchingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <div className="md:col-span-2 lg:col-span-3">
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Logradouro</FormLabel>
                          <FormControl>
                            <Input placeholder="Rua, Avenida..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número</FormLabel>
                        <FormControl>
                          <Input placeholder="123" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="complement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Complemento</FormLabel>
                        <FormControl>
                          <Input placeholder="Sala, Bloco..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="neighborhood"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bairro</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UF</FormLabel>
                          <FormControl>
                            <Input placeholder="GO" maxLength={2} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <FormField
                    control={form.control}
                    name="latitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5">
                          <span>Latitude</span>
                          {field.value != null && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.5 rounded font-mono font-medium">
                              Definida
                            </span>
                          )}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="any"
                            placeholder="-16.6869"
                            value={field.value ?? ""}
                            onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="longitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5">
                          <span>Longitude</span>
                          {field.value != null && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.5 rounded font-mono font-medium">
                              Definida
                            </span>
                          )}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="any"
                            placeholder="-49.2648"
                            value={field.value ?? ""}
                            onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="commercial">
            <Card>
              <CardHeader>
                <CardTitle>Informações Comerciais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="representativeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Representante Responsável</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "none"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o representante" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Sem representante vinculado</SelectItem>
                            {representatives.map((rep) => (
                              <SelectItem key={rep.id} value={rep.id}>
                                {rep.name ? `${rep.name} (${rep.code || 'REP'})` : (rep.code ?? "Representante")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="regionId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Região</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "none"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a região" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Sem região vinculada</SelectItem>
                            {regions.map((region) => (
                              <SelectItem key={region.id} value={region.id}>
                                {region.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="priceTableId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tabela de Preço Vinculada (Opcional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "none"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Padrão por Segmento / Multimarca" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Padrão por Segmento</SelectItem>
                            {priceTables.map((tab) => (
                              <SelectItem key={tab.id} value={tab.id}>
                                {tab.name} ({tab.target_audience})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="purchasePotential"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Potencial de Compra</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "medio"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o potencial" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="alto">Alto Potencial</SelectItem>
                            <SelectItem value="medio">Médio Potencial</SelectItem>
                            <SelectItem value="baixo">Baixo Potencial</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações Comerciais</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Informações relevantes para o comercial..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (onSuccess) {
                onSuccess();
              } else {
                navigate({ to: "/clientes" });
              }
            }}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {clientId ? "Atualizando..." : "Salvando..."}
              </>
            ) : (
              clientId ? "Salvar Alterações" : "Salvar Cliente"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
