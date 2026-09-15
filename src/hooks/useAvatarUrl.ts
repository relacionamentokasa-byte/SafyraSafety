import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SIGNED_URL_TTL = 60 * 60;

export function useAvatarUrl(
  avatarPath: string | null | undefined,
  bucket = "avatars-new-private",
) {
  return useQuery({
    queryKey: ["avatar-signed-url", bucket, avatarPath],
    queryFn: async () => {
      if (!avatarPath) return null;

      // Se já é uma URL completa, retornar direto (compatibilidade com dados antigos)
      if (avatarPath.startsWith("http://") || avatarPath.startsWith("https://")) {
        return avatarPath;
      }

      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(avatarPath, SIGNED_URL_TTL);

      if (error) {
        console.warn("[useAvatarUrl] Erro ao assinar URL:", error.message);
        return null;
      }

      return data.signedUrl;
    },
    enabled: !!avatarPath,
    staleTime: (SIGNED_URL_TTL / 2) * 1000, // Renova quando metade do TTL expirar
    gcTime: SIGNED_URL_TTL * 1000,
  });
}
