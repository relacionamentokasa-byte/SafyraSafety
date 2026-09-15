export interface RouteCoordinate {
  lat: number;
  lng: number;
}

export interface RouteResult {
  distanceKm: number;
  distanceFormatted: string;
  durationMinutes: number;
  durationFormatted: string;
  geometry: RouteCoordinate[]; // Lista de pontos reais da rodovia (curvas)
}

/**
 * Calcula rota real por rodovia utilizando o OSRM (Open Source Routing Machine)
 * Retorna as coordenadas detalhadas das estradas, distância em km e tempo de viagem.
 */
export async function calculateRoadRoute(stops: RouteCoordinate[]): Promise<RouteResult | null> {
  if (!stops || stops.length < 2) return null;

  try {
    // Formato OSRM: {lng},{lat};{lng},{lat}...
    const coordinatesString = stops
      .map(stop => `${stop.lng.toFixed(6)},${stop.lat.toFixed(6)}`)
      .join(';');

    const url = `https://router.project-osrm.org/route/v1/driving/${coordinatesString}?overview=full&geometries=geojson`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`OSRM HTTP error: ${response.status}`);
    }

    const data = await response.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const distanceMeters = route.distance;
      const durationSeconds = route.duration;

      const distanceKm = distanceMeters / 1000;
      const durationMinutes = Math.round(durationSeconds / 60);

      // GeoJSON coordinates são [lng, lat]
      const geometry: RouteCoordinate[] = route.geometry.coordinates.map((coord: [number, number]) => ({
        lat: coord[1],
        lng: coord[0]
      }));

      const hours = Math.floor(durationMinutes / 60);
      const mins = durationMinutes % 60;
      const durationFormatted = hours > 0 ? `${hours}h ${mins}min` : `${mins} min`;

      return {
        distanceKm,
        distanceFormatted: `${distanceKm.toFixed(1)} km`,
        durationMinutes,
        durationFormatted,
        geometry
      };
    }
  } catch (error) {
    console.warn('Erro ao consultar OSRM, aplicando fallback geodésico:', error);
  }

  // Fallback se serviço externo estiver offline
  let totalKm = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const c1 = stops[i];
    const c2 = stops[i + 1];
    const R = 6371;
    const dLat = (c2.lat - c1.lat) * Math.PI / 180;
    const dLon = (c2.lng - c1.lng) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(c1.lat * Math.PI / 180) * Math.cos(c2.lat * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    totalKm += (R * c) * 1.3; // Fator de sinuosidade de rodovia
  }

  const durationMin = Math.round((totalKm / 65) * 60);
  const hours = Math.floor(durationMin / 60);
  const mins = durationMin % 60;

  return {
    distanceKm: totalKm,
    distanceFormatted: `${totalKm.toFixed(1)} km`,
    durationMinutes: durationMin,
    durationFormatted: hours > 0 ? `${hours}h ${mins}min` : `${mins} min`,
    geometry: stops
  };
}
