import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface AddressLookupResult {
  cep?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Busca dados de endereço e geolocalização a partir do CEP
 * Utiliza BrasilAPI (com fallback para ViaCEP) e OpenStreetMap Nominatim para coordenadas GPS
 */
export const getAddressByCep = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ cep: z.string() }).parse(data))
  .handler(async ({ data }): Promise<{ success: boolean; data?: AddressLookupResult; message?: string }> => {
    try {
      const cleanCep = data.cep.replace(/\D/g, "");
      if (cleanCep.length !== 8) {
        throw new Error("CEP deve conter 8 dígitos");
      }

      let addressData: any = null;

      // 1. Tentar BrasilAPI v2 (que já pode trazer coordenadas de localização)
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`);
        if (res.ok) {
          const json = await res.json();
          addressData = {
            cep: cleanCep,
            address: json.street || "",
            neighborhood: json.neighborhood || "",
            city: json.city || "",
            state: json.state || "",
            latitude: json.location?.coordinates?.latitude ? Number(json.location.coordinates.latitude) : undefined,
            longitude: json.location?.coordinates?.longitude ? Number(json.location.coordinates.longitude) : undefined,
          };
        }
      } catch (e) {
        // segue para fallback
      }

      // 2. Fallback para ViaCEP caso BrasilAPI falhe
      if (!addressData || !addressData.city) {
        try {
          const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
          if (res.ok) {
            const json = await res.json();
            if (!json.erro) {
              addressData = {
                cep: cleanCep,
                address: json.logradouro || "",
                neighborhood: json.bairro || "",
                city: json.localidade || "",
                state: json.uf || "",
              };
            }
          }
        } catch (e) {
          // segue
        }
      }

      if (!addressData || !addressData.city) {
        throw new Error("CEP não encontrado");
      }

      // 3. Se ainda não tiver latitude/longitude, geocodificar via Nominatim (OpenStreetMap)
      if (!addressData.latitude || !addressData.longitude) {
        try {
          const query = encodeURIComponent(`${addressData.address ? addressData.address + ', ' : ''}${addressData.neighborhood ? addressData.neighborhood + ', ' : ''}${addressData.city}, ${addressData.state}, Brasil`);
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
            headers: {
              'User-Agent': 'SafyraSafety/1.0 (comercial@safyrasafety.com.br)'
            }
          });
          if (geoRes.ok) {
            const geoJson = await geoRes.json();
            if (geoJson && geoJson.length > 0) {
              addressData.latitude = parseFloat(geoJson[0].lat);
              addressData.longitude = parseFloat(geoJson[0].lon);
            }
          }
        } catch (geoErr) {
          console.warn("Geocodificação Nominatim falhou:", geoErr);
        }
      }

      return {
        success: true,
        data: addressData,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || "Erro ao consultar CEP",
      };
    }
  });

/**
 * Geocodifica um endereço textual completo para capturar latitude e longitude
 */
export const geocodeAddress = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({
    address: z.string().optional(),
    number: z.string().optional(),
    neighborhood: z.string().optional(),
    city: z.string(),
    state: z.string(),
  }).parse(data))
  .handler(async ({ data }): Promise<{ success: boolean; latitude?: number; longitude?: number; message?: string }> => {
    try {
      const parts = [
        data.address,
        data.number,
        data.neighborhood,
        data.city,
        data.state,
        "Brasil"
      ].filter(Boolean);

      const query = encodeURIComponent(parts.join(", "));
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
        headers: {
          'User-Agent': 'SafyraSafety/1.0 (comercial@safyrasafety.com.br)'
        }
      });

      if (geoRes.ok) {
        const geoJson = await geoRes.json();
        if (geoJson && geoJson.length > 0) {
          return {
            success: true,
            latitude: parseFloat(geoJson[0].lat),
            longitude: parseFloat(geoJson[0].lon),
          };
        }
      }

      // Se pesquisa detalhada não encontrar, tenta pelo menos com cidade e estado
      const cityQuery = encodeURIComponent(`${data.city}, ${data.state}, Brasil`);
      const cityRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${cityQuery}&format=json&limit=1`, {
        headers: {
          'User-Agent': 'SafyraSafety/1.0 (comercial@safyrasafety.com.br)'
        }
      });

      if (cityRes.ok) {
        const cityJson = await cityRes.json();
        if (cityJson && cityJson.length > 0) {
          return {
            success: true,
            latitude: parseFloat(cityJson[0].lat),
            longitude: parseFloat(cityJson[0].lon),
          };
        }
      }

      return {
        success: false,
        message: "Não foi possível obter as coordenadas para este endereço",
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || "Erro na geocodificação do endereço",
      };
    }
  });
