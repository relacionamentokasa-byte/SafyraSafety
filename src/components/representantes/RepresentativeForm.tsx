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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uploadFile } from "@/lib/storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

const representativeSchema = z.object({
  // Dados Pessoais
  fullName: z.string().min(2, "Nome é obrigatório"),
  cpf: z.string().optional().or(z.literal("")),
  birthDate: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  whatsapp: z.string().optional().or(z.literal("")),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),

  // Dados Comerciais
  code: z.string().optional().or(z.literal("")),
  regionId: z.string().optional().or(z.literal("")),
  commissionRate: z.coerce.number().min(0).max(100).default(0),
  monthlyGoal: z.coerce.number().min(0).default(0),
  status: z.enum(["active", "inactive"]).default("active"),

  // Endereço
  cep: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  number: z.string().optional().or(z.literal("")),
  complement: z.string().optional().or(z.literal("")),
  neighborhood: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  photoUrl: z.string().optional().or(z.literal("")),
});

interface RepresentativeFormProps {
  initialData?: any;
  representativeId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function RepresentativeForm({
  initialData,
  representativeId,
  onSuccess,
  onCancel,
}: RepresentativeFormProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialData?.photo_url || null);

  const { data: regions } = useQuery({
    queryKey: ["regions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("regions").select("*").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const form = useForm<z.infer<typeof representativeSchema>>({
    resolver: zodResolver(representativeSchema),
    defaultValues: {
      status: initialData?.status || "active",
      commissionRate: initialData?.commission_rate ?? 0,
      monthlyGoal: initialData?.monthly_goal ?? 0,
      fullName: initialData?.name || initialData?.profiles?.full_name || "",
      cpf: initialData?.cpf || "",
      birthDate: initialData?.birth_date || "",
      phone: initialData?.phone || "",
      whatsapp: initialData?.whatsapp || "",
      email: initialData?.email || "",
      code: initialData?.code || "",
      regionId: initialData?.region_id || "",
      cep: initialData?.cep || "",
      address: initialData?.address || "",
      number: initialData?.number || "",
      complement: initialData?.complement || "",
      neighborhood: initialData?.neighborhood || "",
      city: initialData?.city || "",
      photoUrl: initialData?.photo_url || initialData?.profiles?.avatar_path || "",
    },
  });

  useEffect(() => {
    if (initialData) {
      const currentPhoto = initialData.photo_url || initialData.profiles?.avatar_path || "";
      form.reset({
        status: initialData.status || "active",
        commissionRate: initialData.commission_rate ?? 0,
        monthlyGoal: initialData.monthly_goal ?? 0,
        fullName: initialData.name || initialData.profiles?.full_name || "",
        cpf: initialData.cpf || "",
        birthDate: initialData.birth_date || "",
        phone: initialData.phone || "",
        whatsapp: initialData.whatsapp || "",
        email: initialData.email || "",
        code: initialData.code || "",
        regionId: initialData.region_id || "",
        cep: initialData.cep || "",
        address: initialData.address || "",
        number: initialData.number || "",
        complement: initialData.complement || "",
        neighborhood: initialData.neighborhood || "",
        city: initialData.city || "",
        photoUrl: currentPhoto,
      });
      setPreviewUrl(currentPhoto || null);
    }
  }, [initialData, form]);

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);

      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        toast.error("Escolha uma imagem JPEG, PNG ou WebP.");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error("A foto deve ter no máximo 5 MB.");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Utiliza bucket company_assets_v2 com pasta avatars para URLs permanentes e públicas
      const { publicUrl } = await uploadFile("company_assets_v2", file, {
        folder: "avatars",
      });

      setPreviewUrl(publicUrl);
      form.setValue("photoUrl", publicUrl, { shouldValidate: true });
      toast.success("Foto carregada com sucesso!");
    } catch (error: any) {
      console.error("Error uploading photo:", error);
      toast.error("Erro ao carregar a foto: " + (error.message || "Erro desconhecido"));
    } finally {
      setIsUploading(false);
    }
  }

  async function onSubmit(values: z.infer<typeof representativeSchema>) {
    try {
      setIsSubmitting(true);
      const region = regions?.find((r) => r.id === values.regionId);

      const sanitizedBirthDate = values.birthDate && values.birthDate.trim() !== "" ? values.birthDate : null;
      const sanitizedRegionId = values.regionId && values.regionId.trim() !== "" ? values.regionId : null;
      const sanitizedCpf = values.cpf && values.cpf.trim() !== "" ? values.cpf : null;
      const sanitizedPhone = values.phone && values.phone.trim() !== "" ? values.phone : null;
      const sanitizedWhatsapp = values.whatsapp && values.whatsapp.trim() !== "" ? values.whatsapp : null;
      const sanitizedEmail = values.email && values.email.trim() !== "" ? values.email : null;
      const sanitizedCode = values.code && values.code.trim() !== "" ? values.code : null;
      const sanitizedCep = values.cep && values.cep.trim() !== "" ? values.cep : null;
      const sanitizedAddress = values.address && values.address.trim() !== "" ? values.address : null;
      const sanitizedNumber = values.number && values.number.trim() !== "" ? values.number : null;
      const sanitizedComplement = values.complement && values.complement.trim() !== "" ? values.complement : null;
      const sanitizedNeighborhood = values.neighborhood && values.neighborhood.trim() !== "" ? values.neighborhood : null;
      const sanitizedCity = values.city && values.city.trim() !== "" ? values.city : null;

      if (representativeId) {
        const photo = values.photoUrl || previewUrl || null;
        const { error } = await supabase
          .from("representatives")
          .update({
            name: values.fullName,
            cpf: sanitizedCpf,
            birth_date: sanitizedBirthDate,
            phone: sanitizedPhone,
            whatsapp: sanitizedWhatsapp,
            email: sanitizedEmail,
            code: sanitizedCode,
            region_id: sanitizedRegionId,
            state: region?.state || "GO",
            commission_rate: values.commissionRate,
            monthly_goal: values.monthlyGoal,
            status: values.status,
            photo_url: photo,
            cep: sanitizedCep,
            address: sanitizedAddress,
            number: sanitizedNumber,
            complement: sanitizedComplement,
            neighborhood: sanitizedNeighborhood,
            city: sanitizedCity,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", representativeId);

        if (error) throw error;

        // Se o representante estiver vinculado a um profile, sincronizar nome e avatar_path
        if (initialData?.user_id) {
          await supabase
            .from("profiles")
            .update({
              full_name: values.fullName,
              avatar_path: photo,
              updated_at: new Date().toISOString(),
            })
            .eq("id", initialData.user_id);
        }

        toast.success("Representante atualizado com sucesso!");
        queryClient.invalidateQueries({ queryKey: ["representative-detail", representativeId] });
        queryClient.invalidateQueries({ queryKey: ["representatives-list"] });
      } else {
        const { saveRepresentative } = await import("@/lib/representatives.functions");
        await saveRepresentative({
          data: {
            fullName: values.fullName,
            cpf: sanitizedCpf || "",
            birthDate: sanitizedBirthDate || "",
            phone: sanitizedPhone || "",
            whatsapp: sanitizedWhatsapp || "",
            email: sanitizedEmail || "",
            code: sanitizedCode || "",
            regionId: sanitizedRegionId || "",
            state: region?.state || "GO",
            commissionRate: values.commissionRate,
            monthlyGoal: values.monthlyGoal,
            status: values.status,
            photoUrl: values.photoUrl || previewUrl || undefined,
            cep: sanitizedCep || "",
            address: sanitizedAddress || "",
            number: sanitizedNumber || "",
            complement: sanitizedComplement || "",
            neighborhood: sanitizedNeighborhood || "",
            city: sanitizedCity || "",
          },
        });
        toast.success("Representante cadastrado com sucesso!");
        queryClient.invalidateQueries({ queryKey: ["representatives-list"] });
      }

      if (onSuccess) {
        onSuccess();
      } else {
        navigate({ to: "/representantes" });
      }
    } catch (error: any) {
      console.error("Error saving representative:", error);
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const onInvalid = (errors: any) => {
    console.error("Form validation errors:", errors);
    const personalFields = ["fullName", "cpf", "birthDate", "phone", "whatsapp", "email"];
    const commercialFields = ["code", "regionId", "commissionRate", "monthlyGoal", "status"];
    const addressFields = ["cep", "address", "number", "complement", "neighborhood", "city"];

    const errorKeys = Object.keys(errors);
    if (errorKeys.some((k) => personalFields.includes(k))) {
      setActiveTab("personal");
    } else if (errorKeys.some((k) => commercialFields.includes(k))) {
      setActiveTab("commercial");
    } else if (errorKeys.some((k) => addressFields.includes(k))) {
      setActiveTab("address");
    }

    const firstError = Object.values(errors)[0] as any;
    toast.error("Preencha os campos obrigatórios: " + (firstError?.message || "Verifique o formulário"));
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="personal">Dados Pessoais</TabsTrigger>
            <TabsTrigger value="commercial">Comercial</TabsTrigger>
            <TabsTrigger value="address">Endereço</TabsTrigger>
          </TabsList>

          <TabsContent value="personal">
            <Card>
              <CardHeader>
                <CardTitle>Informações Pessoais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center justify-center mb-6 space-y-4">
                  <div className="relative group">
                    <Avatar className="h-28 w-28 border-4 border-background shadow-xl ring-2 ring-primary/10">
                      <AvatarImage src={previewUrl || ""} className="object-cover" />
                      <AvatarFallback className="text-3xl font-bold bg-muted text-muted-foreground">
                        {form.getValues("fullName")?.charAt(0) || "R"}
                      </AvatarFallback>
                    </Avatar>

                    {isUploading && (
                      <div className="absolute inset-0 bg-background/60 rounded-full flex items-center justify-center backdrop-blur-[2px]">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    )}

                    <label
                      htmlFor="photo-upload"
                      className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full cursor-pointer shadow-lg hover:bg-primary/90 transition-all hover:scale-105"
                    >
                      <Camera className="h-4 w-4" />
                      <input
                        id="photo-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Clique no ícone de câmera para adicionar ou alterar a foto.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Carlos Silva" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF</FormLabel>
                        <FormControl>
                          <Input placeholder="000.000.000-00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="birthDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Nascimento</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
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
                </div>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@exemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                    name="regionId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Região de Atuação</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a região" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {regions?.map((r: any) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name} - {r.state}
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
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código do Representante</FormLabel>
                        <FormControl>
                          <Input placeholder="REP-001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          value={field.value}
                        >
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
                    control={form.control}
                    name="commissionRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Comissão (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="monthlyGoal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meta Mensal (R$)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="100"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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

          <TabsContent value="address">
            <Card>
              <CardHeader>
                <CardTitle>Endereço</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="cep"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl>
                        <Input placeholder="00000-000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-3">
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
                          <Input placeholder="Apto, Sala..." {...field} />
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel ? onCancel : () => navigate({ to: "/representantes" })}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : representativeId ? (
              "Salvar Alterações"
            ) : (
              "Salvar Representante"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
