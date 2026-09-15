import { supabase } from "@/integrations/supabase/client";
import { Client } from "@/types/database.types";

export interface ClientFilters {
  search?: string;
  status?: string;
  segment?: string;
  state?: string;
  page?: number;
  pageSize?: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * Busca clientes persistidos no banco Supabase atual
 */
export async function getClients(
  filters: ClientFilters = {},
): Promise<{ data: any[]; count: number }> {
  const { search = "", status = "all", page = 0, pageSize = 10 } = filters;
  const term = search.toLowerCase().trim();

  let dbClients: any[] = [];
  try {
    const { data, error } = await supabase
      .from("clients")
      .select("*, representatives(id, name, photo_url)");
    if (!error && data) dbClients = data;
  } catch (err) {
    console.warn("Supabase clients fetch error:", err);
  }

  let filtered = dbClients.filter((c) => Boolean(c.cnpj && c.cnpj.replace(/\D/g, "").length === 14));

  // Ordenação alfabética por Nome / Razão Social
  filtered.sort((a, b) => {
    const nameA = String(a.trade_name || a.name || a.legal_name || "").toLowerCase();
    const nameB = String(b.trade_name || b.name || b.legal_name || "").toLowerCase();
    return nameA.localeCompare(nameB, "pt-BR");
  });

  if (term) {
    filtered = filtered.filter((c) => {
      const name = String(c.name || "").toLowerCase();
      const legalName = String(c.legal_name || "").toLowerCase();
      const cnpj = String(c.cnpj || "").toLowerCase();
      const city = String(c.city || "").toLowerCase();
      const state = String(c.state || "").toLowerCase();
      const notes = String(c.notes || "").toLowerCase();

      return (
        name.includes(term) ||
        legalName.includes(term) ||
        cnpj.includes(term) ||
        city.includes(term) ||
        state.includes(term) ||
        notes.includes(term)
      );
    });
  }

  if (status !== "all") {
    filtered = filtered.filter((c) => c.status === status);
  }

  const totalCount = filtered.length;
  const start = page * pageSize;
  const paginated = filtered.slice(start, start + pageSize);

  return {
    data: paginated,
    count: totalCount,
  };
}

/**
 * Busca um único cliente pelo seu ID ou CNPJ
 */
export async function getClientById(id: string): Promise<any | null> {
  try {
    const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();

    if (!error && data) {
      return data;
    }
  } catch (err) {
    console.warn("Fallback para buscar cliente canônico por ID:", err);
  }

  return null;
}

/**
 * Busca estatísticas agregadas da carteira de clientes
 */
export async function getClientsStats() {
  let dbClients: any[] = [];
  try {
    const { data, error } = await supabase.from("clients").select("*");
    if (!error && data) dbClients = data;
  } catch (err) {
    console.warn("Supabase clients fetch error:", err);
  }

  const allClients = dbClients.filter((c) => Boolean(c.cnpj && c.cnpj.replace(/\D/g, "").length === 14));

  return {
    total: allClients.length,
    active: allClients.filter((c) => c.status === "active").length,
    prospect: allClients.filter((c) => c.status === "prospect").length,
  };
}

/**
 * Resolve um cliente persistido e retorna seu UUID.
 */
export async function ensureClientInDatabase(
  clientId: string,
  representativeId: string,
): Promise<string> {
  if (!isUuid(representativeId)) {
    throw new Error("Representante inválido");
  }

  if (!isUuid(clientId)) {
    throw new Error("Cliente inválido");
  }

  const { data: existing, error } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .maybeSingle();

  if (error) throw error;
  if (!existing) throw new Error("Cliente não encontrado no banco");

  return existing.id;
}

// Coordenadas padrão de cidades brasileiras para geocodificação de fallback
const CITY_FALLBACK_COORDS: Record<string, { lat: number; lng: number }> = {
  goiânia: { lat: -16.6869, lng: -49.2648 },
  "aparecida de goiânia": { lat: -16.8227, lng: -49.2458 },
  brasília: { lat: -15.7975, lng: -47.8919 },
  itumbiara: { lat: -18.4194, lng: -49.2172 },
  "rio verde": { lat: -17.7925, lng: -50.9192 },
  cristalina: { lat: -16.7686, lng: -47.6139 },
  luziânia: { lat: -16.2528, lng: -47.95 },
  catalão: { lat: -18.1658, lng: -47.9464 },
  jataí: { lat: -17.8814, lng: -51.7144 },
  anápolis: { lat: -16.3267, lng: -48.9534 },
  mineiros: { lat: -17.5694, lng: -52.5511 },
  quirinópolis: { lat: -18.4483, lng: -50.4517 },
  minaçu: { lat: -13.5333, lng: -48.22 },
  goianésia: { lat: -15.3197, lng: -49.1175 },
  araguari: { lat: -18.6486, lng: -48.1872 },
  "belo horizonte": { lat: -19.9167, lng: -43.9345 },
  patrocínio: { lat: -18.9439, lng: -46.9931 },
  ananindeua: { lat: -1.3656, lng: -48.3722 },
  "são luís": { lat: -2.5391, lng: -44.2829 },
  parauapebas: { lat: -6.0675, lng: -49.9022 },
  palmas: { lat: -10.1844, lng: -48.3336 },
};

/**
 * Busca todos os clientes com coordenadas geográficas para uso no Google Maps e Roteirização
 */
export async function getMapClients(search?: string): Promise<any[]> {
  const result = await getClients({ search, pageSize: 500 });
  return result.data.map((c) => {
    if (c.latitude != null && c.longitude != null) {
      return c;
    }
    const cityKey = String(c.city || "")
      .toLowerCase()
      .trim();
    const fallback = CITY_FALLBACK_COORDS[cityKey] || CITY_FALLBACK_COORDS["goiânia"];
    return {
      ...c,
      latitude: fallback.lat,
      longitude: fallback.lng,
    };
  });
}
