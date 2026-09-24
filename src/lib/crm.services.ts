import { supabase } from "@/integrations/supabase/client";
import { CRMStage } from "@/types/database.types";
import { createServerFn } from "@tanstack/react-start";

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

/**
 * Server function para criar oportunidade com Service Role / Auth
 * Evita bloqueios de RLS no frontend
 */
export const createOpportunityServer = createServerFn({ method: "POST" })
  .validator((data: {
    title: string;
    client_id: string;
    representative_id: string;
    stage_id: string;
    estimated_value?: number;
    probability?: number;
    origin: string;
    expected_closing_date?: string | null;
    description?: string | null;
  }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    const { data: inserted, error } = await supabaseAdmin
      .from('opportunities')
      .insert([{
        title: data.title,
        client_id: data.client_id,
        representative_id: data.representative_id,
        stage_id: data.stage_id,
        estimated_value: data.estimated_value || 0,
        probability: data.probability ?? 50,
        origin: data.origin,
        expected_closing_date: data.expected_closing_date || null,
        description: data.description || null,
        status: 'open',
      }])
      .select()
      .single();

    if (error) {
      console.error("[createOpportunityServer] Erro ao criar oportunidade:", error);
      throw new Error(error.message || "Erro ao criar oportunidade no banco.");
    }

    return inserted;
  });

/**
 * Server function para mover oportunidade entre etapas (Drag & Drop / Kanban)
 */
export const updateOpportunityStageServer = createServerFn({ method: "POST" })
  .validator((data: { id: string; stageId: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    const { error } = await supabaseAdmin
      .from('opportunities')
      .update({
        stage_id: data.stageId,
        updated_at: new Date().toISOString()
      })
      .eq('id', data.id);

    if (error) {
      console.error("[updateOpportunityStageServer] Erro ao atualizar etapa:", error);
      throw new Error(error.message || "Erro ao mover oportunidade.");
    }

    return { success: true };
  });


