import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type CurrentProfile = Partial<ProfileRow> & {
  id: string;
  email: string;
};

export function useCurrentProfile() {
  return useQuery<CurrentProfile | null>({
    queryKey: ["user-profile-check"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;

      return {
        ...data,
        id: user.id,
        email: user.email ?? "",
        full_name: data?.full_name ?? user.user_metadata?.full_name ?? "",
        phone: data?.phone ?? null,
        avatar_path: data?.avatar_path ?? null,
        avatar_url: data?.avatar_url ?? null,
        force_password_change: data?.force_password_change ?? false,
      };
    },
  });
}
