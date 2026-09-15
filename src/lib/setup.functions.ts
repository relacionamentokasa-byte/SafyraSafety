import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const clearSystemDataSchema = z.object({
  confirmation: z.literal("LIMPAR SISTEMA"),
});

type AdminDeleteClient = {
  from: (table: string) => {
    delete: () => {
      neq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

/**
 * Destructive maintenance operation. It is intentionally unavailable without
 * an authenticated admin session and an explicit confirmation phrase.
 */
export const clearSystemData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => clearSystemDataSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    if (roleError) {
      throw new Error(
        `Não foi possível validar a autorização administrativa: ${roleError.message}`,
      );
    }

    if (isAdmin !== true) {
      throw new Error("Apenas administradores podem limpar os dados do sistema");
    }

    const { data: profile, error: profileError } = await context.supabase
      .from("profiles")
      .select("status")
      .eq("id", context.userId)
      .maybeSingle();

    if (profileError) {
      throw new Error(
        `Não foi possível validar o status do administrador: ${profileError.message}`,
      );
    }

    const status = String(profile?.status ?? "").toLowerCase();
    if (status !== "ativo" && status !== "active") {
      throw new Error("O acesso administrativo não está ativo");
    }

    // Keep the phrase check in the server function even though the validator
    // already enforces it, so the destructive precondition is explicit here.
    if (data.confirmation !== "LIMPAR SISTEMA") {
      throw new Error("Confirmação inválida para a limpeza do sistema");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as AdminDeleteClient;
    const tables = [
      "commission_logs",
      "commissions",
      "order_payments",
      "order_installment_logs",
      "order_items",
      "interactions",
      "leads",
      "orders",
      "client_contacts",
      "client_transfer_history",
      "client_representatives",
      "clients",
      "product_photos",
      "commercial_materials",
      "commission_rules",
      "products",
      "categories",
      "manufacturers",
      "representative_regions",
      "regions",
      "notifications",
      "audit_logs",
      "activity_log",
      "access_audit_log",
    ];
    const failures: Array<{ table: string; message: string }> = [];

    console.log("--- LIMPANDO SISTEMA PARA DADOS REAIS ---");

    for (const table of tables) {
      console.log(`Limpando tabela: ${table}`);
      const { error: deleteError } = await admin
        .from(table)
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (deleteError) {
        failures.push({ table, message: deleteError.message });
        console.warn(`Erro ao limpar tabela ${table}:`, deleteError.message);
      }
    }

    if (failures.length > 0) {
      return {
        success: false,
        message: `A limpeza terminou com ${failures.length} falha(s). Nenhum sucesso total foi confirmado.`,
        failures,
      };
    }

    console.log("--- LIMPEZA CONCLUÍDA ---");
    return {
      success: true,
      message: "Sistema limpo com sucesso! Agora você pode começar a inserir os dados reais.",
    };
  });
