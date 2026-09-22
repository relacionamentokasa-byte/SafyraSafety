import { supabase } from '@/integrations/supabase/client';
import { getClients } from '@/lib/clients.services';
import { calculateClientCommercialStatus } from '@/lib/client-metrics.utils';

export interface CityMetric {
  name: string;
  state: string;
  totalClients: number;
  activeClients: number;
  totalRevenue: number;
  ordersCount: number;
  topClient?: {
    id: string;
    name: string;
    revenue: number;
  };
}

export interface ClientRegionalHighlight {
  id: string;
  name: string;
  tradeName?: string;
  cnpj?: string;
  city?: string;
  state?: string;
  totalRevenue: number;
  ordersCount: number;
  lastOrderDate?: string;
  daysSinceLastOrder?: number;
  status: 'active' | 'warning' | 'churn';
}

export interface RegionDetailedSummary {
  id: string;
  name: string;
  state: string;
  statesCovered: string[];
  cities: string[];
  citiesMetrics: CityMetric[];
  totalClients: number;
  activeClients: number;
  prospects: number;
  totalRevenue: number;
  ordersCount: number;
  totalCommission: number;
  topClients: ClientRegionalHighlight[];
  warningClients: ClientRegionalHighlight[];
  representativesCount: number;
  status: 'active' | 'inactive';
}

export interface StateMapMetric {
  uf: string;
  name: string;
  regionName: string;
  totalRevenue: number;
  ordersCount: number;
  totalClients: number;
  activeClients: number;
  citiesCount: number;
  cities: CityMetric[];
  topClients: ClientRegionalHighlight[];
  warningClients: ClientRegionalHighlight[];
}

export const PREDEFINED_REGIONS = [
  {
    id: 'reg-go-metropolitana',
    name: 'Goiás - Metropolitana & Centro',
    state: 'GO',
    statesCovered: ['GO'],
    cities: ['Goiânia', 'Aparecida de Goiânia', 'Anápolis', 'Goianésia', 'Senador Canedo', 'Trindade', 'Inhumas'],
    status: 'active' as const
  },
  {
    id: 'reg-go-sul-sudoeste',
    name: 'Goiás - Sul & Sudoeste',
    state: 'GO',
    statesCovered: ['GO'],
    cities: ['Rio Verde', 'Itumbiara', 'Jataí', 'Mineiros', 'Quirinópolis', 'Catalão', 'Caldas Novas', 'Morrinhos', 'Santa Helena de Goiás'],
    status: 'active' as const
  },
  {
    id: 'reg-df-entorno',
    name: 'Distrito Federal & Entorno',
    state: 'DF',
    statesCovered: ['DF', 'GO'],
    cities: ['Brasília', 'Luziânia', 'Cristalina', 'Valparaíso de Goiás', 'Formosa', 'Águas Lindas de Goiás', 'Planaltina'],
    status: 'active' as const
  },
  {
    id: 'reg-mg-triangulo',
    name: 'Minas Gerais - Triângulo & Central',
    state: 'MG',
    statesCovered: ['MG'],
    cities: ['Uberlândia', 'Araguari', 'Patrocínio', 'Belo Horizonte', 'Uberaba', 'Ituiutaba'],
    status: 'active' as const
  },
  {
    id: 'reg-norte-expansao',
    name: 'Norte & Expansão (TO / PA / MA)',
    state: 'TO',
    statesCovered: ['TO', 'PA', 'MA'],
    cities: ['Palmas', 'Minaçu', 'Parauapebas', 'Ananindeua', 'São Luís', 'Araguaína', 'Gurupi'],
    status: 'active' as const
  }
];

export const UF_NAMES: Record<string, string> = {
  GO: 'Goiás',
  DF: 'Distrito Federal',
  MG: 'Minas Gerais',
  PA: 'Pará',
  MA: 'Maranhão',
  TO: 'Tocantins',
  SP: 'São Paulo',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  BA: 'Bahia',
  RJ: 'Rio de Janeiro',
  PR: 'Paraná',
  SC: 'Santa Catarina',
  RS: 'Rio Grande do Sul',
  ES: 'Espírito Santo',
  PE: 'Pernambuco',
  CE: 'Ceará',
  AM: 'Amazonas',
  RO: 'Rondônia',
  AC: 'Acre',
  AP: 'Amapá',
  RR: 'Roraima',
  PI: 'Piauí',
  RN: 'Rio Grande do Norte',
  PB: 'Paraíba',
  AL: 'Alagoas',
  SE: 'Sergipe'
};

/**
 * Retorna dados analíticos de territórios com mapa por estados, cidades e alertas de clientes.
 */
export async function getDetailedRegionalAnalytics(): Promise<{
  regions: RegionDetailedSummary[];
  statesMetrics: Record<string, StateMapMetric>;
  totalNationalRevenue: number;
  totalNationalOrders: number;
  totalNationalClients: number;
}> {
  // 1. Buscar Clientes
  const { data: allClients } = await getClients({ pageSize: 1500 });

  // 2. Buscar Pedidos reais aprovados/faturados
  let orders: any[] = [];
  try {
    const { data } = await supabase
      .from('orders')
      .select('id, client_id, total_amount, created_at, status')
      .neq('status', 'cancelled');
    if (data) orders = data;
  } catch (err) {
    console.warn('Orders fetch error:', err);
  }

  // 3. Buscar Comissões
  let commissions: any[] = [];
  try {
    const { data } = await supabase
      .from('commissions')
      .select('order_id, commission_value')
      .neq('status', 'cancelled');
    if (data) commissions = data;
  } catch (err) {
    console.warn('Commissions fetch error:', err);
  }

  const orderCommissionMap = new Map<string, number>();
  commissions.forEach(c => {
    orderCommissionMap.set(c.order_id, (orderCommissionMap.get(c.order_id) || 0) + Number(c.commission_value || 0));
  });

  // Mapear faturamento e pedidos por cliente
  const clientRevenueMap = new Map<string, {
    totalRevenue: number;
    ordersCount: number;
    lastOrderDate?: string;
    commissionTotal: number;
  }>();

  orders.forEach(o => {
    if (!o.client_id) return;
    const prev = clientRevenueMap.get(o.client_id) || {
      totalRevenue: 0,
      ordersCount: 0,
      lastOrderDate: undefined,
      commissionTotal: 0
    };
    prev.totalRevenue += Number(o.total_amount || 0);
    prev.ordersCount += 1;
    prev.commissionTotal += orderCommissionMap.get(o.id) || (Number(o.total_amount || 0) * 0.04);
    if (!prev.lastOrderDate || new Date(o.created_at) > new Date(prev.lastOrderDate)) {
      prev.lastOrderDate = o.created_at;
    }
    clientRevenueMap.set(o.client_id, prev);
  });

  const now = new Date();

  // Enriquecer cada cliente com métricas financeiras e dias desde a última compra usando a regra centralizada
  const clientsWithMetrics: ClientRegionalHighlight[] = allClients.map(c => {
    const metrics = clientRevenueMap.get(c.id) || {
      totalRevenue: 0,
      ordersCount: 0,
      lastOrderDate: undefined,
      commissionTotal: 0
    };

    const { status: commStatus, daysSinceLastOrder } = calculateClientCommercialStatus(metrics.lastOrderDate, now);
    const status: 'active' | 'warning' | 'churn' = commStatus === 'active' ? 'active' : commStatus === 'warning' ? 'warning' : 'churn';

    return {
      id: c.id,
      name: c.name || c.trade_name || 'Cliente',
      tradeName: c.trade_name,
      cnpj: c.cnpj,
      city: c.city?.trim() || 'Não informada',
      state: (c.state || 'GO').toUpperCase().trim(),
      totalRevenue: metrics.totalRevenue,
      ordersCount: metrics.ordersCount,
      lastOrderDate: metrics.lastOrderDate,
      daysSinceLastOrder,
      status
    };
  });

  // Agrupamento por Estados (UFs)
  const statesMetrics: Record<string, StateMapMetric> = {};

  clientsWithMetrics.forEach(client => {
    const uf = client.state || 'GO';
    if (!statesMetrics[uf]) {
      statesMetrics[uf] = {
        uf,
        name: UF_NAMES[uf] || uf,
        regionName: uf === 'GO' ? 'Goiás' : uf === 'DF' ? 'Distrito Federal' : uf === 'MG' ? 'Minas Gerais' : 'Expansão',
        totalRevenue: 0,
        ordersCount: 0,
        totalClients: 0,
        activeClients: 0,
        citiesCount: 0,
        cities: [],
        topClients: [],
        warningClients: []
      };
    }

    const stateEntry = statesMetrics[uf];
    stateEntry.totalRevenue += client.totalRevenue;
    stateEntry.ordersCount += client.ordersCount;
    stateEntry.totalClients += 1;
    if (client.status === 'active') stateEntry.activeClients += 1;

    // Cidades do Estado
    const cityName = client.city || 'Outros';
    let cityEntry = stateEntry.cities.find(ct => ct.name.toLowerCase() === cityName.toLowerCase());
    if (!cityEntry) {
      cityEntry = {
        name: cityName,
        state: uf,
        totalClients: 0,
        activeClients: 0,
        totalRevenue: 0,
        ordersCount: 0
      };
      stateEntry.cities.push(cityEntry);
    }
    cityEntry.totalClients += 1;
    if (client.status === 'active') cityEntry.activeClients += 1;
    cityEntry.totalRevenue += client.totalRevenue;
    cityEntry.ordersCount += client.ordersCount;

    if (!cityEntry.topClient || client.totalRevenue > cityEntry.topClient.revenue) {
      if (client.totalRevenue > 0) {
        cityEntry.topClient = {
          id: client.id,
          name: client.name,
          revenue: client.totalRevenue
        };
      }
    }
  });

  // Finalizar ordenação de cidades e clientes por estado
  Object.values(statesMetrics).forEach(state => {
    state.cities.sort((a, b) => b.totalRevenue - a.totalRevenue);
    state.citiesCount = state.cities.length;

    const stateClients = clientsWithMetrics.filter(c => c.state === state.uf);
    state.topClients = stateClients
      .filter(c => c.totalRevenue > 0)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5);

    state.warningClients = stateClients
      .filter(c => c.totalRevenue > 0 && c.status !== 'active')
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5);
  });

  // Agrupamento por Macrorregiões
  const regions: RegionDetailedSummary[] = PREDEFINED_REGIONS.map(reg => {
    const regCities = reg.cities.map(c => c.toLowerCase().trim());
    const regStates = reg.statesCovered.map(s => s.toUpperCase().trim());

    const matchedClients = clientsWithMetrics.filter(c => {
      const clientCity = c.city.toLowerCase().trim();
      const clientState = c.state.toUpperCase().trim();

      const cityMatch = regCities.some(rc => clientCity.includes(rc) || rc.includes(clientCity));
      const stateMatch = regStates.includes(clientState);

      if (reg.id === 'reg-go-metropolitana' || reg.id === 'reg-go-sul-sudoeste') {
        return clientState === 'GO' && (cityMatch || reg.cities.includes(c.city));
      }
      return cityMatch || (regCities.length === 0 && stateMatch);
    });

    const totalRevenue = matchedClients.reduce((sum, c) => sum + c.totalRevenue, 0);
    const ordersCount = matchedClients.reduce((sum, c) => sum + c.ordersCount, 0);
    const totalCommission = matchedClients.reduce((sum, c) => sum + (c.totalRevenue * 0.04), 0);
    const activeClients = matchedClients.filter(c => c.status === 'active').length;
    const prospects = matchedClients.filter(c => c.totalRevenue === 0).length;

    // Cidades da região
    const citiesMap = new Map<string, CityMetric>();
    matchedClients.forEach(c => {
      const cName = c.city;
      const prev = citiesMap.get(cName) || {
        name: cName,
        state: c.state,
        totalClients: 0,
        activeClients: 0,
        totalRevenue: 0,
        ordersCount: 0
      };
      prev.totalClients += 1;
      if (c.status === 'active') prev.activeClients += 1;
      prev.totalRevenue += c.totalRevenue;
      prev.ordersCount += c.ordersCount;

      if (!prev.topClient || c.totalRevenue > prev.topClient.revenue) {
        if (c.totalRevenue > 0) {
          prev.topClient = { id: c.id, name: c.name, revenue: c.totalRevenue };
        }
      }
      citiesMap.set(cName, prev);
    });

    const citiesMetrics = Array.from(citiesMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
    const displayCities = citiesMetrics.map(c => c.name);

    const topClients = matchedClients
      .filter(c => c.totalRevenue > 0)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5);

    const warningClients = matchedClients
      .filter(c => c.totalRevenue > 0 && c.status !== 'active')
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5);

    return {
      id: reg.id,
      name: reg.name,
      state: reg.state,
      statesCovered: reg.statesCovered,
      cities: displayCities.length > 0 ? displayCities : reg.cities,
      citiesMetrics,
      totalClients: matchedClients.length,
      activeClients,
      prospects,
      totalRevenue,
      ordersCount,
      totalCommission,
      topClients,
      warningClients,
      representativesCount: 1,
      status: reg.status
    };
  });

  const totalNationalRevenue = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const totalNationalOrders = orders.length;
  const totalNationalClients = allClients.length;

  return {
    regions,
    statesMetrics,
    totalNationalRevenue,
    totalNationalOrders,
    totalNationalClients
  };
}

/**
 * Função de compatibilidade com a tela de configurações de regiões
 */
export type RegionSummary = RegionDetailedSummary;

export async function getRegionsWithClientMetrics(): Promise<RegionSummary[]> {
  const analytics = await getDetailedRegionalAnalytics();
  return analytics.regions;
}

