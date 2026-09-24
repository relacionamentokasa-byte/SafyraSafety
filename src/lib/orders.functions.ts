import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

/**
 * Busca de pedidos no servidor com Service Role / Auth
 * Garante que a lista de pedidos, métricas e itens sejam carregados sem bloqueios de RLS
 */
export const fetchOrdersServer = createServerFn({ method: "POST" })
  .validator((data: {
    search?: string;
    status?: string;
    page?: number;
    pageSize?: number;
    month?: string;
    year?: string;
    manufacturerId?: string;
  } | undefined) => data || {})
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    const {
      search = '',
      status = 'all',
      page = 0,
      pageSize = 10,
      month = 'all',
      year = 'all',
      manufacturerId = 'all'
    } = data || {};

    let query = supabaseAdmin
      .from('orders')
      .select(`
        *,
        client:clients(id, name, trade_name, legal_name),
        representative:representatives(id, name, photo_url, user_id),
        items:order_items(
          id,
          product_name_snapshot,
          product_sku_snapshot,
          product:products(
            id,
            name,
            sku,
            manufacturer_id,
            manufacturer:manufacturers(id, name, logo_path)
          )
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`order_number.ilike.%${search}%,billing_notes.ilike.%${search}%,commercial_notes.ilike.%${search}%,internal_notes.ilike.%${search}%`);
    }

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    // Filtro por Fabricante
    if (manufacturerId !== 'all') {
      const { data: comms } = await supabaseAdmin
        .from('commissions')
        .select('order_id')
        .eq('manufacturer_id', manufacturerId);

      const { data: items } = await supabaseAdmin
        .from('order_items')
        .select('order_id, product:products(manufacturer_id)');

      const orderIdsSet = new Set<string>();
      comms?.forEach(c => {
        if (c.order_id) orderIdsSet.add(c.order_id);
      });
      items?.forEach(it => {
        if (it.product?.manufacturer_id === manufacturerId && it.order_id) {
          orderIdsSet.add(it.order_id);
        }
      });

      const matchedOrderIds = Array.from(orderIdsSet);
      if (matchedOrderIds.length > 0) {
        query = query.in('id', matchedOrderIds);
      } else {
        query = query.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    }

    // Filtro por Mês e Ano
    if (year !== 'all' && month !== 'all') {
      const y = Number(year);
      const m = Number(month);
      const startDate = new Date(y, m - 1, 1).toISOString();
      const endDate = new Date(y, m, 0, 23, 59, 59, 999).toISOString();
      query = query.gte('created_at', startDate).lte('created_at', endDate);
    } else if (year !== 'all') {
      const y = Number(year);
      const startDate = new Date(y, 0, 1).toISOString();
      const endDate = new Date(y, 11, 31, 23, 59, 59, 999).toISOString();
      query = query.gte('created_at', startDate).lte('created_at', endDate);
    } else if (month !== 'all') {
      const y = new Date().getFullYear();
      const m = Number(month);
      const startDate = new Date(y, m - 1, 1).toISOString();
      const endDate = new Date(y, m, 0, 23, 59, 59, 999).toISOString();
      query = query.gte('created_at', startDate).lte('created_at', endDate);
    }

    const from = page * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data: orders, count, error } = await query;

    if (error) {
      console.error("[fetchOrdersServer] Erro:", error);
      return { data: [], count: 0, stats: [] };
    }

    // Buscar estatísticas dinâmicas aplicando os mesmos filtros de período e fabricante (sem paginação e sem status)
    let statsQuery = supabaseAdmin
      .from('orders')
      .select('total_amount, status, created_at, order_number, billing_notes');

    if (search) {
      statsQuery = statsQuery.or(`order_number.ilike.%${search}%,billing_notes.ilike.%${search}%,commercial_notes.ilike.%${search}%,internal_notes.ilike.%${search}%`);
    }

    if (manufacturerId !== 'all') {
      const { data: comms } = await supabaseAdmin
        .from('commissions')
        .select('order_id')
        .eq('manufacturer_id', manufacturerId);

      const { data: items } = await supabaseAdmin
        .from('order_items')
        .select('order_id, product:products(manufacturer_id)');

      const orderIdsSet = new Set<string>();
      comms?.forEach(c => {
        if (c.order_id) orderIdsSet.add(c.order_id);
      });
      items?.forEach(it => {
        if (it.product?.manufacturer_id === manufacturerId && it.order_id) {
          orderIdsSet.add(it.order_id);
        }
      });

      const matchedOrderIds = Array.from(orderIdsSet);
      if (matchedOrderIds.length > 0) {
        statsQuery = statsQuery.in('id', matchedOrderIds);
      } else {
        statsQuery = statsQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    }

    if (year !== 'all' && month !== 'all') {
      const y = Number(year);
      const m = Number(month);
      const startDate = new Date(y, m - 1, 1).toISOString();
      const endDate = new Date(y, m, 0, 23, 59, 59, 999).toISOString();
      statsQuery = statsQuery.gte('created_at', startDate).lte('created_at', endDate);
    } else if (year !== 'all') {
      const y = Number(year);
      const startDate = new Date(y, 0, 1).toISOString();
      const endDate = new Date(y, 11, 31, 23, 59, 59, 999).toISOString();
      statsQuery = statsQuery.gte('created_at', startDate).lte('created_at', endDate);
    } else if (month !== 'all') {
      const y = new Date().getFullYear();
      const m = Number(month);
      const startDate = new Date(y, m - 1, 1).toISOString();
      const endDate = new Date(y, m, 0, 23, 59, 59, 999).toISOString();
      statsQuery = statsQuery.gte('created_at', startDate).lte('created_at', endDate);
    }

    const { data: dynamicStats } = await statsQuery;

    return {
      data: orders || [],
      count: count || 0,
      stats: dynamicStats || []
    };
  });

/**
 * Busca histórico de pedidos de um cliente específico com Service Role / Auth
 */
export const fetchClientOrdersServer = createServerFn({ method: "POST" })
  .validator((data: { clientId: string }) => data)
  .handler(async ({ data }) => {
    const { clientId } = data;
    if (!clientId) return [];

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        representative:representatives(name)
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("[fetchClientOrdersServer] Erro:", error);
      return [];
    }

    return orders || [];
  });

/**
 * Busca detalhes completos de um pedido com Service Role / Auth
 */
export const fetchOrderDetailsServer = createServerFn({ method: "POST" })
  .validator((data: { orderId: string }) => data)
  .handler(async ({ data }) => {
    const { orderId } = data;
    if (!orderId) return null;

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        client:clients(*),
        representative:representatives(id, name, photo_url),
        opportunity:opportunities(title),
        items:order_items(
          *,
          product:products(name, code, sku, unit)
        ),
        history:order_history(*),
        payments:order_payments(*)
      `)
      .eq('id', orderId)
      .maybeSingle();

    if (error) {
      console.error("[fetchOrderDetailsServer] Erro:", error);
      return null;
    }

    return order;
  });

/**
 * Busca dados completos de BI e Relatórios com Service Role / Auth
 */
export const fetchReportDataServer = createServerFn({ method: "POST" })
  .validator((data: {
    startDate?: string;
    endDate?: string;
    manufacturerFilter?: string;
  } | undefined) => data || {})
  .handler(async ({ data }) => {
    const { startDate, endDate } = data || {};

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    // 1. Pedidos
    let ordersQuery = supabaseAdmin
      .from('orders')
      .select(`
        id,
        order_number,
        client_id,
        total_amount,
        created_at,
        status,
        representative_id,
        client:clients (
          id,
          name,
          trade_name,
          legal_name,
          cnpj,
          city,
          state
        )
      `)
      .neq('status', 'cancelled');

    if (startDate) {
      ordersQuery = ordersQuery.gte('created_at', startDate);
    }
    if (endDate) {
      ordersQuery = ordersQuery.lte('created_at', `${endDate}T23:59:59`);
    }

    const { data: orders, error: errOrders } = await ordersQuery.order('created_at', { ascending: true });

    // 2. Itens dos pedidos (com paginação para garantir que todos os itens sejam retornados sem truncamento de 1000 linhas)
    let allItems: any[] = [];
    let from = 0;
    const batchSize = 1000;

    while (true) {
      let itemsQuery = supabaseAdmin
        .from('order_items')
        .select(`
          id,
          order_id,
          product_id,
          quantity,
          unit_price,
          subtotal,
          product_name_snapshot,
          product_sku_snapshot,
          product:products (
            id,
            name,
            sku,
            manufacturer_id,
            category_id,
            product_categories (name),
            manufacturer:manufacturers (
              id,
              name,
              logo_path
            )
          ),
          order:orders (
            id,
            created_at,
            status,
            client_id,
            client:clients (
              id,
              name,
              trade_name,
              legal_name,
              cnpj,
              city,
              state
            )
          )
        `)
        .range(from, from + batchSize - 1);

      const { data: batch, error: errBatch } = await itemsQuery;
      if (errBatch) {
        console.error("[fetchReportDataServer] Erro ao buscar order_items:", errBatch);
        break;
      }

      if (batch && batch.length > 0) {
        allItems = allItems.concat(batch);
      }

      if (!batch || batch.length < batchSize) {
        break;
      }
      from += batchSize;
    }

    // 3. Clientes para Análise de Churn e Carteira
    const { data: clients } = await supabaseAdmin
      .from('clients')
      .select('id, name, trade_name, legal_name, cnpj, created_at, status');

    // 4. Visitas em Campo
    let visitsQuery = supabaseAdmin
      .from('visits')
      .select('id, client_id, scheduled_at, status');

    if (startDate) {
      visitsQuery = visitsQuery.gte('scheduled_at', startDate);
    }
    if (endDate) {
      visitsQuery = visitsQuery.lte('scheduled_at', endDate);
    }

    const { data: visits } = await visitsQuery;

    // 5. Comissões para cálculo de representatividade
    const { data: commissions } = await supabaseAdmin
      .from('commissions')
      .select('id, order_id, commission_value, status, manufacturer_id');

    return {
      orders: orders || [],
      items: allItems || [],
      clients: clients || [],
      visits: visits || [],
      commissions: commissions || []
    };
  });

/**
 * Busca lista completa de comissões com Service Role / Auth
 */
export const fetchCommissionsServer = createServerFn({ method: "POST" })
  .validator((data: {
    month?: string;
    year?: string;
    status?: string;
    manufacturerId?: string;
  } | undefined) => data || {})
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    const { data: commissions, error } = await supabaseAdmin
      .from('commissions')
      .select(`
        *,
        representative:representatives(
          id,
          name,
          photo_url
        ),
        order_payment:order_payment_id(
          id,
          installment_number,
          due_date,
          received_at,
          order:orders(
            id,
            order_number,
            created_at,
            client:clients(name, trade_name, legal_name)
          )
        ),
        manufacturer:manufacturers(id, name, logo_path, default_commission_rate, payout_day_of_month)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("[fetchCommissionsServer] Erro:", error);
      return [];
    }

    return commissions || [];
  });

/**
 * Busca metas comerciais completas e cálculo em tempo real com Service Role / Auth
 */
export const fetchGoalsServer = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    const { data: goalsData, error: goalsError } = await supabaseAdmin
      .from('goals')
      .select(`
        *,
        representative:representatives(
          id,
          name,
          code,
          photo_url,
          user_id
        )
      `)
      .order('created_at', { ascending: false });

    if (goalsError) {
      console.error("[fetchGoalsServer] Erro:", goalsError);
      return [];
    }

    // Busca pedidos confirmados em tempo real com itens e fabricantes
    const [ordersRes, itemsRes, manufacturersRes] = await Promise.all([
      supabaseAdmin
        .from('orders')
        .select('id, representative_id, total_amount, status, created_at')
        .not('status', 'in', '("cancelled","draft")'),
      supabaseAdmin
        .from('order_items')
        .select('order_id, subtotal, product:products(manufacturer_id)'),
      supabaseAdmin
        .from('manufacturers')
        .select('id, name, trade_name, logo_path')
    ]);

    const ordersData = ordersRes.data || [];
    const itemsData = itemsRes.data || [];
    const manufacturers = manufacturersRes.data || [];
    const manufacturerMap = new Map<string, any>();
    manufacturers.forEach(m => manufacturerMap.set(m.id, m));

    // Mapeia totais de pedidos por fabricante
    const orderManufacturerTotals = new Map<string, Map<string, number>>();
    itemsData.forEach((item: any) => {
      const orderId = item.order_id;
      const mId = item.product?.manufacturer_id;
      if (!orderId || !mId) return;

      if (!orderManufacturerTotals.has(orderId)) {
        orderManufacturerTotals.set(orderId, new Map<string, number>());
      }
      const mTotals = orderManufacturerTotals.get(orderId)!;
      mTotals.set(mId, (mTotals.get(mId) || 0) + Number(item.subtotal || 0));
    });

    return (goalsData || []).map((goal: any) => {
      const matchingOrders = ordersData.filter((o: any) => {
        if (!o.created_at || o.representative_id !== goal.representative_id) return false;
        const orderDate = new Date(o.created_at);
        const orderMonth = orderDate.getMonth() + 1;
        const orderYear = orderDate.getFullYear();
        return orderMonth === Number(goal.month) && orderYear === Number(goal.year);
      });

      let realTimeSales = 0;
      let matchedOrdersCount = 0;

      if (goal.manufacturer_id) {
        matchingOrders.forEach((o: any) => {
          const mTotals = orderManufacturerTotals.get(o.id);
          const mVal = mTotals ? (mTotals.get(goal.manufacturer_id) || 0) : 0;
          if (mVal > 0) {
            realTimeSales += mVal;
            matchedOrdersCount += 1;
          }
        });
      } else {
        realTimeSales = matchingOrders.reduce(
          (sum: number, o: any) => sum + (Number(o.total_amount) || 0),
          0
        );
        matchedOrdersCount = matchingOrders.length;
      }

      const finalAchieved = realTimeSales > 0 ? realTimeSales : (Number(goal.achieved_value) || 0);
      const manufacturerInfo = goal.manufacturer_id ? manufacturerMap.get(goal.manufacturer_id) : null;

      return {
        ...goal,
        achieved_value: finalAchieved,
        orders_count: matchedOrdersCount,
        manufacturer: manufacturerInfo || null
      };
    });
  });

/**
 * Busca lista de representantes com métricas com Service Role / Auth
 */
export const fetchRepresentativesServer = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    const { data, error } = await supabaseAdmin
      .from('representatives')
      .select(`
        *,
        regions(name)
      `)
      .order('created_at', { ascending: true });

    if (error) {
      console.error("[fetchRepresentativesServer] Erro:", error);
      return [];
    }

    if (!data || data.length === 0) return [];

    const userIds = data.map((r: any) => r.user_id).filter(Boolean);
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const [profilesRes, clientsRes, ordersRes, goalsRes] = await Promise.all([
      userIds.length
        ? supabaseAdmin.from('profiles').select('id, full_name, avatar_path').in('id', userIds)
        : { data: [] },
      supabaseAdmin.from('clients').select('id, representative_id'),
      supabaseAdmin.from('orders').select('representative_id, total_amount, status, created_at').not('status', 'in', '("cancelled","draft")'),
      supabaseAdmin.from('goals').select('representative_id, target_value, achieved_value, month, year').eq('month', String(currentMonth)).eq('year', String(currentYear)),
    ]);

    const profileMap: Record<string, { full_name: string | null; avatar_path: string | null }> = {};
    (profilesRes.data ?? []).forEach((p: any) => { profileMap[p.id] = p; });

    return data.map((r: any) => {
      const repClients = (clientsRes.data || []).filter((c: any) => c.representative_id === r.id);
      const clientsCount = repClients.length;

      const monthOrders = (ordersRes.data || []).filter((o: any) => {
        if (o.representative_id !== r.id || !o.created_at) return false;
        const dt = new Date(o.created_at);
        return dt.getMonth() + 1 === currentMonth && dt.getFullYear() === currentYear;
      });

      const currentSales = monthOrders.reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0);
      const repGoal = (goalsRes.data || []).find((g: any) => g.representative_id === r.id);
      const targetValue = repGoal ? Number(repGoal.target_value) : (Number(r.monthly_goal) || 0);
      const goalPercent = targetValue > 0 ? Math.min(100, Math.round((currentSales / targetValue) * 100)) : 0;

      return {
        ...r,
        profiles: profileMap[r.user_id] ?? null,
        clients_count: clientsCount,
        current_sales: currentSales,
        target_value: targetValue,
        goal_percent: goalPercent,
      };
    });
  });

/**
 * Busca detalhes completos de um representante específico com Service Role
 */
export const fetchRepresentativeDetailServer = createServerFn({ method: "POST" })
  .validator((data: { representativeId: string }) => data)
  .handler(async ({ data }) => {
    const { representativeId } = data;
    if (!representativeId) return null;

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    const { data: rep, error: errRep } = await supabaseAdmin
      .from('representatives')
      .select(`
        *,
        regions(name, state)
      `)
      .eq('id', representativeId)
      .maybeSingle();

    if (errRep || !rep) return null;

    let profileData = null;
    if (rep.user_id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, avatar_path')
        .eq('id', rep.user_id)
        .maybeSingle();
      profileData = profile;
    }

    const { data: clients } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('representative_id', representativeId)
      .order('name');

    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        client:clients(name)
      `)
      .eq('representative_id', representativeId)
      .order('created_at', { ascending: false });

    const { data: visits } = await supabaseAdmin
      .from('visits')
      .select(`
        *,
        client:clients(name)
      `)
      .eq('representative_id', representativeId)
      .order('scheduled_at', { ascending: false });

    const { data: followUps } = await supabaseAdmin
      .from('follow_ups')
      .select(`
        *,
        client:clients(name)
      `)
      .eq('representative_id', representativeId)
      .order('scheduled_at', { ascending: false });

    const { data: goals } = await supabaseAdmin
      .from('goals')
      .select('*')
      .eq('representative_id', representativeId)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    // Enriquecer metas com os fabricantes se houver
    const { data: repManufacturers } = await supabaseAdmin
      .from('manufacturers')
      .select('id, name, trade_name, logo_path');

    const repManufacturerMap = new Map<string, any>();
    (repManufacturers || []).forEach(m => repManufacturerMap.set(m.id, m));

    const enrichedGoals = (goals || []).map(g => ({
      ...g,
      manufacturer: g.manufacturer_id ? repManufacturerMap.get(g.manufacturer_id) || null : null
    }));

    const { data: commissions } = await supabaseAdmin
      .from('commissions')
      .select('id, commission_value, status')
      .eq('representative_id', representativeId)
      .neq('status', 'cancelled');

    return {
      representative: {
        ...rep,
        profiles: profileData,
      },
      clients: clients || [],
      orders: orders || [],
      commissions: commissions || [],
      visits: visits || [],
      followUps: followUps || [],
      goals: enrichedGoals
    };
  });

/**
 * Busca dados consolidados de Regiões, Territórios e Distribuição Geográfica com Service Role
 */
export const fetchRegionalAnalyticsServer = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    // 1. Carregar todos os clientes
    const { data: clients, error: errClients } = await supabaseAdmin
      .from('clients')
      .select('id, name, trade_name, legal_name, cnpj, city, state, address, neighborhood, latitude, longitude, status, representative_id')
      .order('name');

    if (errClients) {
      console.error("[fetchRegionalAnalyticsServer] Erro ao buscar clientes:", errClients);
    }

    // 2. Carregar todos os pedidos
    const { data: orders, error: errOrders } = await supabaseAdmin
      .from('orders')
      .select('id, client_id, total_amount, created_at, status, representative_id')
      .neq('status', 'cancelled');

    if (errOrders) {
      console.error("[fetchRegionalAnalyticsServer] Erro ao buscar pedidos:", errOrders);
    }

    // 3. Carregar comissões
    const { data: commissions, error: errCommissions } = await supabaseAdmin
      .from('commissions')
      .select('id, order_id, commission_value, status, manufacturer_id')
      .neq('status', 'cancelled');

    // 4. Carregar regiões cadastradas no banco
    const { data: dbRegions } = await supabaseAdmin
      .from('regions')
      .select('*')
      .order('name');

    return {
      clients: clients || [],
      orders: orders || [],
      commissions: commissions || [],
      dbRegions: dbRegions || []
    };
  });

export const fetchManufacturersServer = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    const { data, error } = await supabaseAdmin
      .from('manufacturers')
      .select('id, name, trade_name, legal_name, cnpj, phone, email, status, default_commission_rate, payout_day_of_month, logo_path')
      .order('name');

    if (error) {
      console.error("[fetchManufacturersServer] Erro ao buscar fabricantes:", error);
      return [];
    }

    return (data || []).map((m: any) => ({
      id: m.id,
      name: m.trade_name || m.name,
      trade_name: m.trade_name,
      legal_name: m.legal_name,
      cnpj: m.cnpj,
      phone: m.phone,
      email: m.email,
      status: m.status,
      default_commission_rate: m.default_commission_rate,
      payout_day_of_month: m.payout_day_of_month,
      logo_path: m.logo_path,
    }));
  });

export const deleteGoalServer = createServerFn({ method: "POST" })
  .validator((data: { goalId: string }) => data)
  .handler(async ({ data }) => {
    const { goalId } = data;
    if (!goalId) throw new Error("ID da meta é obrigatório.");

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    const { error } = await supabaseAdmin
      .from('goals')
      .delete()
      .eq('id', goalId);

    if (error) {
      console.error("[deleteGoalServer] Erro ao excluir meta:", error);
      throw new Error(error.message);
    }

    return { success: true };
  });

export const saveGoalServer = createServerFn({ method: "POST" })
  .validator((data: {
    representativeId: string;
    month: number;
    year: number;
    targetValue: number;
    manufacturerId?: string;
  }) => data)
  .handler(async ({ data }) => {
    const { representativeId, month, year, targetValue } = data;
    if (!representativeId) throw new Error("Representante é obrigatório.");
    if (!month || !year) throw new Error("Mês e ano são obrigatórios.");
    if (!targetValue || targetValue <= 0) throw new Error("Valor da meta deve ser maior que zero.");

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    const payload: any = {
      representative_id: representativeId,
      month: Number(month),
      year: Number(year),
      target_value: Number(targetValue),
      achieved_value: 0
    };

    const { data: newGoal, error } = await supabaseAdmin
      .from('goals')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("[saveGoalServer] Erro ao cadastrar meta:", error);
      throw new Error(error.message);
    }

    return { success: true, goal: newGoal };
  });

export const deleteOrderPermanently = createServerFn({ method: "POST" })
  .validator((data: { orderId: string }) => data)
  .handler(async ({ data }) => {
    const { orderId } = data;
    if (!orderId) throw new Error("ID do pedido é obrigatório.");

    // Tentar primeiro via RPC transacional (SECURITY DEFINER)
    const rpcClient = supabase as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: any; error: any }>;
    };

    const { data: rpcData, error: rpcError } = await rpcClient.rpc('delete_order_permanently', {
      p_order_id: orderId,
    });

    if (!rpcError) {
      return { success: true, data: rpcData };
    }

    // Fallback: caso a RPC ainda não esteja aplicada, executar a limpeza em cascata direta
    console.warn("[deleteOrderPermanently] RPC indisponível ou falhou, tentando limpeza direta:", rpcError);

    // 1. Obter pagamentos para limpar comissões vinculadas
    const { data: payments } = await supabase
      .from('order_payments')
      .select('id')
      .eq('order_id', orderId);

    if (payments && payments.length > 0) {
      const paymentIds = payments.map((p) => p.id);
      await supabase
        .from('commissions')
        .delete()
        .in('order_payment_id', paymentIds);
    }

    // 2. Limpar comissões diretas do pedido
    await supabase
      .from('commissions')
      .delete()
      .eq('order_id', orderId);

    // 3. Limpar order_payments
    await supabase
      .from('order_payments')
      .delete()
      .eq('order_id', orderId);

    // 4. Limpar order_items
    await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId);

    // 5. Limpar order_history (se as permissões permitirem)
    await supabase
      .from('order_history')
      .delete()
      .eq('order_id', orderId);

    // 6. Excluir o pedido da tabela orders
    const { error: orderDeleteError } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (orderDeleteError) {
      throw new Error(orderDeleteError.message || "Erro ao excluir o pedido no banco de dados.");
    }

    return { success: true };
  });

/**
 * Altera o status de um produto (Ativar / Desativar) usando Service Role
 */
export const toggleProductStatusServer = createServerFn({ method: "POST" })
  .validator((data: { productId: string; status: 'active' | 'inactive' }) => data)
  .handler(async ({ data }) => {
    const { productId, status } = data;
    if (!productId) throw new Error("ID do produto é obrigatório.");

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    const { error } = await supabaseAdmin
      .from('products')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', productId);

    if (error) {
      console.error("[toggleProductStatusServer] Erro:", error);
      throw new Error(error.message);
    }

    return { success: true };
  });

/**
 * Duplica um produto no catálogo
 */
export const duplicateProductServer = createServerFn({ method: "POST" })
  .validator((data: { productId: string }) => data)
  .handler(async ({ data }) => {
    const { productId } = data;
    if (!productId) throw new Error("ID do produto é obrigatório.");

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    const { data: original, error: fetchErr } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (fetchErr || !original) {
      throw new Error("Produto não encontrado.");
    }

    const { id, created_at, updated_at, ...rest } = original;
    const newSku = (rest.sku ? `${rest.sku}-COPIA` : `PRD-${Date.now()}`).slice(0, 50);
    const newCode = (rest.code ? `${rest.code}-COPIA` : `COD-${Date.now()}`).slice(0, 50);

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('products')
      .insert({
        ...rest,
        name: `${rest.name} (Cópia)`,
        sku: newSku,
        code: newCode,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertErr) {
      console.error("[duplicateProductServer] Erro ao duplicar:", insertErr);
      throw new Error(insertErr.message);
    }

    return { success: true, product: inserted };
  });

/**
 * Exclui um produto do catálogo
 */
export const deleteProductServer = createServerFn({ method: "POST" })
  .validator((data: { productId: string }) => data)
  .handler(async ({ data }) => {
    const { productId } = data;
    if (!productId) throw new Error("ID do produto é obrigatório.");

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    // Verificar se há itens de pedido associados
    const { count, error: countErr } = await supabaseAdmin
      .from('order_items')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', productId);

    if (count && count > 0) {
      // Se houver pedidos vinculados, desativar ao invés de quebrar chave estrangeira
      const { error: updErr } = await supabaseAdmin
        .from('products')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .eq('id', productId);

      if (updErr) throw new Error(updErr.message);
      return { success: true, archived: true };
    }

    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) {
      console.error("[deleteProductServer] Erro ao excluir:", error);
      throw new Error(error.message);
    }

    return { success: true, archived: false };
  });

/**
 * Retorna todos os produtos do catálogo usando paginação transparente com Service Role
 */
export const fetchAllProductsServer = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    let allProducts: any[] = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabaseAdmin
        .from('products')
        .select(`
          *,
          categories:product_categories(name),
          manufacturers(name, logo_path)
        `)
        .order('name')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error("[fetchAllProductsServer] Erro:", error);
        throw new Error(error.message);
      }

      if (!data || data.length === 0) break;
      allProducts.push(...data);
      if (data.length < pageSize) break;
      page++;
    }

    return allProducts;
  });


