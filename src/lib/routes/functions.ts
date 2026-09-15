import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getRouteSummary = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    origin: z.object({ lat: z.number(), lng: z.number() }),
    stops: z.array(z.object({ lat: z.number(), lng: z.number(), label: z.string().optional() })),
    destination: z.object({ lat: z.number(), lng: z.number() }).optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env['GOOGLE_MAPS_API_KEY']!;
    
    if (!apiKey) {
      return { 
        success: false, 
        message: "Google Maps API Key not configured." 
      };
    }

    // Em uma implementação real, chamaríamos a Google Distance Matrix API aqui.
    // Como a chave foi fornecida, o frontend usará o DirectionsService diretamente
    // para visualização e cálculo, mas o servidor pode validar ou otimizar.
    
    return {
      success: true,
      data: {
        message: "API Key is present. Client-side calculation recommended for interactive routing."
      }
    };
  });
