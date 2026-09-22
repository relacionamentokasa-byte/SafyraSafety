import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getCompanyByCnpj = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ cnpj: z.string() }).parse(data))
  .handler(async ({ data }) => {
    try {
      // Limpar o CNPJ para manter apenas números
      const cleanCnpj = data.cnpj.replace(/\D/g, "");
      
      if (cleanCnpj.length !== 14) {
        throw new Error("CNPJ inválido");
      }

      // Tentar BrasilAPI primeiro
      let response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      
      if (!response.ok) {
        // Fallback para Minha Receita (API pública e estável)
        console.log("BrasilAPI falhou, tentando Minha Receita...");
        response = await fetch(`https://minhareceita.org/${cleanCnpj}`);
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Erro ao buscar dados do CNPJ em todas as fontes");
      }

      const companyData = await response.json();

      const cepClean = (companyData.cep || companyData.zip_code || "").replace(/\D/g, "");
      const address = companyData.logradouro || companyData.address || "";
      const neighborhood = companyData.bairro || companyData.neighborhood || "";
      const city = companyData.municipio || companyData.city || "";
      const state = companyData.uf || companyData.state || "";

      let latitude: number | undefined = undefined;
      let longitude: number | undefined = undefined;

      // Geocodificação automática de coordenadas GPS para o cliente
      if (city && state) {
        try {
          const query = encodeURIComponent(`${address ? address + ', ' : ''}${city}, ${state}, Brasil`);
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
            headers: {
              'User-Agent': 'SafyraSafety/1.0 (comercial@safyrasafety.com.br)'
            }
          });
          if (geoRes.ok) {
            const geoJson = await geoRes.json();
            if (geoJson && geoJson.length > 0) {
              latitude = parseFloat(geoJson[0].lat);
              longitude = parseFloat(geoJson[0].lon);
            }
          }
        } catch (e) {
          // ignora erro de geo
        }
      }

      // Normalizar campos que podem vir de APIs diferentes
      return {
        success: true,
        data: {
          legalName: companyData.razao_social || companyData.legal_name || companyData.nome,
          tradeName: companyData.nome_fantasia || companyData.trade_name || companyData.fantasia || companyData.razao_social,
          cnpj: cleanCnpj,
          cep: cepClean,
          address: address,
          number: companyData.numero || companyData.address_number || "",
          complement: companyData.complemento || companyData.address_complement || "",
          neighborhood: neighborhood,
          city: city,
          state: state,
          phone: companyData.ddd_telefone_1 || companyData.telefone || companyData.phone || "",
          email: companyData.email || "",
          latitude,
          longitude,
        }
      };
    } catch (err: any) {
      console.error("Erro na busca de CNPJ:", err);
      return { 
        success: false, 
        message: err.message || "Não foi possível encontrar os dados deste CNPJ" 
      };
    }
  });
