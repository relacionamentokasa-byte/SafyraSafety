import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export const getAggregatedDashboardStats = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Chamamos a função RPC get_dashboard_stats que criamos na migração
    const { data, error } = await supabase.rpc('get_dashboard_stats', {
      _user_id: user?.id
    });

    if (error) throw error;
    return data as {
      total_sales: number;
      orders_today: number;
      active_clients: number;
      pending_visits: number;
      new_clients_month: number;
    };
  });
