import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, Loader2, UserRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAvatarUrl } from "@/hooks/useAvatarUrl";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile } from "@/lib/storage";
import { toast } from "sonner";

const AVATAR_BUCKET = "avatars-new-private";
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome completo"),
  phone: z.string().trim().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export const Route = createFileRoute("/minha-conta")({
  component: MyAccountPage,
});

function MyAccountPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: profile, isLoading } = useCurrentProfile();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: "",
      phone: "",
    },
  });

  const { data: currentAvatarUrl } = useAvatarUrl(profile?.avatar_path || profile?.avatar_url);
  const displayName = form.watch("fullName") || profile?.full_name || "Usuário";
  const displayedAvatarUrl = previewUrl || currentAvatarUrl || "";

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  const discardSelectedFile = useCallback(() => {
    revokePreview();
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [revokePreview]);

  useEffect(() => {
    if (profile) {
      form.reset({
        fullName: profile.full_name ?? "",
        phone: profile.phone ?? "",
      });
    }
  }, [form, profile]);

  useEffect(() => {
    if (!isLoading && !profile) {
      navigate({ to: "/auth" });
    }
  }, [isLoading, navigate, profile]);

  useEffect(() => {
    return () => revokePreview();
  }, [revokePreview]);

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      event.currentTarget.value = "";
      toast.error("Escolha uma imagem JPEG, PNG ou WebP.");
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      event.currentTarget.value = "";
      toast.error("A foto deve ter no máximo 5 MB.");
      return;
    }

    revokePreview();
    const nextPreviewUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextPreviewUrl;
    setSelectedFile(file);
    setPreviewUrl(nextPreviewUrl);
  };

  const handleCancel = () => {
    if (!profile) return;

    form.reset({
      fullName: profile.full_name ?? "",
      phone: profile.phone ?? "",
    });
    discardSelectedFile();
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!profile) return;

    setIsSaving(true);
    let uploadedFilePath: string | null = null;
    let profileSaved = false;

    try {
      let avatarPath = profile.avatar_path;

      if (selectedFile) {
        const upload = await uploadFile(AVATAR_BUCKET, selectedFile, {
          folder: profile.id,
        });
        avatarPath = upload.filePath;
        uploadedFilePath = upload.filePath;
      }

      const profileUpdate = {
        full_name: values.fullName,
        phone: values.phone || null,
        ...(selectedFile
          ? {
              avatar_path: avatarPath,
              avatar_url: null,
            }
          : {}),
      };

      const { data: savedProfile, error } = await supabase
        .from("profiles")
        .upsert({ id: profile.id, ...profileUpdate }, { onConflict: "id" })
        .select("id")
        .single();

      if (error) throw error;
      if (!savedProfile?.id) throw new Error("O banco não confirmou a atualização do perfil");
      profileSaved = true;

      if (
        selectedFile &&
        profile.avatar_path &&
        profile.avatar_path.startsWith(`${profile.id}/`) &&
        profile.avatar_path !== avatarPath
      ) {
        await supabase.storage.from(AVATAR_BUCKET).remove([profile.avatar_path]);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["user-profile-check"] }),
        queryClient.invalidateQueries({ queryKey: ["avatar-signed-url"] }),
      ]);

      discardSelectedFile();
      toast.success("Perfil atualizado com sucesso!");
    } catch (error: unknown) {
      if (uploadedFilePath && !profileSaved) {
        await supabase.storage.from(AVATAR_BUCKET).remove([uploadedFilePath]);
      }

      const message = error instanceof Error ? error.message : "Não foi possível salvar o perfil";
      toast.error(`Erro ao atualizar o perfil: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !profile) {
    return (
      <AppLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Conta</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Minha conta</h1>
          <p className="mt-2 text-muted-foreground">
            Atualize seus dados e escolha a foto que aparece no sistema.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Editar perfil</CardTitle>
            <CardDescription>
              O e-mail da conta é gerenciado pelo acesso do sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 sm:flex-row sm:items-center">
                <div className="relative">
                  <Avatar className="h-24 w-24 border-2 border-primary/10">
                    <AvatarImage src={displayedAvatarUrl} alt={`Foto de ${displayName}`} />
                    <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">
                      {displayName.charAt(0).toUpperCase() || <UserRound size={28} />}
                    </AvatarFallback>
                  </Avatar>
                  <label
                    htmlFor="account-avatar-upload"
                    className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                    title="Escolher foto"
                  >
                    <Camera className="h-4 w-4" />
                    <input
                      ref={fileInputRef}
                      id="account-avatar-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleAvatarChange}
                      disabled={isSaving}
                    />
                  </label>
                </div>
                <div className="text-center sm:text-left">
                  <p className="font-medium">Foto do perfil</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    JPEG, PNG ou WebP. Até 5 MB. O upload acontece ao salvar.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="account-full-name">Nome completo</Label>
                  <Input
                    id="account-full-name"
                    {...form.register("fullName")}
                    disabled={isSaving}
                  />
                  {form.formState.errors.fullName && (
                    <p className="text-sm font-medium text-destructive">
                      {form.formState.errors.fullName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account-phone">Telefone</Label>
                  <Input id="account-phone" {...form.register("phone")} disabled={isSaving} />
                  {form.formState.errors.phone && (
                    <p className="text-sm font-medium text-destructive">
                      {form.formState.errors.phone.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="account-email">E-mail</Label>
                  <Input id="account-email" value={profile.email} readOnly disabled />
                  <p className="text-sm text-muted-foreground">
                    O e-mail não pode ser alterado nesta tela.
                  </p>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar alterações
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
