import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

/**
 * Busca dados completos e reais do Dashboard com Service Role / Auth
 */
export const fetchDashboardServerData = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    const [
      { data: orders },
      { data: visits },
      { data: commissions }
    ] = await Promise.all([
      supabaseAdmin.from('orders').select('id, total_amount, created_at, status'),
      supabaseAdmin.from('visits').select('id, scheduled_at, status'),
      supabaseAdmin.from('commissions').select(`
        id,
        commission_value,
        status,
        created_at,
        paid_at,
        manufacturer:manufacturers(name, payout_day_of_month),
        order_payment:order_payment_id(due_date, received_at)
      `)
    ]);

    return {
      orders: orders || [],
      visits: visits || [],
      commissions: commissions || []
    };
  });

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
