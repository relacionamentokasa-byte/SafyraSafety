import { supabase } from '@/integrations/supabase/client';
import { formatDisplayName } from '@/lib/format-name';
import { fetchRepresentativesServer } from '@/lib/orders.functions';

export interface RepresentativeOption {
  id: string;
  name: string;
  code?: string | null;
  photo_url?: string | null;
}

/**
 * Busca a lista de representantes para selects e dropdowns do sistema.
 * Trata o campo `name` direto e o fallback para `profiles.full_name` via `user_id`, além de trazer `photo_url`.
 */
export async function getRepresentativeOptions(): Promise<RepresentativeOption[]> {
  try {
    let data: any[] = [];
    try {
      const serverReps = await fetchRepresentativesServer();
      if (serverReps && serverReps.length > 0) {
        data = serverReps;
      }
    } catch (errServer) {
      console.warn("[getRepresentativeOptions] fallback server:", errServer);
    }

    if (data.length === 0) {
      const { data: clientData, error } = await supabase
        .from('representatives')
        .select('id, name, code, user_id, status, photo_url')
        .order('name');

      if (error) {
        console.error('Erro ao buscar representantes:', error);
        return [];
      }
      data = clientData || [];
    }

    if (!data || data.length === 0) return [];

    // Se houver representantes sem nome ou sem foto cadastrado direto na tabela, busca via profiles
    const userIds = data
      .filter((r: any) => r.user_id)
      .map((r: any) => r.user_id);

    let profileMap: Record<string, { full_name?: string; avatar_path?: string }> = {};
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_path')
        .in('id', userIds);

      (profilesData || []).forEach((p: any) => {
        profileMap[p.id] = {
          full_name: p.full_name,
          avatar_path: p.avatar_path,
        };
      });
    }

    return data.map((r: any) => {
      const profile = r.user_id ? profileMap[r.user_id] : null;
      const rawName = r.name || profile?.full_name || 'Representante';
      const photo = r.photo_url || profile?.avatar_path || null;
      const formatted = formatDisplayName(rawName);
      return {
        id: r.id,
        name: r.code ? `${formatted} (${r.code})` : formatted,
        code: r.code,
        photo_url: photo,
      };
    });
  } catch (err) {
    console.error('Erro inesperado em getRepresentativeOptions:', err);
    return [];
  }
}
