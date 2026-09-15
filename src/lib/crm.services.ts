import { supabase } from "@/integrations/supabase/client";
import { CRMStage } from "@/types/database.types";

export const DEFAULT_CRM_STAGES: CRMStage[] = [
  {
    id: "stage-prospeccao",
    name: "Prospecção / Primeiro Contato",
    description: "Identificação de potencial e primeiro alinhamento",
    color: "#3b82f6",
    sort_order: 1,
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "stage-apresentacao",
    name: "Visita / Apresentação",
    description: "Visita técnica ou apresentação de catálogo e mix",
    color: "#8b5cf6",
    sort_order: 2,
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "stage-proposta",
    name: "Cotação / Proposta Enviada",
    description: "Proposta comercial ou cotação em análise pelo cliente",
    color: "#f59e0b",
    sort_order: 3,
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "stage-negociacao",
    name: "Negociação / Fechamento",
    description: "Ajuste de condições comerciais, prazos e faturamento",
    color: "#10b981",
    sort_order: 4,
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

/**
 * Busca as etapas do funil de vendas (CRM Stages) no banco de dados.
 * Se a tabela estiver vazia, retorna as etapas padrão do processo comercial.
 */
export async function getCrmStages(): Promise<CRMStage[]> {
  try {
    const { data, error } = await supabase
      .from("crm_stages")
      .select("*")
      .order("sort_order");

    if (error) {
      console.warn("Aviso ao buscar crm_stages, usando etapas padrão:", error.message);
      return DEFAULT_CRM_STAGES;
    }

    if (!data || data.length === 0) {
      return DEFAULT_CRM_STAGES;
    }

    return data as CRMStage[];
  } catch (err) {
    console.error("Erro inesperado em getCrmStages:", err);
    return DEFAULT_CRM_STAGES;
  }
}
