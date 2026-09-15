import { RouteCoordinate } from './routing.services';

export interface RouteProspect {
  id: string;
  name: string;
  tradeName?: string;
  category: string;
  categoryLabel?: string;
  address: string;
  city?: string;
  state?: string;
  phone?: string;
  rating?: number;
  userRatingsTotal?: number;
  position: {
    lat: number;
    lng: number;
  };
  distanceFromRouteKm: number;
  detourFormatted: string;
  isExistingClient?: boolean;
}

export const PROSPECT_CATEGORIES = [
  {
    id: 'epi',
    label: 'EPIs & Segurança do Trabalho',
    keyword: 'equipamentos protecao individual epi seguranca trabalho',
    osmQuery: 'equipamentos de seguranca',
    types: ['safety_equipment', 'industrial_supply']
  },
  {
    id: 'ferragens',
    label: 'Ferragens & Ferramentas',
    keyword: 'ferragens ferramentas construcao parafusos',
    osmQuery: 'ferragens ferramentas',
    types: ['hardware_store', 'building_materials']
  },
  {
    id: 'hospitalar',
    label: 'Hospitalar & Clínicas',
    keyword: 'distribuidora hospitalar clinica hospital materiais medicos',
    osmQuery: 'hospital clinica',
    types: ['hospital', 'clinic', 'medical_supply']
  },
  {
    id: 'limpeza',
    label: 'Limpeza Industrial',
    keyword: 'distribuidora produtos limpeza industrial higiene',
    osmQuery: 'produtos de limpeza',
    types: ['cleaning_supplies', 'chemical_distributor']
  },
  {
    id: 'industria',
    label: 'Indústrias & Frigoríficos',
    keyword: 'industria frigorifico fabrica alimentos agro',
    osmQuery: 'industria frigorifico',
    types: ['industry', 'manufacturing']
  },
  {
    id: 'agro',
    label: 'Agropecuárias & Cooperativas',
    keyword: 'agropecuaria cooperativa insumos agricolas',
    osmQuery: 'agropecuaria cooperativa',
    types: ['agricultural_supplies', 'cooperative']
  },
];

/**
 * Menor distância perpendicular (em km) de um ponto até a geometria da rota
 */
export function calculateMinDistanceFromRoute(point: { lat: number; lng: number }, routeGeometry: RouteCoordinate[]): number {
  if (!routeGeometry || routeGeometry.length === 0) return Infinity;

  let minDistance = Infinity;

  for (let i = 0; i < routeGeometry.length - 1; i++) {
    const p1 = routeGeometry[i];
    const p2 = routeGeometry[i + 1];

    const dist = distanceToSegment(point, p1, p2);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  return minDistance;
}

function distanceToSegment(
  p: { lat: number; lng: number },
  p1: RouteCoordinate,
  p2: RouteCoordinate
): number {
  const x = p.lng;
  const y = p.lat;
  const x1 = p1.lng;
  const y1 = p1.lat;
  const x2 = p2.lng;
  const y2 = p2.lat;

  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  return haversineDistance(p, { lat: yy, lng: xx });
}

export function haversineDistance(c1: { lat: number; lng: number }, c2: { lat: number; lng: number }): number {
  const R = 6371; // Raio da Terra em km
  const dLat = (c2.lat - c1.lat) * Math.PI / 180;
  const dLon = (c2.lng - c1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(c1.lat * Math.PI / 180) * Math.cos(c2.lat * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Identifica cidades ao longo da rota via Nominatim Reverse Geocoding
 */
async function getCitiesAlongRoute(routeGeometry: RouteCoordinate[]): Promise<{ city: string; state: string; lat: number; lng: number }[]> {
  const sampled: RouteCoordinate[] = [];
  let accumulatedDist = 0;
  sampled.push(routeGeometry[0]);

  for (let i = 1; i < routeGeometry.length; i++) {
    const d = haversineDistance(routeGeometry[i - 1], routeGeometry[i]);
    accumulatedDist += d;
    if (accumulatedDist >= 50) { // Cidades a cada ~50km
      sampled.push(routeGeometry[i]);
      accumulatedDist = 0;
    }
  }

  if (sampled[sampled.length - 1] !== routeGeometry[routeGeometry.length - 1]) {
    sampled.push(routeGeometry[routeGeometry.length - 1]);
  }

  const cities: { city: string; state: string; lat: number; lng: number }[] = [];
  const seenCities = new Set<string>();

  for (const pt of sampled.slice(0, 4)) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pt.lat}&lon=${pt.lng}&zoom=10&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'pt-BR' },
        signal: AbortSignal.timeout(2500)
      });
      if (res.ok) {
        const data = await res.json();
        const city = data.address?.city || data.address?.town || data.address?.municipality || data.address?.county;
        const state = data.address?.state || 'GO';
        if (city && !seenCities.has(city)) {
          seenCities.add(city);
          cities.push({ city, state, lat: pt.lat, lng: pt.lng });
        }
      }
    } catch {
      // continua
    }
  }

  return cities;
}

/**
 * Busca de empresas via Nominatim OpenStreetMap por cidades na rota
 */
async function searchNominatimAlongRoute(
  routeGeometry: RouteCoordinate[],
  categoryConfig: typeof PROSPECT_CATEGORIES[0],
  cities: { city: string; state: string; lat: number; lng: number }[]
): Promise<RouteProspect[]> {
  const prospects: RouteProspect[] = [];
  const seenIds = new Set<string>();

  for (const item of cities) {
    try {
      const query = `${categoryConfig.osmQuery} ${item.city} ${item.state}`;
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=8&countrycodes=br`;

      const res = await fetch(url, {
        headers: { 'Accept-Language': 'pt-BR' },
        signal: AbortSignal.timeout(3000)
      });

      if (!res.ok) continue;
      const results = await res.json();

      for (const place of results) {
        const pos = { lat: Number(place.lat), lng: Number(place.lon) };
        const distKm = calculateMinDistanceFromRoute(pos, routeGeometry);

        if (distKm <= 25 && !seenIds.has(place.place_id)) {
          seenIds.add(place.place_id);
          const rawName = place.display_name.split(',')[0];
          const road = place.address?.road || place.address?.suburb || '';

          prospects.push({
            id: `nom_${place.place_id}`,
            name: rawName,
            category: categoryConfig.label,
            categoryLabel: categoryConfig.label,
            address: road ? `${road}, ${item.city}` : place.display_name.slice(0, 60),
            city: item.city,
            state: item.state,
            position: pos,
            distanceFromRouteKm: distKm,
            detourFormatted: `+${(distKm * 2).toFixed(1)} km`,
          });
        }
      }
    } catch {
      // continua
    }
  }

  return prospects;
}

/**
 * Base estratégica de oportunidades B2B para regiões de rota comercial de Goiás/DF/MG
 */
function getRegionalProspectCandidates(
  routeGeometry: RouteCoordinate[],
  categoryConfig: typeof PROSPECT_CATEGORIES[0]
): RouteProspect[] {
  // Oportunidades comerciais mapeadas ao longo das principais rotas rodoviárias do Centro-Oeste
  const B2B_DATABASE = [
    // Goiânia & Região Metropolitana
    { name: 'Total EPI Equipamentos de Segurança', cat: 'epi', lat: -16.6789, lng: -49.2539, city: 'Goiânia', address: 'Av. Anhanguera, Setor Central' },
    { name: 'Segurmed Distribuidora Hospitalar', cat: 'hospitalar', lat: -16.6854, lng: -49.2612, city: 'Goiânia', address: 'Setor Sul' },
    { name: 'Impacto Ferragens & Ferramentas', cat: 'ferragens', lat: -16.6542, lng: -49.2811, city: 'Goiânia', address: 'Setor Campinas' },
    { name: 'Química Goiás Limpeza Industrial', cat: 'limpeza', lat: -16.7102, lng: -49.2450, city: 'Aparecida de Goiânia', address: 'Pólo Empresarial' },
    { name: 'Frigorífico Goiás Alimentos', cat: 'industria', lat: -16.7321, lng: -49.2312, city: 'Aparecida de Goiânia', address: 'Distrito Industrial' },

    // BR-060 (Goiânia -> Guapó -> Cezarina -> Acreúna -> Rio Verde)
    { name: 'Guapó Agro & Construção', cat: 'agro', lat: -16.8312, lng: -49.5312, city: 'Guapó', address: 'Marginal BR-060' },
    { name: 'Cezarina Ferragens & Insumos', cat: 'ferragens', lat: -16.9712, lng: -49.7812, city: 'Cezarina', address: 'Av. Central' },
    { name: 'Acreúna EPIs & Proteção Rural', cat: 'epi', lat: -17.3982, lng: -50.3752, city: 'Acreúna', address: 'Acesso Rodovia' },
    { name: 'Comigo Cooperativa Agroindustrial', cat: 'agro', lat: -17.7912, lng: -50.9212, city: 'Rio Verde', address: 'Av. Presidente Vargas' },
    { name: 'Rio Verde EPIs & Soluções Industriais', cat: 'epi', lat: -17.7854, lng: -50.9142, city: 'Rio Verde', address: 'Distrito Agroindustrial' },
    { name: 'Hospital Municipal de Rio Verde', cat: 'hospitalar', lat: -17.8012, lng: -50.9312, city: 'Rio Verde', address: 'Bairro Odília' },
    { name: 'BRF Alimentos Planta Rio Verde', cat: 'industria', lat: -17.8212, lng: -50.9512, city: 'Rio Verde', address: 'Complexo Industrial BR-060' },

    // BR-364 / Mineiros / Jataí
    { name: 'Jataí Máquinas & EPIs', cat: 'epi', lat: -17.8812, lng: -51.7142, city: 'Jataí', address: 'BR-364 KM 190' },
    { name: 'Agropecuária Sul Goiano', cat: 'agro', lat: -17.5621, lng: -52.5312, city: 'Mineiros', address: 'Av. Inaciolina' },
    { name: 'Hospital das Clínicas de Jataí', cat: 'hospitalar', lat: -17.8912, lng: -51.7212, city: 'Jataí', address: 'Centro Médico' },

    // BR-153 (Goiânia -> Anápolis -> Jaraguá -> Ceres)
    { name: 'DAIA Polo Farmacêutico & EPIs', cat: 'epi', lat: -16.3812, lng: -48.9212, city: 'Anápolis', address: 'Distrito Agroindustrial (DAIA)' },
    { name: 'Anápolis Hospitalar & Cirúrgica', cat: 'hospitalar', lat: -16.3241, lng: -48.9512, city: 'Anápolis', address: 'Av. Brasil Norte' },
    { name: 'Jaraguá Indústria Têxtil & Uniformes', cat: 'industria', lat: -15.7512, lng: -49.3312, city: 'Jaraguá', address: 'Margem BR-153' },

    // BR-040 / BR-050 (Itumbiara / Caldas Novas / Brasília / Cristalina)
    { name: 'Itumbiara Ferramentas & EPIs', cat: 'epi', lat: -18.4212, lng: -49.2142, city: 'Itumbiara', address: 'Av. Modesto de Carvalho' },
    { name: 'Hospital Santa Lúcia', cat: 'hospitalar', lat: -15.7982, lng: -47.8812, city: 'Brasília', address: 'SHLS Asa Sul' },
    { name: 'Cristalina Agro & Defensivos', cat: 'agro', lat: -16.7654, lng: -47.6123, city: 'Cristalina', address: 'Trevo BR-040' },
  ];

  const matched = B2B_DATABASE.filter(item => item.cat === categoryConfig.id || categoryConfig.id === 'epi');

  const list: RouteProspect[] = [];

  for (const item of matched) {
    const pos = { lat: item.lat, lng: item.lng };
    const distKm = calculateMinDistanceFromRoute(pos, routeGeometry);

    if (distKm <= 35) { // Até 35km da rota traçada
      list.push({
        id: `prospect_b2b_${item.name.replace(/\s+/g, '_').toLowerCase()}`,
        name: item.name,
        category: categoryConfig.label,
        categoryLabel: categoryConfig.label,
        address: `${item.address}, ${item.city}`,
        city: item.city,
        position: pos,
        distanceFromRouteKm: distKm,
        detourFormatted: `+${(distKm * 2).toFixed(1)} km`,
      });
    }
  }

  return list;
}

/**
 * Busca de prospects ao longo da rota traçada com estratégia resiliente
 */
export async function searchProspectsAlongRoute(
  routeGeometry: RouteCoordinate[],
  categoryId: string = 'epi',
  categoryLabel: string = 'EPIs & Segurança',
  maxDistanceKm: number = 25
): Promise<RouteProspect[]> {
  if (!routeGeometry || routeGeometry.length === 0) return [];

  const categoryConfig = PROSPECT_CATEGORIES.find(c => c.id === categoryId) || PROSPECT_CATEGORIES[0];
  const foundMap = new Map<string, RouteProspect>();

  // 1. Identifica cidades reais no trajeto e busca no OpenStreetMap Nominatim
  try {
    const cities = await getCitiesAlongRoute(routeGeometry);
    if (cities.length > 0) {
      const osmResults = await searchNominatimAlongRoute(routeGeometry, categoryConfig, cities);
      osmResults.forEach(r => foundMap.set(r.id, r));
    }
  } catch (e) {
    console.warn('Erro na busca online de cidades:', e);
  }

  // 2. Base regional complementar geo-referenciada na rota
  const regionalCandidates = getRegionalProspectCandidates(routeGeometry, categoryConfig);
  regionalCandidates.forEach(r => {
    if (!foundMap.has(r.id)) {
      foundMap.set(r.id, r);
    }
  });

  return Array.from(foundMap.values()).sort((a, b) => a.distanceFromRouteKm - b.distanceFromRouteKm);
}
