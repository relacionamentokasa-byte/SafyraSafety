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

      // Normalizar campos que podem vir de APIs diferentes
      return {
        success: true,
        data: {
          legalName: companyData.razao_social || companyData.legal_name || companyData.nome,
          tradeName: companyData.nome_fantasia || companyData.trade_name || companyData.fantasia || companyData.razao_social,
          cnpj: cleanCnpj,
          cep: (companyData.cep || companyData.zip_code || "").replace(/\D/g, ""),
          address: companyData.logradouro || companyData.address || "",
          number: companyData.numero || companyData.address_number || "",
          complement: companyData.complemento || companyData.address_complement || "",
          neighborhood: companyData.bairro || companyData.neighborhood || "",
          city: companyData.municipio || companyData.city || "",
          state: companyData.uf || companyData.state || "",
          phone: companyData.ddd_telefone_1 || companyData.telefone || companyData.phone || "",
          email: companyData.email || "",
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
