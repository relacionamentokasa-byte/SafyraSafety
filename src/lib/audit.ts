import { supabase } from "@/integrations/supabase/client";

export const auditService = {
  async log(action: string, targetUserId?: string, details?: any) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Apenas registrar na tabela de auditoria se houver usuário autenticado
      if (!user) {
        return;
      }

      const { error } = await supabase
        .from('access_audit_log' as any)
        .insert({
          performed_by: user.id,
          target_user_id: targetUserId || user.id,
          action,
          details: details || {},
        });

      if (error) {
        // Silenciar erro em ambiente de desenvolvimento sem bloquear fluxo
        console.warn('Audit Log Notice:', error.message);
      }
    } catch (error) {
      console.warn('Audit Log Notice:', error);
    }
  }
};
