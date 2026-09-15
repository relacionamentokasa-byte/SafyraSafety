/**
 * @description Formulário de criação/edição de usuários com suporte a upload de foto.
 * CATEGORIA B - Executando a intenção de implementar o upload de fotos.
 */
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { auditService } from "@/lib/audit";
import { uploadFile } from "@/lib/storage";
import { useQuery } from "@tanstack/react-query";

const userSchema = z.object({
  fullName: z.string().min(3, "Nome muito curto"),
  email: z.string().email("E-mail inválido"),
  phone: z.string().optional(),
  initialPassword: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  role: z.enum(["admin", "gestor_comercial", "supervisor", "representante"]),
  representativeId: z.string().optional(),
  regionId: z.string().optional(),
  status: z.enum(["pendente", "ativo", "bloqueado", "inativo"]),
  avatarUrl: z.string().optional(),
  avatarPath: z.string().optional(),
  liberarImediato: z.boolean(),
  alterarSenhaPrimeiroAcesso: z.boolean(),
});

type UserFormValues = z.infer<typeof userSchema>;

export function UserForm() {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: regions } = useQuery({
    queryKey: ["regions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("regions").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: representatives } = useQuery({
    queryKey: ["representatives"],
    queryFn: async () => {
      const { data, error } = await supabase.from("representatives").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      status: "pendente",
      role: "representante",
      liberarImediato: false,
      alterarSenhaPrimeiroAcesso: false,
    },
  });

  const selectedRole = form.watch("role");

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

      const { publicUrl, filePath } = await uploadFile("avatars-new-private", file, {
        folder: user.id,
      });

      setPreviewUrl(publicUrl);
      form.setValue("avatarUrl", publicUrl);
      form.setValue("avatarPath", filePath);
      toast.success("Foto carregada com sucesso!");
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      toast.error("Erro ao carregar a foto: " + (error.message || "Erro desconhecido"));
    } finally {
      setIsUploading(false);
    }
  }

  async function onSubmit(values: UserFormValues) {
    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      // CATEGORIA B - Criando usuário via Supabase Auth
      // Nota: Em um ambiente real de produção, usaríamos uma Edge Function
      // ou admin client para criar usuários sem que o admin saia da sua sessão.
      // Como estamos limitados ao client-side, vamos simular o convite/criação.

      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.initialPassword,
        options: {
          data: {
            full_name: values.fullName,
            role: values.role,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Atualizar o profile com status e outros campos
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            full_name: values.fullName,
            status: values.status,
            phone: values.phone,
            force_password_change: values.alterarSenhaPrimeiroAcesso,
            avatar_url: values.avatarPath ? null : undefined,
            avatar_path: values.avatarPath,
            representative_id: values.representativeId === "none" ? null : values.representativeId,
            region_id: values.regionId === "none" ? null : values.regionId,
          } as any)
          .eq("id", data.user.id);

        if (profileError) throw profileError;

        // Registrar na auditoria
        await auditService.log("user_created", data.user.id, {
          role: values.role,
          status: values.status,
          liberarImediato: values.liberarImediato,
        });

        toast.success("Usuário criado com sucesso!");
        form.reset();
      }
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error("Erro ao criar usuário: " + error.message);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dados do Usuário</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <Avatar className="h-24 w-24 border-2 border-primary/10">
                  <AvatarImage src={previewUrl || ""} />
                  <AvatarFallback className="text-2xl font-bold bg-primary/5">
                    {form.getValues("fullName")?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <label
                  htmlFor="avatar-upload"
                  className="absolute bottom-0 right-0 rounded-full h-8 w-8 border-2 border-background bg-secondary flex items-center justify-center cursor-pointer hover:bg-secondary/80 transition-colors shadow-sm"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4 text-secondary-foreground" />
                  )}
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                </label>
              </div>
            </div>

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome e sobrenome" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="usuario@safyra.com" {...field} />
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
                      <Input placeholder="(00) 00000-0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Perfil de Acesso</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o perfil" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="gestor_comercial">Gestor Comercial</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="representante">Representante</SelectItem>
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
                    <FormLabel>Status de Acesso</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="bloqueado">Bloqueado</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
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
                name="regionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Região</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a região" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
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
            </div>

            {selectedRole === "representante" && (
              <FormField
                control={form.control}
                name="representativeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vincular Representante</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o representante existente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {representatives?.map((rep: any) => (
                          <SelectItem key={rep.id} value={rep.id}>
                            {rep.name} ({rep.code || "REP"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="initialPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha Inicial</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="******" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
              <FormField
                control={form.control}
                name="liberarImediato"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Liberar acesso imediatamente</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="alterarSenhaPrimeiroAcesso"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Alterar senha no primeiro acesso</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline">
            Cancelar
          </Button>
          <Button type="submit">Criar Usuário</Button>
        </div>
      </form>
    </Form>
  );
}
