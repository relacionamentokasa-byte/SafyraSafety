import { supabase } from '@/integrations/supabase/client';
import { fetchManufacturersServer } from './orders.functions';

export interface ManufacturerOption {
  id: string;
  name: string;
  trade_name?: string | null;
  logo_path?: string | null;
  default_commission_rate?: number | null;
  status?: string | null;
}

/**
 * Retorna os fabricantes ativos cadastrados no sistema (Libus, Medix, Nutriex, etc.)
 */
export async function getManufacturerOptions(): Promise<ManufacturerOption[]> {
  try {
    const serverData = await fetchManufacturersServer();
    if (serverData && serverData.length > 0) {
      return serverData;
    }
  } catch (errServer) {
    console.warn("[getManufacturerOptions] Server fallback:", errServer);
  }

  try {
    const { data, error } = await supabase
      .from('manufacturers')
      .select('id, name, trade_name, logo_path, default_commission_rate, status')
      .order('name');

    if (error) {
      console.error('[getManufacturerOptions] Erro ao buscar fabricantes:', error);
      return [];
    }

    return (data || []).map(m => ({
      id: m.id,
      name: m.trade_name || m.name,
      trade_name: m.trade_name,
      logo_path: m.logo_path,
      default_commission_rate: m.default_commission_rate,
      status: m.status
    }));
  } catch (err) {
    console.error('[getManufacturerOptions] Erro inesperado:', err);
    return [];
  }
}
